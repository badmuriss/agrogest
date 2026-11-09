import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FieldInput, FormField, MoneyInput } from '@/components/fields';
import { CounterpartyField } from '@/components/finance-ui';
import { Button, Chip, ChipWrap, Note } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { ACCOUNT_KIND_LABEL, FINANCING_LINE_LABEL, METHOD_LABEL } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import { MOVEMENT_ACCOUNTS, MOVEMENT_LABEL, movementErrors, PARTNER_MOVEMENTS, releasedCents, type MovementInput } from '@/domain/treasury';
import type { MovementKind, PaymentMethod } from '@/domain/types';
import { useApp } from '@/state/app-state';

const KINDS = Object.keys(MOVEMENT_LABEL) as MovementKind[];
const METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[];

const HELP: Record<MovementKind, string> = {
  transferencia: 'Dinheiro de uma conta para outra da operação. Não é receita nem despesa. Para pagar a fatura do cartão, escolha o cartão como destino.',
  aporte: 'O sócio põe dinheiro na operação. Entra no caixa e no saldo do sócio; não é receita.',
  retirada: 'O sócio tira dinheiro da operação. Sai do caixa e do saldo do sócio; não é despesa.',
  distribuicao: 'Parte do lucro paga ao sócio. Sai do caixa; não muda o resultado.',
  liberacao: 'O banco libera o financiamento na conta. Entra no caixa; não é receita. As parcelas viram contas a pagar.',
  adiantamento: 'O cliente (ex.: frigorífico) adianta parte do pagamento. Entra no caixa e é compensado depois, ao receber a venda.',
};

/** Movimentação entre contas, com sócios, de financiamento ou adiantamento de cliente. */
export default function MovimentoScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ tipo?: MovementKind; operacao?: string; de?: string; para?: string; fatura?: string; valor?: string; socio?: string; financiamento?: string }>();
  const preset = params.para ? app.accounts.find((a) => a.id === params.para) : params.de ? app.accounts.find((a) => a.id === params.de) : undefined;
  const operationId =
    preset?.operationId ?? params.operacao ?? app.financings.find((f) => f.id === params.financiamento)?.operationId ??
    app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId ?? '';
  const [kind, setKind] = useState<MovementKind>(params.tipo && MOVEMENT_LABEL[params.tipo] ? params.tipo : 'transferencia');
  const [fromAccountId, setFrom] = useState<string | null>(params.de ?? null);
  const [toAccountId, setTo] = useState<string | null>(params.para ?? null);
  const [partnerId, setPartner] = useState<string | null>(params.socio ?? null);
  const [financingId, setFinancing] = useState<string | null>(params.financiamento ?? null);
  const [counterparty, setCounterparty] = useState('');
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [cents, setCents] = useState(params.valor ? Number(params.valor) || 0 : 0);
  const [occurredAt, setDate] = useState(app.today);
  const [method, setMethod] = useState<PaymentMethod>('transferencia');
  const [proof, setProof] = useState('');
  const [notes, setNotes] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!operationId || !app.canSeeFinance(operationId)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="Somente um sócio da operação movimenta as contas." />
      </Screen>
    );
  }

  const shape = MOVEMENT_ACCOUNTS[kind];
  const accounts = app.accounts.filter((a) => a.operationId === operationId && a.active);
  const toCard = app.accounts.find((a) => a.id === toAccountId)?.kind === 'cartao';
  const invoice = kind === 'transferencia' && toCard
    ? (params.fatura ?? app.invoices.filter((i) => i.accountId === toAccountId && i.openCents > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.month ?? null)
    : null;
  const partners = app.partnersOf(operationId);
  const financings = app.financings.filter((f) => f.operationId === operationId);
  const input: MovementInput = {
    operationId,
    kind,
    fromAccountId: shape.from ? fromAccountId : null,
    toAccountId: shape.to ? toAccountId : null,
    partnerId: PARTNER_MOVEMENTS.includes(kind) ? partnerId : null,
    financingId: kind === 'liberacao' ? financingId : null,
    counterparty: kind === 'adiantamento' ? counterparty : kind === 'liberacao' ? (financings.find((f) => f.id === financingId)?.bank ?? '') : '',
    counterpartyId: kind === 'adiantamento' ? counterpartyId : null,
    invoiceMonth: invoice,
    cents,
    occurredAt,
    method,
    proof,
    notes,
  };
  const error = movementErrors(input, app.accounts, app.today, { partners: partners.map((p) => p.id), financings: app.financings, movements: app.movements });

  const save = async () => {
    setTried(true);
    setFailure(null);
    if (error) return;
    setBusy(true);
    try {
      await app.registerMovement(input);
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível registrar.');
      setBusy(false);
    }
  };

  const accountList = (value: string | null, onChange: (id: string) => void, exclude: string | null, allowCard: boolean) => (
    <Group>
      {accounts
        .filter((a) => a.id !== exclude && (allowCard || a.kind !== 'cartao'))
        .map((a) => (
          <ListRow
            key={a.id}
            icon={a.kind === 'cartao' ? 'credit-card-outline' : a.kind === 'caixa' ? 'cash' : 'bank-outline'}
            title={a.name}
            subtitle={`${ACCOUNT_KIND_LABEL[a.kind]} · ${a.kind === 'cartao' ? 'fatura' : 'saldo'} ${formatCents(Math.abs(app.accountBalance(a.id)))}`}
            selected={value === a.id}
            onPress={() => onChange(a.id)}
            chevron={false}
          />
        ))}
    </Group>
  );

  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : `Registrar · ${formatCents(cents)}`} icon="check" size="lg" disabled={busy} onPress={save} />}>
      <FormField label="O que aconteceu">
        <ChipWrap>
          {KINDS.map((k) => (
            <Chip key={k} label={MOVEMENT_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ChipWrap>
      </FormField>
      <AppText variant="caption" tone="muted">
        {HELP[kind]}
      </AppText>

      {PARTNER_MOVEMENTS.includes(kind) ? (
        <Section title="Sócio">
          <Group>
            {partners.map((p) => (
              <ListRow
                key={p.id}
                icon="account-outline"
                title={p.name}
                subtitle={p.sharePct !== null ? `${p.sharePct}% de participação` : undefined}
                selected={partnerId === p.id}
                onPress={() => setPartner(p.id)}
                chevron={false}
              />
            ))}
          </Group>
        </Section>
      ) : null}

      {kind === 'liberacao' ? (
        <Section title="Financiamento">
          {financings.length === 0 ? (
            <Note boxed icon="bank-transfer-in" title="Cadastre o contrato primeiro">
              <Button title="Cadastrar financiamento" variant="secondary" icon="plus" onPress={() => router.push({ pathname: '/financeiro/financiamento/novo', params: { operacao: operationId } })} />
            </Note>
          ) : (
            <Group>
              {financings.map((f) => (
                <ListRow
                  key={f.id}
                  icon="bank-transfer-in"
                  title={`${f.bank} · ${FINANCING_LINE_LABEL[f.line]}`}
                  subtitle={`${formatCents(f.releasedCents - releasedCents(f.id, app.movements))} a liberar`}
                  selected={financingId === f.id}
                  onPress={() => setFinancing(f.id)}
                  chevron={false}
                />
              ))}
            </Group>
          )}
        </Section>
      ) : null}

      {kind === 'adiantamento' ? (
        <CounterpartyField
          operationId={operationId}
          kind="cliente"
          label="Quem adiantou"
          name={counterparty}
          counterpartyId={counterpartyId}
          onChange={(name, id) => {
            setCounterparty(name);
            setCounterpartyId(id);
          }}
        />
      ) : null}

      {shape.from ? (
        <Section title={kind === 'transferencia' ? 'Sai de' : 'Conta de onde sai'}>{accountList(fromAccountId, setFrom, toAccountId, false)}</Section>
      ) : null}
      {shape.to ? (
        <Section title={kind === 'transferencia' ? 'Vai para' : 'Conta onde entra'}>{accountList(toAccountId, setTo, fromAccountId, kind === 'transferencia')}</Section>
      ) : null}
      {invoice ? <Note icon="credit-card-check-outline">{`Paga a fatura ${invoice.slice(5, 7)}/${invoice.slice(0, 4)} do cartão.`}</Note> : null}

      <FormField label="Valor">
        <MoneyInput cents={cents} onChange={setCents} accessibilityLabel="Valor" />
      </FormField>
      <DateField label="Data" value={occurredAt} onChange={setDate} />
      <FormField label="Forma">
        <ChipWrap>
          {METHODS.map((m) => (
            <Chip key={m} label={METHOD_LABEL[m]} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </ChipWrap>
      </FormField>
      <FormField label="Comprovante (opcional)">
        <FieldInput value={proof} onChangeText={setProof} maxLength={200} autoCapitalize="characters" />
      </FormField>
      <FormField label="Observação (opcional)">
        <FieldInput value={notes} onChangeText={setNotes} multiline maxLength={500} />
      </FormField>
      {!app.online ? <Note icon="cloud-off-outline">Sem internet: fica na fila. Ao sincronizar, o servidor confere as contas e o sócio.</Note> : null}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline" title="Não foi possível registrar">
          {failure}
        </Note>
      ) : tried && error ? (
        <Note boxed tone="warning" icon="alert-outline">
          {error}
        </Note>
      ) : null}
    </Screen>
  );
}
