import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL (PGlite) with an Auth fixture, like finance-database.test.mjs. Proves the SQL rules
// of the finance management (issue #46, phases 2 and 3): card accounts, movements and partners,
// own-money payments and reimbursements, client advances, financings, renegotiation, recurring
// expenses, other revenues, budgets, imported titles, idempotency and the employee projection.
let pg;
const alice = randomUUID(), bob = randomUUID(), employee = randomUUID();
const operation = randomUUID(), farm = randomUUID(), lot = randomUUID();
const bank = randomUUID(), cash = randomUUID(), card = randomUUID();

before(async () => {
  pg = await PGlite.create();
  await pg.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  for (const [id, name] of [[alice, 'Alice'], [bob, 'Bob'], [employee, 'Campo']]) {
    await pg.query('insert into auth.users values($1,$2,now(),$3)', [id, `${id}@example.invalid`, JSON.stringify({ name })]);
  }
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    await pg.exec(await readFile(new URL(file, migrations), 'utf8'));
  }
  await command(alice, 'create_farm', { id: farm, operationId: operation, name: 'Fazenda gestão', city: null, pastureRentCents: 0 });
  for (const [user, role] of [[bob, 'socio'], [employee, 'funcionario']]) {
    const id = randomUUID();
    await command(alice, 'invite', { id, operationId: operation, name: 'Convidado', contact: `${user}@example.invalid`, role, sharePct: null });
    await command(user, 'accept_invite', { id });
  }
  await command(alice, 'create_lot', { id: lot, operationId: operation, farmId: farm, code: 'G01', managementGroup: 'Pasto', supplier: '', category: 'Novilhas',
    purchasedAt: '2026-09-01', headsPurchased: 50, entryWeightKg: 250, purchaseCents: 100, commissionCents: 0, freightCents: 0 });
  const account = (id, name, kind, extra = {}) => command(alice, 'create_account', { id, operationId: operation, name, kind, bank: 'Banco', agency: '', number: '',
    openingBalanceCents: 0, openingDate: '2026-09-01', active: true, ...extra });
  await account(bank, 'Conta movimento', 'corrente', { openingBalanceCents: 1_000_000 });
  await account(cash, 'Caixa', 'caixa');
  await account(card, 'Cartão da fazenda', 'cartao', { closingDay: 5, dueDay: 15 });
});
after(async () => { await pg?.close(); });

async function asUser(user, query, params = []) {
  return pg.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? '']);
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
    return tx.query(query, params);
  });
}
async function command(user, kind, payload, id = randomUUID()) {
  const result = await asUser(user, 'select public.agrogest_command($1,$2,$3) as result', [id, kind, JSON.stringify(payload)]);
  return result.rows[0].result;
}
const workspace = async (user) => (await asUser(user, 'select public.agrogest_workspace() as result')).rows[0].result;
async function saveEntry(user, entry, id = randomUUID()) {
  return command(user, 'save_entry', { id, operationId: operation, farmId: farm, submit: true, expectedVersion: null,
    entry: { occurredAt: '2026-10-13', title: 'Lançamento', ...entry } });
}
const expense = (cents, installments, payload = {}) => ({ kind: 'despesa', amountCents: cents, title: 'Compra de sal',
  payload: { category: 'Alimentação e insumos', categoryId: 'cat-alimentacao', description: 'Sal', supplier: 'Casa do Campo', document: '', installments,
    criterion: 'cabeca', allocations: [], ...payload } });
const approve = (entry, user = bob) => command(user, 'decide_entry', { id: entry.id, operationId: operation, decision: 'aprovar', note: '', expectedVersion: entry.version });
const pay = (items, extra = {}, user = alice, id) => command(user, 'register_payment', {
  id: randomUUID(), operationId: operation, direction: 'pagar', accountId: bank, paidAt: '2026-10-15', items,
  interestCents: 0, fineCents: 0, discountCents: 0, method: 'pix', proof: '', notes: '', ...extra,
}, id);
const move = (kind, extra = {}, user = alice, id) => command(user, 'register_movement', {
  id: randomUUID(), operationId: operation, kind, fromAccountId: null, toAccountId: null, partnerId: null, financingId: null,
  counterparty: '', counterpartyId: null, invoiceMonth: null, cents: 10_000, occurredAt: '2026-10-10', method: 'pix', proof: '', notes: '', ...extra,
}, id);
const group = randomUUID(), center = randomUUID();
const saveCenter = (id, name, parentId = null, isGroup = false, extra = {}, user = alice) => command(user, 'save_cost_center', {
  id, operationId: operation, name, parentId, isGroup, active: true, previous: null, ...extra,
});

test('centers: isolation, groups, concurrency, inactivation, immutable grouping and idempotency', async () => {
  const g = await saveCenter(group, 'Hidráulica', null, true);
  const c = await saveCenter(center, 'Roda d’água', group);
  assert.equal(c.parentId, group);
  const otherOperation = randomUUID(), otherFarm = randomUUID();
  await command(alice, 'create_farm', { id: otherFarm, operationId: otherOperation, name: 'Outra operação', city: null, pastureRentCents: 0 });
  await assert.rejects(saveCenter(randomUUID(), 'Centro cruzado', group, false, { operationId: otherOperation }), /desta operação/);
  await assert.rejects(saveCenter(center, 'Mover operação', group, false, { operationId: otherOperation, previous: c }), /outra operação/);
  await assert.rejects(saveCenter(randomUUID(), 'Filho de centro', center), /agrupamento ativo/);
  await assert.rejects(saveCenter(randomUUID(), 'Grupo de grupo', group, true), /Agrupamento inválido/);
  await assert.rejects(saveCenter(randomUUID(), 'Proibido', null, false, {}, employee), /exclusivo dos sócios/);
  await assert.rejects(saveCenter(center, 'Outra operação', null, false, { operationId: randomUUID() }), /Sem acesso/);
  await assert.rejects(saveCenter(center, 'Mudança sem base'), /mudou em outro aparelho/);
  await assert.rejects(saveCenter(center, c.name, null, false, { previous: c }), /agrupamento é fixo/);
  await assert.rejects(saveCenter(randomUUID(), c.name), /unique/i);
  assert.deepEqual((await workspace(employee)).costCenters, []);
  assert.equal((await workspace(alice)).costCenters.length, 2);
  const payload = { ...c, name: 'Roda de água', previous: c };
  const commandId = randomUUID();
  const renamed = await command(alice, 'save_cost_center', payload, commandId);
  assert.deepEqual(await command(alice, 'save_cost_center', payload, commandId), renamed);
  await assert.rejects(command(alice, 'save_cost_center', { ...payload, name: 'Diferente' }, commandId), /reutilizado/);
  assert.equal((await pg.query("select relrowsecurity from pg_class where oid='private.cost_centers'::regclass")).rows[0].relrowsecurity, true);
  await assert.rejects(asUser(alice, 'select * from private.cost_centers'), /permission denied/);
  const inactiveGroup = await command(alice, 'save_cost_center', { ...g, active: false, previous: g });
  await assert.rejects(saveEntry(alice, expense(100, [{ dueDate: '2026-10-30', cents: 100 }], { costCenterId: center })), /inativo/);
  await command(alice, 'save_cost_center', { ...g, previous: inactiveGroup });
});

test('historical classification audits changes without touching entries, payments, approval or version', async () => {
  const e = await saveEntry(alice, expense(10000, [{ dueDate: '2026-10-30', cents: 10000 }]));
  await approve(e);
  await pay([{ entryId: e.id, index: 0, cents: 3000 }]);
  const original = (await pg.query('select * from private.entries where id=$1', [e.id])).rows[0];
  const payments = (await pg.query('select * from private.payments')).rows;
  const payload = { id: e.id, operationId: operation, costCenterId: center, reason: 'Classificar manutenção antiga', previous: null };
  const commandId = randomUUID();
  const classification = await command(alice, 'classify_cost', payload, commandId);
  assert.deepEqual(await command(alice, 'classify_cost', payload, commandId), classification);
  assert.equal(classification.history.length, 1);
  assert.equal(classification.history[0].by, alice);
  assert.equal(classification.history[0].from, null);
  assert.equal(classification.history[0].to, center);
  assert.deepEqual((await pg.query('select * from private.entries where id=$1', [e.id])).rows[0], original);
  assert.deepEqual((await pg.query('select * from private.payments')).rows, payments);
  assert.deepEqual((await workspace(alice)).costClassifications, [classification]);
  assert.deepEqual((await workspace(employee)).costClassifications, []);
  await assert.rejects(command(employee, 'classify_cost', payload), /exclusivo dos sócios/);
  await assert.rejects(command(alice, 'classify_cost', payload), /mudou em outro aparelho/);
  await assert.rejects(command(alice, 'classify_cost', { ...payload, previous: classification, reason: '' }), /motivo/);
  const cleared = await command(alice, 'classify_cost', { ...payload, previous: classification, costCenterId: null });
  assert.equal(cleared.history.length, 2);
  assert.equal(cleared.costCenterId, null);
  const c = (await workspace(alice)).costCenters.find((c) => c.id === center);
  const inactive = await command(alice, 'save_cost_center', { ...c, active: false, previous: c });
  await assert.rejects(command(alice, 'classify_cost', { ...payload, previous: cleared }), /inativo/);
  await assert.rejects(saveEntry(alice, expense(100, [{ dueDate: '2026-10-30', cents: 100 }], { costCenterId: group })), /Escolha um centro/);
  await assert.rejects(saveEntry(alice, expense(100, [{ dueDate: '2026-10-30', cents: 100 }], { costCenterId: randomUUID() })), /desta operação/);
  await command(alice, 'save_cost_center', { ...c, previous: inactive });
});

test('recurrence center survives create, update, workspace reload and expense launch', async () => {
  const id = randomUUID();
  const fields = { farmId: farm, title: 'Diária mensal', categoryId: 'cat-mao-de-obra', counterparty: '', counterpartyId: null,
    cents: 30000, dayOfMonth: 10, startMonth: '2026-10', endMonth: null, active: true, costCenterId: center };
  const r = await command(alice, 'save_recurrence', { id, operationId: operation, ...fields });
  assert.equal(r.costCenterId, center);
  const r2 = await command(alice, 'save_recurrence', { id, operationId: operation, ...fields, title: 'Diária ajustada', previous: fields });
  assert.equal(r2.costCenterId, center);
  assert.equal((await workspace(alice)).recurrences.find((x) => x.id === id).costCenterId, center);
  const e = await saveEntry(alice, expense(30000, [{ dueDate: '2026-10-30', cents: 30000 }], { recurrence: { id, month: '2026-10' }, costCenterId: center }));
  assert.equal(e.payload.costCenterId, center);
});

test('offline chained edits use revisions rather than client/server clock equality', async () => {
  const id = randomUUID();
  const first = await saveCenter(id, 'Primeiro', null, false, { createdAt: '2020-01-01T00:00:00Z' });
  const second = await saveCenter(id, 'Segundo', null, false, { previous: { ...first, createdAt: '2020-01-01T00:00:00Z' } });
  assert.equal(second.version, 2);
  const e = await saveEntry(alice, expense(100, [{ dueDate: '2026-10-30', cents: 100 }]));
  await approve(e);
  const payload = { id: e.id, operationId: operation, costCenterId: id, reason: 'Classificação offline', previous: null };
  const classified = await command(alice, 'classify_cost', payload);
  const localPrevious = { ...classified, history: classified.history.map((h) => ({ ...h, at: '2020-01-01T00:00:00Z' })) };
  const next = await command(alice, 'classify_cost', { ...payload, costCenterId: null, previous: localPrevious });
  assert.equal(next.version, 2);
  assert.equal(next.history[0].at, classified.history[0].at);
});
