import { addDays, addMonths } from './dates';
import { formatNumber } from './format';
import type { Allocation, AllocationCriterion, Installment } from './types';

export const CRITERION_LABEL: Record<AllocationCriterion, string> = {
  cabeca: 'Por cabeça',
  peso: 'Por peso vivo',
  manual: 'Manual (%)',
};

/**
 * Divide `totalCents` proporcionalmente a `weights` pelo método do maior resto.
 * A soma das partes fecha exatamente com o total (RN-05): o rateio nunca cria nem perde centavos.
 */
export function splitCents(
  totalCents: number,
  weights: number[],
): { shares: number[]; adjustedCents: number } {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (totalCents <= 0 || sum <= 0) return { shares: weights.map(() => 0), adjustedCents: 0 };

  const exact = weights.map((w) => (totalCents * w) / sum);
  const shares = exact.map((value) => Math.floor(value));
  const leftover = totalCents - shares.reduce((acc, s) => acc + s, 0);
  exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .slice(0, leftover)
    .forEach(({ index }) => {
      shares[index] += 1;
    });
  return { shares, adjustedCents: leftover };
}

export interface AllocationTarget {
  lotId: string;
  heads: number;
  avgWeightKg: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  error: string | null;
  /** Centavos distribuídos pelo arredondamento (informativo). */
  adjustedCents: number;
}

export function buildAllocations(
  totalCents: number,
  criterion: AllocationCriterion,
  targets: AllocationTarget[],
  manualPct: Record<string, number>,
): AllocationResult {
  if (targets.length === 0) return { allocations: [], error: null, adjustedCents: 0 };

  const basis = targets.map((t) => {
    if (criterion === 'cabeca') return t.heads;
    if (criterion === 'peso') return Math.round(t.heads * t.avgWeightKg);
    return manualPct[t.lotId] ?? 0;
  });

  if (criterion === 'manual') {
    const sum = basis.reduce((acc, b) => acc + b, 0);
    if (Math.abs(sum - 100) > 0.001) {
      return {
        allocations: targets.map((t, i) => ({ lotId: t.lotId, cents: 0, basis: basis[i] })),
        error: `Os percentuais somam ${formatNumber(sum, 2)}%. Eles precisam somar 100%.`,
        adjustedCents: 0,
      };
    }
  }

  const { shares, adjustedCents } = splitCents(totalCents, basis);
  return {
    allocations: targets.map((t, i) => ({ lotId: t.lotId, cents: shares[i], basis: basis[i] })),
    error: null,
    adjustedCents,
  };
}

/** Parcelas mensais; os centavos que sobram ficam nas primeiras parcelas. */
export function monthlyInstallments(totalCents: number, count: number, firstDue: string): Installment[] {
  const { shares } = splitCents(totalCents, Array.from({ length: count }, () => 1));
  return shares.map((cents, i) => ({ dueDate: addMonths(firstDue, i), cents }));
}

/** Parcelas por prazo em dias a partir da emissão (ex.: "30/60 dias"). */
export function termInstallments(totalCents: number, issuedAt: string, termsInDays: number[]): Installment[] {
  const { shares } = splitCents(totalCents, termsInDays.map(() => 1));
  return shares.map((cents, i) => ({ dueDate: addDays(issuedAt, termsInDays[i]), cents }));
}
