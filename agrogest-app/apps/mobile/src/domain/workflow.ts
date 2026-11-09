import { approvalBlockReason, requiresApproval } from './approval';
import { summarizeLot } from './lot-metrics';
import { pastureConflict, RESERVING, CONFIRMED } from './pasture';
import { stockConflict, type StockMode } from './stock';
import type {
  Decision,
  Entry,
  EntryStatus,
  Farm,
  HistoryItem,
  Lot,
  Membership,
  NfExtraction,
  Pasture,
  Supply,
} from './types';

/** Simula o que o servidor teria em mãos ao validar comandos. */
export interface WorkflowContext {
  lots: Lot[];
  farms: Farm[];
  memberships: Membership[];
  entries: Entry[];
  pastures: Pasture[];
  supplies?: Supply[];
  today: string;
  now: string;
}

/** Saldo do estoque: consumo, transferência e perda precisam caber em todas as datas. */
function stockCheck(ctx: WorkflowContext, entry: Entry, mode: StockMode): string | null {
  return stockConflict(ctx.entries, entry, mode, {
    supply: (id) => ctx.supplies?.find((s) => s.id === id),
    farm: (id) => ctx.farms.find((f) => f.id === id)?.name ?? 'esta fazenda',
  });
}

export const SYSTEM_USER = 'sistema';

export function withHistory<T extends Entry>(entry: T, item: HistoryItem): T {
  return { ...entry, history: [...entry.history, item] };
}

export function submittedStatus(online: boolean): EntryStatus {
  return online ? 'aguardando_aprovacao' : 'aguardando_envio';
}

/** Efetivado sem segunda aprovação porque ninguém mais na operação podia aprovar. */
export function isDirect(entry: Pick<Entry, 'status' | 'decidedBy'>): boolean {
  return entry.status === 'aprovado' && entry.decidedBy === SYSTEM_USER;
}

function headsRequested(entry: Entry): { lotId: string; heads: number } | null {
  if (entry.kind === 'mortalidade' || entry.kind === 'venda') {
    return { lotId: entry.payload.lotId, heads: entry.payload.heads };
  }
  return null;
}

export function confirmedHeads(ctx: WorkflowContext, lotId: string, excludeEntryId?: string): number {
  const lot = ctx.lots.find((l) => l.id === lotId);
  if (!lot) return 0;
  const rent = ctx.farms.find((f) => f.id === lot.farmId)?.pastureRentCents ?? 0;
  const entries = ctx.entries.filter((e) => e.id !== excludeEntryId);
  return summarizeLot(lot, entries, rent, ctx.today).headsCurrent;
}

/** Saldo por pasto: movimentações, baixas e pesagens precisam caber no grupo daquele pasto. */
function pastureCheck(ctx: WorkflowContext, entry: Entry, reserve: boolean): string | null {
  if (entry.kind !== 'manejo' && entry.kind !== 'mortalidade' && entry.kind !== 'venda' && entry.kind !== 'pesagem') return null;
  const lot = ctx.lots.find((l) => l.id === entry.payload.lotId);
  if (!lot) return null;
  const name = (id: string) => ctx.pastures.find((p) => p.id === id)?.name ?? 'O pasto';
  return pastureConflict(lot, ctx.entries, entry, reserve ? RESERVING : CONFIRMED, name);
}

/** Ao receber o comando: a baixa cabe no saldo, somando outras baixas já pendentes? (cenário E) */
export function receiveConflict(ctx: WorkflowContext, entry: Entry): string | null {
  const byPasture = pastureCheck(ctx, entry, true);
  if (byPasture) return byPasture;
  const byStock = stockCheck(ctx, entry, 'reserva');
  if (byStock) return byStock;
  const request = headsRequested(entry);
  if (!request) return null;
  const available = confirmedHeads(ctx, request.lotId, entry.id);
  const reserved = ctx.entries
    .filter((e) => e.id !== entry.id && e.status === 'aguardando_aprovacao')
    .map(headsRequested)
    .filter((r) => r?.lotId === request.lotId)
    .reduce((acc, r) => acc + (r?.heads ?? 0), 0);
  if (request.heads + reserved <= available) return null;
  if (reserved > 0) {
    return `O lote tem ${available} cabeças confirmadas e ${reserved} já reservadas em outros lançamentos pendentes. Este pede ${request.heads}.`;
  }
  return `O lote tem ${available} cabeças confirmadas, mas este lançamento pede ${request.heads}. Outro celular pode ter registrado uma baixa antes.`;
}

/** Na aprovação: o saldo confirmado ainda comporta a baixa? Nunca consolida saldo negativo (RN-12). */
function approvalConflict(ctx: WorkflowContext, entry: Entry): string | null {
  const byPasture = pastureCheck(ctx, entry, false);
  if (byPasture) return byPasture;
  const byStock = stockCheck(ctx, entry, 'confirmado');
  if (byStock) return byStock;
  const request = headsRequested(entry);
  if (!request) return null;
  const available = confirmedHeads(ctx, request.lotId, entry.id);
  return request.heads > available
    ? `O saldo confirmado do lote é ${available} cabeças; este lançamento pede ${request.heads}.`
    : null;
}

function clearPending<T extends Entry>(entry: T): T {
  return { ...entry, pendingDecision: null, pendingDecisionBy: null, pendingDecisionNote: null };
}

function applyDecision(
  ctx: WorkflowContext,
  entry: Entry,
  userId: string,
  decision: Decision,
  note: string,
): Entry {
  const base = clearPending(entry);
  if (decision === 'recusar') {
    return withHistory(
      { ...base, status: 'rejeitado', decidedBy: userId, decidedAt: ctx.now, decisionNote: note || null },
      { at: ctx.now, by: userId, action: 'recusado', note },
    );
  }
  const conflict = approvalConflict(ctx, entry);
  if (conflict) {
    return withHistory(
      { ...base, status: 'conflito', conflictReason: conflict },
      { at: ctx.now, by: SYSTEM_USER, action: 'conflito', note: conflict },
    );
  }
  return withHistory(
    { ...base, status: 'aprovado', decidedBy: userId, decidedAt: ctx.now, decisionNote: note || null },
    { at: ctx.now, by: userId, action: 'aprovado', note: note || undefined },
  );
}

/** Online a decisão é validada na hora; offline vira intenção pendente, nunca "aprovado". */
export function decide(
  ctx: WorkflowContext,
  entry: Entry,
  userId: string,
  decision: Decision,
  note: string,
  online: boolean,
): Entry {
  const reason = approvalBlockReason(userId, entry, ctx.memberships);
  if (reason) throw new Error(reason);
  if (online) return applyDecision(ctx, entry, userId, decision, note);
  return withHistory(
    { ...entry, pendingDecision: decision, pendingDecisionBy: userId, pendingDecisionNote: note || null },
    {
      at: ctx.now,
      by: userId,
      action: decision === 'aprovar' ? 'intencao_aprovar' : 'intencao_recusar',
      note: note || undefined,
    },
  );
}

/**
 * Lançamento enviado com conexão: o servidor recebe e valida na hora. Sem outra pessoa
 * habilitada a aprovar, já é efetivado (veja `requiresApproval`).
 */
export function receive(ctx: WorkflowContext, entry: Entry): Entry {
  const conflict = receiveConflict(ctx, entry);
  if (conflict) {
    return withHistory(
      { ...entry, status: 'conflito', conflictReason: conflict },
      { at: ctx.now, by: SYSTEM_USER, action: 'conflito', note: conflict },
    );
  }
  if (!requiresApproval(entry, ctx.memberships)) {
    return withHistory(
      { ...entry, status: 'aprovado', conflictReason: null, decidedBy: SYSTEM_USER, decidedAt: ctx.now },
      { at: ctx.now, by: SYSTEM_USER, action: 'efetivado' },
    );
  }
  return withHistory(
    { ...entry, status: 'aguardando_aprovacao', conflictReason: null },
    { at: ctx.now, by: SYSTEM_USER, action: 'recebido' },
  );
}

/**
 * Sincronização simulada: envia a fila local, roda a leitura por IA das notas que aguardavam
 * internet e valida as decisões tomadas offline. Retorna só os lançamentos alterados.
 */
export function syncAll(ctx: WorkflowContext, extract: () => NfExtraction): Entry[] {
  let working = [...ctx.entries];
  const changed = new Map<string, Entry>();
  const update = (entry: Entry) => {
    working = working.map((e) => (e.id === entry.id ? entry : e));
    changed.set(entry.id, entry);
  };
  const current = (id: string) => working.find((e) => e.id === id)!;
  const order = [...ctx.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((e) => e.id);

  for (const id of order) {
    const entry = current(id);
    if (entry.status !== 'aguardando_envio') continue;
    if (entry.kind === 'nota_fiscal' && entry.payload.stage === 'aguardando_conexao') {
      update(
        withHistory(
          {
            ...entry,
            status: 'rascunho',
            payload: { ...entry.payload, stage: 'pronta_para_revisao', extraction: extract() },
          },
          { at: ctx.now, by: SYSTEM_USER, action: 'ia_extraiu' },
        ),
      );
      continue;
    }
    update(receive({ ...ctx, entries: working }, entry));
  }

  for (const id of order) {
    const entry = current(id);
    if (!entry.pendingDecision || !entry.pendingDecisionBy) continue;
    const by = entry.pendingDecisionBy;
    const reason =
      entry.status !== 'aguardando_aprovacao'
        ? 'O lançamento mudou de situação antes da sincronização.'
        : approvalBlockReason(by, entry, ctx.memberships);
    if (reason) {
      update(withHistory(clearPending(entry), { at: ctx.now, by, action: 'intencao_descartada', note: reason }));
      continue;
    }
    update(
      applyDecision({ ...ctx, entries: working }, entry, by, entry.pendingDecision, entry.pendingDecisionNote ?? ''),
    );
  }

  return [...changed.values()];
}
