import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CounterpartyField } from '@/components/finance-ui';
import { FieldInput, FormField, MoneyInput } from '@/components/fields';
import { FarmPicker } from '@/components/pickers';
import { Button, Chip, ChipWrap, Note, SwitchRow } from '@/components/ui/controls';
import { EmptyState, Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { EXPENSE_NATURES, STOCK_CATEGORY_ID } from '@/domain/finance';
import { recurrenceErrors, type RecurrenceInput } from '@/domain/treasury';
import { CostCenterField } from '@/components/cost-center-field';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const toMonthText = (month: string | null) => (month ? `${month.slice(5, 7)}/${month.slice(0, 4)}` : '');
const fromMonthText = (text: string) => {
  const match = /^(\d{2})\/(\d{4})$/.exec(text.trim());
  const month = match ? `${match[2]}-${match[1]}` : '';
  return MONTH.test(month) ? month : null;
};

/** Modelo de despesa recorrente: valor, dia do vencimento e meses em que vale. */
export default function RecorrenciaScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string; operacao?: string }>();
  const current = params.id ? app.recurrences.find((r) => r.id === params.id) : undefined;
  const operationId = current?.operationId ?? params.operacao ?? app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId ?? '';
  const [input, setInput] = useState<RecurrenceInput>(() => ({
    farmId: current?.farmId ?? app.scopedFarms.find((f) => f.operationId === operationId)?.id ?? app.defaultFarmId,
    title: current?.title ?? '',
    categoryId: current?.categoryId ?? 'cat-administrativas',
    costCenterId: current?.costCenterId ?? null,
    counterparty: current?.counterparty ?? '',
    counterpartyId: current?.counterpartyId ?? null,
    cents: current?.cents ?? 0,
    dayOfMonth: current?.dayOfMonth ?? 10,
    startMonth: current?.startMonth ?? app.today.slice(0, 7),
    endMonth: current?.endMonth ?? null,
    active: current?.active ?? true,
  }));
  const [startText, setStartText] = useState(toMonthText(input.startMonth));
  const [endText, setEndText] = useState(toMonthText(input.endMonth));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!operationId || !app.canSeeFinance(operationId) || (params.id && !current)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="Somente um sócio da operação cadastra despesas recorrentes." />
      </Screen>
    );
  }
  const set = (patch: Partial<RecurrenceInput>) => setInput({ ...input, ...patch });
  const options = app.categories.filter(
    (c) => c.active && EXPENSE_NATURES.includes(c.nature) && c.id !== STOCK_CATEGORY_ID && c.nature !== 'aquisicao_estoque' && (c.operationId === null || c.operationId === operationId),
  );
  const value: RecurrenceInput = { ...input, startMonth: fromMonthText(startText) ?? '', endMonth: endText.trim() ? (fromMonthText(endText) ?? 'inválido') : null };
  const error = recurrenceErrors(value, app.categories);

  const save = async () => {
    setTried(true);
    setFailure(null);
    if (error) return;
    setBusy(true);
    try {
      await app.saveRecurrence(operationId, value, current?.id);
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : current ? 'Salvar alterações' : 'Cadastrar'} icon="check" size="lg" disabled={busy} onPress={save} />}>
      <FormField label="Despesa">
        <FieldInput value={input.title} onChangeText={(title) => set({ title })} placeholder="Ex.: Energia da sede" maxLength={120} autoCapitalize="sentences" />
      </FormField>
      <FormField label="Valor de cada mês">
        <MoneyInput cents={input.cents} onChange={(cents) => set({ cents })} accessibilityLabel="Valor de cada mês" />
      </FormField>
      <FormField label="Categoria">
        <ChipWrap>
          {options.map((c) => (
            <Chip key={c.id} label={c.name} selected={input.categoryId === c.id} onPress={() => set({ categoryId: c.id })} />
          ))}
        </ChipWrap>
      </FormField>
      <CostCenterField operationId={operationId} value={input.costCenterId ?? null} onChange={(costCenterId) => set({ costCenterId })} />
      <FarmPicker value={input.farmId} onChange={(farmId) => set({ farmId })} />
      <CounterpartyField
        operationId={operationId}
        kind="fornecedor"
        label="Fornecedor"
        name={input.counterparty}
        counterpartyId={input.counterpartyId}
        onChange={(counterparty, counterpartyId) => set({ counterparty, counterpartyId })}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <FormField label="Dia do vencimento">
            <FieldInput
              value={String(input.dayOfMonth || '')}
              onChangeText={(t) => set({ dayOfMonth: Number(t.replace(/\D/g, '')) || 0 })}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="1 a 28"
            />
          </FormField>
        </View>
        <View style={styles.flex}>
          <FormField label="A partir de">
            <FieldInput value={startText} onChangeText={setStartText} placeholder="mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={7} />
          </FormField>
        </View>
      </View>
      <FormField label="Até (opcional)" hint="Em branco, continua todo mês.">
        <FieldInput value={endText} onChangeText={setEndText} placeholder="mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={7} />
      </FormField>
      {current ? (
        <SwitchRow label="Ativa" description={input.active ? 'Os meses seguem aparecendo como previstos.' : 'Pausada: os meses não lançados somem da previsão.'} value={input.active} onValueChange={(active) => set({ active })} />
      ) : null}
      <Note icon="information-outline">Os meses aparecem como despesas previstas no fluxo de caixa e nos avisos. Lançar o mês cria a despesa, que segue para aprovação.</Note>
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
