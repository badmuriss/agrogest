import { addDays, daysBetween, formatDate } from './dates';
import { plural } from './format';
import type { Entry, EntryStatus, Lot, Pasture, WeightMethod } from './types';

/*
 * Pastos, ocupação e GMD por pasto.
 *
 * O lote de origem (econômico) continua único; os animais dele podem estar divididos em
 * grupos em pastos diferentes. A ocupação é reconstruída a partir da entrada do lote e dos
 * lançamentos aprovados (movimentações, mortes, vendas e pesagens), em ordem de ocorrência.
 * O servidor aplica a mesma reconstrução (`private.lot_pasture_replay`).
 */

// ---------------------------------------------------------------------------
// Nome normalizado e ID estável dos pastos convertidos do texto antigo

const ACCENTS_FROM = 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ';
const ACCENTS_TO = 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn';

/** "  Pasto  do Córrego " → "pasto do corrego". Igual a `private.pasture_key` no servidor. */
export function pastureKey(name: string): string {
  let out = '';
  for (const ch of name) {
    const i = ACCENTS_FROM.indexOf(ch);
    out += i >= 0 ? ACCENTS_TO[i] : ch;
  }
  return out.replace(/\s+/g, ' ').trim().toLowerCase();
}

export const LEGACY_DEFAULT_PASTURE = 'Pasto principal';

/**
 * ID do pasto criado a partir do nome em texto de lotes antigos: o mesmo em qualquer aparelho
 * e no servidor (md5 de "fazenda:nome normalizado"), para a conversão ser idempotente.
 */
export function legacyPastureId(farmId: string, name: string): string {
  const key = pastureKey(name) || pastureKey(LEGACY_DEFAULT_PASTURE);
  const hex = md5(utf8(`${farmId}:${key}`));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

const MD5_SHIFT = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

/** MD5 (RFC 1321) em hexadecimal. Só identifica pastos convertidos; não é uso criptográfico. */
function md5(input: number[]): string {
  const bytes = [...input, 0x80];
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bits = input.length * 8;
  for (let i = 0; i < 8; i++) bytes.push(i < 4 ? (bits >>> (8 * i)) & 255 : Math.floor(bits / 2 ** (8 * i)) & 255);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    const m = Array.from({ length: 16 }, (_, i) => {
      const o = chunk + i * 4;
      return bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24);
    });
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + MD5_K[i] + m[g]) | 0;
      a = d;
      d = c;
      c = b;
      const s = MD5_SHIFT[(i >> 4) * 4 + (i % 4)];
      b = (b + ((f << s) | (f >>> (32 - s)))) | 0;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  return [a0, b0, c0, d0]
    .map((word) => Array.from({ length: 4 }, (_, i) => ((word >>> (8 * i)) & 255).toString(16).padStart(2, '0')).join(''))
    .join('');
}

// ---------------------------------------------------------------------------
// Cadastro

export interface PastureInput {
  name: string;
  areaHa: number | null;
  forage: string;
  notes: string;
  active: boolean;
}

export const PASTURE_LIMITS = { name: 150, forage: 150, notes: 500, maxAreaHa: 100_000 };

export type PastureErrors = Partial<Record<'name' | 'areaHa' | 'forage' | 'notes', string>>;

/** `others`: os demais pastos da mesma fazenda, ativos ou não (o nome não se repete). */
export function pastureErrors(input: PastureInput, others: Pick<Pasture, 'name'>[]): PastureErrors {
  const errors: PastureErrors = {};
  const key = pastureKey(input.name);
  if (!key) errors.name = 'Dê um nome ao pasto.';
  else if (input.name.trim().length > PASTURE_LIMITS.name) errors.name = 'Use até 150 caracteres.';
  else if (others.some((p) => pastureKey(p.name) === key)) errors.name = 'Já existe um pasto com este nome na fazenda.';
  if (input.areaHa === null || !Number.isFinite(input.areaHa) || input.areaHa <= 0 || input.areaHa > PASTURE_LIMITS.maxAreaHa) {
    errors.areaHa = 'Informe a área útil em hectares (maior que zero).';
  }
  if (!input.forage.trim()) errors.forage = 'Informe o tipo de capim.';
  else if (input.forage.trim().length > PASTURE_LIMITS.forage) errors.forage = 'Use até 150 caracteres.';
  if (input.notes.trim().length > PASTURE_LIMITS.notes) errors.notes = 'Use até 500 caracteres.';
  return errors;
}

/**
 * Pasto já usado por algum lote ou lançamento (de qualquer situação, inclusive rascunho ou
 * pendente). Só um pasto nunca usado pode ser excluído; os demais são inativados, para não
 * perder ocupação e GMD. Igual a `private.pasture_in_use` no servidor.
 */
export function pastureInUse(pastureId: string, lots: Pick<Lot, 'pastureId'>[], entries: Entry[]): boolean {
  return (
    lots.some((l) => l.pastureId === pastureId) ||
    entries.some(
      (e) =>
        (e.kind === 'manejo' && (e.payload.fromPastureId === pastureId || e.payload.toPastureId === pastureId)) ||
        ((e.kind === 'pesagem' || e.kind === 'mortalidade' || e.kind === 'venda') && e.payload.pastureId === pastureId),
    )
  );
}

/** Sugestões de forrageiras comuns; o produtor pode escrever outra. */
export const FORAGE_SUGGESTIONS = ['Brachiaria', 'Marandu', 'Humidícola', 'Mombaça', 'Tanzânia', 'Massai', 'Tifton', 'Nativa'];

// ---------------------------------------------------------------------------
// Reconstrução da ocupação do lote

/** Pasto ainda desconhecido (lote sem referência estruturada). */
export const UNKNOWN_PASTURE = '';

const PASTURE_KINDS = new Set(['manejo', 'mortalidade', 'venda', 'pesagem']);

/** Confirmados contam no saldo; enviados aguardando aprovação reservam cabeças. */
export const CONFIRMED: EntryStatus[] = ['aprovado'];
export const RESERVING: EntryStatus[] = ['aprovado', 'aguardando_aprovacao'];

export interface WeighPoint {
  date: string;
  kg: number;
  method: WeightMethod;
  headsWeighed: number;
  /** null para o peso de entrada do lote. */
  entryId: string | null;
}

/** Permanência de um grupo do lote num pasto, sem nenhuma mudança de composição. */
export interface PastureSegment {
  lotId: string;
  pastureId: string;
  start: string;
  /** null enquanto o grupo continua lá. */
  end: string | null;
  heads: number;
  points: WeighPoint[];
}

export type OccupancyEventType = 'entrada' | 'chegada' | 'saida' | 'morte' | 'venda' | 'transferencia';

export interface OccupancyEvent {
  date: string;
  pastureId: string;
  lotId: string;
  heads: number;
  type: OccupancyEventType;
  entryId: string | null;
  /** Pasto do outro lado da movimentação. */
  otherPastureId?: string;
  /** Baixa sem pasto informado, distribuída entre os grupos (lançamentos antigos). */
  apportioned?: boolean;
}

export interface LotPastureTimeline {
  lotId: string;
  /** Primeira inconsistência encontrada (saldo negativo, datas, pasto sem animais). */
  error: string | null;
  /** Cabeças por pasto depois do último evento. */
  heads: Map<string, number>;
  segments: PastureSegment[];
  events: OccupancyEvent[];
  /** Pesagens do lote inteiro enquanto ele estava dividido: não pertencem a um pasto só. */
  unattributed: number;
  /** O peso de entrada veio da fazenda de origem, sem data própria: não serve de base. */
  inheritedEntry: boolean;
}

function payloadLotId(entry: Entry): string | null {
  return PASTURE_KINDS.has(entry.kind) && 'lotId' in entry.payload ? entry.payload.lotId : null;
}

function chronological(a: Entry, b: Entry): number {
  return a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** Lançamentos que mexem nos grupos do lote, em ordem; `candidate` entra no lugar da versão salva. */
export function lotPastureEvents(lotId: string, entries: Entry[], statuses: EntryStatus[], candidate?: Entry): Entry[] {
  const list = entries.filter((e) => e.id !== candidate?.id && statuses.includes(e.status) && payloadLotId(e) === lotId);
  if (candidate && payloadLotId(candidate) === lotId) list.push(candidate);
  return list.sort(chronological);
}

export function lotPastureTimeline(lot: Lot, events: Entry[], name: (pastureId: string) => string): LotPastureTimeline {
  const heads = new Map<string, number>();
  const open = new Map<string, PastureSegment>();
  const segments: PastureSegment[] = [];
  const out: OccupancyEvent[] = [];
  const incoming = lot.transfer?.incoming;
  const outgoing = lot.transfer?.outgoing;
  const label = (id: string) => (id === UNKNOWN_PASTURE ? 'O pasto de entrada' : name(id));
  let error: string | null = null;
  let unattributed = 0;
  const fail = (message: string) => {
    error ??= message;
  };

  const change = (pastureId: string, date: string, delta: number, inherit?: WeighPoint) => {
    const current = open.get(pastureId);
    if (current) {
      current.end = date;
      open.delete(pastureId);
    }
    const after = (heads.get(pastureId) ?? 0) + delta;
    if (after <= 0) {
      heads.delete(pastureId);
      return;
    }
    heads.set(pastureId, after);
    const segment: PastureSegment = { lotId: lot.id, pastureId, start: date, end: null, heads: after, points: inherit ? [inherit] : [] };
    open.set(pastureId, segment);
    segments.push(segment);
  };

  const start = lot.pastureId || UNKNOWN_PASTURE;
  heads.set(start, lot.headsPurchased);
  const first: PastureSegment = {
    lotId: lot.id,
    pastureId: start,
    start: lot.purchasedAt,
    end: null,
    heads: lot.headsPurchased,
    points: incoming ? [] : [{ date: lot.purchasedAt, kg: lot.entryWeightKg, method: 'medido', headsWeighed: lot.headsPurchased, entryId: null }],
  };
  open.set(start, first);
  segments.push(first);
  out.push({ date: lot.purchasedAt, pastureId: start, lotId: lot.id, heads: lot.headsPurchased, type: 'entrada', entryId: null });

  for (const entry of events) {
    if (error) break;
    const at = entry.occurredAt;
    if (at < lot.purchasedAt) {
      fail(`A data ${formatDate(at)} é anterior à entrada do lote, em ${formatDate(lot.purchasedAt)}.`);
      break;
    }
    if (outgoing && at > outgoing.at) {
      fail('O lote já foi transferido para outra fazenda.');
      break;
    }
    switch (entry.kind) {
      case 'manejo': {
        const { fromPastureId: from, toPastureId: to, heads: moved } = entry.payload;
        const available = heads.get(from) ?? 0;
        if (from === to) {
          fail('Escolha um pasto de destino diferente da origem.');
          break;
        }
        if (!Number.isInteger(moved) || moved <= 0 || moved > available) {
          fail(`Em ${formatDate(at)}, ${label(from)} tem ${plural(available, 'cabeça', 'cabeças')} deste lote; a movimentação pede ${moved}.`);
          break;
        }
        // O grupo inteiro muda de pasto sem misturar: a pesagem do mesmo dia abre a nova permanência.
        const last = open.get(from)?.points.at(-1);
        const whole = moved === available && !heads.has(to);
        change(from, at, -moved);
        change(to, at, moved, whole && last?.date === at ? last : undefined);
        out.push(
          { date: at, pastureId: from, lotId: lot.id, heads: moved, type: 'saida', entryId: entry.id, otherPastureId: to },
          { date: at, pastureId: to, lotId: lot.id, heads: moved, type: 'chegada', entryId: entry.id, otherPastureId: from },
        );
        break;
      }
      case 'mortalidade':
      case 'venda': {
        const total = [...heads.values()].reduce((acc, n) => acc + n, 0);
        const requested = entry.payload.heads;
        if (entry.kind === 'mortalidade' && requested > total) {
          fail(`Em ${formatDate(at)}, o lote tem ${plural(total, 'cabeça', 'cabeças')}; o lançamento pede ${requested}.`);
          break;
        }
        // Mesma regra do resumo do lote: a venda nunca baixa mais do que o saldo.
        const count = Math.min(requested, total);
        const type = entry.kind === 'venda' ? 'venda' : 'morte';
        const target = entry.payload.pastureId;
        if (target) {
          const available = heads.get(target) ?? 0;
          if (count > available) {
            fail(`Em ${formatDate(at)}, ${label(target)} tem ${plural(available, 'cabeça', 'cabeças')} deste lote; o lançamento pede ${count}.`);
            break;
          }
          change(target, at, -count);
          out.push({ date: at, pastureId: target, lotId: lot.id, heads: count, type, entryId: entry.id });
          break;
        }
        // Sem pasto informado: baixa dos maiores grupos, sinalizada como apropriada.
        const groups = [...heads.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        let left = count;
        for (const [pastureId, available] of groups) {
          if (left <= 0) break;
          const taken = Math.min(left, available);
          change(pastureId, at, -taken);
          out.push({ date: at, pastureId, lotId: lot.id, heads: taken, type, entryId: entry.id, apportioned: groups.length > 1 });
          left -= taken;
        }
        break;
      }
      case 'pesagem': {
        const explicit = entry.payload.pastureId;
        const target = explicit || (heads.size === 1 ? [...heads.keys()][0] : null);
        if (!target) {
          unattributed += 1;
          break;
        }
        const segment = open.get(target);
        if (!segment) {
          fail(`Em ${formatDate(at)}, ${label(target)} não tem animais deste lote.`);
          break;
        }
        // Cabeças avaliadas não mexem no saldo: uma pesagem nunca vira conflito por isso.
        segment.points.push({
          date: at,
          kg: entry.payload.avgWeightKg,
          method: entry.payload.method,
          headsWeighed: entry.payload.headsWeighed,
          entryId: entry.id,
        });
        break;
      }
      default:
        break;
    }
  }

  if (outgoing && !error) {
    for (const [pastureId, count] of [...heads.entries()]) {
      change(pastureId, outgoing.at, -count);
      out.push({ date: outgoing.at, pastureId, lotId: lot.id, heads: count, type: 'transferencia', entryId: null });
    }
  }

  return { lotId: lot.id, error, heads, segments, events: out, unattributed, inheritedEntry: !!incoming };
}

/** Motivo de conflito ao incluir/alterar `candidate`, ou null se a ocupação continua coerente. */
export function pastureConflict(
  lot: Lot,
  entries: Entry[],
  candidate: Entry | null,
  statuses: EntryStatus[],
  name: (pastureId: string) => string,
): string | null {
  const events = lotPastureEvents(lot.id, entries, statuses, candidate ?? undefined);
  return lotPastureTimeline(lot, events, name).error;
}

// ---------------------------------------------------------------------------
// GMD por pasto

export interface GmdInterval {
  lotId: string;
  pastureId: string;
  from: string;
  to: string;
  days: number;
  /** Cabeças do grupo durante o intervalo (composição constante). */
  heads: number;
  startKg: number;
  endKg: number;
  gmdKg: number;
  /** Algum dos dois pesos é estimativa visual. */
  estimated: boolean;
  /** Algum dos dois pesos avaliou só parte do grupo. */
  sample: boolean;
}

/**
 * Intervalos atribuíveis: duas pesagens consecutivas do mesmo grupo, no mesmo pasto, sem
 * mudança de pasto nem de composição entre elas. Pesagens no mesmo dia: vale a última.
 */
export function segmentIntervals(segment: PastureSegment): GmdInterval[] {
  const result: GmdInterval[] = [];
  let previous: WeighPoint | null = null;
  for (const point of segment.points) {
    if (previous && daysBetween(previous.date, point.date) > 0) {
      const days = daysBetween(previous.date, point.date);
      result.push({
        lotId: segment.lotId,
        pastureId: segment.pastureId,
        from: previous.date,
        to: point.date,
        days,
        heads: segment.heads,
        startKg: previous.kg,
        endKg: point.kg,
        gmdKg: (point.kg - previous.kg) / days,
        estimated: previous.method === 'estimado' || point.method === 'estimado',
        sample: previous.headsWeighed < segment.heads || point.headsWeighed < segment.heads,
      });
    }
    previous = point;
  }
  return result;
}

export interface GmdSummary {
  /** kg/cabeça/dia, ponderado por cabeça-dia dos intervalos. */
  gmdKg: number;
  intervals: number;
  lots: number;
  /** Cabeça-dias cobertos pelos intervalos usados. */
  headDays: number;
  from: string;
  to: string;
  estimated: boolean;
  sample: boolean;
  categories: string[];
}

export function aggregateGmd(intervals: GmdInterval[], lotCategory: (lotId: string) => string): GmdSummary | null {
  const base = intervals.reduce((acc, i) => acc + i.days * i.heads, 0);
  if (base <= 0) return null;
  const gain = intervals.reduce((acc, i) => acc + (i.endKg - i.startKg) * i.heads, 0);
  const lots = new Set(intervals.map((i) => i.lotId));
  return {
    gmdKg: gain / base,
    intervals: intervals.length,
    lots: lots.size,
    headDays: base,
    from: intervals.reduce((min, i) => (i.from < min ? i.from : min), intervals[0].from),
    to: intervals.reduce((max, i) => (i.to > max ? i.to : max), intervals[0].to),
    estimated: intervals.some((i) => i.estimated),
    sample: intervals.some((i) => i.sample),
    categories: [...new Set([...lots].map(lotCategory))].sort(),
  };
}

// ---------------------------------------------------------------------------
// Relatório

export interface PastureFilter {
  /** Período inclusivo, AAAA-MM-DD; null = sem limite. */
  from: string | null;
  to: string | null;
  lotId: string | null;
  category: string | null;
  /** Só intervalos entre duas pesagens medidas na balança. */
  measuredOnly: boolean;
}

export const NO_FILTER: PastureFilter = { from: null, to: null, lotId: null, category: null, measuredOnly: false };

export interface PastureStay {
  lotId: string;
  pastureId: string;
  start: string;
  end: string | null;
  days: number;
  headDays: number;
  maxHeads: number;
}

export interface PastureReport {
  pastureId: string;
  pasture: Pasture | undefined;
  /** Cabeças confirmadas hoje, por lote. */
  currentLots: { lotId: string; heads: number }[];
  currentHeads: number;
  /** Cabeças por hectare hoje; não é UA/ha. */
  headsPerHa: number | null;
  headsIn: number;
  headsOut: number;
  /** Cabeça-dias no período. */
  headDays: number;
  /** Dias com algum animal no período. */
  occupiedDays: number;
  stays: PastureStay[];
  events: OccupancyEvent[];
  intervals: GmdInterval[];
  gmd: GmdSummary | null;
  /** Por que não há GMD, quando não há. */
  insufficient: string | null;
}

export interface ForageComparison {
  key: string;
  label: string;
  pastureIds: string[];
  gmd: GmdSummary;
}

export interface PastureReportResult {
  reports: PastureReport[];
  byForage: ForageComparison[];
  /** Pesagens do lote inteiro com o lote dividido: ficam fora do GMD por pasto. */
  unattributed: number;
  /** Lotes com histórico incoerente (não deveria ocorrer com dados validados). */
  inconsistentLots: string[];
}

const clipDays = (start: string, end: string, from: string | null, toExclusive: string | null) => {
  const s = from && from > start ? from : start;
  const e = toExclusive && toExclusive < end ? toExclusive : end;
  return Math.max(0, daysBetween(s, e));
};

function inPeriod(date: string, filter: PastureFilter) {
  return (!filter.from || date >= filter.from) && (!filter.to || date <= filter.to);
}

/** Linhas do tempo confirmadas de cada lote. */
export function lotTimelines(lots: Lot[], entries: Entry[], name: (pastureId: string) => string): Map<string, LotPastureTimeline> {
  const byLot = new Map<string, Entry[]>();
  for (const entry of entries) {
    const lotId = payloadLotId(entry);
    if (!lotId || entry.status !== 'aprovado') continue;
    const list = byLot.get(lotId) ?? [];
    list.push(entry);
    byLot.set(lotId, list);
  }
  return new Map(lots.map((lot) => [lot.id, lotPastureTimeline(lot, (byLot.get(lot.id) ?? []).sort(chronological), name)]));
}

export function buildPastureReports(input: {
  pastures: Pasture[];
  lots: Lot[];
  timelines: Map<string, LotPastureTimeline>;
  today: string;
  filter: PastureFilter;
}): PastureReportResult {
  const { pastures, lots, timelines, today, filter } = input;
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const category = (lotId: string) => lotById.get(lotId)?.category ?? '';
  const lotMatches = (lotId: string) =>
    (!filter.lotId || filter.lotId === lotId) && (!filter.category || category(lotId) === filter.category);
  const toExclusive = filter.to ? addDays(filter.to, 1) : null;
  const end = (segment: PastureSegment) => segment.end ?? today;

  let unattributed = 0;
  const inconsistentLots: string[] = [];
  const segments: PastureSegment[] = [];
  const events: OccupancyEvent[] = [];
  const current = new Map<string, Map<string, number>>();
  for (const lot of lots) {
    const timeline = timelines.get(lot.id);
    if (!timeline || !lotMatches(lot.id)) continue;
    if (timeline.error) inconsistentLots.push(lot.id);
    unattributed += timeline.unattributed;
    segments.push(...timeline.segments);
    events.push(...timeline.events);
    for (const [pastureId, heads] of timeline.heads) {
      const byLot = current.get(pastureId) ?? new Map<string, number>();
      byLot.set(lot.id, heads);
      current.set(pastureId, byLot);
    }
  }

  const ids = new Set(pastures.map((p) => p.id));
  for (const s of segments) ids.add(s.pastureId);
  const allIntervals = segments.flatMap(segmentIntervals);

  const reports: PastureReport[] = [...ids].map((pastureId) => {
    const pasture = pastures.find((p) => p.id === pastureId);
    const own = segments.filter((s) => s.pastureId === pastureId);
    const inside = own.filter((s) => (!filter.to || s.start <= filter.to) && (!filter.from || end(s) >= filter.from));
    const headDays = inside.reduce((acc, s) => acc + s.heads * clipDays(s.start, end(s), filter.from, toExclusive), 0);

    // União dos períodos com animais, para dias de ocupação sem contar duas vezes.
    const ranges = own
      .map((s) => ({ start: filter.from && filter.from > s.start ? filter.from : s.start, end: toExclusive && toExclusive < end(s) ? toExclusive : end(s) }))
      .filter((r) => r.end > r.start)
      .sort((a, b) => a.start.localeCompare(b.start));
    let occupiedDays = 0;
    let cursor: { start: string; end: string } | null = null;
    for (const r of ranges) {
      if (cursor && r.start <= cursor.end) {
        if (r.end > cursor.end) cursor.end = r.end;
        continue;
      }
      if (cursor) occupiedDays += daysBetween(cursor.start, cursor.end);
      cursor = { ...r };
    }
    if (cursor) occupiedDays += daysBetween(cursor.start, cursor.end);

    // Permanências: segmentos consecutivos do mesmo lote viram um período só.
    const stays: PastureStay[] = [];
    for (const s of [...inside].sort((a, b) => a.lotId.localeCompare(b.lotId) || a.start.localeCompare(b.start))) {
      const last = stays.at(-1);
      const segmentHeadDays = s.heads * clipDays(s.start, end(s), filter.from, toExclusive);
      if (last && last.lotId === s.lotId && last.end === s.start) {
        last.end = s.end;
        last.headDays += segmentHeadDays;
        last.maxHeads = Math.max(last.maxHeads, s.heads);
        last.days = daysBetween(last.start, last.end ?? today);
      } else {
        stays.push({ lotId: s.lotId, pastureId, start: s.start, end: s.end, days: daysBetween(s.start, end(s)), headDays: segmentHeadDays, maxHeads: s.heads });
      }
    }
    stays.sort((a, b) => b.start.localeCompare(a.start));

    const ownEvents = events.filter((e) => e.pastureId === pastureId && inPeriod(e.date, filter)).sort((a, b) => b.date.localeCompare(a.date));
    const headsIn = ownEvents.filter((e) => e.type === 'entrada' || e.type === 'chegada').reduce((acc, e) => acc + e.heads, 0);
    const headsOut = ownEvents.filter((e) => e.type !== 'entrada' && e.type !== 'chegada').reduce((acc, e) => acc + e.heads, 0);

    const candidates = allIntervals.filter((i) => i.pastureId === pastureId);
    const periodic = candidates.filter((i) => (!filter.from || i.from >= filter.from) && (!filter.to || i.to <= filter.to));
    const intervals = periodic.filter((i) => !filter.measuredOnly || !i.estimated);
    const gmd = aggregateGmd(intervals, category);
    const insufficient = gmd
      ? null
      : own.length === 0
        ? 'Nenhum animal passou por este pasto.'
        : candidates.length === 0
          ? 'Faltam duas pesagens do mesmo grupo neste pasto, sem mudança de pasto ou de composição entre elas.'
          : periodic.length === 0
            ? 'Nenhum intervalo de pesagens completo dentro do período.'
            : 'Só há estimativas visuais neste pasto.';

    const byLot = current.get(pastureId) ?? new Map<string, number>();
    const currentLots = [...byLot.entries()].map(([lotId, heads]) => ({ lotId, heads })).sort((a, b) => b.heads - a.heads);
    const currentHeads = currentLots.reduce((acc, l) => acc + l.heads, 0);
    return {
      pastureId,
      pasture,
      currentLots,
      currentHeads,
      headsPerHa: pasture?.areaHa ? currentHeads / pasture.areaHa : null,
      headsIn,
      headsOut,
      headDays,
      occupiedDays,
      stays,
      events: ownEvents,
      intervals,
      gmd,
      insufficient,
    };
  });

  const forageGroups = new Map<string, { label: string; pastureIds: string[] }>();
  for (const pasture of pastures) {
    const key = pastureKey(pasture.forage);
    if (!key) continue;
    const group = forageGroups.get(key) ?? { label: pasture.forage.trim(), pastureIds: [] };
    group.pastureIds.push(pasture.id);
    forageGroups.set(key, group);
  }
  const byForage: ForageComparison[] = [];
  for (const [key, group] of forageGroups) {
    const intervals = reports.filter((r) => group.pastureIds.includes(r.pastureId)).flatMap((r) => r.intervals);
    const gmd = aggregateGmd(intervals, category);
    if (gmd) byForage.push({ key, label: group.label, pastureIds: group.pastureIds, gmd });
  }
  byForage.sort((a, b) => b.gmd.gmdKg - a.gmd.gmdKg);

  reports.sort((a, b) => (a.pasture?.active === false ? 1 : 0) - (b.pasture?.active === false ? 1 : 0) || (a.pasture?.name ?? '').localeCompare(b.pasture?.name ?? '', 'pt-BR'));
  return { reports, byForage, unattributed, inconsistentLots };
}

export type PastureStatus =
  | { kind: 'ocupado'; since: string; days: number }
  | { kind: 'descanso'; since: string; days: number }
  | { kind: 'nunca' };

/**
 * O que o produtor olha para rodar os pastos: ocupado desde a chegada dos lotes que estão lá,
 * ou em descanso desde a última saída.
 */
export function pastureStatus(report: Pick<PastureReport, 'currentHeads' | 'stays'>, today: string): PastureStatus {
  if (report.currentHeads > 0) {
    const since = report.stays.filter((s) => s.end === null).reduce((min, s) => (s.start < min ? s.start : min), today);
    return { kind: 'ocupado', since, days: daysBetween(since, today) };
  }
  if (report.stays.length === 0) return { kind: 'nunca' };
  const since = report.stays.reduce((max, s) => ((s.end ?? today) > max ? (s.end ?? today) : max), report.stays[0].start);
  return { kind: 'descanso', since, days: daysBetween(since, today) };
}

/** Grupos atuais (confirmados) do lote, do maior para o menor. */
export function lotGroups(timeline: LotPastureTimeline | undefined): { pastureId: string; heads: number }[] {
  if (!timeline) return [];
  return [...timeline.heads.entries()].map(([pastureId, heads]) => ({ pastureId, heads })).sort((a, b) => b.heads - a.heads);
}
