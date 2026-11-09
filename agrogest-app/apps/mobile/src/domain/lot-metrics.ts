import { carcassArrobas, saleGrossCents } from './cattle';
import { daysBetween, monthLabel } from './dates';
import type { Allocation, AllocationCriterion, Entry, Farm, Lot, WeightMethod } from './types';

export interface WeighingPoint {
  date: string;
  kg: number;
  method: WeightMethod;
  heads: number;
  /** null para o peso de entrada da compra. */
  entryId: string | null;
}

export interface ExpenseItem {
  entryId: string;
  title: string;
  date: string;
  cents: number;
  criterion: AllocationCriterion;
}

export interface SaleResult {
  entryId: string;
  date: string;
  buyer: string;
  heads: number;
  carcassKg: number;
  arrobas: number;
  pricePerArrobaCents: number;
  grossCents: number;
  deductionsCents: number;
  /** Custo médio por cabeça da origem na data da venda × cabeças vendidas. */
  soldCostCents: number;
  realResultCents: number;
  /** Aluguel simbólico dos vendidos: cabeça-dia desde a compra (mês = 30 dias). */
  pastureRentCents: number;
  adjustedResultCents: number;
}

export interface LotSummary {
  lot: Lot;
  headsCurrent: number;
  headsSold: number;
  headsDead: number;
  weighings: WeighingPoint[];
  lastWeighing: WeighingPoint;
  gmdKg: number | null;
  gmdEstimated: boolean;
  acquisitionCents: number;
  expensesCents: number;
  expenseItems: ExpenseItem[];
  /** Tudo que o lote já custou, inclusive a parte dos animais vendidos. */
  totalCostCents: number;
  /** Custo que permanece com os animais remanescentes. */
  remainingCostCents: number;
  costPerHeadCents: number;
  sales: SaleResult[];
  revenueCents: number;
  realResultCents: number;
  adjustedResultCents: number;
  arrobasSold: number;
  /** Aluguel simbólico acumulado de todo o lote até hoje. Nunca é caixa (RN-10). */
  pastureRentAccruedCents: number;
  /** Cabeça-dia acumulada desde a entrada até hoje (base do custo por cabeça/mês). */
  headDays: number;
  /** Lançamentos ainda não aprovados que afetam o lote; não entram nos números. */
  pendingCount: number;
}

/** Compra de insumos para o estoque: obrigação financeira, mas ainda não é custo de lote. */
export function isStockPurchase(entry: Entry): boolean {
  return (entry.kind === 'despesa' || entry.kind === 'nota_fiscal') && entry.payload.destination === 'estoque';
}

/**
 * Custo apropriado aos lotes. Compra para o estoque não entra; o consumo entra pelo custo
 * derivado em `costEntries` (domain/stock.ts), vazio enquanto não foi calculado.
 */
export function lotAllocations(entry: Entry): Allocation[] {
  if (entry.kind === 'despesa') return isStockPurchase(entry) ? [] : entry.payload.allocations;
  if (entry.kind === 'nota_fiscal' && entry.payload.destination === 'despesa') return entry.payload.allocations;
  if (entry.kind === 'consumo') return entry.derivedAllocations ?? [];
  return [];
}

export function entryLotIds(entry: Entry): string[] {
  switch (entry.kind) {
    case 'pesagem':
    case 'mortalidade':
    case 'venda':
    case 'manejo':
      return [entry.payload.lotId];
    case 'consumo':
      return entry.payload.targets.map((t) => t.lotId);
    default:
      return lotAllocations(entry).map((a) => a.lotId);
  }
}

export function byOccurrence(a: Entry, b: Entry): number {
  return a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt);
}

/** Índices e resumos pertencem a uma leitura dos dados; uma nova leitura cria outro cache. */
export function createLotSummarizer(lots: Lot[], entries: Entry[], farms: Farm[], today: string) {
  const byId = new Map(lots.map((lot) => [lot.id, lot]));
  const rentByFarm = new Map(farms.map((farm) => [farm.id, farm.pastureRentCents]));
  const byLot = new Map<string, Entry[]>();
  for (const entry of entries) {
    for (const lotId of new Set(entryLotIds(entry))) {
      const related = byLot.get(lotId) ?? [];
      related.push(entry);
      byLot.set(lotId, related);
    }
  }
  const summaries = new Map<string, LotSummary>();
  return (lotId: string): LotSummary | undefined => {
    const lot = byId.get(lotId);
    if (!lot) return undefined;
    let summary = summaries.get(lotId);
    if (!summary) {
      summary = summarizeLot(lot, byLot.get(lotId) ?? [], rentByFarm.get(lot.farmId) ?? 0, today);
      summaries.set(lotId, summary);
    }
    return summary;
  };
}

/**
 * Reconstrói o estado do lote a partir dos lançamentos aprovados, em ordem cronológica.
 * Custeio: custo médio por cabeça dentro da origem (RF-09, a validar com o produtor).
 * Mortalidade: o custo dos animais perdidos fica com os remanescentes (premissa do protótipo).
 */
export function summarizeLot(
  lot: Lot,
  entries: Entry[],
  pastureRentCents: number,
  today: string,
): LotSummary {
  const related = entries.filter((e) => entryLotIds(e).includes(lot.id));
  const approved = related.filter((e) => e.status === 'aprovado').sort(byOccurrence);
  const pendingCount = related.filter((e) => e.status !== 'aprovado' && e.status !== 'rejeitado').length;

  const acquisitionCents = lot.purchaseCents + lot.commissionCents + lot.freightCents;
  const weighings: WeighingPoint[] = [
    { date: lot.purchasedAt, kg: lot.entryWeightKg, method: lot.transfer?.incoming?.weightMethod ?? 'medido', heads: lot.headsPurchased, entryId: null },
  ];
  const expenseItems: ExpenseItem[] = [];
  const sales: SaleResult[] = [];

  let heads = lot.headsPurchased;
  let pool = acquisitionCents;
  let headsDead = 0;
  let headDays = 0;
  let cursor = lot.purchasedAt;

  for (const entry of approved) {
    if (entry.occurredAt > cursor) {
      headDays += heads * daysBetween(cursor, entry.occurredAt);
      cursor = entry.occurredAt;
    }
    switch (entry.kind) {
      case 'pesagem':
        weighings.push({
          date: entry.occurredAt,
          kg: entry.payload.avgWeightKg,
          method: entry.payload.method,
          heads: entry.payload.headsWeighed,
          entryId: entry.id,
        });
        break;
      case 'despesa':
      case 'nota_fiscal':
      case 'consumo': {
        const share = lotAllocations(entry).find((a) => a.lotId === lot.id);
        if (share) {
          pool += share.cents;
          expenseItems.push({
            entryId: entry.id,
            title: entry.title,
            date: entry.occurredAt,
            cents: share.cents,
            criterion: entry.payload.criterion,
          });
        }
        break;
      }
      case 'mortalidade':
        heads -= entry.payload.heads;
        headsDead += entry.payload.heads;
        break;
      case 'venda': {
        const sold = Math.min(entry.payload.heads, heads);
        const soldCostCents = heads > 0 ? Math.round((pool * sold) / heads) : 0;
        pool -= soldCostCents;
        heads -= sold;
        const grossCents = saleGrossCents(entry.payload.carcassKg, entry.payload.pricePerArrobaCents);
        const realResultCents = grossCents - entry.payload.deductionsCents - soldCostCents;
        const rentCents = Math.round(
          (pastureRentCents * sold * daysBetween(lot.purchasedAt, entry.occurredAt)) / 30,
        );
        sales.push({
          entryId: entry.id,
          date: entry.occurredAt,
          buyer: entry.payload.buyer,
          heads: sold,
          carcassKg: entry.payload.carcassKg,
          arrobas: carcassArrobas(entry.payload.carcassKg),
          pricePerArrobaCents: entry.payload.pricePerArrobaCents,
          grossCents,
          deductionsCents: entry.payload.deductionsCents,
          soldCostCents,
          realResultCents,
          pastureRentCents: rentCents,
          adjustedResultCents: realResultCents - rentCents,
        });
        break;
      }
    }
  }
  const outgoing = lot.transfer?.outgoing;
  if (outgoing && outgoing.at <= today) {
    if (outgoing.at > cursor) headDays += heads * daysBetween(cursor, outgoing.at);
    heads = 0;
    pool = 0;
    cursor = outgoing.at;
  }
  if (today > cursor) headDays += heads * daysBetween(cursor, today);

  const first = weighings[0];
  const lastWeighing = weighings[weighings.length - 1];
  const days = daysBetween(first.date, lastWeighing.date);
  const gmdKg = weighings.length > 1 && days > 0 ? (lastWeighing.kg - first.kg) / days : null;
  const expensesCents = expenseItems.reduce((acc, item) => acc + item.cents, 0);
  const sum = (pick: (s: SaleResult) => number) => sales.reduce((acc, s) => acc + pick(s), 0);

  return {
    lot,
    headsCurrent: heads,
    headsSold: sum((s) => s.heads),
    headsDead,
    weighings,
    lastWeighing,
    gmdKg,
    gmdEstimated: lastWeighing.method === 'estimado',
    acquisitionCents,
    expensesCents,
    expenseItems,
    totalCostCents: acquisitionCents + expensesCents,
    remainingCostCents: pool,
    costPerHeadCents: heads > 0 ? Math.round(pool / heads) : 0,
    sales,
    revenueCents: sum((s) => s.grossCents),
    realResultCents: sum((s) => s.realResultCents),
    adjustedResultCents: sum((s) => s.adjustedResultCents),
    arrobasSold: sum((s) => s.arrobas),
    pastureRentAccruedCents: Math.round((pastureRentCents * headDays) / 30),
    headDays,
    pendingCount,
  };
}

export interface PortfolioSummary {
  heads: number;
  activeLots: number;
  remainingCostCents: number;
  avgCostPerHeadCents: number;
  realResultCents: number;
  adjustedResultCents: number;
  arrobasSold: number;
  revenueCents: number;
}

export function summarizePortfolio(lots: LotSummary[]): PortfolioSummary {
  const sum = (pick: (s: LotSummary) => number) => lots.reduce((acc, s) => acc + pick(s), 0);
  const heads = sum((s) => s.headsCurrent);
  const remainingCostCents = sum((s) => s.remainingCostCents);
  return {
    heads,
    activeLots: lots.filter((s) => s.headsCurrent > 0).length,
    remainingCostCents,
    avgCostPerHeadCents: heads > 0 ? Math.round(remainingCostCents / heads) : 0,
    realResultCents: sum((s) => s.realResultCents),
    adjustedResultCents: sum((s) => s.adjustedResultCents),
    arrobasSold: sum((s) => s.arrobasSold),
    revenueCents: sum((s) => s.revenueCents),
  };
}

/** Custos apropriados (aprovados) por mês, para o gráfico da home gerencial. */
export function monthlyCosts(
  entries: Entry[],
  operationIds: Set<string>,
  farmIds: Set<string>,
  today: string,
  months = 6,
): { key: string; label: string; cents: number }[] {
  const [y, m] = today.split('-').map(Number);
  const buckets = Array.from({ length: months }, (_, i) => {
    const date = new Date(y, m - 1 - (months - 1 - i), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: monthLabel(`${key}-01`), cents: 0 };
  });
  for (const entry of entries) {
    if (entry.status !== 'aprovado' || !operationIds.has(entry.operationId) || !farmIds.has(entry.farmId)) continue;
    const allocated = lotAllocations(entry).reduce((acc, a) => acc + a.cents, 0);
    // Compra para o estoque não é custo do mês: o custo aparece no consumo.
    const isGeneralExpense = entry.kind === 'despesa' && !isStockPurchase(entry) && entry.payload.allocations.length === 0;
    const cents = isGeneralExpense ? (entry.amountCents ?? 0) : allocated;
    const bucket = buckets.find((b) => b.key === entry.occurredAt.slice(0, 7));
    if (bucket) bucket.cents += cents;
  }
  return buckets;
}

export interface HerdSummary {
  heads: number;
  activeLots: number;
  /** Peso médio atual ponderado pelas cabeças; null sem lotes ativos. */
  avgWeightKg: number | null;
  /** GMD médio ponderado pelas cabeças dos lotes já pesados; null antes da primeira pesagem. */
  avgGmdKg: number | null;
  /** Algum peso ou GMD da média vem de estimativa visual. */
  estimated: boolean;
}

/** Rebanho de hoje: só lotes com animais. */
export function summarizeHerd(lots: LotSummary[]): HerdSummary {
  const active = lots.filter((s) => s.headsCurrent > 0);
  const heads = active.reduce((acc, s) => acc + s.headsCurrent, 0);
  const weighted = (pick: (s: LotSummary) => number | null) => {
    const usable = active.filter((s) => pick(s) !== null);
    const base = usable.reduce((acc, s) => acc + s.headsCurrent, 0);
    return base > 0 ? usable.reduce((acc, s) => acc + (pick(s) ?? 0) * s.headsCurrent, 0) / base : null;
  };
  return {
    heads,
    activeLots: active.length,
    avgWeightKg: weighted((s) => s.lastWeighing.kg),
    avgGmdKg: weighted((s) => s.gmdKg),
    estimated: active.some((s) => s.lastWeighing.method === 'estimado'),
  };
}

export interface MonthSummary {
  /** AAAA-MM */
  month: string;
  headsSold: number;
  arrobasSold: number;
  revenueCents: number;
  realResultCents: number;
  costsCents: number;
  previousCostsCents: number;
}

/** Vendas aprovadas e custos apropriados no mês de `today`, com os custos do mês anterior. */
export function monthSummary(
  lots: LotSummary[],
  entries: Entry[],
  operationIds: Set<string>,
  farmIds: Set<string>,
  today: string,
): MonthSummary {
  const month = today.slice(0, 7);
  const sales = lots.flatMap((s) => s.sales).filter((sale) => sale.date.startsWith(month));
  const [previous, current] = monthlyCosts(entries, operationIds, farmIds, today, 2);
  return {
    month,
    headsSold: sales.reduce((acc, s) => acc + s.heads, 0),
    arrobasSold: sales.reduce((acc, s) => acc + s.arrobas, 0),
    revenueCents: sales.reduce((acc, s) => acc + s.grossCents, 0),
    realResultCents: sales.reduce((acc, s) => acc + s.realResultCents, 0),
    costsCents: current.cents,
    previousCostsCents: previous.cents,
  };
}

/** Lotes com animais sem pesagem há `days` dias ou mais (o peso de entrada conta como a primeira). */
export function staleLots(lots: LotSummary[], today: string, days = 30): LotSummary[] {
  return lots.filter((s) => s.headsCurrent > 0 && daysBetween(s.lastWeighing.date, today) >= days);
}
