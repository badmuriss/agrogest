import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startOcr } from '../../../services/extraction/container.mjs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { summarizeLot } from '../../mobile/src/domain/lot-metrics.ts';

let mf, temporary, db, ocr;
const sessions = {};
const account = { ana: 'ana', bruno: 'bruno', campo: 'campo', isolado: 'isolado' };
before(async () => {
  ocr = await startOcr({ project: `agrogest-api-test-${process.pid}`, port: 0 });
  const ocrUrl = ocr.url;
  assert.equal((await fetch(`${ocrUrl}/health`)).status, 200);
  temporary = await mkdtemp(path.join(tmpdir(), 'agrogest-d1-tests-'));
  await build({ entryPoints: ['src/index.ts'], outfile: path.join(temporary, 'worker.mjs'), bundle: true, format: 'esm', platform: 'browser' });
  mf = new Miniflare({ ...convertV4MiniflareOptions({ name: 'agrogest-test', cf: false, modules: true, modulesRoot: temporary, scriptPath: path.join(temporary, 'worker.mjs'), compatibilityDate: '2026-11-06', d1Databases: ['DB'], r2Buckets: ['DOCUMENTS'], bindings: { APP_ENV: 'local', FRONTEND_ORIGIN: 'http://localhost:8081', INFERENCE_PROVIDER: 'local', INFERENCE_REMOTE_ALLOWED: 'false', LOCAL_OCR_BASE_URL: ocrUrl, INFERENCE_TIMEOUT_MS: '45000', INFERENCE_MAX_OUTPUT_TOKENS: '1200' } }), telemetry: { enabled: false } });
  db = await mf.getD1Database('DB');
  for (const file of (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    for (const sql of (await readFile(`migrations/${file}`, 'utf8')).split(';').map((x) => x.replace(/^--.*$/gm, '').trim()).filter(Boolean)) await db.prepare(sql).run();
  }
  for (const key of Object.keys(account)) {
    const r = await mf.dispatchFetch('http://localhost/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${key}@agrogest.local`, password: 'AgroGest2026!' }) });
    assert.equal(r.status, 200); sessions[key] = (await r.json()).data.session.access_token;
  }
});
after(async () => { try { await mf?.dispose(); } finally { await ocr?.stop(); if (temporary) await rm(temporary, { recursive: true }); } });
const call = async (who, route, input) => {
  const r = await mf.dispatchFetch(`http://localhost${route}`, { method: input === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${sessions[who]}`, 'Content-Type': 'application/json' }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
  return { status: r.status, body: await r.json() };
};
const workspace = async (who) => (await call(who, '/api/rpc/agrogest_workspace', {})).body.data;
const cmd = (who, id, kind, payload) => call(who, '/api/rpc/agrogest_command', { command_id: id, kind, payload });
function expense(id, extra = {}) {
  return { id, operationId: 'gs-op', farmId: 'gs-fazenda', expectedVersion: null, submit: true, entry: { kind: 'despesa', operationId: 'gs-op', farmId: 'gs-fazenda', title: 'Sal mineral', amountCents: 125040, occurredAt: '2026-11-06', payload: { categoryId: 'cat-alimentacao', category: 'Alimentação', description: 'Sal mineral', supplier: 'Cooperativa Campo Verde', document: 'GS-001', installments: [{ dueDate: '2026-11-06', cents: 125040 }], criterion: 'cabeca', allocations: [{ lotId: 'gs-fazenda-lote', cents: 125040, basis: 10 }], ...extra } } };
}

test('OCR container checks model readiness and rejects browser access, empty bodies and invalid image bytes', async () => {
  const health = await fetch(`${ocr.url}/health`);
  assert.equal(health.status, 200);
  const state = await health.json();
  assert.equal(state.ok, true);
  assert.equal(state.modelSha256, 'c4932b937207a9514b7514d518b931a99938c02a28a5a5a553f8599ed58b7deb');
  assert.equal((await fetch(`${ocr.url}/extract`, { method: 'POST', headers: { Origin: 'http://127.0.0.1:8787' }, body: 'blocked' })).status, 403);
  assert.equal((await fetch(`${ocr.url}/extract`, { method: 'POST' })).status, 413);
  assert.equal((await fetch(`${ocr.url}/extract`, { method: 'POST', body: '<html>invalid image</html>' })).status, 422);
  assert.equal((await fetch(`${ocr.url}/missing`)).status, 404);
});

test('D1/R2: real image → actual OCR → reviewed expense → another partner approval → calculated indicator', async () => {
  const bytes = await readFile('../../tests/fixtures/comprovante-gs-001.png');
  const upload = () => mf.dispatchFetch('http://localhost/api/documents?operationId=gs-op', { method: 'POST', headers: { Authorization: `Bearer ${sessions.ana}`, 'Content-Type': 'image/png' }, body: bytes });
  const up = await upload(); assert.equal(up.status, 201); const document = await up.json();
  const repeated = await upload(); assert.equal((await repeated.json()).id, document.id, 'hash deduplication in same operation');
  const extraction = await call('ana', `/api/documents/${document.id}/extract`, {});
  assert.equal(extraction.status, 200); assert.equal(extraction.body.provider, 'local');
  assert.equal(extraction.body.fields.amountCents, 125040); assert.equal(extraction.body.fields.supplier, 'Cooperativa Campo Verde');
  assert.equal(extraction.body.fields.description, 'Sal mineral para bovinos'); assert.equal(extraction.body.fields.occurredAt, '2026-11-06');
  const ws = await workspace('ana'), lot = ws.lots[0];
  const before = summarizeLot(lot, ws.entries, 0, '2026-11-06').totalCostCents;
  const p = expense('gs-e2e-ocr', { sourceDocumentId: document.id });
  const saved = await cmd('ana', 'gs-cmd-ocr', 'save_entry', p); assert.equal(saved.status, 200); assert.equal(saved.body.data.status, 'aguardando_aprovacao');
  const waiting = await workspace('ana'); assert.equal(summarizeLot(lot, waiting.entries, 0, '2026-11-06').totalCostCents, before, 'pending has no confirmed cost');
  const self = await cmd('ana', 'gs-self', 'decide_entry', { id: p.id, operationId: 'gs-op', expectedVersion: 1, decision: 'aprovar', note: '' }); assert.equal(self.status, 403);
  const employee = await cmd('campo', 'gs-employee', 'decide_entry', { id: p.id, operationId: 'gs-op', expectedVersion: 1, decision: 'aprovar', note: '' }); assert.equal(employee.status, 403);
  const approved = await cmd('bruno', 'gs-approve', 'decide_entry', { id: p.id, operationId: 'gs-op', expectedVersion: 1, decision: 'aprovar', note: '' }); assert.equal(approved.status, 200); assert.equal(approved.body.data.status, 'aprovado');
  const final = await workspace('ana'); assert.equal(summarizeLot(lot, final.entries, 0, '2026-11-06').totalCostCents - before, 125040);
  const replay = await cmd('ana', 'gs-cmd-ocr', 'save_entry', p); assert.equal(replay.status, 200); assert.equal(replay.body.data.version, 1);
  assert.equal((await workspace('ana')).entries.filter((e) => e.id === p.id).length, 1);
  const duplicate = await cmd('ana', 'gs-duplicate', 'save_entry', expense('gs-e2e-duplicate', { sourceDocumentId: document.id })); assert.equal(duplicate.status, 409);
  assert.equal((await workspace('ana')).entries.some((e) => e.id === 'gs-e2e-duplicate'), false, 'all D1 writes rolled back');
  assert.equal((await call('isolado', `/api/documents/${document.id}`)).status, 403);
  assert.equal((await call('campo', `/api/documents/${document.id}/content`)).status, 403);
});

test('authorization isolates workspaces, employees and tampered operations', async () => {
  const isolated = await workspace('isolado'); assert.equal(isolated.farms.length, 1); assert.equal(isolated.farms[0].id, 'gs-fazenda-isolada'); assert.equal(isolated.entries.length, 0);
  const employee = await workspace('campo'); assert.equal(employee.financialAccounts.length, 0); assert.equal(employee.entries.some((e) => e.id === 'gs-e2e-ocr'), false); assert.equal(employee.lots[0].purchaseCents, 0);
  const hacked = expense('gs-hacked'); hacked.operationId = 'gs-outra-op'; hacked.entry.operationId = 'gs-outra-op';
  assert.equal((await cmd('ana', 'gs-hacked-command', 'save_entry', hacked)).status, 403);
  assert.equal((await mf.dispatchFetch('http://localhost/api/rpc/agrogest_workspace', { method: 'POST' })).status, 401);
  assert.equal((await mf.dispatchFetch('http://localhost/api/health', { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
});

test('duplicate command IDs, stale approvals and concurrent commands never duplicate effects', async () => {
  const p = expense('gs-race');
  const replies = await Promise.all([cmd('ana', 'gs-race-command', 'save_entry', p), cmd('ana', 'gs-race-command', 'save_entry', p)]);
  assert.deepEqual(replies.map((r) => r.status), [200, 200]);
  assert.equal((await workspace('ana')).entries.filter((e) => e.id === p.id).length, 1);
  assert.equal((await cmd('ana', 'gs-race-command', 'save_entry', { ...p, submit: false })).status, 409);
  const decision = { id: p.id, operationId: 'gs-op', expectedVersion: 1, decision: 'aprovar', note: '' };
  const results = await Promise.all([cmd('bruno', 'gs-d1', 'decide_entry', decision), cmd('bruno', 'gs-d2', 'decide_entry', decision)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const approved = (await workspace('ana')).entries.find((e) => e.id === p.id); assert.equal(approved.history.filter((h) => h.action === 'aprovado').length, 1);
  assert.equal((await cmd('ana', 'gs-edit-approved', 'save_entry', { ...p, expectedVersion: 2 })).status, 403);
});

test('two concurrent payments cannot settle the same obligation twice; reversal preserves expense cost', async () => {
  const payment = (id) => ({ id, operationId: 'gs-op', direction: 'pagar', accountId: 'gs-caixa', partnerId: null, partnerMode: null, advanceId: null, paidAt: '2026-11-06', items: [{ entryId: 'gs-race', index: 0, cents: 125040 }], interestCents: 0, fineCents: 0, discountCents: 0, method: 'pix', proof: '', notes: '' });
  const replies = await Promise.all([cmd('ana', 'gs-pay1', 'register_payment', payment('gs-pay1')), cmd('bruno', 'gs-pay2', 'register_payment', payment('gs-pay2'))]);
  assert.deepEqual(replies.map((r) => r.status), [200, 200]);
  const rows = (await workspace('ana')).payments; assert.equal(rows.filter((p) => p.status === 'efetivado').length, 1); assert.equal(rows.filter((p) => p.status === 'conflito').length, 1);
  const posted = rows.find((p) => p.status === 'efetivado'); assert.equal((await cmd('ana', 'gs-reverse', 'reverse_payment', { id: posted.id, operationId: 'gs-op', reason: 'Teste de estorno' })).status, 200);
  assert.equal((await workspace('ana')).entries.find((e) => e.id === 'gs-race').status, 'aprovado');
});

test('integer money, balanced installments and lot ownership are enforced on server', async () => {
  const fractional = expense('gs-fractional'); fractional.entry.amountCents = 1250.4; assert.equal((await cmd('ana', 'gs-fractional', 'save_entry', fractional)).status, 400);
  const broken = expense('gs-broken'); broken.entry.payload.installments[0].cents = 1; assert.equal((await cmd('ana', 'gs-broken', 'save_entry', broken)).status, 400);
  const foreign = expense('gs-foreign'); foreign.entry.payload.allocations[0].lotId = 'gs-fazenda-isolada-lote'; assert.equal((await cmd('ana', 'gs-foreign', 'save_entry', foreign)).status, 400);
  assert.equal((await db.prepare("SELECT count(*) n FROM transaction_guards").first()).n, 0);
});

test('cost classification, recurrences, budgets and spreadsheet opening titles preserve the original expense', async () => {
  const center = { id: 'gs-center', operationId: 'gs-op', name: 'Nutrição', parentId: null, isGroup: false, active: true, previous: null };
  assert.equal((await cmd('ana', 'gs-center-create', 'save_cost_center', center)).status, 200);
  const before = (await workspace('ana')).entries.find((e) => e.id === 'gs-e2e-ocr');
  assert.equal((await cmd('ana', 'gs-classify', 'classify_cost', { id: before.id, operationId: 'gs-op', costCenterId: center.id, reason: 'Organizar histórico', previous: null })).status, 200);
  assert.deepEqual((await workspace('ana')).entries.find((e) => e.id === before.id), before, 'classification never rewrites approved entry or its version');
  const recurrence = { id: 'gs-rec', operationId: 'gs-op', farmId: 'gs-fazenda', title: 'Sal mensal', categoryId: 'cat-alimentacao', counterparty: 'Cooperativa', counterpartyId: null, cents: 10000, dayOfMonth: 10, startMonth: '2026-11', endMonth: null, active: true, costCenterId: center.id };
  assert.equal((await cmd('ana', 'gs-rec', 'save_recurrence', recurrence)).status, 200);
  assert.equal((await cmd('ana', 'gs-budget', 'set_budget', { id: 'gs-budget', operationId: 'gs-op', categoryId: 'cat-alimentacao', month: '2026-11', cents: 500000 })).status, 200);
  const title = { id: 'gs-title', direction: 'pagar', title: 'Saldo anterior', counterparty: 'Fornecedor', categoryId: null, occurredAt: '2026-10-01', installments: [{ dueDate: '2026-11-20', cents: 5000 }], importKey: 'sheet:row:1' };
  const imported = { id: 'gs-import', operationId: 'gs-op', farmId: 'gs-fazenda', titles: [title] };
  assert.equal((await cmd('ana', 'gs-import', 'import_titles', imported)).body.data.added, 1);
  assert.equal((await cmd('ana', 'gs-import-again', 'import_titles', { ...imported, id: 'gs-import2', titles: [{ ...title, id: 'gs-title2' }] })).body.data.skipped, 1);
  assert.equal((await workspace('ana')).titles.length, 1);
});

test('treasury uses account ownership, financing release limits and reversible renegotiation', async () => {
  const financing = { id: 'gs-financing', operationId: 'gs-op', farmId: 'gs-fazenda', bank: 'Banco local', line: 'custeio', contract: 'GS', releasedCents: 100000, ratePct: 0, graceMonths: 0, guarantees: '', notes: '', schedule: [{ dueDate: '2026-12-01', principalCents: 100000, interestCents: 0 }] };
  assert.equal((await cmd('ana', 'gs-financing', 'save_financing', financing)).status, 200);
  const release = { id: 'gs-release', operationId: 'gs-op', kind: 'liberacao', fromAccountId: null, toAccountId: 'gs-caixa', partnerId: null, financingId: financing.id, counterparty: 'Banco local', counterpartyId: null, invoiceMonth: null, cents: 100000, occurredAt: '2026-11-06', method: 'transferencia', proof: '', notes: '' };
  assert.equal((await cmd('ana', 'gs-release', 'register_movement', release)).status, 200);
  assert.equal((await cmd('ana', 'gs-release-excess', 'register_movement', { ...release, id: 'gs-excess', cents: 1 })).status, 400);
  assert.equal((await cmd('ana', 'gs-release-reverse', 'reverse_movement', { id: release.id, operationId: 'gs-op', reason: 'Correção' })).status, 200);
  const reneg = { id: 'gs-reneg', operationId: 'gs-op', reason: 'Prorrogar', direction: 'pagar', items: [{ entryId: 'gs-title', index: 0 }], installments: [{ dueDate: '2026-12-20', cents: 5500 }] };
  const saved = await cmd('ana', 'gs-reneg', 'renegotiate', reneg); assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.data.items[0].settledCents, 0);
  assert.equal((await cmd('ana', 'gs-reneg-undo', 'undo_renegotiation', { id: reneg.id, operationId: 'gs-op', reason: 'Condição cancelada' })).status, 200);
});

test('lot transfer carries the computed value once, closes source and preserves account separation', async () => {
  const farm = { id: 'gs-dest-farm', operationId: 'gs-dest-op', name: 'Destino', city: null, pastureRentCents: 0 };
  assert.equal((await cmd('ana', 'gs-farm-create', 'create_farm', farm)).status, 200);
  const pasture = { id: 'gs-dest-pasture', operationId: farm.operationId, farmId: farm.id, name: 'Destino', areaHa: 5, forage: 'Braquiária', notes: '' };
  assert.equal((await cmd('ana', 'gs-pasture-create', 'create_pasture', pasture)).status, 200);
  const ws = await workspace('ana'), source = ws.lots.find((l) => l.id === 'gs-fazenda-lote');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const summary = summarizeLot(source, ws.entries, 0, today);
  const input = { id: source.id, operationId: source.operationId, sourceFarmId: source.farmId, destinationFarmId: farm.id, code: 'TRANSFERIDO', managementGroup: 'Destino', pastureId: pasture.id, commandId: 'gs-transfer', destinationLotId: 'gs-dest-lot', expectedHeads: summary.headsCurrent, expectedCostCents: summary.remainingCostCents, expectedWeightKg: summary.lastWeighing.kg, date: today };
  const transfer = await cmd('ana', 'gs-transfer', 'transfer_lot', input); assert.equal(transfer.status, 200, JSON.stringify(transfer.body));
  assert.equal(transfer.body.data.lot.purchaseCents, summary.remainingCostCents);
  assert.equal((await cmd('ana', 'gs-transfer', 'transfer_lot', input)).status, 200);
  const final = await workspace('ana'); assert.equal(final.lots.filter((l) => l.id === input.destinationLotId).length, 1);
  assert.equal(summarizeLot(final.lots.find((l) => l.id === source.id), final.entries, 0, today).headsCurrent, 0);
  assert.equal((await workspace('bruno')).farms.some((f) => f.id === farm.id), false);
});

test('discarding an unsent documentary draft releases its link without deleting the original image', async () => {
  const response = await mf.dispatchFetch('http://localhost/api/documents?operationId=gs-op', { method: 'POST', headers: { Authorization: `Bearer ${sessions.ana}` }, body: await readFile('../../tests/fixtures/comprovante-gs-002.png') });
  assert.equal(response.status, 201); const doc = await response.json();
  const extracted = await call('ana', `/api/documents/${doc.id}/extract`, {}); assert.equal(extracted.body.fields.amountCents, 8990);
  const draft = expense('gs-doc-draft', { sourceDocumentId: doc.id }); draft.submit = false;
  assert.equal((await cmd('ana', 'gs-doc-draft', 'save_entry', draft)).status, 200);
  assert.equal((await cmd('ana', 'gs-doc-discard', 'discard_entry', { id: draft.id, operationId: 'gs-op' })).status, 200);
  assert.equal((await db.prepare('SELECT count(*) n FROM document_entry_links WHERE document_id=?').bind(doc.id).first()).n, 0);
  assert.equal((await call('ana', `/api/documents/${doc.id}`)).status, 200);
  assert.equal((await cmd('ana', 'gs-doc-reuse', 'save_entry', { ...draft, id: 'gs-doc-reused' })).status, 200);
});

test('demotion and session revocation are rechecked even when replaying an acknowledged financial command', async () => {
  const demote = await cmd('ana', 'gs-demote', 'update_member', { id: 'gs-bruno', operationId: 'gs-op', role: 'funcionario', previous: { role: 'socio', sharePct: 50 } }); assert.equal(demote.status, 200);
  const replay = await cmd('bruno', 'gs-approve', 'decide_entry', { id: 'gs-e2e-ocr', operationId: 'gs-op', expectedVersion: 1, decision: 'aprovar', note: '' }); assert.equal(replay.status, 403);
  assert.equal((await workspace('bruno')).financialAccounts.length, 0);
  const logout = await call('bruno', '/api/auth/logout', {}); assert.equal(logout.status, 200);
  assert.equal((await cmd('bruno', 'gs-after-logout', 'save_entry', expense('gs-logout'))).status, 401);
});
