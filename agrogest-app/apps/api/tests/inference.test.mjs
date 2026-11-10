import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { extract, inferenceCacheKey, isRemoteInference } from '../src/inference.ts';

let server, base, nextFields, invalidJson = false, seen;
const valid = () => ({ amountCents: 4700, occurredAt: '21/09/2018', supplier: null, description: 'Produto visível', document: '123' });
const env = () => ({ APP_ENV: 'local', INFERENCE_PROVIDER: 'local-vision', INFERENCE_REMOTE_ALLOWED: 'false', LOCAL_VISION_BASE_URL: base, LOCAL_VISION_MODEL: 'contract-test', LOCAL_VISION_API_KEY: 'synthetic-local-test-key', LOCAL_VISION_REVISION: 'model@revision-a' });
before(async () => {
  server = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    seen = { url: req.url, authorization: req.headers.authorization, body: JSON.parse(body) };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: invalidJson ? 'incomplete {' : JSON.stringify(nextFields) } }] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });

test('local VLM contract sends image bytes directly and normalizes an explicit Brazilian date without remote permission', async () => {
  nextFields = valid();
  const result = await extract(env(), new Uint8Array([137, 80, 78, 71]).buffer, 'image/png');
  assert.equal(result.fields.amountCents, 4700);
  assert.equal(result.fields.occurredAt, '2018-09-21');
  assert.equal(result.fields.supplier, null);
  assert.equal(result.provider, 'local-vision');
  assert.equal(result.model, 'model@revision-a');
  assert.equal(seen.url, '/v1/chat/completions');
  assert.equal(seen.authorization, 'Bearer synthetic-local-test-key');
  assert.equal(seen.body.messages[0].content[1].image_url.url, 'data:image/png;base64,iVBORw==');
  assert.equal(seen.body.response_format.type, 'json_schema');
});

test('model output must have integer cents, valid calendar dates, bounded fields and complete JSON', async () => {
  for (const bad of [{ amountCents: 47.5 }, { occurredAt: '31/02/2018' }, { supplier: 'x'.repeat(161) }]) {
    nextFields = { ...valid(), ...bad };
    await assert.rejects(extract(env(), new ArrayBuffer(1), 'image/png'), (error) => error.status === 502);
  }
  invalidJson = true;
  await assert.rejects(extract(env(), new ArrayBuffer(1), 'image/png'), (error) => error.status === 502 && !error.message.includes('incomplete'));
  invalidJson = false;
});

test('local provider refuses non-loopback addresses and remote providers require explicit permission', async () => {
  await assert.rejects(extract({ ...env(), LOCAL_VISION_BASE_URL: 'https://remote.invalid' }, new ArrayBuffer(1), 'image/png'), /endereço local/);
  await assert.rejects(extract({ ...env(), INFERENCE_PROVIDER: 'workers-ai' }, new ArrayBuffer(1), 'image/png'), /inferência remota/);
  await assert.rejects(extract({ ...env(), INFERENCE_PROVIDER: 'openrouter', INFERENCE_REMOTE_ALLOWED: 'true' }, new ArrayBuffer(1), 'image/png'), /não suportado/);
  assert.equal(isRemoteInference(env()), false);
  assert.equal(isRemoteInference({ INFERENCE_PROVIDER: 'workers-ai' }), true);
});

test('extraction cache depends on pipeline and model revision and never stores the private API key', () => {
  const key = inferenceCacheKey(env());
  assert.notEqual(key, inferenceCacheKey({ ...env(), LOCAL_VISION_REVISION: 'model@revision-b' }));
  assert.equal(key.includes('synthetic-local-test-key'), false);
  assert.notEqual(key, inferenceCacheKey({ ...env(), INFERENCE_PROVIDER: 'local' }));
});

const cloud = () => ({ APP_ENV: 'local', INFERENCE_PROVIDER: 'workers-ai', INFERENCE_REMOTE_ALLOWED: 'true', WORKERS_AI_TRANSPORT: 'rest', WORKERS_AI_MODEL: '@cf/meta/llama-4-scout-17b-16e-instruct', WORKERS_AI_ACCOUNT_ID: 'a'.repeat(32), WORKERS_AI_API_TOKEN: 'synthetic-private-token' });

test('Workers AI REST contract uses only the selected Cloudflare account, inline image and native schema; errors never fall back', async (t) => {
  const calls = [];
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options });
    return Response.json({ success: true, result: { response: JSON.stringify(valid()) } });
  });
  t.after(() => fetch.mock.restore());
  const result = await extract(cloud(), new Uint8Array([137, 80, 78, 71]).buffer, 'image/png');
  assert.equal(result.fields.amountCents, 4700);
  assert.equal(result.fields.occurredAt, '2018-09-21');
  assert.equal(result.provider, 'workers-ai');
  assert.equal(calls[0].url, `https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/ai/run/@cf/meta/llama-4-scout-17b-16e-instruct`);
  const input = JSON.parse(calls[0].body);
  assert.equal(input.messages[0].content[1].image_url.url, 'data:image/png;base64,iVBORw==');
  assert.equal(input.response_format.json_schema.properties.amountCents.type[0], 'integer');
  fetch.mock.mockImplementation(async () => { calls.push('failure'); return new Response('synthetic upstream private error', { status: 429 }); });
  await assert.rejects(extract(cloud(), new ArrayBuffer(1), 'image/png'), error => error.status === 502 && !error.message.includes('private'));
  assert.equal(calls.length, 2, 'one request per extraction; no fallback');
});

test('hosted Workers AI binding uses the same image/schema without a token and cannot activate in local development', async () => {
  const calls = [];
  const config = { ...cloud(), APP_ENV: 'staging', WORKERS_AI_TRANSPORT: 'binding', WORKERS_AI_API_TOKEN: undefined, WORKERS_AI_ACCOUNT_ID: undefined, AI: { run: async (model, input) => { calls.push({ model, input }); return { response: valid() }; } } };
  assert.equal((await extract(config, new ArrayBuffer(1), 'image/jpeg')).fields.amountCents, 4700);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.messages[0].content[1].image_url.url, 'data:image/jpeg;base64,AA==');
  await assert.rejects(extract({ ...config, APP_ENV: 'local' }, new ArrayBuffer(1), 'image/png'), /exclusivo/);
  await assert.rejects(extract({ ...config, INFERENCE_PROVIDER: 'local-vision' }, new ArrayBuffer(1), 'image/png'), /hospedado/);
  assert.equal(calls.length, 1);
});

test('Workers AI rejects missing credentials, text-only models and unvalidated remote output', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, result: { response: JSON.stringify({ ...valid(), amountCents: 0.5 }) } }));
  t.after(() => fetch.mock.restore());
  await assert.rejects(extract({ ...cloud(), WORKERS_AI_API_TOKEN: '' }, new ArrayBuffer(1), 'image/png'), /conta e token/);
  await assert.rejects(extract({ ...cloud(), WORKERS_AI_MODEL: '@cf/text-only-model' }, new ArrayBuffer(1), 'image/png'), /modelo visual/);
  assert.equal(fetch.mock.callCount(), 0);
  await assert.rejects(extract(cloud(), new ArrayBuffer(1), 'image/png'), error => error.status === 502);
  assert.equal(fetch.mock.callCount(), 1);
});
