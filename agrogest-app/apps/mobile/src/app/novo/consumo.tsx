import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField, ToggleGroup } from '@/components/fields';
import { FarmPicker } from '@/components/pickers';
import { SupplyPicker } from '@/components/stock-ui';
import { Note, Segmented } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { Card, Divider, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { DoneState, StepHeader, WizardNav } from '@/components/wizard';
import { CRITERION_LABEL } from '@/domain/allocation';
import { addDays, formatDate } from '@/domain/dates';
import { formatCents, formatNumber, parseDecimal } from '@/domain/format';
import { consumptionAllocations, consumptionTargets, formatQty, stockConflict, stockLedger, UNIT_LABEL } from '@/domain/stock';
import type { AllocationCriterion, Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const STEPS = ['Qual insumo?', 'Quanto e quando?', 'Quais lotes consumiram?', 'Confira'];

/**
 * Consumo do dia a dia (ex.: 5 sacos de sal na semana). Baixa o estoque e leva o custo médio
 * para os lotes, rateado pela composição na data ou pela cabeça-dia do período.
 */
export default function ConsumoScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'consumo' ? existing : undefined;

  const [step, setStep] = useState(0);
  const [farmId, setFarmId] = useState(initial?.farmId ?? app.defaultFarmId);
  const [supplyId, setSupplyId] = useState<string | null>(initial?.payload.supplyId ?? null);
  const [quantityText, setQuantityText] = useState(initial ? formatNumber(initial.payload.quantity, 3) : '');
  const [date, setDate] = useState(initial?.occurredAt ?? app.today);
  const [period, setPeriod] = useState(initial?.payload.periodStart ? 'periodo' : 'dia');
  const [periodStart, setPeriodStart] = useState(initial?.payload.periodStart ?? addDays(app.today, -6));
  const [criterion, setCriterion] = useState<AllocationCriterion>(initial?.payload.criterion ?? 'cabeca');
  const [selectedIds, setSelectedIds] = useState<string[] | null>(initial ? initial.payload.targets.map((t) => t.lotId) : null);
  const [manualPct, setManualPct] = useState<Record<string, string>>(() =>
    initial?.payload.criterion === 'manual' ? Object.fromEntries(initial.payload.targets.map((t) => [t.lotId, String(t.basis)])) : {},
  );
  const [notes, setNotes] = useState(initial?.payload.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<Entry | null>(null);

  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Outro consumo" onAgain={() => router.replace('/novo/consumo')} />
      </Screen>
    );
  }

  const farm = app.farm(farmId);
  const supply = supplyId ? app.supply(supplyId) : undefined;
  const quantity = parseDecimal(quantityText) ?? 0;
  const start = period === 'periodo' ? periodStart : null;
  // Lotes da fazenda que tinham animais em algum dia do período (ou na data).
  const lots = app.farmLotSummaries(farmId).map((s) => s.lot);
  const candidates = consumptionTargets(lots, app.visibleEntries, 'cabeca', date, start, {}).targets.map((t) => t.lotId);
  const chosen = selectedIds ?? candidates;
  const pct = Object.fromEntries(Object.entries(manualPct).map(([id, text]) => [id, parseDecimal(text) ?? 0]));
  const result = consumptionTargets(lots.filter((l) => chosen.includes(l.id)), app.visibleEntries, criterion, date, start, pct);
  const position = supply ? app.stock([farmId]).find((p) => p.supply.id === supply.id) : undefined;
  const showValue = farm ? app.canSeeFinance(farm.operationId) : false;

  const candidate = {
    id: initial?.id ?? 'novo-consumo',
    kind: 'consumo',
    status: 'aguardando_aprovacao',
    operationId: farm?.operationId ?? '',
    farmId,
    authorId: app.user.id,
    title: supply ? `Consumo de ${supply.name}` : 'Consumo',
    amountCents: null,
    occurredAt: date,
    createdAt: new Date().toISOString(),
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    pendingDecision: null,
    pendingDecisionBy: null,
    pendingDecisionNote: null,
    conflictReason: null,
    history: [],
    payload: { supplyId: supplyId ?? '', quantity, periodStart: start, criterion, targets: result.targets, notes: notes.trim() },
  } satisfies Entry;
  const names = { supply: (id: string) => app.supply(id), farm: (id: string) => app.farm(id)?.name ?? 'esta fazenda' };
  const conflict = supply && quantity > 0 ? stockConflict(app.visibleEntries, candidate, 'reserva', names) : null;
  const costCents = supply && quantity > 0 && !conflict
    ? (stockLedger(app.visibleEntries, supply.id, 'confirmado', undefined, candidate).outflowCents.get(candidate.id) ?? 0)
    : 0;
  const allocations = consumptionAllocations(costCents, result.targets);
  const basisLabel = (basis: number) =>
    criterion === 'manual' ? `${formatNumber(basis, 2)}%` : criterion === 'peso' ? `${formatNumber(basis)} kg` : start ? `${formatNumber(basis)} cab.-dia` : `${formatNumber(basis)} cab.`;

  const canNext = [
    !!farm && !!supply,
    quantity > 0 && date <= app.today && !conflict && (!start || start <= date),
    result.error === null,
    true,
  ][step];

  const save = async (submit: boolean) => {
    if (!farm || !supply) return;
    setBusy(true);
    setFailure(null);
    try {
      const entry = await app.saveEntry(
        {
          kind: 'consumo',
          payload: candidate.payload,
          operationId: farm.operationId,
          farmId: farm.id,
          title: candidate.title,
          amountCents: null,
          occurredAt: date,
        },
        { submit, existingId: initial?.id },
      );
      setSaved(entry);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar o consumo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <WizardNav
          step={step}
          last={STEPS.length - 1}
          canNext={canNext}
          onStep={setStep}
          busy={busy}
          onSave={save}
          scope={farm ? { operationId: farm.operationId, kind: 'consumo' } : undefined}
        />
      }>
      <StepHeader steps={STEPS} current={step} />
      <FadeIn key={step}>
        {step === 0 ? (
          <>
            <FarmPicker value={farmId} onChange={(id) => { setFarmId(id); setSupplyId(null); setSelectedIds(null); }} />
            {farm ? <SupplyPicker farmId={farm.id} value={supplyId} onChange={setSupplyId} /> : null}
          </>
        ) : null}

        {step === 1 && supply ? (
          <>
            <FormField
              label={`Quantidade (${UNIT_LABEL[supply.unit]?.[1] ?? supply.unit})`}
              hint={position ? `${formatQty(position.available, supply.unit)} disponíveis em ${farm?.name ?? 'estoque'}.` : undefined}
              error={conflict}>
              <FieldInput value={quantityText} onChangeText={setQuantityText} keyboardType="decimal-pad" placeholder="Ex.: 5" suffix={supply.unit} />
            </FormField>
            <ToggleGroup
              accessibilityLabel="Quando foi consumido"
              options={[
                { value: 'dia', label: 'Num dia' },
                { value: 'periodo', label: 'Num período' },
              ]}
              value={period}
              onChange={setPeriod}
            />
            {period === 'periodo' ? (
              <>
                <DateField label="De" value={periodStart} onChange={setPeriodStart} />
                <DateField label="Até" value={date} onChange={setDate} />
                <Note>O rateio usa a cabeça-dia de cada lote no período: quem ficou mais dias leva mais custo.</Note>
              </>
            ) : (
              <DateField label="Quando" value={date} onChange={setDate} />
            )}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Segmented
              accessibilityLabel="Critério do rateio"
              options={(['cabeca', 'peso', 'manual'] as AllocationCriterion[]).map((value) => ({ value, label: CRITERION_LABEL[value] }))}
              value={criterion}
              onChange={setCriterion}
            />
            {candidates.length === 0 ? (
              <Note tone="warning" icon="alert-outline">
                Nenhum lote desta fazenda tinha animais nesta data.
              </Note>
            ) : (
              <Group>
                {lots
                  .filter((l) => candidates.includes(l.id))
                  .map((lot) => {
                    const target = result.targets.find((t) => t.lotId === lot.id);
                    const on = chosen.includes(lot.id);
                    return (
                      <View key={lot.id}>
                        <ListRow
                          icon={on ? 'checkbox-marked' : 'checkbox-blank-outline'}
                          iconTone={on ? 'accent' : 'neutral'}
                          title={`Origem ${lot.code}`}
                          subtitle={on && target ? basisLabel(target.basis) : 'Fora do rateio'}
                          chevron={false}
                          onPress={() => setSelectedIds(on ? chosen.filter((id) => id !== lot.id) : [...chosen, lot.id])}
                        />
                        {on && criterion === 'manual' ? (
                          <View style={styles.pct}>
                            <FieldInput
                              accessibilityLabel={`Percentual da origem ${lot.code}`}
                              value={manualPct[lot.id] ?? ''}
                              onChangeText={(text) => setManualPct({ ...manualPct, [lot.id]: text })}
                              keyboardType="decimal-pad"
                              suffix="%"
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
              </Group>
            )}
            {result.error && chosen.length > 0 ? (
              <AppText variant="caption" tone="danger">
                {result.error}
              </AppText>
            ) : null}
            <FormField label="Observação (opcional)">
              <FieldInput value={notes} onChangeText={setNotes} placeholder="Ex.: cocho do pasto 3" maxLength={500} />
            </FormField>
          </>
        ) : null}

        {step === 3 && supply && farm ? (
          <>
            <Card>
              <KV label="Insumo" value={supply.name} />
              <KV label="Quantidade" value={formatQty(quantity, supply.unit)} strong />
              <KV label={start ? 'Período' : 'Data'} value={start ? `${formatDate(start)} a ${formatDate(date)}` : formatDate(date)} />
              <KV label="Fazenda" value={farm.name} />
              {showValue ? (
                <>
                  <Divider />
                  <KV label="Custo pelo custo médio" value={formatCents(costCents)} strong hint={position ? `${formatCents(position.avgCostCents)}/${supply.unit}` : undefined} />
                </>
              ) : null}
            </Card>
            <Section title={`Rateio · ${CRITERION_LABEL[criterion].toLowerCase()}`}>
              <Card>
                {allocations.map((a) => (
                  <KV
                    key={a.lotId}
                    label={`Origem ${lots.find((l) => l.id === a.lotId)?.code ?? ''}`}
                    hint={basisLabel(a.basis)}
                    value={showValue ? `+ ${formatCents(a.cents)}` : ''}
                  />
                ))}
              </Card>
            </Section>
            <Note icon="information-outline">
              O estoque baixa quando o consumo for aprovado. O valor vem das compras já aprovadas e pode mudar se uma compra anterior for aprovada depois.
            </Note>
            {failure ? (
              <Note boxed tone="danger" icon="alert-circle-outline">
                {failure}
              </Note>
            ) : null}
          </>
        ) : null}
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pct: { paddingHorizontal: space.lg, paddingBottom: space.sm },
});
