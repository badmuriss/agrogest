import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField, MoneyInput, ToggleGroup } from '@/components/fields';
import { AccountPicker, dueText } from '@/components/finance-ui';
import { Button, Chip, ChipWrap, Note } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { Card, Divider, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { advanceBalance, METHOD_LABEL, paymentErrors, paymentTotal, type InstallmentView, type PaymentInput } from '@/domain/finance';
import { formatDate } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import type { PartnerMode, PaymentDirection, PaymentMethod } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[];

/**
 * Baixa de uma ou mais parcelas da mesma operação. Quem pagou registra; não precisa de segunda
 * aprovação porque a conta já foi aprovada. O caixa muda; o custo e a competência, não.
 */
export default function BaixaScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ parcelas?: string; direcao?: PaymentDirection }>();
  const ids = (params.parcelas ?? '').split(',').filter(Boolean);
  const views = ids
    .map((id) => app.allInstallments.find((v) => v.id === id))
    .filter((v): v is InstallmentView => v !== undefined && v.openCents > 0 && v.source !== 'fatura');
  const operationId = views[0]?.operationId ?? '';
  const direction: PaymentDirection = views[0]?.direction ?? params.direcao ?? 'pagar';
  // Sugere uma conta de caixa; o cartão é escolhido de propósito.
  const firstAccount = (app.accounts.find((a) => a.operationId === operationId && a.active && a.kind !== 'cartao') ?? app.accounts.find((a) => a.operationId === operationId && a.active))?.id ?? null;

  const [accountId, setAccountId] = useState<string | null>(firstAccount);
  const [source, setSource] = useState<'conta' | 'socio' | 'adiantamento'>('conta');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerMode, setPartnerMode] = useState<PartnerMode>('reembolso');
  const [advanceId, setAdvanceId] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState(app.today);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [amounts, setAmounts] = useState<Record<string, number>>(() => Object.fromEntries(views.map((v) => [v.id, v.openCents])));
  const [interestCents, setInterest] = useState(0);
  const [fineCents, setFine] = useState(0);
  const [discountCents, setDiscount] = useState(0);
  const [proof, setProof] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (views.length === 0 || views.some((v) => v.operationId !== operationId) || !app.canSeeFinance(operationId)) {
    return (
      <Screen>
        <EmptyState icon="cash-check" title="Nada em aberto para baixar" message="As parcelas escolhidas já foram quitadas ou não são da mesma operação." />
      </Screen>
    );
  }

  const chosenAccount = accountId ?? firstAccount;
  const partners = app.partnersOf(operationId);
  const advances = app.movements
    .filter((m) => m.operationId === operationId && m.kind === 'adiantamento' && (m.status === 'efetivado' || m.status === 'aguardando_envio'))
    .map((m) => ({ movement: m, left: advanceBalance(m, app.payments) }))
    .filter((x) => x.left > 0);
  const input: PaymentInput = {
    operationId,
    direction,
    accountId: source === 'conta' ? (chosenAccount ?? '') : null,
    partnerId: source === 'socio' ? partnerId : null,
    partnerMode: source === 'socio' ? partnerMode : null,
    advanceId: source === 'adiantamento' ? advanceId : null,
    paidAt,
    items: views.map((v) => ({ entryId: v.entryId, index: v.index, cents: amounts[v.id] ?? 0 })),
    interestCents,
    fineCents,
    discountCents,
    method,
    proof,
    notes,
  };
  const formError =
    paymentErrors(input, app.accounts, app.today, { partners: partners.map((p) => p.id), movements: app.movements, payments: app.payments }) ??
    (views.find((v) => (amounts[v.id] ?? 0) > v.openCents) ? 'O valor de uma parcela passou do que está em aberto.' : null);
  const total = paymentTotal(input);
  const partial = views.some((v) => (amounts[v.id] ?? 0) < v.openCents);

  const save = async () => {
    setTried(true);
    setFailure(null);
    if (formError) return;
    setBusy(true);
    try {
      await app.registerPayment(input);
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível registrar a baixa.');
      setBusy(false);
    }
  };

  const verb = direction === 'pagar' ? 'pagamento' : 'recebimento';
  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : `Registrar ${verb} · ${formatCents(Math.max(0, total))}`} icon="check" size="lg" disabled={busy} onPress={save} />}>
      <Section title={views.length > 1 ? 'Parcelas' : 'Parcela'}>
        {views.map((v) => (
          <Card key={v.id} style={styles.card}>
            <AppText variant="bodyStrong">
              {v.title}
              {v.count > 1 ? ` · ${v.position}/${v.count}` : ''}
            </AppText>
            <AppText variant="caption" tone="muted">
              {[v.counterparty || null, dueText(v), `${formatCents(v.openCents)} em aberto`].filter(Boolean).join(' · ')}
            </AppText>
            <FormField label={views.length > 1 ? 'Valor quitado desta parcela' : 'Valor quitado'} hint={(amounts[v.id] ?? 0) < v.openCents ? 'Pagamento parcial: o resto continua em aberto.' : undefined}>
              <MoneyInput cents={amounts[v.id] ?? 0} onChange={(cents) => setAmounts({ ...amounts, [v.id]: cents })} accessibilityLabel={`Valor quitado de ${v.title}`} />
            </FormField>
          </Card>
        ))}
      </Section>

      {direction === 'pagar' || advances.length > 0 ? (
        <ToggleGroup
          accessibilityLabel="De onde veio o dinheiro"
          options={
            direction === 'pagar'
              ? [
                  { value: 'conta', label: 'Conta da operação' },
                  { value: 'socio', label: 'Um sócio pagou' },
                ]
              : [
                  { value: 'conta', label: 'Entrou na conta' },
                  { value: 'adiantamento', label: 'Compensar adiantamento' },
                ]
          }
          value={source}
          onChange={setSource}
        />
      ) : null}
      {source === 'conta' ? <AccountPicker operationId={operationId} value={chosenAccount} onChange={setAccountId} /> : null}
      {source === 'socio' ? (
        <Section title="Quem pagou com dinheiro próprio">
          <Group>
            {partners.map((p) => (
              <ListRow key={p.id} icon="account-cash-outline" title={p.name} selected={partnerId === p.id} onPress={() => setPartnerId(p.id)} chevron={false} />
            ))}
          </Group>
          <ToggleGroup<PartnerMode>
            accessibilityLabel="Como fica"
            options={[
              { value: 'reembolso', label: 'Reembolsar o sócio' },
              { value: 'aporte', label: 'Fica como aporte' },
            ]}
            value={partnerMode}
            onChange={setPartnerMode}
          />
          <AppText variant="caption" tone="muted">
            {partnerMode === 'reembolso'
              ? 'A parcela fica paga e a operação passa a dever o valor ao sócio: o reembolso aparece em contas a pagar.'
              : 'A parcela fica paga e o valor entra como aporte do sócio na operação. Nenhuma conta da operação muda.'}
          </AppText>
        </Section>
      ) : null}
      {source === 'adiantamento' ? (
        <Section title="Adiantamento a compensar">
          <Group>
            {advances.map(({ movement, left }) => (
              <ListRow
                key={movement.id}
                icon="cash-fast"
                title={movement.counterparty}
                subtitle={`${formatDate(movement.occurredAt)} · ${formatCents(left)} a compensar`}
                selected={advanceId === movement.id}
                onPress={() => setAdvanceId(movement.id)}
                chevron={false}
              />
            ))}
          </Group>
          <AppText variant="caption" tone="muted">O dinheiro entrou quando o cliente adiantou; aqui só a conta a receber é quitada.</AppText>
        </Section>
      ) : null}
      <DateField label={direction === 'pagar' ? 'Data do pagamento' : 'Data do recebimento'} value={paidAt} onChange={setPaidAt} />
      <FormField label="Forma">
        <ChipWrap>
          {METHODS.map((m) => (
            <Chip key={m} label={METHOD_LABEL[m]} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </ChipWrap>
      </FormField>

      <Section title="Acréscimos e desconto (opcional)">
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField label="Juros">
              <MoneyInput cents={interestCents} onChange={setInterest} accessibilityLabel="Juros" />
            </FormField>
          </View>
          <View style={styles.flex}>
            <FormField label="Multa">
              <MoneyInput cents={fineCents} onChange={setFine} accessibilityLabel="Multa" />
            </FormField>
          </View>
        </View>
        <FormField label="Desconto">
          <MoneyInput cents={discountCents} onChange={setDiscount} accessibilityLabel="Desconto" />
        </FormField>
      </Section>

      <FormField label="Comprovante (opcional)" hint="Nº de autenticação, ID do Pix ou do boleto. O arquivo ainda não é enviado.">
        <FieldInput value={proof} onChangeText={setProof} placeholder="Ex.: E0000000020261020..." maxLength={200} autoCapitalize="characters" />
      </FormField>
      <FormField label="Observação (opcional)">
        <FieldInput value={notes} onChangeText={setNotes} multiline maxLength={500} />
      </FormField>

      <Card>
        <KV label="Parcelas quitadas" value={formatCents(input.items.reduce((acc, i) => acc + i.cents, 0))} />
        {interestCents + fineCents > 0 ? <KV label="Juros e multa" value={`+ ${formatCents(interestCents + fineCents)}`} /> : null}
        {discountCents > 0 ? <KV label="Desconto" value={`− ${formatCents(discountCents)}`} /> : null}
        <Divider />
        <KV label={direction === 'pagar' ? 'Sai da conta' : 'Entra na conta'} value={formatCents(Math.max(0, total))} strong />
      </Card>
      <Note icon="information-outline">
        {`O ${verb} muda o caixa na data informada. A despesa continua na competência de quando aconteceu${partial ? '; o que faltar segue em aberto' : ''}.`}
      </Note>
      {!app.online ? (
        <Note icon="cloud-off-outline">Sem internet: a baixa fica na fila. Ao sincronizar, o servidor confere se o valor ainda está em aberto.</Note>
      ) : null}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline" title="Não foi possível registrar">
          {failure}
        </Note>
      ) : tried && formError ? (
        <Note boxed tone="warning" icon="alert-outline">
          {formError}
        </Note>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
