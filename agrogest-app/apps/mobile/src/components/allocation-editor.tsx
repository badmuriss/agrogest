import { View } from 'react-native';

import { buildAllocations, type AllocationResult } from '@/domain/allocation';
import { formatCents, formatNumber, parseDecimal } from '@/domain/format';
import type { LotSummary } from '@/domain/lot-metrics';
import type { Allocation, AllocationCriterion } from '@/domain/types';
import { useApp } from '@/state/app-state';

import { pastureLabel } from './rows';

import { Segmented } from './ui/controls';
import { TextField } from './ui/form';
import { Card, Divider, Group, KV, ListRow, Section } from './ui/layout';
import { AppText } from './ui/text';

export interface AllocationState {
  criterion: AllocationCriterion;
  selectedIds: string[];
  manualPct: Record<string, string>;
}

export function initialAllocationState(
  lots: LotSummary[],
  allocations?: Allocation[],
  criterion?: AllocationCriterion,
): AllocationState {
  if (allocations && allocations.length > 0) {
    return {
      criterion: criterion ?? 'cabeca',
      selectedIds: allocations.map((a) => a.lotId),
      manualPct: criterion === 'manual' ? Object.fromEntries(allocations.map((a) => [a.lotId, String(a.basis)])) : {},
    };
  }
  return { criterion: 'cabeca', selectedIds: lots.map((s) => s.lot.id), manualPct: {} };
}

export function resolveAllocation(lots: LotSummary[], totalCents: number, state: AllocationState): AllocationResult {
  const targets = lots
    .filter((s) => state.selectedIds.includes(s.lot.id))
    .map((s) => ({ lotId: s.lot.id, heads: s.headsCurrent, avgWeightKg: s.lastWeighing.kg }));
  const pct = Object.fromEntries(
    Object.entries(state.manualPct).map(([lotId, text]) => [lotId, parseDecimal(text) ?? 0]),
  );
  return buildAllocations(totalCents, state.criterion, targets, pct);
}

const CRITERIA: { value: AllocationCriterion; label: string }[] = [
  { value: 'cabeca', label: 'Por cabeça' },
  { value: 'peso', label: 'Por peso' },
  { value: 'manual', label: 'Manual' },
];

/** Rateio com simulação antes da confirmação (RF-09). */
export function AllocationEditor({
  lots,
  totalCents,
  state,
  onChange,
}: {
  lots: LotSummary[];
  totalCents: number;
  state: AllocationState;
  onChange: (state: AllocationState) => void;
}) {
  const app = useApp();
  const result = resolveAllocation(lots, totalCents, state);
  const allocatedTotal = result.allocations.reduce((acc, a) => acc + a.cents, 0);
  const selected = lots.filter((s) => state.selectedIds.includes(s.lot.id));
  const usesEstimate = state.criterion === 'peso' && selected.some((s) => s.lastWeighing.method === 'estimado');

  const toggle = (lotId: string) =>
    onChange({
      ...state,
      selectedIds: state.selectedIds.includes(lotId)
        ? state.selectedIds.filter((id) => id !== lotId)
        : [...state.selectedIds, lotId],
    });

  const basisLabel = (s: LotSummary, basis: number) => {
    if (state.criterion === 'cabeca') return `${basis} cab.`;
    if (state.criterion === 'peso') {
      const approx = s.lastWeighing.method === 'estimado' ? '≈' : '';
      return `${s.headsCurrent} × ${approx}${formatNumber(s.lastWeighing.kg)} kg`;
    }
    return `${formatNumber(basis, 2)}%`;
  };

  return (
    <>
      <Section title="Lotes que recebem o custo">
        <Group>
          {lots.map((s) => (
            <ListRow
              key={s.lot.id}
              title={`Origem ${s.lot.code}`}
              subtitle={`${s.headsCurrent} cab. · ${pastureLabel(app, s)}`}
              selected={state.selectedIds.includes(s.lot.id)}
              onPress={() => toggle(s.lot.id)}
            />
          ))}
        </Group>
        {selected.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Sem lotes, o valor fica como despesa geral da fazenda.
          </AppText>
        ) : null}
      </Section>

      {selected.length > 0 ? (
        <Section title="Critério">
          <Segmented
            accessibilityLabel="Critério de rateio"
            options={CRITERIA}
            value={state.criterion}
            onChange={(criterion) => onChange({ ...state, criterion })}
          />
          {state.criterion === 'manual'
            ? selected.map((s) => (
                <View key={s.lot.id} style={{ gap: 6 }}>
                  <AppText variant="caption" tone="muted">
                    Origem {s.lot.code}
                  </AppText>
                  <TextField
                    keyboardType="decimal-pad"
                    suffix="%"
                    placeholder="0"
                    value={state.manualPct[s.lot.id] ?? ''}
                    onChangeText={(text) => onChange({ ...state, manualPct: { ...state.manualPct, [s.lot.id]: text } })}
                  />
                </View>
              ))
            : null}
          <Card>
            {result.allocations.map((a) => {
              const s = lots.find((l) => l.lot.id === a.lotId)!;
              return <KV key={a.lotId} label={`Origem ${s.lot.code}`} hint={basisLabel(s, a.basis)} value={formatCents(a.cents)} />;
            })}
            <Divider />
            <KV label="Total" value={`${formatCents(allocatedTotal)} de ${formatCents(totalCents)}`} strong />
            {result.error ? (
              <AppText variant="caption" tone="danger">
                {result.error}
              </AppText>
            ) : totalCents > 0 ? (
              <AppText variant="caption" tone="success">
                Fecha no centavo{result.adjustedCents > 0 ? ` (${result.adjustedCents} ¢ de arredondamento)` : ''}.
              </AppText>
            ) : null}
            {usesEstimate ? (
              <AppText variant="caption" tone="warning">
                Usa peso estimado (≈) em pelo menos um lote.
              </AppText>
            ) : null}
          </Card>
        </Section>
      ) : null}
    </>
  );
}
