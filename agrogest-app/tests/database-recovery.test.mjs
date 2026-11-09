import assert from 'node:assert/strict';
import { test } from 'node:test';

import { databaseFailureMessage, initializeDatabase, retryTransientWebLock } from '../apps/mobile/src/services/database-recovery.ts';

test('web access-handle errors explain previous openings and other tabs without requiring either', () => {
  for (const error of [
    new Error('NoModificationAllowedError: Access Handles cannot be created if there is another open Access Handle'),
    { name: 'NoModificationAllowedError', message: 'createSyncAccessHandle failed' },
    'createSyncAccessHandle failed',
  ]) {
    const message = databaseFailureMessage(error, true);
    assert.equal(message.title, 'Os dados estão em uso');
    assert.match(message.message, /abertura anterior/);
    assert.match(message.message, /se houver/);
    assert.match(message.help, /não apaga seus registros/);
  }
});

test('migration and unknown errors keep a generic actionable message on both platforms', () => {
  for (const error of [new Error('SQLITE_ERROR'), null, undefined, 42, { name: 'MigrationError' }]) {
    assert.equal(databaseFailureMessage(error, true).title, 'Não foi possível abrir os dados');
    assert.equal(databaseFailureMessage(error, false).title, 'Não foi possível abrir os dados');
  }
  assert.equal(databaseFailureMessage(new Error('createSyncAccessHandle failed'), false).title, 'Não foi possível abrir os dados');
});

test('initialization releases an opened database if its migration fails, preserving the original error', async () => {
  const original = new Error('migration failed');
  for (const closeFails of [false, true]) {
    let closes = 0;
    await assert.rejects(initializeDatabase({
      async getFirstAsync() { throw original; },
      async closeAsync() { closes++; if (closeFails) throw new Error('close failed'); },
    }), (error) => error === original);
    assert.equal(closes, 1);
  }
});

test('successful initialization retains the connection and reuses the existing database version', async () => {
  let closes = 0;
  await initializeDatabase({
    async getFirstAsync(sql) { assert.equal(sql, 'PRAGMA user_version'); return { user_version: 15 }; },
    async closeAsync() { closes++; },
  });
  assert.equal(closes, 0);
});

test('a transient web OPFS lock retries once, with a cooldown and no retry for migration errors', () => {
  assert.equal(retryTransientWebLock(new Error('createSyncAccessHandle: locked'), 0, 20000), true);
  assert.equal(retryTransientWebLock(new Error('NoModificationAllowedError'), 19900, 20000), false);
  assert.equal(retryTransientWebLock(new Error('no such column'), 0, 20000), false);
});
