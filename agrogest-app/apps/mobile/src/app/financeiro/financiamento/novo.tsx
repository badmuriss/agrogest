import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccountPicker } from '@/components/finance-ui';
import { FieldInput, FormField, MoneyInput } from '@/components/fields';
import { FarmPicker } from '@/components/pickers';
import { Button, Chip, ChipWrap, Note, SwitchRow } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { Card, Divider, EmptyState, KV, Screen, Section } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { addMonths, formatDate } from '@/domain/dates';
import { FINANCING_LINE_LABEL } from '@/domain/finance';
import { formatCents, parseDecimal } from '@/domain/format';
import { financingErrors, sacSchedule, type FinancingInput } from '@/domain/treasury';
import type { FinancingLine } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const LINES = Object.keys(FINANCING_LINE_LABEL) as FinancingLine[];
const FREQUENCIES: { months: number; label: string }[] = [
  { months: 1, label: 'Mensal' },
  { months: 6, label: 'Semestral' },
  { months: 12, label: 'Anual' },
];

/**
 * Cadastro do contrato com o cronograma de parcelas (amortização + juros). O cronograma sugerido é
 * SAC com carência de juros; confira com o contrato do banco antes de salvar.
 */
export default function NovoFinanciamentoScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ operacao?: string }>();
  const operationId = params.operacao ?? app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId ?? '';
  const [farmId, setFarmId] = useState(app.scopedFarms.find((f) => f.operationId === operationId)?.id ?? app.defaultFarmId);
  const [bank, setBank] = useState('');
  const [line, setLine] = useState<FinancingLine>('custeio');
  const [contract, setContract] = useState('');
  const [releasedCents, setReleased] = useState(0);
  const [rateText, setRateText] = useState('');
  const [graceMonths, setGrace] = useState(0);
  const [count, setCount] = useState(2);
  const [frequency, setFrequency] = useState(12);
  const [firstDue, setFirstDue] = useState(addMonths(app.today, 12));
  const [guarantees, setGuarantees] = useState('');
  const [notes, setNotes] = useState('');
  const [releaseNow, setReleaseNow] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(app.accounts.find((a) => a.operationId === operationId && a.active && a.kind !== 'cartao')?.id ?? null);
  const [releasedAt, setReleasedAt] = useState(app.today);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!operationId || !app.canSeeFinance(operationId)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="Somente um sócio da operação cadastra financiamentos." />
      </Screen>
    );
  }

  const ratePct = rateText.trim() ? parseDecimal(rateText) : null;
  const schedule = sacSchedule(releasedCents, ratePct ?? 0, firstDue, count, graceMonths, frequency);
  const input: FinancingInput = { farmId, bank, line, contract, releasedCents, ratePct, graceMonths, guarantees, notes, schedule };
  const error = financingErrors(input) ?? (releaseNow && !accountId ? 'Escolha a conta onde o dinheiro entrou.' : null);

  const save = async () => {
    setTried(true);
    setFailure(null);
    if (error) return;
    setBusy(true);
    try {
      const saved = await app.saveFinancing(operationId, input, releaseNow && accountId ? { accountId, occurredAt: releasedAt, cents: releasedCents } : undefined);
      haptics.success();
      router.replace({ pathname: '/financeiro/financiamento/[id]', params: { id: saved.id } });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : 'Cadastrar financiamento'} icon="check" size="lg" disabled={busy} onPress={save} />}>
      <FarmPicker value={farmId} onChange={setFarmId} />
      <FormField label="Banco ou instituição">
        <FieldInput value={bank} onChangeText={setBank} placeholder="Ex.: Banco do Brasil" maxLength={100} />
      </FormField>
      <FormField label="Linha">
        <ChipWrap>
          {LINES.map((l) => (
            <Chip key={l} label={FINANCING_LINE_LABEL[l]} selected={line === l} onPress={() => setLine(l)} />
          ))}
        </ChipWrap>
      </FormField>
      <FormField label="Nº do contrato (opcional)">
        <FieldInput value={contract} onChangeText={setContract} maxLength={60} />
      </FormField>
      <FormField label="Valor contratado">
        <MoneyInput cents={releasedCents} onChange={setReleased} accessibilityLabel="Valor contratado" />
      </FormField>
      <View style={styles.row}>
        <View style={styles.flex}>
          <FormField label="Taxa (% ao ano)">
            <FieldInput value={rateText} onChangeText={setRateText} keyboardType="decimal-pad" placeholder="Ex.: 8,5" maxLength={6} />
          </FormField>
        </View>
        <View style={styles.flex}>
          <FormField label="Carência (meses)">
            <FieldInput value={graceMonths ? String(graceMonths) : ''} onChangeText={(t) => setGrace(Number(t.replace(/\D/g, '')) || 0)} keyboardType="number-pad" maxLength={3} placeholder="0" />
          </FormField>
        </View>
      </View>

      <Section title="Cronograma">
        <FormField label="Parcelas">
          <ChipWrap>
            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 24, 36, 60].map((n) => (
              <Chip key={n} label={String(n)} selected={count === n} onPress={() => setCount(n)} />
            ))}
          </ChipWrap>
        </FormField>
        <FormField label="Periodicidade">
          <ChipWrap>
            {FREQUENCIES.map((f) => (
              <Chip key={f.months} label={f.label} selected={frequency === f.months} onPress={() => setFrequency(f.months)} />
            ))}
          </ChipWrap>
        </FormField>
        <DateField label={graceMonths > 0 ? 'Primeiro vencimento (juros da carência)' : 'Primeiro vencimento'} value={firstDue} onChange={setFirstDue} />
        {schedule.length > 0 ? (
          <Card>
            {schedule.map((item, i) => (
              <KV
                key={i}
                label={`${i + 1}ª · ${formatDate(item.dueDate)}`}
                value={formatCents(item.principalCents + item.interestCents)}
                hint={`${formatCents(item.principalCents)} amortização + ${formatCents(item.interestCents)} juros`}
              />
            ))}
            <Divider />
            <KV label="Total de juros" value={formatCents(schedule.reduce((acc, i) => acc + i.interestCents, 0))} />
          </Card>
        ) : null}
        <AppText variant="caption" tone="faint">Sugestão em SAC com juros sobre o saldo. Se o contrato do banco for diferente, ajuste a taxa, a carência ou as parcelas até bater.</AppText>
      </Section>

      <FormField label="Garantias (opcional)">
        <FieldInput value={guarantees} onChangeText={setGuarantees} maxLength={500} placeholder="Ex.: penhor do rebanho, aval dos sócios" />
      </FormField>
      <FormField label="Observação (opcional)">
        <FieldInput value={notes} onChangeText={setNotes} maxLength={500} multiline />
      </FormField>

      <SwitchRow label="O dinheiro já foi liberado" description="Registra a liberação na conta: entra no caixa, sem ser receita." value={releaseNow} onValueChange={setReleaseNow} />
      {releaseNow ? (
        <>
          <AccountPicker operationId={operationId} value={accountId} onChange={setAccountId} />
          <DateField label="Data da liberação" value={releasedAt} onChange={setReleasedAt} />
        </>
      ) : (
        <Note icon="information-outline">Quando o banco liberar, registre em Movimentar › Liberação de financiamento.</Note>
      )}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline" title="Não foi possível salvar">
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
