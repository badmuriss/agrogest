import { ApiError, cents, ensure, idString, json, saoPauloDay, type Env } from './contracts.ts';
import { authenticate, digest, login, publicUser, type Actor } from './auth.ts';
import { entityWrites, load, member, project, type State } from './store.ts';
import { transition } from './commands.ts';
import { extract } from './inference.ts';

const canonical = (value: any): string => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
async function body(request: Request) {
  ensure(Number(request.headers.get('Content-Length') ?? 0) <= 512_000, 'Solicitação muito grande.', 413);
  const text = await request.text(); ensure(text.length <= 512_000, 'Solicitação muito grande.', 413);
  try { return JSON.parse(text); } catch { throw new ApiError('JSON inválido.'); }
}
async function command(env: Env, actor: Actor, input: any) {
  const { command_id: id, kind, payload } = input;
  ensure(idString(id) && typeof kind === 'string' && kind.length < 80 && payload && typeof payload === 'object', 'Comando inválido.');
  const payloadText = canonical(payload);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { state, version } = await load(env);
    const already = await env.DB.prepare('SELECT kind,payload,result FROM commands WHERE actor_id=? AND id=?').bind(actor.id, id).first<{ kind: string; payload: string; result: string }>();
    if (already) {
      ensure(already.kind === kind && already.payload === payloadText, 'Identificador já usado com dados diferentes.', 409);
      const partner = !['save_entry', 'decide_entry', 'discard_entry', 'accept_invite', 'create_farm'].includes(kind);
      if (payload.operationId) member(state, actor.id, payload.operationId, partner);
      const replay = JSON.parse(already.result);
      if (replay?.kind && ['venda', 'receita', 'nota_fiscal', 'ajuste_estoque'].includes(replay.kind) || kind === 'decide_entry' && replay?.kind === 'despesa') member(state, actor.id, payload.operationId, true);
      if (kind === 'transfer_lot' && replay?.lot?.operationId) member(state, actor.id, replay.lot.operationId, true);
      return replay;
    }
    const next = structuredClone(state);
    let changed: ReturnType<typeof transition>;
    try { changed = transition(next, actor.id, kind, payload, new Date().toISOString()); }
    catch (error) { if (error instanceof Error && error.constructor === Error) throw new ApiError(error.message); throw error; }
    const { result, operationId } = changed;
    const guardId = crypto.randomUUID();
    const writes = entityWrites(env, state, next);
    // CHECK(ok=1) aborts the complete batch when another command changed the snapshot.
    // Session revocation is also checked within the transaction, not just at routing time.
    const statements = [env.DB.prepare('INSERT INTO transaction_guards(id,ok) SELECT ?,CASE WHEN (SELECT version FROM revisions WHERE id=1)=? AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND user_id=? AND expires_at>?) THEN 1 ELSE 0 END').bind(guardId, version, actor.tokenHash, actor.id, Date.now()), ...writes];
    if (kind === 'save_entry' && payload.entry?.kind === 'despesa') {
      const documentId = payload.entry.payload?.sourceDocumentId;
      const previousDoc = state.entries.find((e) => e.id === payload.id && e.kind === 'despesa');
      const previousId = previousDoc?.kind === 'despesa' ? (previousDoc.payload as any).sourceDocumentId : null;
      ensure(!previousId || previousId === documentId, 'A origem documental de um lançamento não pode ser removida.');
      if (documentId) {
        const doc = await env.DB.prepare('SELECT author_id,extraction FROM documents WHERE id=? AND operation_id=?').bind(documentId, operationId).first<{ author_id: string; extraction: string | null }>();
        ensure(doc && (doc.author_id === actor.id || state.memberships.some((m) => m.userId === actor.id && m.operationId === operationId && m.role === 'socio')), 'Documento fora do seu acesso.', 403, '42501');
        ensure(doc.extraction, 'Execute e revise a extração real do documento antes de registrar.');
        const link = await env.DB.prepare('SELECT entry_id FROM document_entry_links WHERE document_id=?').bind(documentId).first<{ entry_id: string }>();
        ensure(!link || link.entry_id === payload.id, 'Este comprovante já está vinculado a outra despesa.', 409);
        statements.push(env.DB.prepare('INSERT INTO document_entry_links(document_id,entry_id,operation_id) VALUES(?,?,?) ON CONFLICT(document_id) DO UPDATE SET entry_id=excluded.entry_id WHERE document_entry_links.entry_id=excluded.entry_id').bind(documentId, payload.id, operationId));
      }
    }
    if (kind === 'discard_entry') statements.push(env.DB.prepare('DELETE FROM document_entry_links WHERE entry_id=?').bind(payload.id));
    statements.push(env.DB.prepare('UPDATE revisions SET version=version+1 WHERE id=1'), env.DB.prepare('INSERT INTO commands(actor_id,id,kind,payload,result) VALUES(?,?,?,?,?)').bind(actor.id, id, kind, payloadText, JSON.stringify(result)), env.DB.prepare('INSERT INTO audit_events(operation_id,actor_id,command_id,kind,created_at) VALUES(?,?,?,?,?)').bind(operationId, actor.id, id, kind, new Date().toISOString()), env.DB.prepare('DELETE FROM transaction_guards WHERE id=?').bind(guardId));
    try { await env.DB.batch(statements); return result; }
    catch (error) {
      // A race retries against fresh state; semantic validation then rejects stale versions.
      if (attempt < 4 && /constraint|unique|check/i.test(String(error))) continue;
      throw error;
    }
  }
  throw new ApiError('Outra alteração ocorreu. Sincronize e tente novamente.', 409);
}
interface DocumentRow { id: string; operation_id: string; author_id: string; sha256: string; object_key: string; mime: string; name: string; size: number; extraction: string | null }
async function documentAccess(env: Env, actor: Actor, id: string) {
  ensure(idString(id), 'Documento inválido.');
  const doc = await env.DB.prepare('SELECT * FROM documents WHERE id=?').bind(id).first<DocumentRow>();
  ensure(doc, 'Documento não encontrado.', 404);
  const { state } = await load(env);
  const m = member(state, actor.id, doc.operation_id);
  ensure(m.role === 'socio' || doc.author_id === actor.id, 'Documento fora do seu acesso.', 403, '42501');
  return doc;
}
const describe = (d: DocumentRow) => ({ id: d.id, operationId: d.operation_id, name: d.name, mime: d.mime, size: d.size, sha256: d.sha256, extraction: d.extraction ? JSON.parse(d.extraction) : null });
async function route(request: Request, env: Env) {
  const url = new URL(request.url), path = url.pathname;
  ensure(env.APP_ENV === 'local' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Esta configuração só executa localmente.', 403);
  if (path === '/api/health') return json({ ok: true, environment: 'local', database: 'D1-local', documents: 'R2-local', inferenceProvider: env.INFERENCE_PROVIDER, remoteInferenceAllowed: env.INFERENCE_REMOTE_ALLOWED === 'true' });
  if (path === '/api/auth/login' && request.method === 'POST') return json({ data: { session: await login(env, await body(request)) }, error: null });
  const actor = await authenticate(request, env);
  if (path === '/api/auth/user') return json({ data: { user: publicUser(actor) }, error: null });
  if (path === '/api/auth/logout' && request.method === 'POST') { await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(actor.tokenHash).run(); return json({ data: {}, error: null }); }
  if (path.startsWith('/api/auth/')) throw new ApiError('Cadastro e recuperação por e-mail não estão disponíveis nesta demonstração local. Use uma conta local configurada.', 503, 'local_auth_only');
  if (path === '/api/rpc/agrogest_workspace' && request.method === 'POST') return json({ data: project((await load(env)).state, actor.id), error: null });
  if (path === '/api/rpc/agrogest_command' && request.method === 'POST') return json({ data: await command(env, actor, await body(request)), error: null });
  if (path === '/api/documents' && request.method === 'POST') {
    const operationId = url.searchParams.get('operationId');
    ensure(idString(operationId), 'Selecione uma operação.');
    member((await load(env)).state, actor.id, operationId);
    const declared = Number(request.headers.get('Content-Length') ?? 0);
    ensure(declared <= 8 * 1024 * 1024, 'Imagem maior que 8 MiB.', 413);
    const bytes = await request.arrayBuffer(); ensure(bytes.byteLength > 0 && bytes.byteLength <= 8 * 1024 * 1024, 'Imagem vazia ou maior que 8 MiB.', 413);
    const b = new Uint8Array(bytes);
    const mime = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? 'image/png' : b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg' : new TextDecoder().decode(b.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(b.slice(8, 12)) === 'WEBP' ? 'image/webp' : null;
    ensure(mime, 'Use imagem PNG, JPEG ou WebP válida.', 415);
    const sha = await digest(bytes), key = `${operationId}/${sha}`, id = crypto.randomUUID();
    const existing = await env.DB.prepare('SELECT * FROM documents WHERE operation_id=? AND sha256=?').bind(operationId, sha).first<DocumentRow>();
    if (existing) { await documentAccess(env, actor, existing.id); return json(describe(existing)); }
    const name = (request.headers.get('X-Document-Name') ?? 'comprovante').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 160);
    await env.DOCUMENTS.put(key, bytes, { httpMetadata: { contentType: mime } });
    await env.DB.prepare('INSERT OR IGNORE INTO documents(id,operation_id,author_id,sha256,object_key,mime,name,size,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, operationId, actor.id, sha, key, mime, name, bytes.byteLength, new Date().toISOString()).run();
    const saved = await env.DB.prepare('SELECT * FROM documents WHERE operation_id=? AND sha256=?').bind(operationId, sha).first<DocumentRow>();
    ensure(saved, 'Não foi possível armazenar o documento.', 500); await documentAccess(env, actor, saved.id); return json(describe(saved), 201);
  }
  const match = path.match(/^\/api\/documents\/([a-zA-Z0-9_-]+)(\/extract|\/content)?$/);
  if (match) {
    const doc = await documentAccess(env, actor, match[1]);
    if (!match[2] && request.method === 'GET') return json(describe(doc));
    if (match[2] === '/content' && request.method === 'GET') {
      const obj = await env.DOCUMENTS.get(doc.object_key); ensure(obj, 'Arquivo local ausente.', 404);
      return new Response(obj.body, { headers: { 'Content-Type': doc.mime, 'Content-Length': String(doc.size), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
    }
    if (match[2] === '/extract' && request.method === 'POST') {
      if (doc.extraction && JSON.parse(doc.extraction).provider === env.INFERENCE_PROVIDER) return json(JSON.parse(doc.extraction));
      // Remote inference is explicit, with a hard reservation of at most 20 requests/account/day.
      if (env.INFERENCE_PROVIDER !== 'local') {
        ensure(env.INFERENCE_REMOTE_ALLOWED === 'true', 'Inferência remota desativada.', 503);
        try { await env.DB.prepare('INSERT INTO inference_usage(actor_id,day,count) VALUES(?,?,1) ON CONFLICT(actor_id,day) DO UPDATE SET count=count+1').bind(actor.id, saoPauloDay(new Date().toISOString())).run(); }
        catch { throw new ApiError('Limite diário de inferência atingido.', 429); }
      }
      const object = await env.DOCUMENTS.get(doc.object_key); ensure(object, 'Arquivo local ausente.', 404);
      const output = await extract(env, await object.arrayBuffer(), doc.mime);
      const saved = { ...output, documentId: doc.id, sha256: doc.sha256, extractedAt: new Date().toISOString() };
      await env.DB.prepare('UPDATE documents SET extraction=? WHERE id=?').bind(JSON.stringify(saved), doc.id).run();
      return json(saved);
    }
  }
  throw new ApiError('Rota não encontrada.', 404);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url), origin = request.headers.get('Origin');
    const allowed = origin === url.origin || origin === env.FRONTEND_ORIGIN || origin === 'http://127.0.0.1:8081';
    let response: Response;
    try {
      if (url.pathname.startsWith('/api/')) {
        ensure(!origin || allowed, 'Origem não autorizada.', 403);
        response = request.method === 'OPTIONS' ? new Response(null, { status: 204 }) : await route(request, env);
      } else response = await env.ASSETS.fetch(request);
    } catch (error) {
      response = error instanceof ApiError ? json({ data: null, error: { message: error.message, code: error.code } }, error.status)
        : json({ data: null, error: { message: 'O serviço local não concluiu a operação. Os registros foram preservados.', code: 'local_service_error' } }, 500);
      // Never serialize stack, upstream response, SQL bindings, headers or document contents.
      if (!(error instanceof ApiError)) console.error('AgroGest local: falha interna', error instanceof Error ? error.name : 'Unknown');
    }
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    headers.set('Referrer-Policy', 'same-origin');
    if (origin && allowed) { headers.set('Access-Control-Allow-Origin', origin); headers.set('Vary', 'Origin'); headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Document-Name'); headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); }
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
