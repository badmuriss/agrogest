import assert from 'node:assert/strict';
import { test } from 'node:test';

import { appAccessAllowed, callbackStage } from '../apps/mobile/src/domain/auth-callback.ts';

test('callback screen only finishes after verified success with a session', () => {
  assert.equal(callbackStage({ recovering: false, callbackStatus: 'checking', hasSession: true }), 'checking');
  assert.equal(callbackStage({ recovering: false, callbackStatus: 'error', hasSession: true }), 'error');
  assert.equal(callbackStage({ recovering: false, callbackStatus: 'idle', hasSession: true }), 'idle');
  assert.equal(callbackStage({ recovering: false, callbackStatus: 'success', hasSession: false }), 'idle');
  assert.equal(callbackStage({ recovering: false, callbackStatus: 'success', hasSession: true }), 'done');
});

test('password recovery keeps priority over the confirmation result', () => {
  for (const callbackStatus of ['idle', 'checking', 'success', 'error']) {
    assert.equal(callbackStage({ recovering: true, callbackStatus, hasSession: true }), 'recovery');
  }
});

test('app stays closed while a PKCE session is unverified or rejected', () => {
  assert.equal(appAccessAllowed({ signedIn: true, recovering: false, callbackStatus: 'checking' }), false);
  assert.equal(appAccessAllowed({ signedIn: true, recovering: false, callbackStatus: 'error' }), false);
  assert.equal(appAccessAllowed({ signedIn: true, recovering: true, callbackStatus: 'success' }), false);
  assert.equal(appAccessAllowed({ signedIn: false, recovering: false, callbackStatus: 'success' }), false);
  assert.equal(appAccessAllowed({ signedIn: true, recovering: false, callbackStatus: 'success' }), true);
  // Sem link nenhum (sessão já existente, login com senha): o app segue aberto como antes.
  assert.equal(appAccessAllowed({ signedIn: true, recovering: false, callbackStatus: 'idle' }), true);
});

test('a link refused before creating a session keeps the existing session open', () => {
  assert.equal(callbackStage({ recovering: false, callbackStatus: 'rejected', hasSession: true }), 'error');
  assert.equal(callbackStage({ recovering: false, callbackStatus: 'rejected', hasSession: false }), 'error');
  assert.equal(appAccessAllowed({ signedIn: true, recovering: false, callbackStatus: 'rejected' }), true);
  assert.equal(appAccessAllowed({ signedIn: false, recovering: false, callbackStatus: 'rejected' }), false);
});
