import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectWorkspace } from '../apps/mobile/src/state/workspace-selectors.ts';
import { today, workspaceFixture } from './fixtures/workspace.mjs';

const { sameValue, shareSnapshot } = await import('../apps/mobile/src/state/share-snapshot.ts');

const read = () => ({
  lots: [{ id: 'l1', code: 'Origem 021', purchasePlan: { installments: [1, 2] } }],
  entries: [{ id: 'e1', payload: { kg: 236 }, status: 'aprovado' }],
  settings: { contextFarmId: 'f1', lastSyncAt: '2026-10-25T10:00:00.000Z' },
});

test('same data keeps the previous snapshot, ignoring only the last sync time', () => {
  const prev = read();
  const next = { ...read(), settings: { ...read().settings, lastSyncAt: '2026-10-25T10:05:00.000Z' } };
  assert.equal(shareSnapshot(prev, next), prev);
});

test('a changed table is replaced while equal tables keep their reference', () => {
  const prev = read();
  const next = read();
  next.entries[0].payload.kg = 248;
  const shared = shareSnapshot(prev, next);
  assert.notEqual(shared, prev);
  assert.equal(shared.lots, prev.lots);
  assert.equal(shared.settings, prev.settings);
  assert.equal(shared.entries, next.entries);
  assert.equal(shared.entries[0].payload.kg, 248);
});

test('any other setting change counts as new data', () => {
  const prev = read();
  const next = { ...read(), settings: { ...read().settings, contextFarmId: 'f2' } };
  const shared = shareSnapshot(prev, next);
  assert.equal(shared.settings, next.settings);
  assert.equal(shared.lots, prev.lots);
});

test('structural equality distinguishes order, missing keys, null and arrays', () => {
  assert.equal(sameValue([1, 2], [1, 2]), true);
  assert.equal(sameValue([1, 2], [2, 1]), false);
  assert.equal(sameValue({ a: 1 }, { a: 1, b: undefined }), false);
  assert.equal(sameValue({ a: null }, { a: null }), true);
  assert.equal(sameValue(null, {}), false);
  assert.equal(sameValue([], {}), false);
  assert.equal(sameValue({ a: [{ b: 1 }] }, { a: [{ b: 1 }] }), true);
});

test('the first read is used as is', () => {
  const next = read();
  assert.equal(shareSnapshot(null, next), next);
});

test('sharing unchanged data never preserves financial access after a role downgrade', () => {
  const prev = workspaceFixture();
  assert.ok(selectWorkspace(prev, 'partner', true, today).accounts.length > 0);
  const next = structuredClone(prev);
  next.memberships = next.memberships.map((member) => member.userId === 'partner'
    ? { ...member, role: 'funcionario', sharePct: null }
    : member);
  const shared = shareSnapshot(prev, next);
  assert.equal(shared.accounts, prev.accounts);
  assert.equal(shared.memberships, next.memberships);
  const workspace = selectWorkspace(shared, 'partner', true, today);
  assert.deepEqual(workspace.accounts, []);
  assert.deepEqual(workspace.installments, []);
  assert.deepEqual(workspace.pendingPurchases, []);
});

test('membership removal takes effect even when every farm and lot stays unchanged', () => {
  const prev = workspaceFixture();
  const next = structuredClone(prev);
  next.memberships = next.memberships.filter((member) => member.userId !== 'partner');
  const shared = shareSnapshot(prev, next);
  assert.equal(shared.lots, prev.lots);
  const workspace = selectWorkspace(shared, 'partner', true, today);
  assert.deepEqual(workspace.visibleFarms, []);
  assert.deepEqual(workspace.visibleEntries, []);
  assert.deepEqual(workspace.activity, []);
  assert.deepEqual(workspace.accounts, []);
});
