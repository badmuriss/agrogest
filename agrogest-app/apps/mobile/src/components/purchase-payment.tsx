import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ToggleGroup } from '@/components/fields';
import { AccountPicker, CounterpartyField } from '@/components/finance-ui';
import { monthlyInstallments } from '@/domain/allocation';
import { addDays, formatDate } from '@/domain/dates';
import { METHOD_LABEL, PART_LABEL, planInstallments, PURCHASE_PARTS, purchasePartCents } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import type { Installment, Lot, PaymentMethod, PurchasePartKind, PurchasePlan } from '@/domain/types';
import { useApp, type PaidAtPurchase } from '@/state/app-state';
import { space } from '@/theme';

import { Chip, ChipWrap } from './ui/controls';
import { DateField } from './ui/form';
import { Card, KV, ListRow } from './ui/layout';
import { AppText } from './ui/text';

export type PartMode = 'pago' | 'avista' | 'parcelado';

export interface PartDraft {
  kind: PurchasePartKind;
  counterparty: string;
  counterpartyId: string | null;
  mode: PartMode;
  dueDate: string;
  count: number;
  accountId: string | null;
  paidAt: string;
  method: PaymentMethod;
}

const PAY_METHODS: PaymentMethod[] = ['pix', 'transferencia', 'boleto', 'dinheiro', 'cheque'];

/** Rascunho de cada parte com valor: do plano já salvo, ou "a pagar em 30 dias" para começar. */
export function initialDrafts(lot: Lot, firstAccountId: string | null): PartDraft[] {
  return PURCHASE_PARTS.filter((kind) => purchasePartCents(lot, kind) > 0).map((kind) => {
    const saved = lot.purchasePlan?.parts.find((p) => p.kind === kind);
    return {
      kind,
      counterparty: saved?.counterparty ?? (kind === 'animais' ? lot.supplier : ''),
      counterpartyId: saved?.counterpartyId ?? null,
      mode: saved ? (saved.installments.length > 1 ? 'parcelado' : 'avista') : 'avista',
      dueDate: saved?.installments[0]?.dueDate ?? addDays(lot.purchasedAt, 30),
      count: Math.max(2, saved?.installments.length ?? 2),
      accountId: firstAccountId,
      paidAt: lot.purchasedAt,
      method: 'pix',
    };
  });
}

function installmentsOf(lot: Lot, d: PartDraft): Installment[] {
  const cents = purchasePartCents(lot, d.kind);
  if (d.mode === 'pago') return [{ dueDate: d.paidAt, cents }];
  if (d.mode === 'avista') return [{ dueDate: d.dueDate, cents }];
  return monthlyInstallments(cents, d.count, d.dueDate);
}

/** Plano de pagamento e as parcelas pagas no ato (que viram baixas). */
export function buildPurchase(lot: Lot, drafts: PartDraft[]): { plan: PurchasePlan; paid: PaidAtPurchase[]; error: string | null } {
  const plan: PurchasePlan = {
    parts: drafts.map((d) => ({ kind: d.kind, counterparty: d.counterparty.trim(), counterpartyId: d.counterpartyId, installments: installmentsOf(lot, d) })),
  };
  const flat = planInstallments(plan);
  const paid: PaidAtPurchase[] = [];
  for (const d of drafts) {
    if (d.mode !== 'pago') continue;
    if (!d.accountId) return { plan, paid, error: `Escolha a conta de onde saiu o pagamento de ${PART_LABEL[d.kind].toLowerCase()}.` };
    paid.push({ index: flat.findIndex((x) => x.kind === d.kind), accountId: d.accountId, paidAt: d.paidAt, method: d.method });
  }
  return { plan, paid, error: null };
}

/**
 * Como cada parte da compra foi ou será paga: já paga (com a conta, vira baixa), à vista numa
 * data ou parcelada. Cada parte pode ser paga a uma pessoa diferente.
 */
export function PurchasePaymentEditor({ lot, drafts, onChange }: { lot: Lot; drafts: PartDraft[]; onChange: (drafts: PartDraft[]) => void }) {
  const set = (i: number, patch: Partial<PartDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <View style={styles.parts}>
      {drafts.map((d, i) => {
        const cents = purchasePartCents(lot, d.kind);
        const installments = installmentsOf(lot, d);
        return (
          <Card key={d.kind} style={styles.card}>
            <View style={styles.row}>
              <AppText variant="heading" style={styles.flex}>
                {PART_LABEL[d.kind]}
              </AppText>
              <AppText variant="bodyStrong" numeric>
                {formatCents(cents)}
              </AppText>
            </View>
            <CounterpartyField
              operationId={lot.operationId}
              kind="fornecedor"
              label={d.kind === 'animais' ? 'Vendedor' : d.kind === 'comissao' ? 'Corretor' : 'Transportadora'}
              name={d.counterparty}
              counterpartyId={d.counterpartyId}
              onChange={(counterparty, counterpartyId) => set(i, { counterparty, counterpartyId })}
            />
            <ToggleGroup<PartMode>
              accessibilityLabel={`Pagamento de ${PART_LABEL[d.kind]}`}
              options={[
                { value: 'pago', label: 'Já pago' },
                { value: 'avista', label: 'A pagar' },
                { value: 'parcelado', label: 'Parcelado' },
              ]}
              value={d.mode}
              onChange={(mode) => set(i, { mode })}
            />
            {d.mode === 'pago' ? (
              <>
                <AccountPicker operationId={lot.operationId} value={d.accountId} onChange={(accountId) => set(i, { accountId })} />
                <DateField label="Pago em" value={d.paidAt} onChange={(paidAt) => set(i, { paidAt })} />
                <ChipWrap>
                  {PAY_METHODS.map((m) => (
                    <Chip key={m} label={METHOD_LABEL[m]} selected={d.method === m} onPress={() => set(i, { method: m })} />
                  ))}
                </ChipWrap>
                <AppText variant="caption" tone="muted">
                  Sai da conta nesta data e a parcela já fica quitada.
                </AppText>
              </>
            ) : (
              <>
                {d.mode === 'parcelado' ? (
                  <ChipWrap>
                    {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <Chip key={n} label={`${n}x`} selected={d.count === n} onPress={() => set(i, { count: n })} />
                    ))}
                  </ChipWrap>
                ) : null}
                <DateField label={d.mode === 'parcelado' ? 'Primeiro vencimento' : 'Vencimento'} value={d.dueDate} onChange={(dueDate) => set(i, { dueDate })} />
                {installments.length > 1 ? (
                  <View>
                    {installments.map((item, k) => (
                      <KV key={k} label={`${k + 1}ª · ${formatDate(item.dueDate)}`} value={formatCents(item.cents)} />
                    ))}
                  </View>
                ) : null}
                <AppText variant="caption" tone="muted">
                  Vira conta a pagar, com aviso de vencimento.
                </AppText>
              </>
            )}
          </Card>
        );
      })}
    </View>
  );
}

/** Na tela do lote: quanto da compra está pago, ou o convite para informar o pagamento. */
export function PurchasePaymentRow({ lot }: { lot: Lot }) {
  const app = useApp();
  const total = lot.purchaseCents + lot.commissionCents + lot.freightCents;
  if (total <= 0 || lot.transfer?.incoming || !app.canSeeFinance(lot.operationId)) return null;
  const open = () => router.push({ pathname: '/lote/pagamento/[id]', params: { id: lot.id } });
  if (!lot.purchasePlan) {
    return (
      <ListRow
        icon="cash-clock"
        iconTone="warning"
        title="Informar como a compra foi paga"
        subtitle="Vira conta a pagar e entra no caixa da conta"
        onPress={open}
      />
    );
  }
  const views = app.allInstallments.filter((v) => v.entryId === lot.id);
  const paid = views.reduce((acc, v) => acc + v.paidCents, 0);
  const due = views.reduce((acc, v) => acc + v.openCents, 0);
  const overdue = views.some((v) => v.state === 'vencida');
  return (
    <ListRow
      icon={due === 0 ? 'cash-check' : 'cash-clock'}
      iconTone={due === 0 ? 'success' : overdue ? 'danger' : 'neutral'}
      title={due === 0 ? 'Compra quitada' : `${formatCents(due)} a pagar${overdue ? ' · vencida' : ''}`}
      subtitle={`Pagamento da compra · ${formatCents(paid)} pago`}
      onPress={open}
    />
  );
}

const styles = StyleSheet.create({
  parts: { gap: space.lg },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
