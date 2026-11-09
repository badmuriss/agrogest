import { splitCents } from './allocation';
import { addDays, daysBetween, formatDate } from './dates';
import { formatNumber } from './format';
import { byOccurrence } from './lot-metrics';
import type {
  Allocation,
  AllocationCriterion,
  Entry,
  EntryStatus,
  Lot,
  StockItem,
  Supply,
  SupplyConversion,
  SupplyKind,
} from './types';

export const SUPPLY_KIND_LABEL: Record<SupplyKind, string> = {
  sal: 'Sal comum',
  sal_mineral: 'Sal mineral',
  proteinado: 'Proteinado',
  racao: 'Ração',
  medicamento: 'Medicamento',
  outros: 'Outros',
};

export const SUPPLY_UNITS = ['saco', 'kg', 't', 'l', 'dose', 'un'];

export const UNIT_LABEL: Record<string, [string, string]> = {
  saco: ['saco', 'sacos'],
  kg: ['kg', 'kg'],
  t: ['t', 't'],
  l: ['litro', 'litros'],
  dose: ['dose', 'doses'],
  un: ['unidade', 'unidades'],
};

/** Quantidades com até 3 casas: somas em ponto flutuante não criam saldo fantasma. */
export function roundQty(q: number): number {
  return Math.round(q * 1000) / 1000;
}

export function formatQty(q: number, unit: string): string {
  const [one, many] = UNIT_LABEL[unit] ?? [unit, unit];
  return `${formatNumber(q, 3)} ${Math.abs(q) === 1 ? one : many}`;
}

/** Converte a quantidade comprada para a unidade de controle; null sem conversão cadastrada. */
export function toControlUnits(supply: Pick<Supply, 'unit' | 'conversions'>, quantity: number, unit: string): number | null {
  if (unit === supply.unit) return roundQty(quantity);
  const conversion = supply.conversions.find((c) => c.unit === unit);
  return conversion ? roundQty(quantity * conversion.factor) : null;
}

export interface SupplyInput {
  name: string;
  kind: SupplyKind;
  unit: string;
  conversions: SupplyConversion[];
  minQuantity: number | null;
  active: boolean;
}

export function supplyErrors(input: SupplyInput, others: Pick<Supply, 'name'>[]): string | null {
  const name = input.name.trim();
  if (!name || name.length > 100) return 'Dê um nome ao insumo (até 100 caracteres).';
  if (others.some((o) => o.name.trim().toLowerCase() === name.toLowerCase())) return 'Já existe um insumo com este nome.';
  if (!SUPPLY_UNITS.includes(input.unit)) return 'Escolha a unidade de controle.';
  if (input.conversions.some((c) => !SUPPLY_UNITS.includes(c.unit) || c.unit === input.unit || !(c.factor > 0) || c.factor > 1_000_000)) {
    return 'Cada conversão precisa de outra unidade e de um fator maior que zero.';
  }
  if (new Set(input.conversions.map((c) => c.unit)).size !== input.conversions.length) return 'A mesma unidade aparece duas vezes.';
  if (input.minQuantity !== null && !(input.minQuantity >= 0)) return 'O estoque mínimo não pode ser negativo.';
  return null;
}

/**
 * Política de custeio do estoque: **custo médio ponderado** por insumo e fazenda (padrão adotado,
 * a validar com o produtor). Cada saída leva a fração do valor igual à fração da quantidade,
 * como o custo do lote na venda: a última unidade leva o resto e nenhum centavo sobra ou falta.
 */
export function outflowValue(state: { qty: number; value: number }, quantity: number): number {
  if (state.qty <= 0) return 0;
  if (quantity >= state.qty) return state.value;
  return Math.round((state.value * quantity) / state.qty);
}

/** Política de perdas: ajuste negativo sai do estoque e **não** vira custo dos lotes. */
export const LOSS_TO_LOTS = false;

export type StockMovementType = 'compra' | 'consumo' | 'ajuste' | 'transferencia_saida' | 'transferencia_entrada';

export interface StockMovement {
  entryId: string;
  type: StockMovementType;
  farmId: string;
  supplyId: string;
  date: string;
  /** Variação de quantidade (positiva entra). */
  quantity: number;
  /** Variação de valor em centavos (positiva entra). */
  cents: number;
  qtyAfter: number;
  valueAfter: number;
  status: EntryStatus;
}

/** Itens de estoque de uma compra aprovável (despesa ou nota com destino estoque). */
export function purchaseItems(entry: Entry): StockItem[] {
  if ((entry.kind === 'despesa' || entry.kind === 'nota_fiscal') && entry.payload.destination === 'estoque') {
    return entry.payload.stockItems ?? [];
  }
  return [];
}

/** Insumos que o lançamento movimenta. */
export function entrySupplyIds(entry: Entry): string[] {
  if (entry.kind === 'consumo' || entry.kind === 'ajuste_estoque' || entry.kind === 'transferencia_estoque') {
    return [entry.payload.supplyId];
  }
  return [...new Set(purchaseItems(entry).map((i) => i.supplyId))];
}

/** Só tira do estoque: consumo, transferência e ajuste negativo. */
function isOutflow(entry: Entry): boolean {
  return (
    entry.kind === 'consumo' ||
    entry.kind === 'transferencia_estoque' ||
    (entry.kind === 'ajuste_estoque' && entry.payload.delta < 0)
  );
}

export type StockMode = 'confirmado' | 'reserva';
const PENDING: EntryStatus[] = ['aguardando_aprovacao', 'aguardando_envio'];

/**
 * Confirmado: só aprovados. Reserva (ao receber um lançamento): aprovados mais as **saídas**
 * pendentes; entradas pendentes não contam, para ninguém consumir o que ainda pode ser recusado.
 */
function counts(entry: Entry, mode: StockMode): boolean {
  if (entry.status === 'aprovado') return true;
  return mode === 'reserva' && PENDING.includes(entry.status) && isOutflow(entry);
}

export interface StockLedger {
  /** Primeira inconsistência (saldo negativo em alguma data), ou null. */
  error: string | null;
  /** Saldo final por fazenda. */
  farms: Map<string, { qty: number; value: number }>;
  movements: StockMovement[];
  /** Valor que cada consumo ou ajuste tirou do estoque. */
  outflowCents: Map<string, number>;
}

export interface StockNames {
  supply: (supplyId: string) => Pick<Supply, 'name' | 'unit'> | undefined;
  farm: (farmId: string) => string;
}

/**
 * Reconstrói o estoque de um insumo em todas as fazendas, em ordem de ocorrência e captura.
 * Mesma regra de `private.stock_replay` no servidor. `candidate` substitui a versão gravada.
 */
export function stockLedger(
  entries: Entry[],
  supplyId: string,
  mode: StockMode,
  names?: StockNames,
  candidate?: Entry,
): StockLedger {
  const events = entries
    .filter((e) => e.id !== candidate?.id && counts(e, mode) && entrySupplyIds(e).includes(supplyId))
    .concat(candidate && entrySupplyIds(candidate).includes(supplyId) ? [candidate] : [])
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const farms = new Map<string, { qty: number; value: number }>();
  const movements: StockMovement[] = [];
  const outflowCents = new Map<string, number>();
  const state = (farmId: string) => {
    let s = farms.get(farmId);
    if (!s) {
      s = { qty: 0, value: 0 };
      farms.set(farmId, s);
    }
    return s;
  };
  const push = (entry: Entry, type: StockMovementType, farmId: string, quantity: number, cents: number) => {
    const s = state(farmId);
    s.qty = roundQty(s.qty + quantity);
    s.value += cents;
    movements.push({ entryId: entry.id, type, farmId, supplyId, date: entry.occurredAt, quantity, cents, qtyAfter: s.qty, valueAfter: s.value, status: entry.status });
  };
  const shortage = (entry: Entry, farmId: string, requested: number): string => {
    const supply = names?.supply(supplyId);
    const unit = supply?.unit ?? '';
    const have = state(farmId).qty;
    return `Em ${formatDate(entry.occurredAt)}, o estoque de ${supply?.name ?? 'este insumo'} em ${names?.farm(farmId) ?? 'esta fazenda'} tinha ${formatQty(have, unit)}; o lançamento pede ${formatQty(requested, unit)}.`;
  };

  for (const entry of events) {
    if (entry.kind === 'consumo' || entry.kind === 'transferencia_estoque' || (entry.kind === 'ajuste_estoque' && entry.payload.delta < 0)) {
      const requested = roundQty(entry.kind === 'ajuste_estoque' ? -entry.payload.delta : entry.payload.quantity);
      const s = state(entry.farmId);
      if (requested > s.qty + 1e-9) return { error: shortage(entry, entry.farmId, requested), farms, movements, outflowCents };
      const cents = outflowValue(s, requested);
      outflowCents.set(entry.id, cents);
      if (entry.kind === 'transferencia_estoque') {
        push(entry, 'transferencia_saida', entry.farmId, -requested, -cents);
        // A chegada só conta depois de aprovada, como qualquer entrada.
        if (entry.status === 'aprovado') push(entry, 'transferencia_entrada', entry.payload.toFarmId, requested, cents);
      } else {
        push(entry, entry.kind === 'consumo' ? 'consumo' : 'ajuste', entry.farmId, -requested, -cents);
      }
    } else if (entry.kind === 'ajuste_estoque') {
      // Sobra encontrada entra pelo custo médio atual (sem estoque, sem valor).
      const s = state(entry.farmId);
      const cents = s.qty > 0 ? Math.round((s.value * entry.payload.delta) / s.qty) : 0;
      push(entry, 'ajuste', entry.farmId, roundQty(entry.payload.delta), cents);
    } else {
      for (const item of purchaseItems(entry).filter((i) => i.supplyId === supplyId)) {
        push(entry, 'compra', entry.farmId, roundQty(item.quantity), item.cents);
      }
    }
  }
  return { error: null, farms, movements, outflowCents };
}

/** O lançamento cabe no estoque? Mesmo papel de `pastureConflict` para os pastos. */
export function stockConflict(entries: Entry[], candidate: Entry, mode: StockMode, names?: StockNames): string | null {
  if (!isOutflow(candidate)) return null;
  for (const supplyId of entrySupplyIds(candidate)) {
    const error = stockLedger(entries, supplyId, mode, names, candidate).error;
    if (error) return error;
  }
  return null;
}

/** Rateia o custo do consumo pelas bases gravadas; fecha exatamente com o total (RN-05). */
export function consumptionAllocations(cents: number, targets: { lotId: string; basis: number }[]): Allocation[] {
  const { shares } = splitCents(cents, targets.map((t) => t.basis));
  return targets.map((t, i) => ({ lotId: t.lotId, cents: shares[i], basis: t.basis }));
}

function entriesBySupply(entries: Entry[]): Map<string, Entry[]> {
  const grouped = new Map<string, Entry[]>();
  for (const entry of entries) {
    for (const supplyId of entrySupplyIds(entry)) {
      const related = grouped.get(supplyId) ?? [];
      related.push(entry);
      grouped.set(supplyId, related);
    }
  }
  return grouped;
}

/**
 * Preenche o custo dos consumos e ajustes aprovados (`derivedCents` e `derivedAllocations`),
 * sem mudar o lançamento gravado. Lançamentos pendentes recebem uma prévia, pelo saldo atual.
 */
export function costEntries(entries: Entry[]): Entry[] {
  const bySupply = entriesBySupply(entries);
  if (bySupply.size === 0) return entries;
  const cost = new Map<string, number>();
  for (const [supplyId, related] of bySupply) {
    for (const [id, cents] of stockLedger(related, supplyId, 'confirmado').outflowCents) cost.set(id, cents);
  }
  return entries.map((entry) => {
    if (entry.kind !== 'consumo' && entry.kind !== 'ajuste_estoque') return entry;
    let cents = cost.get(entry.id);
    if (cents === undefined && entry.status !== 'aprovado' && entry.status !== 'rejeitado') {
      cents = stockLedger(bySupply.get(entry.payload.supplyId) ?? [], entry.payload.supplyId, 'confirmado', undefined, entry).outflowCents.get(entry.id);
    }
    if (cents === undefined) return entry;
    return entry.kind === 'consumo'
      ? { ...entry, derivedCents: cents, derivedAllocations: consumptionAllocations(cents, entry.payload.targets) }
      : { ...entry, derivedCents: cents };
  });
}

type HerdChange = Extract<Entry, { kind: 'mortalidade' | 'venda' }>;

function herdChanges(lotId: string, entries: Entry[], date: string): HerdChange[] {
  return entries.filter((entry): entry is HerdChange =>
    (entry.kind === 'mortalidade' || entry.kind === 'venda') && entry.status === 'aprovado'
    && entry.payload.lotId === lotId && entry.occurredAt <= date).sort(byOccurrence);
}

function headsAfter(heads: number, entry: HerdChange): number {
  return heads - (entry.kind === 'venda' ? Math.min(entry.payload.heads, heads) : entry.payload.heads);
}

/** Cabeças confirmadas do lote no fim do dia `date` (0 antes da entrada ou depois da transferência). */
export function headsOn(lot: Lot, entries: Entry[], date: string): number {
  if (date < lot.purchasedAt || (lot.transfer?.outgoing && lot.transfer.outgoing.at <= date)) return 0;
  return herdChanges(lot.id, entries, date).reduce(headsAfter, lot.headsPurchased);
}

/** Peso médio do lote na data, pela última pesagem até ela. */
export function weightOn(lot: Lot, entries: Entry[], date: string): number {
  if (date < lot.purchasedAt) return 0;
  let last: Extract<Entry, { kind: 'pesagem' }> | undefined;
  for (const entry of entries) {
    if (entry.kind !== 'pesagem' || entry.status !== 'aprovado' || entry.payload.lotId !== lot.id || entry.occurredAt > date) continue;
    if (!last || byOccurrence(last, entry) <= 0) last = entry;
  }
  return last?.payload.avgWeightKg ?? lot.entryWeightKg;
}

/** Cabeça-dia do lote no período [start, end], contando os dois dias. */
export function headDays(lot: Lot, entries: Entry[], start: string, end: string): number {
  let cursor = start > lot.purchasedAt ? start : lot.purchasedAt;
  const outgoing = lot.transfer?.outgoing;
  const lastDay = outgoing && outgoing.at <= end ? addDays(outgoing.at, -1) : end;
  if (cursor > lastDay) return 0;
  let heads = lot.headsPurchased;
  let total = 0;
  // O efetivo muda no próprio dia da venda/mortalidade. Integra os trechos entre eventos,
  // em vez de reconstruir todo o lote para cada dia do período.
  for (const entry of herdChanges(lot.id, entries, lastDay)) {
    if (entry.occurredAt > cursor) {
      total += heads * daysBetween(cursor, entry.occurredAt);
      cursor = entry.occurredAt;
    }
    heads = headsAfter(heads, entry);
  }
  return total + heads * (daysBetween(cursor, lastDay) + 1);
}

export const MAX_PERIOD_DAYS = 92;

/**
 * Base do rateio do consumo: cabeças (ou cabeça-dia no período), peso vivo, ou percentual.
 * Usa a composição na data do consumo, não a de hoje (RF-09). Lotes sem animais ficam de fora.
 */
export function consumptionTargets(
  lots: Lot[],
  entries: Entry[],
  criterion: AllocationCriterion,
  date: string,
  periodStart: string | null,
  manualPct: Record<string, number>,
): { targets: { lotId: string; basis: number }[]; error: string | null } {
  if (periodStart && (periodStart > date || daysBetween(periodStart, date) >= MAX_PERIOD_DAYS)) {
    return { targets: [], error: `O período precisa começar antes do fim e ter até ${MAX_PERIOD_DAYS} dias.` };
  }
  const byLot = new Map<string, Entry[]>();
  if (criterion !== 'manual') {
    for (const entry of entries) {
      if (entry.status !== 'aprovado' || entry.occurredAt > date || (entry.kind !== 'mortalidade' && entry.kind !== 'venda' && entry.kind !== 'pesagem')) continue;
      const related = byLot.get(entry.payload.lotId) ?? [];
      related.push(entry);
      byLot.set(entry.payload.lotId, related);
    }
  }
  const targets = lots
    .map((lot) => {
      if (criterion === 'manual') return { lotId: lot.id, basis: manualPct[lot.id] ?? 0 };
      const related = byLot.get(lot.id) ?? [];
      const heads = periodStart ? headDays(lot, related, periodStart, date) : headsOn(lot, related, date);
      const basis = criterion === 'peso' ? Math.round(heads * weightOn(lot, related, date)) : heads;
      return { lotId: lot.id, basis };
    })
    .filter((t) => t.basis > 0);
  if (targets.length === 0) return { targets, error: 'Nenhum lote escolhido tinha animais na data do consumo.' };
  if (criterion === 'manual') {
    const sum = targets.reduce((acc, t) => acc + t.basis, 0);
    if (Math.abs(sum - 100) > 0.001) return { targets, error: `Os percentuais somam ${formatNumber(sum, 2)}%. Eles precisam somar 100%.` };
  }
  return { targets, error: null };
}

export interface StockPosition {
  supply: Supply;
  farmId: string;
  qty: number;
  valueCents: number;
  /** Custo médio por unidade de controle, em centavos. */
  avgCostCents: number;
  /** Consumo médio diário nos últimos 30 dias; null sem consumo. */
  dailyUse: number | null;
  /** Dias até acabar, pelo consumo médio; null sem consumo. */
  daysLeft: number | null;
  low: boolean;
  /** Saídas aguardando aprovação ou envio, já descontadas em `available`. */
  reserved: number;
  available: number;
}

export const USE_WINDOW_DAYS = 30;

/** Saldo, valor, duração e alerta de cada insumo nas fazendas pedidas. */
export function stockPositions(supplies: Supply[], entries: Entry[], farmIds: string[], today: string): StockPosition[] {
  const result: StockPosition[] = [];
  const since = addDays(today, -USE_WINDOW_DAYS);
  const bySupply = entriesBySupply(entries);
  for (const supply of supplies) {
    const related = bySupply.get(supply.id) ?? [];
    const confirmed = stockLedger(related, supply.id, 'confirmado');
    const reserved = stockLedger(related, supply.id, 'reserva');
    for (const farmId of farmIds) {
      const s = confirmed.farms.get(farmId);
      const used = confirmed.movements
        .filter((m) => m.farmId === farmId && m.type === 'consumo' && m.date > since && m.date <= today)
        .reduce((acc, m) => acc - m.quantity, 0);
      const touched = s !== undefined || reserved.farms.has(farmId);
      if (!touched && !supply.active) continue;
      const qty = s?.qty ?? 0;
      const reservedQty = reserved.error ? 0 : roundQty(qty - (reserved.farms.get(farmId)?.qty ?? qty));
      const dailyUse = used > 0 ? used / USE_WINDOW_DAYS : null;
      result.push({
        supply,
        farmId,
        qty,
        valueCents: s?.value ?? 0,
        avgCostCents: qty > 0 ? Math.round((s?.value ?? 0) / qty) : 0,
        dailyUse,
        daysLeft: dailyUse ? Math.floor(qty / dailyUse) : null,
        low: supply.minQuantity !== null && qty <= supply.minQuantity,
        reserved: Math.max(0, reservedQty),
        available: roundQty(qty - Math.max(0, reservedQty)),
      });
    }
  }
  return result;
}
