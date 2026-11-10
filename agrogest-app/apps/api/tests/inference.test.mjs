import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { extract, inferenceCacheKey, isRemoteInference } from '../src/inference.ts';

let server, base, nextFields, invalidJson = false, seen;
const valid = () => ({ amountCents: 4700, occurredAt: '21/09/2018', supplier: null, description: 'Produto visível', document: '123' });
const env = () => ({ INFERENCE_PROVIDER: 'local-vision', INFERENCE_REMOTE_ALLOWED: 'false', LOCAL_VISION_BASE_URL: base, LOCAL_VISION_MODEL: 'contract-test', LOCAL_VISION_API_KEY: 'synthetic-local-test-key', LOCAL_VISION_REVISION: 'model@revision-a' });
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
  await assert.rejects(extract({ ...env(), INFERENCE_PROVIDER: 'openrouter' }, new ArrayBuffer(1), 'image/png'), /inferência remota/);
  assert.equal(isRemoteInference(env()), false);
  assert.equal(isRemoteInference({ INFERENCE_PROVIDER: 'openrouter' }), true);
});

test('extraction cache depends on pipeline and model revision and never stores the private API key', () => {
  const key = inferenceCacheKey(env());
  assert.notEqual(key, inferenceCacheKey({ ...env(), LOCAL_VISION_REVISION: 'model@revision-b' }));
  assert.equal(key.includes('synthetic-local-test-key'), false);
  assert.notEqual(key, inferenceCacheKey({ ...env(), INFERENCE_PROVIDER: 'local' }));
});
