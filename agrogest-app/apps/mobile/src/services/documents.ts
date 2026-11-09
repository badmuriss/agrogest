import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { apiFetch } from './backend';

export interface Extraction {
  fields: { amountCents: number | null; occurredAt: string | null; supplier: string | null; description: string | null; document: string | null };
  text: string; warnings: string[]; provider: string; model: string; confidence?: number;
  documentId: string; extractedAt: string; sha256: string;
}
export interface DocumentDraft {
  id: string; serverId: string | null; farmId: string; operationId: string;
  name: string; mime: string; base64: string; extraction: Extraction | null;
  reviewed: Extraction['fields'] | null; entryId: string | null; createdAt: string;
}
export async function saveDocumentDraft(db: SQLiteDatabase, draft: DocumentDraft) {
  await db.runAsync('INSERT INTO local_documents(id,data,created_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', [draft.id, JSON.stringify(draft), draft.createdAt]);
}
export async function readDocumentDraft(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM local_documents WHERE id=?', [id]);
  return row ? JSON.parse(row.data) as DocumentDraft : null;
}
export async function documentDrafts(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM local_documents ORDER BY created_at DESC LIMIT 30');
  return rows.map((r) => JSON.parse(r.data) as DocumentDraft);
}
export async function captureDocument(db: SQLiteDatabase, input: Pick<DocumentDraft, 'farmId' | 'operationId' | 'name' | 'mime' | 'base64'>) {
  if (!input.base64 || input.base64.length * 3 / 4 > 8 * 1024 * 1024) throw new Error('Escolha uma imagem com até 8 MiB.');
  const draft: DocumentDraft = { ...input, id: randomUUID(), serverId: null, extraction: null, reviewed: null, entryId: null, createdAt: new Date().toISOString() };
  await saveDocumentDraft(db, draft); return draft;
}
async function result<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Não foi possível ler este documento.');
  return data;
}
export async function analyzeDocument(db: SQLiteDatabase, draft: DocumentDraft) {
  let current = draft;
  if (!current.serverId) {
    const bytes = Uint8Array.from(atob(draft.base64), (c) => c.charCodeAt(0));
    const uploaded = await result<{ id: string }>(await apiFetch(`/api/documents?operationId=${encodeURIComponent(draft.operationId)}`, { method: 'POST', headers: { 'Content-Type': draft.mime, 'X-Document-Name': draft.name.replace(/[^a-zA-Z0-9 ._-]/g, '') }, body: bytes }));
    current = { ...current, serverId: uploaded.id };
    await saveDocumentDraft(db, current);
  }
  const extraction = await result<Extraction>(await apiFetch(`/api/documents/${current.serverId}/extract`, { method: 'POST' }));
  current = { ...current, extraction, reviewed: current.reviewed ?? extraction.fields };
  await saveDocumentDraft(db, current); return current;
}
