import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { bootstrapSql, cloudMigrations } from '../../../scripts/cloud-config.mjs';
let mf, db, temporary;
const origin = 'https://agrogest-staging.example.workers.dev';
const account = { email: 'reviewer@example.org', name: 'Revisor independente', password: 'Synthetic-private-password-2026' };
const apply = async text => { for (const sql of text.replace(/^--.*$/gm, '').split(';').map(x => x.trim()).filter(Boolean)) await db.prepare(sql).run(); };
const login = input => mf.dispatchFetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
before(async () => {
  temporary = await mkdtemp(path.join(tmpdir(), 'agrogest-cloud-local-test-'));
  await build({ entryPoints: ['src/index.ts'], outfile: path.join(temporary, 'worker.mjs'), bundle: true, format: 'esm', platform: 'browser' });
  mf = new Miniflare({ ...convertV4MiniflareOptions({ name: 'agrogest-cloud-contract', cf: false, modules: true, modulesRoot: temporary, scriptPath: path.join(temporary, 'worker.mjs'), compatibilityDate: '2026-11-06', d1Databases: ['DB'], r2Buckets: ['DOCUMENTS'], bindings: { APP_ENV: 'staging', FRONTEND_ORIGIN: origin, INFERENCE_PROVIDER: 'workers-ai', INFERENCE_REMOTE_ALLOWED: 'false' } }), telemetry: { enabled: false } });
  db = await mf.getD1Database('DB');
  for (const name of cloudMigrations) await apply(await readFile(`migrations/${name}`, 'utf8'));
});
after(async () => { await mf?.dispose(); if (temporary) await rm(temporary, { recursive: true, force: true }); });

test('hosted configuration accepts only its explicit HTTPS origin and rejects local Metro CORS', async () => {
  const response = await mf.dispatchFetch(`${origin}/api/health`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.environment, 'staging'); assert.equal(health.database, 'D1');
  assert.equal(health.remoteInferenceAllowed, false, 'no remote AI during this simulated integration');
  for (const bad of ['http://localhost/api/health', 'http://agrogest-staging.example.workers.dev/api/health', 'https://other.example.workers.dev/api/health']) assert.equal((await mf.dispatchFetch(bad)).status, 403);
  const cors = await mf.dispatchFetch(`${origin}/api/health`, { headers: { Origin: 'http://localhost:8081' } });
  assert.equal(cors.status, 403); assert.equal(cors.headers.get('Access-Control-Allow-Origin'), null);
  const options = await mf.dispatchFetch(`${origin}/api/health`, { method: 'OPTIONS', headers: { Origin: origin } });
  assert.equal(options.status, 204); assert.equal(options.headers.get('Access-Control-Allow-Origin'), origin);
});

test('cloud schema has no public demo data; private bootstrap logs in and creates an operation through the real domain', async () => {
  assert.equal((await db.prepare('SELECT count(*) AS n FROM identities').first()).n, 0);
  const sql = bootstrapSql([account], 'staging');
  await apply(sql); await apply(sql);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM identities').first()).n, 1, 'replay does not duplicate identities');
  const response = await login(account); assert.equal(response.status, 200);
  const session = (await response.json()).data.session;
  const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
  const result = await mf.dispatchFetch(`${origin}/api/rpc/agrogest_command`, { method: 'POST', headers, body: JSON.stringify({ command_id: 'cloud-first-farm', kind: 'create_farm', payload: { id: 'private-farm', operationId: 'private-operation', name: 'Fazenda do revisor', city: '', pastureRentCents: 0 } }) });
  assert.equal(result.status, 200, await result.text());
  const workspace = await mf.dispatchFetch(`${origin}/api/rpc/agrogest_workspace`, { method: 'POST', headers, body: '{}' });
  const state = (await workspace.json()).data;
  assert.equal(state.farms[0].id, 'private-farm');
  const upload = await mf.dispatchFetch(`${origin}/api/documents?operationId=private-operation`, { method: 'POST', headers, body: await readFile('../../tests/fixtures/comprovante-gs-004.png') });
  assert.equal(upload.status, 201);
  const document = await upload.json();
  const extraction = await mf.dispatchFetch(`${origin}/api/documents/${document.id}/extract`, { method: 'POST', headers, body: '{}' });
  assert.equal(extraction.status, 503, 'remote inference explicitly disabled in this local test');
  const original = await mf.dispatchFetch(`${origin}/api/documents/${document.id}/content`, { headers });
  assert.equal(original.status, 200); assert.equal((await original.arrayBuffer()).byteLength, document.size);
});

test('accidentally imported public demo credentials and sessions cannot access a hosted environment', async () => {
  await apply(await readFile('migrations/0002_local_demo.sql', 'utf8'));
  const response = await login({ email: 'ana@agrogest.local', password: 'AgroGest2026!' });
  assert.equal(response.status, 403);
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(''.padEnd(64, '0'), 'gs-ana', Date.now() + 60000).run();
  // A valid hash still cannot bypass the hosted demo-identity guard.
  const token = 'a'.repeat(64);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(b => b.toString(16).padStart(2, '0')).join('');
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(hash, 'gs-ana', Date.now() + 60000).run();
  assert.equal((await mf.dispatchFetch(`${origin}/api/auth/user`, { headers: { Authorization: `Bearer ${token}` } })).status, 403);
});
