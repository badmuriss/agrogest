import type * as Domain from '../../mobile/src/domain/types.ts';
import { ensure, type Env } from './contracts.ts';

export interface Tables {
  users: Domain.User; operations: Domain.Operation; memberships: Domain.Membership;
  farms: Domain.Farm; pastures: Domain.Pasture; lots: Domain.Lot; entries: Domain.Entry;
  invites: Domain.Invite; financialAccounts: Domain.FinancialAccount; categories: Domain.LedgerCategory;
  counterparties: Domain.Counterparty; payments: Domain.Payment; supplies: Domain.Supply;
  costCenters: Domain.CostCenter; costClassifications: Domain.CostClassification; movements: Domain.Movement;
  financings: Domain.Financing; renegotiations: Domain.Renegotiation; recurrences: Domain.Recurrence;
  budgets: Domain.Budget; titles: Domain.ImportedTitle;
}
export type State = { [K in keyof Tables]: Tables[K][] };
export const collections: (keyof Tables)[] = ['users', 'operations', 'memberships', 'farms', 'pastures', 'lots', 'entries', 'invites', 'financialAccounts', 'categories', 'counterparties', 'payments', 'supplies', 'costCenters', 'costClassifications', 'movements', 'financings', 'renegotiations', 'recurrences', 'budgets', 'titles'];
export const emptyState = (): State => Object.fromEntries(collections.map((c) => [c, []])) as unknown as State;
export const entityId = (collection: string, value: any): string => collection === 'memberships' ? `${value.operationId}:${value.userId}` : value.id;
export function member(state: State, actor: string, operationId: string, partner = false) {
  const row = state.memberships.find((m) => m.userId === actor && m.operationId === operationId);
  ensure(row && (!partner || row.role === 'socio'), 'Sua conta não tem permissão para esta operação.', 403, '42501');
  return row;
}
export async function load(env: Env) {
  const results = await env.DB.batch([
    env.DB.prepare('SELECT version FROM revisions WHERE id = 1'),
    env.DB.prepare('SELECT collection, data FROM entities'),
  ]);
  const state = emptyState();
  for (const row of results[1].results as { collection: keyof Tables; data: string }[]) {
    if (collections.includes(row.collection)) (state[row.collection] as unknown[]).push(JSON.parse(row.data));
  }
  return { state, version: (results[0].results[0] as { version: number }).version };
}
export function entityWrites(env: Env, before: State, after: State) {
  const statements: D1PreparedStatement[] = [];
  for (const collection of collections) {
    const old = new Map(before[collection].map((r) => [entityId(collection, r), JSON.stringify(r)]));
    const next = new Set<string>();
    for (const row of after[collection]) {
      const id = entityId(collection, row), data = JSON.stringify(row);
      next.add(id);
      if (old.get(id) !== data) statements.push(env.DB.prepare('INSERT INTO entities(collection,id,operation_id,data) VALUES(?,?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data,operation_id=excluded.operation_id').bind(collection, id, 'operationId' in row ? row.operationId : collection === 'operations' ? id : null, data));
    }
    for (const id of old.keys()) if (!next.has(id)) statements.push(env.DB.prepare('DELETE FROM entities WHERE collection=? AND id=?').bind(collection, id));
  }
  return statements;
}

/** The server, never the screen mode, controls which financial data leaves D1. */
export function project(state: State, actor: string) {
  const allowed = new Set(state.memberships.filter((m) => m.userId === actor).map((m) => m.operationId));
  const finance = new Set(state.memberships.filter((m) => m.userId === actor && m.role === 'socio').map((m) => m.operationId));
  const memberships = state.memberships.filter((m) => allowed.has(m.operationId));
  const people = new Set([actor, ...memberships.map((m) => m.userId)]);
  const result = emptyState();
  result.users = state.users.filter((u) => people.has(u.id));
  result.operations = state.operations.filter((o) => allowed.has(o.id));
  result.memberships = memberships;
  result.farms = state.farms.filter((f) => allowed.has(f.operationId));
  result.pastures = state.pastures.filter((p) => allowed.has(p.operationId));
  result.lots = state.lots.filter((l) => allowed.has(l.operationId)).map((l) => finance.has(l.operationId) ? l : { ...l, purchaseCents: 0, commissionCents: 0, freightCents: 0, purchasePlan: null, supplier: '', gtaNumbers: [], invoiceNumbers: [] });
  result.entries = state.entries.filter((e) => allowed.has(e.operationId) && (finance.has(e.operationId) || !['venda', 'receita', 'nota_fiscal', 'despesa', 'ajuste_estoque'].includes(e.kind) || (e.kind === 'despesa' && e.authorId === actor)))
    .map((e) => finance.has(e.operationId) || e.authorId === actor ? e : { ...e, amountCents: null, payload: { ...e.payload, costCents: undefined, unitCostCents: undefined } } as unknown as Domain.Entry);
  for (const c of collections.filter((c) => !['users', 'operations', 'memberships', 'farms', 'pastures', 'lots', 'entries', 'invites', 'supplies'].includes(c))) {
    (result[c] as unknown[]) = state[c].filter((row) => 'operationId' in row && typeof row.operationId === 'string' && finance.has(row.operationId));
  }
  result.supplies = state.supplies.filter((s) => allowed.has(s.operationId));
  const email = state.users.find((u) => u.id === actor)?.email;
  result.invites = state.invites.filter((i) => finance.has(i.operationId) || i.contact.toLowerCase() === email?.toLowerCase()).map((i) => ({ ...i, context: { inviterName: state.users.find((u) => u.id === i.createdBy)?.name ?? 'Sócio', operationName: state.operations.find((o) => o.id === i.operationId)?.name ?? '', farmNames: state.farms.filter((f) => f.operationId === i.operationId).map((f) => f.name) } }));
  return { ...result, activity: [] };
}
