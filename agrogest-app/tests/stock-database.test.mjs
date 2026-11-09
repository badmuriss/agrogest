import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL (PGlite) with an Auth fixture. Proves the stock rules on the server: supply
// registry, stock purchases (payables without lot cost), consumption against the balance with
// reservations, adjustments approved by partners, transfers, and the employee projection.
let pg;
const alice = randomUUID(), bob = randomUUID(), employee = randomUUID();
const operation = randomUUID(), farm = randomUUID(), farm2 = randomUUID(), lot1 = randomUUID(), lot2 = randomUUID(), salt = randomUUID();
const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

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
  await command(alice, 'create_farm', { id: farm, operationId: operation, name: 'Boa Vista', city: null, pastureRentCents: 0 });
  // A second farm of the same operation (the app does not create one yet; the model supports it).
  await pg.query("insert into private.farms(id, operation_id, name) values($1, $2, 'Santa Fé')", [farm2, operation]);
  for (const [user, role] of [[bob, 'socio'], [employee, 'funcionario']]) {
    const id = randomUUID();
    await command(alice, 'invite', { id, operationId: operation, name: 'Convidado', contact: `${user}@example.invalid`, role, sharePct: null });
    await command(user, 'accept_invite', { id });
  }
  for (const [id, code, heads] of [[lot1, 'S01', 60], [lot2, 'S02', 40]]) {
    await command(alice, 'create_lot', { id, operationId: operation, farmId: farm, code, managementGroup: 'Pasto', supplier: '', category: 'Novilhas',
      purchasedAt: '2026-09-01', headsPurchased: heads, entryWeightKg: 250, purchaseCents: 100, commissionCents: 0, freightCents: 0 });
  }
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
const saveEntry = (user, entry, farmId = farm, id = randomUUID()) => command(user, 'save_entry', { id, operationId: operation, farmId, submit: true,
  expectedVersion: null, entry: { occurredAt: today, title: 'Lançamento', amountCents: null, ...entry } });
const decide = (user, entry, decision = 'aprovar') =>
  command(user, 'decide_entry', { id: entry.id, operationId: operation, decision, note: '', expectedVersion: entry.version });
const supply = { id: salt, operationId: operation, name: 'Sal mineral', kind: 'sal_mineral', unit: 'saco', conversions: [{ unit: 't', factor: 40 }], minQuantity: 50, active: true };
const purchase = (quantity, cents, extra = {}, items) => ({ kind: 'despesa', amountCents: cents, title: 'Caminhão de sal', payload: {
  category: 'Compra de insumos para estoque', description: 'Sal', supplier: 'Casa do Campo', document: 'NF 123', destination: 'estoque',
  installments: [{ dueDate: '2026-11-13', cents: cents - 2 * Math.floor(cents / 3) }, { dueDate: '2026-12-13', cents: Math.floor(cents / 3) }, { dueDate: '2027-01-13', cents: Math.floor(cents / 3) }],
  criterion: 'cabeca', allocations: [], stockItems: items ?? [{ supplyId: salt, quantity, cents, purchaseQuantity: quantity / 40, purchaseUnit: 't' }], ...extra } });
const consumption = (quantity, extra = {}, payload = {}) => ({ kind: 'consumo', title: 'Consumo de sal', ...extra, payload: { supplyId: salt, quantity,
  periodStart: null, criterion: 'cabeca', targets: [{ lotId: lot1, basis: 60 }, { lotId: lot2, basis: 40 }], notes: '', ...payload } });

test('stock: supplies, purchases, consumption with reservations, adjustments, transfers and the employee projection', async (t) => {
  await t.test('only partners register supplies; everyone sees them; the unit is fixed after use', async () => {
    await assert.rejects(command(employee, 'create_supply', supply), /Somente um sócio/);
    await assert.rejects(command(alice, 'create_supply', { ...supply, conversions: [{ unit: 'saco', factor: 2 }] }), /outra unidade/);
    const created = await command(alice, 'create_supply', supply);
    assert.deepEqual([created.unit, created.minQuantity, created.conversions], ['saco', 50, [{ unit: 't', factor: 40 }]]);
    assert.equal((await workspace(employee)).supplies[0].name, 'Sal mineral');
    await assert.rejects(command(alice, 'create_supply', { ...supply, id: randomUUID(), name: 'sal  MINERAL' }), /Já existe/);
  });

  let truck;
  await t.test('a stock purchase closes the items, has no lot allocation, and becomes payables without lot cost', async () => {
    await assert.rejects(saveEntry(alice, purchase(480, 1_200_000, {}, [{ supplyId: salt, quantity: 480, cents: 1_000_000, purchaseQuantity: 12, purchaseUnit: 't' }])), /somar o valor/);
    await assert.rejects(saveEntry(alice, purchase(480, 1_200_000, { allocations: [{ lotId: lot1, cents: 1_200_000, basis: 60 }] })), /não é rateada/);
    await assert.rejects(saveEntry(alice, purchase(480.0001, 1_200_000)), /até 3 casas/);
    await assert.rejects(saveEntry(alice, purchase(480, 1_200_000, { destination: 'outro' })), /Destino/);
    truck = await saveEntry(alice, purchase(480, 1_200_000));
    assert.equal(truck.status, 'aguardando_aprovacao');
  });

  await t.test('consumption needs approved stock: a pending purchase does not count', async () => {
    const early = await saveEntry(employee, consumption(5));
    assert.equal(early.status, 'conflito');
    assert.match(early.conflictReason, /o estoque de Sal mineral em Boa Vista tinha 0 sacos; o lançamento pede 5 sacos/);
    truck = await decide(bob, truck);
    assert.equal(truck.status, 'aprovado');
    const views = [0, 1, 2].map((i) => pg.query("select private.installment_cents('despesa', data, $2) as c from private.entries where id = $1", [truck.id, i]));
    assert.deepEqual((await Promise.all(views)).map((r) => Number(r.rows[0].c)), [400_000, 400_000, 400_000]);
  });

  await t.test('5 bags a week: recorded by the employee, approved by anyone else; the balance follows', async () => {
    let week = await saveEntry(employee, consumption(5));
    assert.equal(week.status, 'aguardando_aprovacao');
    week = await decide(alice, week);
    assert.equal(week.status, 'aprovado');
    const replay = (await pg.query('select private.stock_replay($1, $2, null, null, false) as r', [operation, salt])).rows[0].r;
    assert.deepEqual(replay.farms[farm], { qty: 475, value: 1_187_500 });
  });

  await t.test('two devices: pending consumptions reserve the stock; the second beyond the balance conflicts', async () => {
    const first = await saveEntry(employee, consumption(300));
    const second = await saveEntry(bob, consumption(300));
    assert.equal(first.status, 'aguardando_aprovacao');
    assert.equal(second.status, 'conflito');
    assert.match(second.conflictReason, /tinha 175 sacos; o lançamento pede 300 sacos/);
    // Approving the first still fits; a retroactive one would contradict it.
    assert.equal((await decide(alice, first)).status, 'aprovado');
  });

  await t.test('consumption rules: no amount, no future date, lots of the farm, period and manual percentages', async () => {
    await assert.rejects(saveEntry(employee, consumption(1, { amountCents: 100 })), /custo médio/);
    await assert.rejects(saveEntry(employee, consumption(1, { occurredAt: '2999-01-01' })), /futura/);
    await assert.rejects(saveEntry(employee, consumption(1, {}, { targets: [{ lotId: randomUUID(), basis: 1 }] })), /fora da fazenda/);
    await assert.rejects(saveEntry(employee, consumption(1, {}, { criterion: 'manual', targets: [{ lotId: lot1, basis: 70 }, { lotId: lot2, basis: 20 }] })), /somar 100%/);
    await assert.rejects(saveEntry(employee, consumption(1, {}, { periodStart: '2026-01-01' })), /período/);
    await assert.rejects(saveEntry(employee, consumption(1, {}, { supplyId: randomUUID() })), /Insumo fora/);
  });

  await t.test('stock adjustments: approved only by another partner; a loss leaves the stock', async () => {
    const loss = await saveEntry(bob, { kind: 'ajuste_estoque', title: 'Ajuste', payload: { supplyId: salt, delta: -5, reason: 'Sacos molhados' } });
    assert.equal(loss.status, 'aguardando_aprovacao');
    await assert.rejects(decide(employee, loss), /outra pessoa habilitada/);
    assert.equal((await decide(alice, loss)).status, 'aprovado');
    await assert.rejects(saveEntry(bob, { kind: 'ajuste_estoque', title: 'Ajuste', payload: { supplyId: salt, delta: 0, reason: 'x' } }), /diferença/);
    await assert.rejects(saveEntry(bob, { kind: 'ajuste_estoque', title: 'Ajuste', payload: { supplyId: salt, delta: 1, reason: ' ' } }), /motivo/);
    const tooMuch = await saveEntry(bob, { kind: 'ajuste_estoque', title: 'Ajuste', payload: { supplyId: salt, delta: -1000, reason: 'Contagem' } });
    assert.equal(tooMuch.status, 'conflito');
  });

  await t.test('transfer to another farm of the operation, at the average cost, arriving only when approved', async () => {
    await assert.rejects(saveEntry(alice, { kind: 'transferencia_estoque', title: 'Transferência', payload: { supplyId: salt, quantity: 10, toFarmId: farm, notes: '' } }), /outra fazenda/);
    let move = await saveEntry(alice, { kind: 'transferencia_estoque', title: 'Transferência', payload: { supplyId: salt, quantity: 10, toFarmId: farm2, notes: '' } });
    const early = await saveEntry(alice, consumption(1, {}, { targets: [] }), farm2).catch((error) => error);
    assert.match(String(early.message ?? early.conflictReason), /lotes que consumiram/);
    move = await decide(bob, move);
    const farms = (await pg.query('select private.stock_replay($1, $2, null, null, false) as r', [operation, salt])).rows[0].r.farms;
    assert.equal(farms[farm2].qty, 10);
    assert.equal(farms[farm2].value, 25_000);
    assert.equal(farms[farm].qty, 160);
  });

  await t.test('employees receive the stock movements and masked purchases, never values', async () => {
    const view = await workspace(employee);
    const masked = view.entries.find((e) => e.id === truck.id);
    assert.equal(masked.amountCents, 0);
    assert.equal(masked.payload.supplier, '');
    assert.deepEqual(masked.payload.installments, []);
    assert.deepEqual(masked.payload.stockItems, [{ supplyId: salt, quantity: 480, cents: 0, purchaseQuantity: 12, purchaseUnit: 't' }]);
    assert.ok(view.entries.some((e) => e.kind === 'ajuste_estoque') && view.entries.some((e) => e.kind === 'transferencia_estoque'));
    assert.equal(new Set(view.entries.map((e) => e.id)).size, view.entries.length);
    const activity = view.activity.filter((a) => a.subject.entryKind === 'consumo');
    assert.ok(activity.length > 0);
    assert.ok(activity.every((a) => a.subject.supplyName === 'Sal mineral' && typeof a.subject.quantity === 'number'));
    assert.equal(view.activity.some((a) => a.subject.entryKind === 'despesa'), false);
    assert.ok(view.activity.some((a) => a.kind === 'create_supply'));
    assert.equal(JSON.stringify(view.activity).includes('Cents'), false);
  });

  await t.test('supply edits need the previous state and keep the unit once used', async () => {
    const previous = { name: 'Sal mineral', kind: 'sal_mineral', unit: 'saco', conversions: [{ unit: 't', factor: 40 }], minQuantity: 50, active: true };
    await assert.rejects(command(alice, 'update_supply', { ...supply, unit: 'kg', previous }), /unidade de controle não pode mudar/);
    await assert.rejects(command(alice, 'update_supply', { ...supply, minQuantity: 80, previous: { ...previous, minQuantity: 10 } }), /mudou em outro aparelho/);
    assert.equal((await command(alice, 'update_supply', { ...supply, minQuantity: 80, previous })).minQuantity, 80);
  });
});

test('the app replay (stockLedger) gives the same balances and values as the server for the same entries', async () => {
  const { stockLedger } = await import('../apps/mobile/src/domain/stock.ts');
  const entries = (await workspace(alice)).entries;
  const server = (await pg.query('select private.stock_replay($1, $2, null, null, false) as r', [operation, salt])).rows[0].r.farms;
  const app = Object.fromEntries(stockLedger(entries, salt, 'confirmado').farms);
  assert.deepEqual(app, server);
  // The employee's masked view keeps the quantities exactly (values are zero by design).
  const masked = stockLedger((await workspace(employee)).entries, salt, 'confirmado').farms;
  assert.deepEqual(Object.fromEntries([...masked].map(([id, s]) => [id, s.qty])), Object.fromEntries(Object.entries(server).map(([id, s]) => [id, s.qty])));
});
