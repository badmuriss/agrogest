import type { SQLiteDatabase } from 'expo-sqlite';

import type { ActivityItem } from '@/domain/activity';
import type {
  Budget,
  CostCenter,
  CostClassification,
  Counterparty,
  Entry,
  Farm,
  Financing,
  FinancialAccount,
  ImportedTitle,
  Invite,
  LedgerCategory,
  Lot,
  Membership,
  Movement,
  Operation,
  Pasture,
  Payment,
  Recurrence,
  Renegotiation,
  Supply,
  User,
} from '@/domain/types';

/** Documentos financeiros guardados como JSON em `finance_docs`, pelo tipo. */
export interface FinanceDocs {
  costCenters: CostCenter[];
  costClassifications: CostClassification[];
  movements: Movement[];
  financings: Financing[];
  renegotiations: Renegotiation[];
  recurrences: Recurrence[];
  budgets: Budget[];
  titles: ImportedTitle[];
}

export const FINANCE_DOC_KINDS = ['movements', 'financings', 'renegotiations', 'recurrences', 'budgets', 'titles', 'costCenters', 'costClassifications'] as const;
export type FinanceDocKind = (typeof FINANCE_DOC_KINDS)[number];

export interface Snapshot extends FinanceDocs {
  users: User[];
  operations: Operation[];
  memberships: Membership[];
  farms: Farm[];
  pastures: Pasture[];
  lots: Lot[];
  entries: Entry[];
  invites: Invite[];
  /** Atividade vinda do servidor (vazia no protótipo local). */
  activity: ActivityItem[];
  /** Financeiro: só chega do servidor para sócios. */
  accounts: FinancialAccount[];
  /** Só as categorias criadas pela operação; as padrão vêm do domínio. */
  categories: LedgerCategory[];
  counterparties: Counterparty[];
  payments: Payment[];
  supplies: Supply[];
  settings: Record<string, string>;
}


/** O que o servidor devolve; os campos novos faltam em respostas de versões anteriores. */
export type CloudWorkspace = Omit<
  Snapshot,
  'settings' | 'pastures' | 'activity' | 'accounts' | 'categories' | 'counterparties' | 'payments' | 'supplies' | FinanceDocKind
> & Partial<FinanceDocs> & {
  pastures?: Pasture[];
  activity?: ActivityItem[];
  financialAccounts?: FinancialAccount[];
  categories?: LedgerCategory[];
  counterparties?: Counterparty[];
  payments?: Payment[];
  supplies?: Supply[];
};

const FINANCE_TABLES = ['financial_accounts', 'categories', 'counterparties', 'payments', 'supplies', 'finance_docs'];

/** Uma recusa de acesso atualiza a operação mesmo com fila; os comandos e as outras operações ficam intactos. */
export async function refreshOperationAccess(db: SQLiteDatabase, authorized: CloudWorkspace, operationId: string): Promise<void> {
  const local = await loadSnapshot(db);
  const merge = <T extends { operationId: string }>(oldRows: T[], newRows: T[]) => [
    ...oldRows.filter((row) => row.operationId !== operationId), ...newRows.filter((row) => row.operationId === operationId),
  ];
  await replaceCloudSnapshot(db, {
    users: [...new Map([...local.users, ...authorized.users].map((u) => [u.id, u])).values()],
    operations: [...local.operations.filter((o) => o.id !== operationId), ...authorized.operations.filter((o) => o.id === operationId)],
    memberships: merge(local.memberships, authorized.memberships),
    farms: merge(local.farms, authorized.farms),
    lots: merge(local.lots, authorized.lots),
    entries: merge(local.entries, authorized.entries),
    invites: merge(local.invites, authorized.invites),
    pastures: merge(local.pastures, authorized.pastures ?? []),
    activity: merge(local.activity, authorized.activity ?? []),
    financialAccounts: merge(local.accounts, authorized.financialAccounts ?? []),
    categories: [...local.categories.filter((c) => c.operationId !== operationId), ...(authorized.categories ?? []).filter((c) => c.operationId === operationId)],
    counterparties: merge(local.counterparties, authorized.counterparties ?? []),
    payments: merge(local.payments, authorized.payments ?? []),
    supplies: merge(local.supplies, authorized.supplies ?? []),
    ...Object.fromEntries(FINANCE_DOC_KINDS.map((kind) => [kind, merge<{ operationId: string }>(local[kind], authorized[kind] ?? [])])),
  });
}

/** Tabelas com `operation_id`, limpas quando o acesso a uma operação é revogado. */
export const OPERATION_TABLES = ['entries', 'invites', 'lots', 'pastures', 'farms', 'memberships', ...FINANCE_TABLES];

/** Caller holds the cloud write transaction. Settings and the durable queue survive. */
export async function replaceCloudSnapshot(db: SQLiteDatabase, snapshot: CloudWorkspace): Promise<void> {
  for (const table of ['activity', 'entries', 'invites', 'lots', 'pastures', 'farms', 'memberships', 'operations', 'users', ...FINANCE_TABLES]) {
    await db.execAsync(`DELETE FROM ${table}`);
  }
  for (const user of snapshot.users) await insertUser(db, user);
  for (const operation of snapshot.operations) await insertOperation(db, operation);
  for (const membership of snapshot.memberships) await insertMembership(db, membership);
  for (const farm of snapshot.farms) await saveFarm(db, farm);
  for (const pasture of snapshot.pastures ?? []) await savePasture(db, pasture);
  for (const lot of snapshot.lots) await insertLot(db, lot);
  for (const entry of snapshot.entries) {
    await saveEntry(db, entry);
    if (entry.version) await setSetting(db, `entryVersion:${entry.id}`, String(entry.version));
  }
  for (const invite of snapshot.invites) await insertInvite(db, invite);
  for (const item of snapshot.activity ?? []) await saveActivity(db, item);
  for (const account of snapshot.financialAccounts ?? []) await saveAccount(db, account);
  for (const category of snapshot.categories ?? []) await saveCategory(db, category);
  for (const counterparty of snapshot.counterparties ?? []) await saveCounterparty(db, counterparty);
  for (const payment of snapshot.payments ?? []) await savePayment(db, payment);
  for (const supply of snapshot.supplies ?? []) await saveSupply(db, supply);
  for (const kind of FINANCE_DOC_KINDS) {
    for (const doc of snapshot[kind] ?? []) await saveDoc(db, kind, doc);
  }
}

/** Movimentação, financiamento, renegociação, recorrência, orçamento ou conta importada. */
export async function saveDoc(db: SQLiteDatabase, kind: FinanceDocKind, doc: { id: string; operationId: string }): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO finance_docs (kind, id, operation_id, data) VALUES (?, ?, ?, ?)', [kind, doc.id, doc.operationId, JSON.stringify(doc)]);
}

export async function saveAccount(db: SQLiteDatabase, a: FinancialAccount): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO financial_accounts (id, operation_id, name, kind, bank, agency, number, opening_balance_cents, opening_date, active, created_at,
       closing_day, due_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.operationId, a.name, a.kind, a.bank, a.agency, a.number, a.openingBalanceCents, a.openingDate, a.active ? 1 : 0, a.createdAt,
      a.closingDay ?? null, a.dueDay ?? null],
  );
}

export async function saveCategory(db: SQLiteDatabase, c: LedgerCategory): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO categories (id, operation_id, name, nature, active) VALUES (?, ?, ?, ?, ?)', [
    c.id,
    c.operationId ?? '',
    c.name,
    c.nature,
    c.active ? 1 : 0,
  ]);
}

export async function saveCounterparty(db: SQLiteDatabase, c: Counterparty): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO counterparties (id, operation_id, name, kind, document, contact, pix_key, notes, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.id, c.operationId, c.name, c.kind, c.document, c.contact, c.pixKey, c.notes, c.active ? 1 : 0, c.createdAt],
  );
}

export async function saveSupply(db: SQLiteDatabase, x: Supply): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO supplies (id, operation_id, name, kind, unit, conversions, min_quantity, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [x.id, x.operationId, x.name, x.kind, x.unit, JSON.stringify(x.conversions ?? []), x.minQuantity, x.active ? 1 : 0, x.createdAt],
  );
}

/** Baixas não são apagadas: estorno e descarte mudam a situação. */
export async function savePayment(db: SQLiteDatabase, p: Payment): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO payments (id, operation_id, direction, account_id, paid_at, items, interest_cents, fine_cents, discount_cents,
       method, proof, notes, status, conflict_reason, author_id, created_at, reversed_by, reversed_at, reverse_reason, partner_id, partner_mode, advance_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    // A coluna da conta é obrigatória desde a v11: sem conta (sócio ou adiantamento), fica vazia.
    [p.id, p.operationId, p.direction, p.accountId ?? '', p.paidAt, JSON.stringify(p.items), p.interestCents, p.fineCents, p.discountCents,
      p.method, p.proof, p.notes, p.status, p.conflictReason, p.authorId, p.createdAt, p.reversedBy, p.reversedAt, p.reverseReason,
      p.partnerId ?? null, p.partnerMode ?? null, p.advanceId ?? null],
  );
}

export async function saveActivity(db: SQLiteDatabase, a: ActivityItem): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO activity (id, operation_id, farm_id, actor_id, actor_name, kind, at, subject) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [a.id, a.operationId, a.farmId, a.actorId, a.actorName, a.kind, a.at, JSON.stringify(a.subject ?? {})],
  );
}

interface EntryRow {
  id: string;
  kind: string;
  status: string;
  operation_id: string;
  farm_id: string;
  author_id: string;
  title: string;
  amount_cents: number | null;
  occurred_at: string;
  created_at: string;
  payload: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  pending_decision: string | null;
  pending_decision_by: string | null;
  pending_decision_note: string | null;
  conflict_reason: string | null;
  history: string;
}

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    operationId: row.operation_id,
    farmId: row.farm_id,
    authorId: row.author_id,
    title: row.title,
    amountCents: row.amount_cents,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    payload: JSON.parse(row.payload),
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    pendingDecision: row.pending_decision,
    pendingDecisionBy: row.pending_decision_by,
    pendingDecisionNote: row.pending_decision_note,
    conflictReason: row.conflict_reason,
    history: JSON.parse(row.history),
  } as Entry;
}

export async function loadSnapshot(db: SQLiteDatabase): Promise<Snapshot> {
  const users = await db.getAllAsync<User>('SELECT id, name, email FROM users ORDER BY name');
  const operations = await db.getAllAsync<Operation>('SELECT id, name, owner_id AS ownerId FROM operations ORDER BY name');
  const memberships = await db.getAllAsync<Membership>(
    'SELECT operation_id AS operationId, user_id AS userId, role, share_pct AS sharePct FROM memberships',
  );
  const farms = await db.getAllAsync<Omit<Farm, 'boundary'> & { boundary: string | null }>(
    'SELECT id, name, operation_id AS operationId, pasture_rent_cents AS pastureRentCents, city, boundary FROM farms ORDER BY name',
  );
  const pastures = await db.getAllAsync<Omit<Pasture, 'active' | 'legacy' | 'boundary'> & { active: number; legacy: number; boundary: string | null }>(
    `SELECT id, operation_id AS operationId, farm_id AS farmId, name, area_ha AS areaHa, forage, notes, active, legacy,
       created_at AS createdAt, boundary
     FROM pastures ORDER BY name`,
  );
  const lots = await db.getAllAsync<
    Omit<Lot, 'gtaNumbers' | 'invoiceNumbers' | 'location' | 'transfer' | 'purchasePlan'> & {
      gtaNumbers: string;
      invoiceNumbers: string;
      location: string | null;
      transfer: string;
      purchasePlan: string | null;
    }
  >(
    `SELECT id, code, operation_id AS operationId, farm_id AS farmId, management_group AS managementGroup,
       supplier, category, purchased_at AS purchasedAt, heads_purchased AS headsPurchased,
       entry_weight_kg AS entryWeightKg, purchase_cents AS purchaseCents,
       commission_cents AS commissionCents, freight_cents AS freightCents,
       gta_numbers AS gtaNumbers, invoice_numbers AS invoiceNumbers, location, transfer, pasture_id AS pastureId,
       purchase_plan AS purchasePlan
     FROM lots ORDER BY code`,
  );
  const entryRows = await db.getAllAsync<EntryRow>('SELECT * FROM entries ORDER BY created_at DESC');
  const invites = await db.getAllAsync<Omit<Invite, 'context'> & { context: string | null }>(
    `SELECT id, operation_id AS operationId, name, contact, role, share_pct AS sharePct, created_at AS createdAt,
       created_by AS createdBy, context
     FROM invites ORDER BY created_at`,
  );
  const activity = await db.getAllAsync<Omit<ActivityItem, 'subject'> & { subject: string }>(
    `SELECT id, operation_id AS operationId, farm_id AS farmId, actor_id AS actorId, actor_name AS actorName, kind, at, subject
     FROM activity ORDER BY at DESC`,
  );
  const accounts = await db.getAllAsync<Omit<FinancialAccount, 'active'> & { active: number }>(
    `SELECT id, operation_id AS operationId, name, kind, bank, agency, number, opening_balance_cents AS openingBalanceCents,
       opening_date AS openingDate, active, created_at AS createdAt, closing_day AS closingDay, due_day AS dueDay
     FROM financial_accounts ORDER BY name`,
  );
  const categories = await db.getAllAsync<Omit<LedgerCategory, 'active'> & { active: number }>(
    'SELECT id, operation_id AS operationId, name, nature, active FROM categories ORDER BY name',
  );
  const counterparties = await db.getAllAsync<Omit<Counterparty, 'active'> & { active: number }>(
    `SELECT id, operation_id AS operationId, name, kind, document, contact, pix_key AS pixKey, notes, active, created_at AS createdAt
     FROM counterparties ORDER BY name`,
  );
  const supplies = await db.getAllAsync<Omit<Supply, 'active' | 'conversions'> & { active: number; conversions: string }>(
    `SELECT id, operation_id AS operationId, name, kind, unit, conversions, min_quantity AS minQuantity, active, created_at AS createdAt
     FROM supplies ORDER BY name`,
  );
  const payments = await db.getAllAsync<Omit<Payment, 'items'> & { items: string }>(
    `SELECT id, operation_id AS operationId, direction, account_id AS accountId, paid_at AS paidAt, items, interest_cents AS interestCents,
       fine_cents AS fineCents, discount_cents AS discountCents, method, proof, notes, status, conflict_reason AS conflictReason,
       author_id AS authorId, created_at AS createdAt, reversed_by AS reversedBy, reversed_at AS reversedAt, reverse_reason AS reverseReason,
       partner_id AS partnerId, partner_mode AS partnerMode, advance_id AS advanceId
     FROM payments ORDER BY paid_at DESC, created_at DESC`,
  );
  const docRows = await db.getAllAsync<{ kind: FinanceDocKind; data: string }>('SELECT kind, data FROM finance_docs ORDER BY rowid');
  const docs = Object.fromEntries(FINANCE_DOC_KINDS.map((kind) => [kind, [] as unknown[]])) as unknown as FinanceDocs;
  for (const row of docRows) (docs[row.kind] as unknown[] | undefined)?.push(JSON.parse(row.data));
  const settingRows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return {
    users,
    operations,
    memberships,
    farms: farms.map((farm) => ({ ...farm, boundary: farm.boundary ? JSON.parse(farm.boundary) : null })),
    pastures: pastures.map((p) => ({ ...p, active: p.active === 1, legacy: p.legacy === 1, boundary: p.boundary ? JSON.parse(p.boundary) : null })),
    lots: lots.map((lot) => ({
      ...lot,
      gtaNumbers: JSON.parse(lot.gtaNumbers),
      invoiceNumbers: JSON.parse(lot.invoiceNumbers),
      location: lot.location ? JSON.parse(lot.location) : null,
      transfer: JSON.parse(lot.transfer || '{}'),
      purchasePlan: lot.purchasePlan ? JSON.parse(lot.purchasePlan) : null,
    })),
    entries: entryRows.map(rowToEntry),
    invites: invites.map((i) => ({ ...i, context: i.context ? JSON.parse(i.context) : undefined })),
    activity: activity.map((a) => ({ ...a, subject: JSON.parse(a.subject || '{}') })),
    accounts: accounts.map((a) => ({ ...a, active: a.active === 1 })),
    categories: categories.map((c) => ({ ...c, active: c.active === 1 })),
    counterparties: counterparties.map((c) => ({ ...c, active: c.active === 1 })),
    supplies: supplies.map((x) => ({ ...x, active: x.active === 1, conversions: JSON.parse(x.conversions || '[]') })),
    payments: payments.map((p) => ({ ...p, accountId: p.accountId || null, items: JSON.parse(p.items) })),
    ...docs,
    settings: Object.fromEntries(settingRows.map((r) => [r.key, r.value])),
  };
}

export async function saveEntry(db: SQLiteDatabase, e: Entry): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO entries (id, kind, status, operation_id, farm_id, author_id, title, amount_cents,
       occurred_at, created_at, payload, decided_by, decided_at, decision_note, pending_decision,
       pending_decision_by, pending_decision_note, conflict_reason, history)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.id,
      e.kind,
      e.status,
      e.operationId,
      e.farmId,
      e.authorId,
      e.title,
      e.amountCents,
      e.occurredAt,
      e.createdAt,
      JSON.stringify(e.payload),
      e.decidedBy,
      e.decidedAt,
      e.decisionNote,
      e.pendingDecision,
      e.pendingDecisionBy,
      e.pendingDecisionNote,
      e.conflictReason,
      JSON.stringify(e.history),
    ],
  );
}

export async function deleteEntry(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export async function deleteSetting(db: SQLiteDatabase, key: string): Promise<void> {
  await db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
}

export async function insertUser(db: SQLiteDatabase, u: User): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO users (id, name, email) VALUES (?, ?, ?)', [u.id, u.name, u.email]);
}

export async function insertOperation(db: SQLiteDatabase, o: Operation): Promise<void> {
  await db.runAsync('INSERT INTO operations (id, name, owner_id) VALUES (?, ?, ?)', [o.id, o.name, o.ownerId ?? null]);
}

export async function deleteMembership(db: SQLiteDatabase, operationId: string, userId: string): Promise<void> {
  await db.runAsync('DELETE FROM memberships WHERE operation_id = ? AND user_id = ?', [operationId, userId]);
}

export async function insertMembership(db: SQLiteDatabase, m: Membership): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO memberships (operation_id, user_id, role, share_pct) VALUES (?, ?, ?, ?)', [
    m.operationId,
    m.userId,
    m.role,
    m.sharePct,
  ]);
}

export async function saveFarm(db: SQLiteDatabase, f: Farm): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO farms (id, name, operation_id, pasture_rent_cents, city, boundary) VALUES (?, ?, ?, ?, ?, ?)',
    [f.id, f.name, f.operationId, f.pastureRentCents, f.city, f.boundary ? JSON.stringify(f.boundary) : null],
  );
}

export async function setFarmBoundary(db: SQLiteDatabase, farmId: string, boundary: Farm['boundary']): Promise<void> {
  await db.runAsync('UPDATE farms SET boundary = ? WHERE id = ?', [boundary ? JSON.stringify(boundary) : null, farmId]);
}

export async function setLotLocation(db: SQLiteDatabase, lotId: string, location: Lot['location']): Promise<void> {
  await db.runAsync('UPDATE lots SET location = ? WHERE id = ?', [location ? JSON.stringify(location) : null, lotId]);
}

/** Cadastro e edição de pasto. Não há exclusão: pastos com histórico só são inativados. */
export async function savePasture(db: SQLiteDatabase, p: Pasture): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO pastures (id, operation_id, farm_id, name, area_ha, forage, notes, active, legacy, created_at, boundary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.id, p.operationId, p.farmId, p.name, p.areaHa, p.forage, p.notes, p.active ? 1 : 0, p.legacy ? 1 : 0, p.createdAt,
      p.boundary ? JSON.stringify(p.boundary) : null],
  );
}

/** Só para pasto nunca usado (ver `pastureInUse`). */
export async function deletePasture(db: SQLiteDatabase, pastureId: string): Promise<void> {
  await db.runAsync('DELETE FROM pastures WHERE id = ?', [pastureId]);
}

export async function setPastureBoundary(db: SQLiteDatabase, pastureId: string, boundary: Pasture['boundary']): Promise<void> {
  await db.runAsync('UPDATE pastures SET boundary = ? WHERE id = ?', [boundary ? JSON.stringify(boundary) : null, pastureId]);
}

export async function insertLot(db: SQLiteDatabase, l: Lot): Promise<void> {
  await db.runAsync(
    `INSERT INTO lots (id, code, operation_id, farm_id, management_group, supplier, category, purchased_at,
       heads_purchased, entry_weight_kg, purchase_cents, commission_cents, freight_cents, gta_numbers, invoice_numbers, location, transfer, pasture_id,
       purchase_plan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      l.id,
      l.code,
      l.operationId,
      l.farmId,
      l.managementGroup,
      l.supplier,
      l.category,
      l.purchasedAt,
      l.headsPurchased,
      l.entryWeightKg,
      l.purchaseCents,
      l.commissionCents,
      l.freightCents,
      JSON.stringify(l.gtaNumbers ?? []),
      JSON.stringify(l.invoiceNumbers ?? []),
      l.location ? JSON.stringify(l.location) : null,
      JSON.stringify(l.transfer ?? {}),
      l.pastureId ?? null,
      l.purchasePlan ? JSON.stringify(l.purchasePlan) : null,
    ],
  );
}

/** Como a compra do lote é paga; `null` apaga (lote sem pagamento informado). */
export async function setLotPurchasePlan(db: SQLiteDatabase, lotId: string, plan: Lot['purchasePlan']): Promise<void> {
  await db.runAsync('UPDATE lots SET purchase_plan = ? WHERE id = ?', [plan ? JSON.stringify(plan) : null, lotId]);
}

/** Corrige os dados de raiz do lote. Fazenda e operação não mudam: os lançamentos dependem delas. */
export async function updateLot(db: SQLiteDatabase, l: Lot): Promise<void> {
  await db.runAsync(
    `UPDATE lots SET code = ?, management_group = ?, pasture_id = ?, supplier = ?, category = ?, purchased_at = ?, heads_purchased = ?,
       entry_weight_kg = ?, purchase_cents = ?, commission_cents = ?, freight_cents = ?, gta_numbers = ?, invoice_numbers = ?
     WHERE id = ?`,
    [
      l.code,
      l.managementGroup,
      l.pastureId ?? null,
      l.supplier,
      l.category,
      l.purchasedAt,
      l.headsPurchased,
      l.entryWeightKg,
      l.purchaseCents,
      l.commissionCents,
      l.freightCents,
      JSON.stringify(l.gtaNumbers ?? []),
      JSON.stringify(l.invoiceNumbers ?? []),
      l.id,
    ],
  );
}

export async function insertInvite(db: SQLiteDatabase, i: Invite): Promise<void> {
  await db.runAsync(
    `INSERT INTO invites (id, operation_id, name, contact, role, share_pct, created_at, created_by, context)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.id, i.operationId, i.name, i.contact, i.role, i.sharePct, i.createdAt, i.createdBy, i.context ? JSON.stringify(i.context) : null],
  );
}

export async function deleteInvite(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM invites WHERE id = ?', [id]);
}

/** Server-confirmed movement metadata; no purchase/history rows are overwritten. */
export async function setLotTransfer(db: SQLiteDatabase, id: string, transfer: Lot['transfer']): Promise<void> {
  await db.runAsync('UPDATE lots SET transfer = ?, location = NULL WHERE id = ?', [JSON.stringify(transfer ?? {}), id]);
}
