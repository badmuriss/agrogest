import type { SQLiteDatabase } from 'expo-sqlite';

import { LEGACY_DEFAULT_PASTURE, legacyPastureId } from '@/domain/pasture';

/** v2: conta local, convites e app começando vazio (os dados de exemplo são opcionais). */
const SCHEMA_VERSION = 15;

const TABLES = [
  'users', 'operations', 'memberships', 'farms', 'pastures', 'lots', 'entries', 'invites', 'activity',
  'financial_accounts', 'categories', 'counterparties', 'supplies', 'payments', 'finance_docs', 'local_documents', 'settings',
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= SCHEMA_VERSION) return;

  if ((row?.user_version ?? 0) >= 2) {
    // Additive, atomic upgrades preserve lots and pending cloud commands.
    await db.withTransactionAsync(async () => {
      const version = row?.user_version ?? 0;
      if (version < 3) await db.execAsync(OUTBOX);
      if (version < 4) {
        await db.execAsync(`
          ALTER TABLE lots ADD COLUMN gta_numbers TEXT NOT NULL DEFAULT '[]';
          ALTER TABLE lots ADD COLUMN invoice_numbers TEXT NOT NULL DEFAULT '[]';
        `);
      }
      // v5: contorno da fazenda e posição do lote no mapa, em JSON.
      if (version < 5) await db.execAsync(`
        ALTER TABLE farms ADD COLUMN boundary TEXT;
        ALTER TABLE lots ADD COLUMN location TEXT;
      `);
      if (version < 6) await db.execAsync('ALTER TABLE invites ADD COLUMN context TEXT');
      if (version < 7) await db.execAsync("ALTER TABLE lots ADD COLUMN transfer TEXT NOT NULL DEFAULT '{}'");
      // v8: pastos estruturados; o nome em texto dos lotes vira referência, sem perder o texto.
      if (version < 8) {
        await db.execAsync(PASTURES);
        const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(lots)');
        if (!columns.some((c) => c.name === 'pasture_id')) await db.execAsync('ALTER TABLE lots ADD COLUMN pasture_id TEXT');
        await convertLegacyPastures(db);
      }
      // v9: contorno opcional do pasto no mapa, em JSON (a v8 acima já cria a tabela com ele).
      if (version < 9) {
        const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(pastures)');
        if (!columns.some((c) => c.name === 'boundary')) await db.execAsync('ALTER TABLE pastures ADD COLUMN boundary TEXT');
      }
      // v10: atividade da fazenda vinda do servidor, para abrir sem internet.
      if (version < 10) await db.execAsync(ACTIVITY);
      // v11: financeiro (contas, plano de contas, contatos, baixas) e insumos do estoque.
      // As contas a pagar e o saldo do estoque vêm dos lançamentos, que não mudam.
      if (version < 11) await db.execAsync(FINANCE_AND_STOCK);
      // v12: como a compra do lote é paga (parcelas por parte); lotes antigos ficam sem.
      if (version < 12) {
        const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(lots)');
        if (!columns.some((c) => c.name === 'purchase_plan')) await db.execAsync('ALTER TABLE lots ADD COLUMN purchase_plan TEXT');
      }
      // v13: identifica o criador para proteger o acesso na edição de pessoas.
      if (version < 13) {
        const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(operations)');
        if (columns.length > 0 && !columns.some((c) => c.name === 'owner_id')) await db.execAsync('ALTER TABLE operations ADD COLUMN owner_id TEXT');
      }
      // v14: gestão financeira (cartão, baixa por sócio ou adiantamento, movimentações, financiamentos,
      // renegociações, recorrências, orçamento e contas importadas). A fila e os dados ficam.
      if (version < 14) await addFinanceManagement(db);
      if (version < 15) await db.execAsync(LOCAL_DOCUMENTS);
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    });
    return;
  }

  // Protótipo: em vez de migrar a v1 (com dados fictícios), recomeça do zero.
  await db.execAsync(TABLES.map((t) => `DROP TABLE IF EXISTS ${t};`).join('\n'));
  await db.execAsync(`
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT);
    CREATE UNIQUE INDEX users_email ON users (email);
    CREATE TABLE operations (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, owner_id TEXT);
    CREATE TABLE memberships (
      operation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      share_pct REAL,
      PRIMARY KEY (operation_id, user_id)
    );
    CREATE TABLE farms (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      pasture_rent_cents INTEGER NOT NULL,
      city TEXT,
      boundary TEXT
    );
    CREATE TABLE lots (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      farm_id TEXT NOT NULL,
      management_group TEXT NOT NULL,
      supplier TEXT NOT NULL,
      category TEXT NOT NULL,
      purchased_at TEXT NOT NULL,
      heads_purchased INTEGER NOT NULL,
      entry_weight_kg REAL NOT NULL,
      purchase_cents INTEGER NOT NULL,
      commission_cents INTEGER NOT NULL,
      freight_cents INTEGER NOT NULL,
      gta_numbers TEXT NOT NULL DEFAULT '[]',
      invoice_numbers TEXT NOT NULL DEFAULT '[]',
      location TEXT,
      transfer TEXT NOT NULL DEFAULT '{}',
      pasture_id TEXT,
      purchase_plan TEXT
    );
    CREATE TABLE entries (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      farm_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      title TEXT NOT NULL,
      amount_cents INTEGER,
      occurred_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      decided_by TEXT,
      decided_at TEXT,
      decision_note TEXT,
      pending_decision TEXT,
      pending_decision_by TEXT,
      pending_decision_note TEXT,
      conflict_reason TEXT,
      history TEXT NOT NULL
    );
    CREATE INDEX entries_status ON entries (status);
    CREATE TABLE invites (
      id TEXT PRIMARY KEY NOT NULL,
      operation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      role TEXT NOT NULL,
      share_pct REAL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      context TEXT
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `);
  await db.execAsync(OUTBOX);
  await db.execAsync(PASTURES);
  await db.execAsync(ACTIVITY);
  await db.execAsync(FINANCE_AND_STOCK);
  await addFinanceManagement(db);
  await db.execAsync(LOCAL_DOCUMENTS);
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/**
 * Colunas do cartão e da origem da baixa, e uma tabela de documentos (JSON) para movimentações,
 * financiamentos, renegociações, recorrências, orçamentos e contas importadas. Idempotente.
 */
async function addFinanceManagement(db: SQLiteDatabase): Promise<void> {
  const has = async (table: string, column: string) =>
    (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).some((c) => c.name === column);
  if (!(await has('financial_accounts', 'closing_day'))) {
    await db.execAsync('ALTER TABLE financial_accounts ADD COLUMN closing_day INTEGER; ALTER TABLE financial_accounts ADD COLUMN due_day INTEGER;');
  }
  if (!(await has('payments', 'partner_id'))) {
    await db.execAsync('ALTER TABLE payments ADD COLUMN partner_id TEXT; ALTER TABLE payments ADD COLUMN partner_mode TEXT; ALTER TABLE payments ADD COLUMN advance_id TEXT;');
  }
  await db.execAsync(`CREATE TABLE IF NOT EXISTS finance_docs (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);`);
}

const FINANCE_AND_STOCK = `
CREATE TABLE IF NOT EXISTS financial_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  bank TEXT NOT NULL DEFAULT '',
  agency TEXT NOT NULL DEFAULT '',
  number TEXT NOT NULL DEFAULT '',
  opening_balance_cents INTEGER NOT NULL DEFAULT 0,
  opening_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  nature TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS counterparties (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  pix_key TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS supplies (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  unit TEXT NOT NULL,
  conversions TEXT NOT NULL DEFAULT '[]',
  min_quantity REAL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  account_id TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  items TEXT NOT NULL,
  interest_cents INTEGER NOT NULL DEFAULT 0,
  fine_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  method TEXT NOT NULL,
  proof TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  conflict_reason TEXT,
  author_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reversed_by TEXT,
  reversed_at TEXT,
  reverse_reason TEXT
);`;

const ACTIVITY = `CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  farm_id TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT,
  kind TEXT NOT NULL,
  at TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '{}'
);`;

const PASTURES = `CREATE TABLE IF NOT EXISTS pastures (
  id TEXT PRIMARY KEY NOT NULL,
  operation_id TEXT NOT NULL,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  area_ha REAL,
  forage TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  legacy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  boundary TEXT
);`;

/**
 * Cada nome de pasto em texto vira um pasto da fazenda, com o mesmo ID que o servidor gera
 * (`legacyPastureId`). Área e capim ficam em branco: não são inferidos. Idempotente.
 */
async function convertLegacyPastures(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(lots)');
  const has = (name: string) => columns.some((c) => c.name === name);
  if (!has('farm_id') || !has('management_group') || !has('operation_id')) return;
  const lots = await db.getAllAsync<{ id: string; farm_id: string; operation_id: string; management_group: string }>(
    'SELECT id, farm_id, operation_id, management_group FROM lots WHERE pasture_id IS NULL',
  );
  for (const lot of lots) {
    const name = lot.management_group.trim().replace(/\s+/g, ' ') || LEGACY_DEFAULT_PASTURE;
    const id = legacyPastureId(lot.farm_id, name);
    await db.runAsync(
      `INSERT OR IGNORE INTO pastures (id, operation_id, farm_id, name, area_ha, forage, notes, active, legacy, created_at)
       VALUES (?, ?, ?, ?, NULL, '', '', 1, 1, ?)`,
      [id, lot.operation_id, lot.farm_id, name, new Date().toISOString()],
    );
    await db.runAsync('UPDATE lots SET pasture_id = ? WHERE id = ?', [id, lot.id]);
  }
}

const OUTBOX = `CREATE TABLE IF NOT EXISTS cloud_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  error TEXT
);`;

/** Apaga tudo deste aparelho, inclusive a conta: volta para a tela de boas-vindas. */
export async function wipeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(TABLES.map((t) => `DELETE FROM ${t};`).join('\n'));
  await db.execAsync('DELETE FROM cloud_outbox;');
}

/** v15: image and OCR draft persist per authenticated account, outside snapshot replacement. */
const LOCAL_DOCUMENTS = `CREATE TABLE IF NOT EXISTS local_documents (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);`;
