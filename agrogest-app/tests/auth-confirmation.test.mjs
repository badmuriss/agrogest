import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONFIRMATION_COOLDOWN_MS, confirmationFailure, createEmailConfirmation, parseAuthCallback } from '../apps/mobile/src/services/email-confirmation.ts';

const redirect = () => 'agrogest:///auth/callback';
const fixtureUser = (patch = {}) => ({ id: 'fixture-user', email: 'person@example.test', email_confirmed_at: '2026-10-25T12:00:00Z', ...patch });
const fixtureSession = (user = fixtureUser()) => ({ user, access_token: 'fixture-access', refresh_token: 'fixture-refresh' });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('signup cooldown and simultaneous resends never create users or send twice', async (t) => {
  let now = 100_000;
  t.mock.method(Date, 'now', () => now);
  const delivery = deferred();
  const calls = [];
  const flow = createEmailConfirmation({
    async resend(input) { calls.push(input); return delivery.promise; },
  }, redirect);
  flow.begin(' Person@Example.Test ');
  assert.equal(flow.getSnapshot().email, 'person@example.test');
  assert.equal(await flow.resend(), false);
  assert.equal(calls.length, 0);
  now += CONFIRMATION_COOLDOWN_MS;
  const first = flow.resend();
  assert.equal(flow.getSnapshot().status, 'sending');
  assert.equal(await flow.resend('another@example.test'), false);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { type: 'signup', email: 'person@example.test', options: { emailRedirectTo: redirect() } });
  delivery.resolve({ error: null });
  assert.equal(await first, true);
  assert.equal(flow.getSnapshot().status, 'awaiting');
  // Changing the address or resetting the pending flow cannot bypass the cooldown.
  flow.reset();
  assert.equal(await flow.resend('another@example.test'), false);
  assert.equal(calls.length, 1);
});

test('failed delivery reserves cooldown, maps rate limiting and ignores replies after reset', async (t) => {
  t.mock.method(Date, 'now', () => 100_000);
  const flow = createEmailConfirmation({ async resend() { return { error: { code: 'over_email_send_rate_limit' } }; } }, redirect);
  assert.equal(await flow.resend('person@example.test'), false);
  assert.equal(flow.getSnapshot().reason, 'rate_limited');
  assert.equal(flow.getSnapshot().retryAt, 160_000);
  const response = deferred();
  const other = createEmailConfirmation({ async resend() { return response.promise; } }, redirect);
  const pending = other.resend('person@example.test');
  other.reset();
  response.resolve({ error: null });
  assert.equal(await pending, false);
  assert.equal(other.getSnapshot().status, 'idle');
});

test('missing session cannot claim that the email was confirmed', async () => {
  let userCalls = 0;
  const flow = createEmailConfirmation({
    async getSession() { return { data: { session: null }, error: null }; },
    async getUser() { userCalls++; throw new Error('must not fetch without session'); },
  }, redirect);
  flow.begin('person@example.test');
  assert.equal(await flow.check(), null);
  assert.equal(flow.getSnapshot().status, 'needs_sign_in');
  assert.equal(flow.getSnapshot().reason, 'no_session');
  assert.equal(userCalls, 0);
});

test('verification after a returning link waits for an in-flight resend', async () => {
  const response = deferred();
  let sessionCalls = 0;
  const flow = createEmailConfirmation({
    async resend() { return response.promise; },
    async getSession() { sessionCalls++; return { data: { session: fixtureSession() }, error: null }; },
    async getUser() { return { data: { user: fixtureUser() }, error: null }; },
  }, redirect);
  const resend = flow.resend('person@example.test');
  const check = flow.check('person@example.test');
  assert.equal(sessionCalls, 0);
  response.resolve({ error: null });
  assert.equal(await resend, true);
  assert.equal((await check).user.id, 'fixture-user');
  assert.equal(flow.getSnapshot().status, 'verified');
});

test('confirmation requires a server-verified confirmed user in the same current session', async () => {
  const saved = fixtureSession(fixtureUser({ email_confirmed_at: null }));
  let server = fixtureUser();
  let current = saved;
  const flow = createEmailConfirmation({
    async getSession() { return { data: { session: current }, error: null }; },
    async getUser() { return { data: { user: server }, error: null }; },
  }, redirect);
  const verified = await flow.check(' PERSON@EXAMPLE.TEST ');
  assert.equal(verified.user.email_confirmed_at, server.email_confirmed_at);
  assert.equal(flow.getSnapshot().status, 'verified');
  assert.equal('access_token' in flow.getSnapshot(), false);
  server = fixtureUser({ email_confirmed_at: null });
  assert.equal(await flow.check(), null);
  assert.equal(flow.getSnapshot().reason, 'not_confirmed');
  server = fixtureUser();
  assert.equal(await flow.check('other@example.test'), null);
  assert.equal(flow.getSnapshot().reason, 'email_mismatch');
  current = fixtureSession(fixtureUser({ id: 'different-user' }));
  assert.equal(await flow.check(), null);
  assert.equal(flow.getSnapshot().reason, 'session_changed');
});

test('sign-out or account switch during verification cannot return the old session', async () => {
  const userResponse = deferred();
  let current = fixtureSession();
  const flow = createEmailConfirmation({
    async getSession() { return { data: { session: current }, error: null }; },
    async getUser() { return userResponse.promise; },
  }, redirect);
  const pending = flow.check('person@example.test');
  await Promise.resolve();
  current = fixtureSession(fixtureUser({ id: 'new-user' }));
  userResponse.resolve({ data: { user: fixtureUser() }, error: null });
  assert.equal(await pending, null);
  assert.equal(flow.getSnapshot().reason, 'session_changed');
});

test('validation and network/expiry failures remain explicit without throwing raw provider errors', async () => {
  const local = createEmailConfirmation(null, redirect);
  assert.equal(await local.resend('bad-address'), false);
  assert.equal(local.getSnapshot().reason, 'invalid_email');
  assert.equal(await local.check(), null);
  assert.equal(local.getSnapshot().reason, 'unavailable');
  const flow = createEmailConfirmation({ async getSession() { throw new Error('private provider detail'); } }, redirect);
  assert.equal(await flow.check(), null);
  assert.equal(flow.getSnapshot().reason, 'connection');
  assert.doesNotMatch(flow.getSnapshot().error, /private/);
  assert.equal(confirmationFailure({ code: 'pkce_code_verifier_not_found' }).reason, 'link_expired');
  assert.equal(confirmationFailure({ code: 'session_not_found' }).reason, 'session_expired');
});

test('callback accepts exact app locations and preserves the SDK PKCE flow ID', () => {
  const parsed = parseAuthCallback(`${redirect()}?code=fixture-code&sb_flow_id=fixture-flow`, redirect());
  assert.deepEqual(parsed, { kind: 'code', code: 'fixture-code', flowId: 'fixture-flow' });
  assert.equal(parseAuthCallback('agrogest://auth/callback?code=fixture-code', redirect()).kind, 'code');
  assert.equal(parseAuthCallback('https://elsewhere.test/auth/callback?code=fixture-code', redirect()).kind, 'ignore');
  assert.equal(parseAuthCallback('agrogest:///evil/auth/callback?code=fixture-code', redirect()).kind, 'ignore');
  assert.equal(parseAuthCallback('agrogest://auth/other?code=fixture-code', redirect()).kind, 'ignore');
  assert.equal(parseAuthCallback(`${redirect()}?access_token=fixture-token`, redirect()).kind, 'error');
  assert.match(parseAuthCallback(`${redirect()}#error_code=otp_expired`, redirect()).error, /expirou/);
  assert.equal(parseAuthCallback('https://local.test/auth/callback?code=fixture-code', 'https://local.test/auth/callback').kind, 'code');
});
