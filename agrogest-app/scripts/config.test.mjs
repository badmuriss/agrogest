import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { configure, readConfig, configurationProblems, workersModel } from './local-config.mjs';
import { cloudConfig, prepareCloud, bootstrapSql } from './cloud-config.mjs';
import { backendLocation } from '../apps/mobile/src/services/backend-location.ts';
const settings = (environment = 'staging') => ({ environment, accountId: 'a'.repeat(32), workerName: `agrogest-${environment}`, origin: `https://agrogest-${environment}.example.workers.dev`, databaseName: `agrogest-${environment}`, databaseId: '11111111-1111-4111-8111-111111111111', bucketName: `agrogest-documents-${environment}`, inferenceTransport: 'binding' });

test('switching inference preserves unrelated credentials and state, removes obsolete provider config, and reports missing settings without secrets', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agrogest-config-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, '.dev.vars'), state = path.join(dir, 'outbox.sqlite');
  writeFileSync(file, '# Keep this comment\nCUSTOM_KEY="synthetic#key"\nOPENROUTER_API_KEY=obsolete-key\nLOCAL_VISION_API_KEY="synthetic-local-key"\n');
  writeFileSync(state, 'unchanged outbox');
  configure('workers-ai', file);
  const config = readConfig(file);
  assert.equal(config.CUSTOM_KEY, 'synthetic#key');
  assert.equal(config.LOCAL_VISION_API_KEY, 'synthetic-local-key');
  assert.equal(config.INFERENCE_REMOTE_ALLOWED, 'true');
  assert.equal(config.WORKERS_AI_MODEL, workersModel);
  assert.equal(config.OPENROUTER_API_KEY, undefined);
  const errors = configurationProblems(config).join('\n');
  assert.match(errors, /WORKERS_AI_API_TOKEN/); assert.doesNotMatch(errors, /synthetic|obsolete-key/);
  configure('local-vision', file);
  assert.equal(readConfig(file).INFERENCE_REMOTE_ALLOWED, 'false');
  assert.equal(readFileSync(state, 'utf8'), 'unchanged outbox');
  assert.throws(() => configure('unknown', file));
});

test('web follows its hosted origin; local names remain byte-compatible and backends/accounts have separate sessions and outboxes', async () => {
  const hash = async value => createHash('sha256').update(value).digest('hex');
  const local = backendLocation(undefined, 'http://127.0.0.1:8787');
  assert.equal(local.url, 'http://127.0.0.1:8787');
  assert.equal(local.sessionKey, 'agrogest-worker-local-session-v1');
  assert.equal(await local.database('gs-ana', hash), 'agrogest-worker-local-gs-ana.db');
  assert.equal(backendLocation('', 'http://localhost:8081').url, local.url);
  const hosted = backendLocation(undefined, 'https://agrogest.example.workers.dev');
  assert.equal(hosted.url, 'https://agrogest.example.workers.dev');
  assert.doesNotMatch(await hosted.database('ana', hash), /[%/:]/);
  assert.notEqual(await hosted.database('gs-ana', hash), await local.database('gs-ana', hash));
  assert.notEqual(await hosted.database('ana', hash), await hosted.database('bruno', hash));
  assert.notEqual(hosted.sessionKey, backendLocation('https://other.example.workers.dev').sessionKey);
  const longest = backendLocation(`https://${'w'.repeat(63)}.${'a'.repeat(63)}.workers.dev`);
  const filename = await longest.database('u'.repeat(100), hash);
  assert.ok(('/' + filename + '-journal').length < 64, 'fits the installed Expo web VFS path limit including journal');
  assert.match(longest.sessionKey, /^[A-Za-z0-9_.-]+$/);
  assert.throws(() => backendLocation('https://user:secret@example.com'));
  assert.throws(() => backendLocation('https://example.com/api'));
});

test('cloud package separates staging/production, selects binding or private REST and excludes public demo identities', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'agrogest-cloud-config-')); t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = prepareCloud(settings(), directory);
  assert.equal(config.env.staging.vars.WORKERS_AI_TRANSPORT, 'binding');
  assert.deepEqual(config.env.staging.ai, { binding: 'AI' });
  assert.equal(config.env.staging.vars.WORKERS_AI_API_TOKEN, undefined);
  assert.throws(() => readFileSync(path.join(directory, 'migrations/0002_local_demo.sql')));
  assert.match(readFileSync(path.join(directory, 'migrations/0001_domain.sql'), 'utf8'), /CREATE TABLE IF NOT EXISTS identities/);
  writeFileSync(path.join(directory, 'migrations/0002_local_demo.sql'), '-- stale package');
  assert.throws(() => prepareCloud(settings(), directory), /migration não prevista/);
  const production = cloudConfig({ ...settings('production'), inferenceTransport: 'rest', inferenceAccountId: 'b'.repeat(32) }, directory).env.production;
  assert.equal(production.ai, undefined);
  assert.equal(production.vars.WORKERS_AI_ACCOUNT_ID, 'b'.repeat(32));
  for (const invalid of [{ origin: 'http://localhost:8787' }, { origin: 'https://agrogest-staging.example.workers.dev/' }, { databaseId: '00000000-0000-0000-0000-000000000001' }, { inferenceTransport: 'unknown' }]) assert.throws(() => cloudConfig({ ...settings(), ...invalid }, directory));
});

test('private account bootstrap escapes SQL, hashes passwords and rejects public demonstration accounts', () => {
  const sql = bootstrapSql([{ email: 'reviewer@example.org', name: "Maria d'Ávila", password: 'Synthetic-only-strong-password' }], 'staging');
  assert.doesNotMatch(sql, /Synthetic-only-strong-password|AgroGest2026!/);
  assert.match(sql, /Maria d''Ávila/);
  assert.match(sql, /ON CONFLICT\(id\) DO NOTHING/);
  assert.throws(() => bootstrapSql([{ email: 'ana@agrogest.local', name: 'Ana', password: 'AgroGest2026!' }], 'production'));
});
