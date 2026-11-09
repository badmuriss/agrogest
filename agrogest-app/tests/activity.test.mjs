import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
// Node's TS stripping does not resolve the extensionless imports used by Metro.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') && context.parentURL?.includes('/src/domain/') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { activityDay, activityTime, describeActivity, localActivity } = await import('../apps/mobile/src/domain/activity.ts');

const item = (kind, subject = {}) => ({ id: '1', operationId: 'o', farmId: 'f', actorId: 'u', actorName: 'Marlon Souza', kind, at: '2026-10-19T17:32:00.000Z', subject });

test('each action reads as a short sentence with the object in evidence and no money', () => {
  assert.deepEqual(
    (({ action, object }) => ({ action, object }))(describeActivity(item('create_pasture', { name: 'Piquete 3' }))),
    { action: 'cadastrou o pasto', object: 'Piquete 3' });
  assert.equal(describeActivity(item('update_pasture', { name: 'P1', wasActive: true, active: false })).action, 'inativou o pasto');
  assert.equal(describeActivity(item('delete_pasture', { name: 'P1' })).tone, 'danger');
  const move = describeActivity(item('save_entry', { entryKind: 'manejo', submit: true, lotCode: '021', heads: 12, fromPasture: 'Córrego', toPasture: 'Represa' }));
  assert.equal(move.action, 'registrou uma mudança de pasto');
  assert.equal(move.detail, 'Origem 021 · 12 cabeças · Córrego → Represa');
  assert.equal(describeActivity(item('decide_entry', { entryKind: 'venda', decision: 'recusar' })).action, 'recusou uma venda');
  assert.equal(describeActivity(item('transfer_lot', { code: '7', direction: 'entrada', fromFarm: 'Boa Vista' })).detail, 'de Boa Vista');
  // A command this version does not know still shows up.
  assert.equal(describeActivity(item('nova_acao')).action, 'fez uma alteração');
});

test('days read as Hoje/Ontem/date and plain dates have no time', () => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(activityDay(now.toISOString(), today), 'Hoje');
  assert.equal(activityDay(new Date(now.getTime() - 86_400_000).toISOString(), today), 'Ontem');
  assert.equal(activityDay('2026-01-05', '2026-10-25'), '5 de jan');
  assert.equal(activityDay('2025-12-30', '2026-10-25'), '30 de dez de 2025');
  assert.equal(activityTime('2026-01-05'), null);
  assert.match(activityTime(now.toISOString()), /^\d{2}:\d{2}$/);
});

test('the local prototype builds activity from entry history, newest first, merging created+sent', () => {
  const entry = {
    id: 'e1', kind: 'manejo', status: 'aprovado', operationId: 'o', farmId: 'f', authorId: 'u1', title: 't', amountCents: null,
    occurredAt: '2026-10-01', createdAt: '2026-10-01T10:00:00.000Z',
    payload: { lotId: 'l1', fromPastureId: 'p1', toPastureId: 'p2', heads: 5, notes: '' },
    history: [
      { at: '2026-10-01T10:00:00.000Z', by: 'u1', action: 'criado' },
      { at: '2026-10-01T10:00:00.000Z', by: 'u1', action: 'enviado' },
      { at: '2026-10-02T09:00:00.000Z', by: 'u2', action: 'aprovado' },
    ],
  };
  const items = localActivity({
    entries: [entry],
    pastures: [{ id: 'p1', operationId: 'o', farmId: 'f', name: 'Pasto 01', areaHa: 10, forage: 'x', notes: '', active: true, createdAt: '2026-09-01T00:00:00.000Z' }],
    users: [{ id: 'u1', name: 'Marlon' }, { id: 'u2', name: 'Ana' }],
    lotCode: () => '021',
    pastureName: (id) => (id === 'p1' ? 'Pasto 01' : 'Pasto 02'),
  });
  assert.deepEqual(items.map((i) => [i.kind, i.actorName]), [['decide_entry', 'Ana'], ['save_entry', 'Marlon'], ['create_pasture', null]]);
  assert.equal(describeActivity(items[1]).detail, 'Origem 021 · 5 cabeças · Pasto 01 → Pasto 02');
});
