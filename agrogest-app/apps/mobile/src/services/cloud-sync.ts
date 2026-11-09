import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

import * as repo from '@/db/repo';
import { nowISO } from '@/domain/dates';
import type { Entry } from '@/domain/types';

import { cloudToken, requireSupabase } from './supabase';
import type { Json } from './database.types';
import { cloudTask } from './cloud-task';

export type CloudCommandKind = 'create_farm' | 'update_farm' | 'create_pasture' | 'update_pasture' | 'create_lot' | 'update_lot' | 'update_farm_boundary' | 'update_pasture_boundary' | 'delete_pasture' | 'place_lot' | 'invite' | 'accept_invite' | 'cancel_invite' | 'save_entry' | 'decide_entry' | 'discard_entry'
  | 'create_account' | 'update_account' | 'create_category' | 'save_counterparty' | 'register_payment' | 'reverse_payment' | 'create_supply' | 'update_supply'
  | 'set_lot_payment_plan' | 'register_movement' | 'reverse_movement' | 'save_financing' | 'renegotiate' | 'undo_renegotiation'
  | 'save_recurrence' | 'set_budget' | 'import_titles' | 'save_cost_center' | 'classify_cost';
export interface CloudCommand { id: string; kind: CloudCommandKind; payload: Record<string, unknown>; error: string | null }
type CommandRow = Omit<CloudCommand, 'payload'> & { payload: string };
type Workspace = repo.CloudWorkspace;

const writes = new WeakMap<SQLiteDatabase, Promise<unknown>>();
export async function cloudTransaction<T>(db: SQLiteDatabase, write: () => Promise<T>): Promise<T> {
  const previous = writes.get(db) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    let result!: T;
    await db.withTransactionAsync(async () => { result = await write(); });
    return result;
  });
  writes.set(db, next);
  try { return await next; } finally { if (writes.get(db) === next) writes.delete(db); }
}

export async function queuedCommands(db: SQLiteDatabase): Promise<CloudCommand[]> {
  const rows = await db.getAllAsync<CommandRow>('SELECT id, kind, payload, error FROM cloud_outbox ORDER BY created_at, rowid');
  return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) }));
}

/** Badge and emptiness checks do not need to read or parse every queued payload. */
export async function queuedCommandCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM cloud_outbox');
  return row?.count ?? 0;
}

export async function enqueue(db: SQLiteDatabase, kind: CloudCommandKind, payload: Record<string, unknown>) {
  const id = randomUUID();
  await db.runAsync('INSERT INTO cloud_outbox (id, kind, payload, created_at) VALUES (?, ?, ?, ?)', [id, kind, JSON.stringify(payload), nowISO()]);
  return id;
}

export function cloudError(error: { message: string; code?: string }) {
  if (error.code === '42501') return 'Sua conta não tem permissão para esta ação. Sincronize e confira seus vínculos.';
  if (error.code === '23505') return 'Este registro já existe. Confira o código do lote ou o convite.';
  if (error.code === 'P0001') return error.message;
  return 'Não foi possível sincronizar. Seus registros continuam salvos neste aparelho.';
}

/** A DB has only one sync in flight; foreground/manual/NetInfo triggers share it. */
const running = new WeakMap<SQLiteDatabase, Promise<{ pending: number; error: string | null }>>();

export function syncCloud(db: SQLiteDatabase, accountId: string) {
  const previous = running.get(db);
  if (previous) return previous;
  const work = cloudTask(db, () => performSync(db, accountId)).finally(() => { running.delete(db); });
  running.set(db, work);
  return work;
}

async function performSync(db: SQLiteDatabase, accountId: string) {
  const client = requireSupabase();
  const queue = await queuedCommands(db);
  for (const command of queue) {
    // Two local edits may have been queued before the first acquired a server version.
    // Resolve only the explicit dependency; never replace a stale known revision.
    const payload = { ...command.payload };
    if (payload.expectedVersion === 'after-previous') {
      const version = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [`entryVersion:${payload.id}`]);
      payload.expectedVersion = version ? Number(version.value) : null;
      // Freeze this request before delivery, including when the reply is lost.
      await cloudTransaction(db, async () => {
        await db.runAsync('UPDATE cloud_outbox SET payload = ? WHERE id = ?', [JSON.stringify(payload), command.id]);
      });
    }
    const token = await cloudToken(accountId);
    const { data, error } = await client.rpc('agrogest_command', { command_id: command.id, kind: command.kind, payload: payload as Json })
      .setHeader('Authorization', `Bearer ${token}`);
    if (error) {
      const message = cloudError(error);
      await db.runAsync('UPDATE cloud_outbox SET error = ? WHERE id = ?', [message, command.id]);
      // Revocation or demotion must refresh the connected cache even when a
      // rejected command remains in the outbox for explicit resolution.
      if (error.code === '42501' && typeof payload.operationId === 'string') {
        const token = await cloudToken(accountId);
        const { data: authorized, error: readError } = await client.rpc('agrogest_workspace').setHeader('Authorization', `Bearer ${token}`);
        const workspace = authorized as Workspace | null;
        if (!readError && workspace) {
          await cloudTransaction(db, async () => {
            await repo.refreshOperationAccess(db, workspace, payload.operationId as string);
          });
        }
      }
      return { pending: await queuedCommandCount(db), error: message };
    }
    // Commit acknowledgement and revision together. A crash before this point
    // replays the same command ID, which the server returns without new effects.
    await cloudTransaction(db, async () => {
      const entry = data as Entry | null;
      if (entry?.version && typeof payload.id === 'string') {
        await repo.setSetting(db, `entryVersion:${payload.id}`, String(entry.version));
        // Only replace local state if no later command references this entry.
        const later = await db.getFirstAsync<{ id: string }>(
          "SELECT id FROM cloud_outbox WHERE id <> ? AND json_extract(payload, '$.id') = ? LIMIT 1", [command.id, payload.id]);
        if (!later && (command.kind === 'save_entry' || command.kind === 'decide_entry')) await repo.saveEntry(db, entry);
      }
      await db.runAsync('DELETE FROM cloud_outbox WHERE id = ?', [command.id]);
    });
  }
  // Do not overwrite optimistic data added while the network request was in flight.
  const pending = await queuedCommandCount(db);
  if (pending > 0) return { pending, error: null };
  const token = await cloudToken(accountId);
  const { data, error } = await client.rpc('agrogest_workspace').setHeader('Authorization', `Bearer ${token}`);
  if (error) return { pending: 0, error: cloudError(error) };
  const workspace = data as unknown as Workspace;
  if (!workspace || !Array.isArray(workspace.users) || !Array.isArray(workspace.entries)) throw new Error('Resposta inválida do servidor.');
  await cloudTransaction(db, async () => {
    // Recheck inside the SQLite transaction: local writes are serialized too.
    if (await queuedCommandCount(db) > 0) return;
    await repo.replaceCloudSnapshot(db, workspace);
    await repo.setSetting(db, 'lastSyncAt', nowISO());
  });
  return { pending: await queuedCommandCount(db), error: null };
}
