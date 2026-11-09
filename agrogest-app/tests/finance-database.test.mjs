import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { DEFAULT_CATEGORIES } from '../apps/mobile/src/domain/finance.ts';

// Real PostgreSQL (PGlite) with an Auth fixture, like database.test.mjs. Proves the SQL rules of
// the finance base: partner-only access, payments against approved installments, conflicts,
// reversals, idempotency and the projection employees receive.
let pg;
const alice = randomUUID(), bob = randomUUID(), employee = randomUUID();
const operation = randomUUID(), farm = randomUUID(), lot = randomUUID(), account = randomUUID();

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
  await command(alice, 'create_farm', { id: farm, operationId: operation, name: 'Fazenda financeiro', city: null, pastureRentCents: 0 });
  for (const [user, role] of [[bob, 'socio'], [employee, 'funcionario']]) {
    const id = randomUUID();
    await command(alice, 'invite', { id, operationId: operation, name: 'Convidado', contact: `${user}@example.invalid`, role, sharePct: null });
    await command(user, 'accept_invite', { id });
  }
  await command(alice, 'create_lot', { id: lot, operationId: operation, farmId: farm, code: 'F01', managementGroup: 'Pasto', supplier: '', category: 'Novilhas',
    purchasedAt: '2026-09-01', headsPurchased: 50, entryWeightKg: 250, purchaseCents: 100, commissionCents: 0, freightCents: 0 });
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
const expense = (cents, installments, payload = {}) => ({ kind: 'despesa', amountCents: cents, title: 'Caminhão de sal',
  payload: { category: 'Alimentação e insumos', description: 'Sal', supplier: 'Casa do Campo', document: '', installments, criterion: 'cabeca', allocations: [], ...payload } });
const approve = (entry) => command(bob, 'decide_entry', { id: entry.id, operationId: operation, decision: 'aprovar', note: '', expectedVersion: entry.version });
const pay = (items, extra = {}, user = alice, id) => command(user, 'register_payment', {
  id: randomUUID(), operationId: operation, direction: 'pagar', accountId: account, paidAt: '2026-10-15', items,
  interestCents: 0, fineCents: 0, discountCents: 0, method: 'pix', proof: 'E2E123', notes: '', ...extra,
}, id);
const accountPayload = { id: account, operationId: operation, name: 'Banco do Brasil', kind: 'corrente', bank: 'BB', agency: '1234', number: '5678-9',
  openingBalanceCents: -20_000, openingDate: '2026-10-01', active: true };

test('the plan of accounts is the same in the app and in the database', async () => {
  const rows = (await pg.query('select private.default_categories() as list')).rows[0].list;
  assert.deepEqual(rows, DEFAULT_CATEGORIES.map(({ id, name, nature }) => ({ id, name, nature })));
});

test('finance base: registry, payments, conflicts, reversals and the employee projection', async (t) => {
  await t.test('only partners register accounts, categories and contacts; employees receive none of it', async () => {
    await assert.rejects(command(employee, 'create_account', accountPayload), /exclusivo dos sócios/);
    const created = await command(alice, 'create_account', accountPayload);
    assert.equal(created.openingBalanceCents, -20_000);
    assert.equal(created.openingDate, '2026-10-01');
    await assert.rejects(command(alice, 'create_account', { ...accountPayload, id: randomUUID(), name: ' banco do brasil ' }), /Já existe uma conta/);
    await assert.rejects(command(alice, 'create_category', { id: randomUUID(), operationId: operation, name: 'frete', nature: 'custo_producao' }), /Já existe/);
    await assert.rejects(command(alice, 'create_category', { id: randomUUID(), operationId: operation, name: 'Arrendamento', nature: 'lucro' }), /Natureza/);
    await command(alice, 'create_category', { id: randomUUID(), operationId: operation, name: 'Arrendamento', nature: 'custo_producao' });
    await command(alice, 'save_counterparty', { id: randomUUID(), operationId: operation, name: 'Casa do Campo', kind: 'fornecedor', document: '12.345.678/0001-90',
      contact: '', pixKey: 'pix@casa.example', notes: '', active: true });
    const mine = await workspace(alice);
    assert.equal(mine.financialAccounts.length, 1);
    assert.equal(mine.counterparties[0].pixKey, 'pix@casa.example');
    const theirs = await workspace(employee);
    assert.deepEqual([theirs.financialAccounts, theirs.counterparties, theirs.payments], [[], [], []]);
    assert.equal(theirs.categories[0].name, 'Arrendamento');
  });

  let truck;
  await t.test('expenses accept the plan and the registered supplier; unknown references are refused', async () => {
    const supplier = (await workspace(alice)).counterparties[0].id;
    await assert.rejects(saveEntry(alice, expense(100, [{ dueDate: '2026-11-01', cents: 100 }], { categoryId: 'cat-inexistente' })), /plano de contas/);
    await assert.rejects(saveEntry(alice, expense(100, [{ dueDate: '2026-11-01', cents: 100 }], { counterpartyId: randomUUID() })), /Fornecedor/);
    truck = await saveEntry(alice, expense(1_200_000, [
      { dueDate: '2026-11-13', cents: 400_000 }, { dueDate: '2026-12-13', cents: 400_000 }, { dueDate: '2027-01-13', cents: 400_000 },
    ], { categoryId: 'cat-alimentacao', counterpartyId: supplier }));
    assert.equal(truck.status, 'aguardando_aprovacao');
  });

  await t.test('a payment against an obligation still waiting for approval is a conflict, not an error', async () => {
    const result = await pay([{ entryId: truck.id, index: 0, cents: 400_000 }]);
    assert.equal(result.status, 'conflito');
    assert.match(result.conflictReason, /ainda não foi aprovada/);
  });

  let partial;
  await t.test('after approval: partial payment, replay of the same command and the rest still open', async () => {
    truck = await approve(truck);
    assert.equal(truck.status, 'aprovado');
    const id = randomUUID();
    const payload = { id: randomUUID(), operationId: operation, direction: 'pagar', accountId: account, paidAt: '2026-10-15',
      items: [{ entryId: truck.id, index: 0, cents: 150_000 }], interestCents: 0, fineCents: 0, discountCents: 0, method: 'pix', proof: '', notes: '' };
    partial = await command(alice, 'register_payment', payload, id);
    assert.equal(partial.status, 'efetivado');
    assert.deepEqual(await command(alice, 'register_payment', payload, id), partial);
    assert.equal((await pg.query('select count(*)::int as n from private.payments where id = $1', [partial.id])).rows[0].n, 1);
    const over = await pay([{ entryId: truck.id, index: 0, cents: 250_001 }]);
    assert.equal(over.status, 'conflito');
    assert.match(over.conflictReason, /tem R\$ 2\.500,00 em aberto; a baixa pede R\$ 2\.500,01/);
  });

  await t.test('two devices settling the same installment: the second one beyond the open amount conflicts', async () => {
    const results = await Promise.all([
      pay([{ entryId: truck.id, index: 0, cents: 200_000 }]),
      pay([{ entryId: truck.id, index: 0, cents: 200_000 }], {}, bob),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), ['conflito', 'efetivado']);
    const settled = (await pg.query("select private.settled_cents($1, $2, 0) as n", [operation, truck.id])).rows[0].n;
    assert.equal(Number(settled), 350_000);
  });

  await t.test('one payment settles several installments, with interest, fine and discount moving only cash', async () => {
    const result = await pay([{ entryId: truck.id, index: 0, cents: 50_000 }, { entryId: truck.id, index: 1, cents: 400_000 }],
      { interestCents: 1_000, fineCents: 500, discountCents: 2_000 });
    assert.equal(result.status, 'efetivado');
    assert.equal(result.items.length, 2);
    const paidTwice = await pay([{ entryId: truck.id, index: 1, cents: 1 }]);
    assert.match(paidTwice.conflictReason, /já foi quitada/);
  });

  await t.test('reversal reopens the installment; a conflict is dismissed; nothing is deleted', async () => {
    await assert.rejects(command(alice, 'reverse_payment', { id: partial.id, operationId: operation, reason: '  ' }), /motivo/);
    const reversed = await command(alice, 'reverse_payment', { id: partial.id, operationId: operation, reason: 'Pix devolvido' });
    assert.deepEqual([reversed.status, reversed.reverseReason, reversed.reversedBy], ['estornado', 'Pix devolvido', alice]);
    await assert.rejects(command(alice, 'reverse_payment', { id: partial.id, operationId: operation, reason: 'de novo' }), /não pode mais/);
    assert.equal(Number((await pg.query("select private.settled_cents($1, $2, 0) as n", [operation, truck.id])).rows[0].n), 250_000);
    const conflict = (await workspace(alice)).payments.find((p) => p.status === 'conflito');
    assert.equal((await command(alice, 'reverse_payment', { id: conflict.id, operationId: operation, reason: '' })).status, 'descartado');
    await assert.rejects(command(employee, 'reverse_payment', { id: conflict.id, operationId: operation, reason: '' }), /exclusivo/);
    assert.ok((await pg.query('select count(*)::int as n from private.payments')).rows[0].n >= 6);
  });

  await t.test('sales are received in installments that close the net amount; direction must match', async () => {
    const sale = (installments) => ({ kind: 'venda', amountCents: 600_000, title: 'Venda', payload: { lotId: lot, buyer: 'Frigorífico', heads: 2,
      carcassKg: 300, pricePerArrobaCents: 30_000, deductionsCents: 10_000, ...(installments ? { installments } : {}) } });
    await assert.rejects(saveEntry(alice, sale([{ dueDate: '2026-11-12', cents: 600_000 }])), /valor líquido/);
    let entry = await saveEntry(alice, sale([{ dueDate: '2026-11-12', cents: 295_000 }, { dueDate: '2026-12-12', cents: 295_000 }]));
    entry = await approve(entry);
    assert.match((await pay([{ entryId: entry.id, index: 0, cents: 295_000 }])).conflictReason, /não encontrada/);
    assert.equal((await pay([{ entryId: entry.id, index: 0, cents: 295_000 }], { direction: 'receber' })).status, 'efetivado');
    // The employee's masked sale carries neither installments nor values.
    const masked = (await workspace(employee)).entries.find((e) => e.id === entry.id);
    assert.equal(masked.payload.installments, undefined);
    assert.equal(masked.amountCents, 0);
    // Old sales without installments are received in one go on the sale date.
    const old = await approve(await saveEntry(alice, sale(null)));
    assert.equal((await pay([{ entryId: old.id, index: 0, cents: 590_000 }], { direction: 'receber' })).status, 'efetivado');
  });

  await t.test('an expense saved before the finance base (no category, no contact) is an open payable', async () => {
    const legacy = await approve(await saveEntry(alice, expense(30_000, [{ dueDate: '2026-09-30', cents: 30_000 }])));
    assert.equal((await pay([{ entryId: legacy.id, index: 0, cents: 30_000 }])).status, 'efetivado');
  });

  await t.test('account rules: edits need the previous state, the opening stays before payments, inactive or older dates conflict', async () => {
    const previous = { name: accountPayload.name, kind: 'corrente', bank: 'BB', agency: '1234', number: '5678-9', openingBalanceCents: -20_000, openingDate: '2026-10-01', active: true };
    await assert.rejects(command(alice, 'update_account', { ...accountPayload, name: 'BB', previous: { ...previous, name: 'Outro' } }), /mudou em outro aparelho/);
    await assert.rejects(command(alice, 'update_account', { ...accountPayload, openingDate: '2026-10-16', previous }), /antes desta data/);
    const legacy = await approve(await saveEntry(alice, expense(5_000, [{ dueDate: '2026-11-01', cents: 5_000 }])));
    assert.match((await pay([{ entryId: legacy.id, index: 0, cents: 5_000 }], { paidAt: '2026-09-15' })).conflictReason, /começa em 01\/10\/2026/);
    await command(alice, 'update_account', { ...accountPayload, active: false, previous });
    assert.match((await pay([{ entryId: legacy.id, index: 0, cents: 5_000 }])).conflictReason, /inativada/);
    await assert.rejects(pay([{ entryId: legacy.id, index: 0, cents: 5_000 }], { paidAt: '2999-01-01' }), /futura/);
  });

  await t.test('activity shows payments without amounts, only to partners', async () => {
    const items = (await workspace(alice)).activity.filter((a) => a.kind === 'register_payment');
    assert.ok(items.length > 0);
    assert.ok(items.every((a) => typeof a.subject.count === 'number' && !JSON.stringify(a.subject).includes('Cents')));
    assert.equal((await workspace(employee)).activity.some((a) => ['register_payment', 'create_account', 'save_counterparty'].includes(a.kind)), false);
  });
});

test('lot purchase: the informed payment plan becomes payables; values are locked once paid', async (t) => {
  const lotId = randomUUID();
  const lotPayload = { id: lotId, operationId: operation, farmId: farm, code: 'C24', managementGroup: 'Pasto', supplier: 'Fazenda Boa Esperança', category: 'Novilhas',
    purchasedAt: '2026-10-01', headsPurchased: 10, entryWeightKg: 250, purchaseCents: 2_000_000, commissionCents: 50_000, freightCents: 0 };
  const plan = { parts: [
    { kind: 'animais', counterparty: 'Fazenda Boa Esperança', counterpartyId: null, installments: [{ dueDate: '2026-10-01', cents: 1_000_000 }, { dueDate: '2026-11-01', cents: 1_000_000 }] },
    { kind: 'comissao', counterparty: 'Corretor', counterpartyId: null, installments: [{ dueDate: '2026-10-01', cents: 50_000 }] },
  ] };
  const setPlan = (user, next, previous = null) => command(user, 'set_lot_payment_plan', { id: lotId, operationId: operation, plan: next, previous });
  const payLot = (index, cents) => command(alice, 'register_payment', { id: randomUUID(), operationId: operation, direction: 'pagar', accountId: account,
    paidAt: '2026-10-15', items: [{ entryId: lotId, index, cents }], interestCents: 0, fineCents: 0, discountCents: 0, method: 'pix', proof: '', notes: '' });

  await t.test('the plan is set apart from the lot, by a partner, and must close each part', async () => {
    // The account rules test left the account inactive.
    const current = (await workspace(alice)).financialAccounts.find((a) => a.id === account);
    const { id: _id, operationId: _op, createdAt: _at, ...previous } = current;
    await command(alice, 'update_account', { ...previous, id: account, operationId: operation, active: true, previous });
    await assert.rejects(command(alice, 'create_lot', { ...lotPayload, id: randomUUID(), code: 'X1', purchasePlan: plan }), /depois de cadastrar/);
    await command(alice, 'create_lot', lotPayload);
    // An old lot (no plan) is not a payable: paying it finds nothing.
    assert.match((await payLot(0, 1)).conflictReason, /não encontrada/);
    await assert.rejects(setPlan(employee, plan), /exclusivo dos sócios/);
    await assert.rejects(setPlan(alice, { parts: plan.parts.slice(0, 1) }), /todas as partes/);
    await assert.rejects(setPlan(alice, { parts: [plan.parts[0], { ...plan.parts[1], installments: [{ dueDate: '2026-10-01', cents: 49_999 }] }] }), /fechar o valor/);
    const saved = await setPlan(alice, plan);
    assert.deepEqual(saved.purchasePlan, plan);
    await assert.rejects(setPlan(alice, plan, null), /mudou em outro aparelho/);
    assert.equal((await workspace(employee)).lots.find((l) => l.id === lotId).purchasePlan, undefined);
    assert.deepEqual((await workspace(alice)).lots.find((l) => l.id === lotId).purchasePlan, plan);
  });

  let paid;
  await t.test('installments are paid like any payable, in the fixed order animals, commission, freight', async () => {
    paid = await payLot(0, 1_000_000);
    assert.equal(paid.status, 'efetivado');
    assert.equal((await payLot(2, 50_000)).status, 'efetivado');
    assert.match((await payLot(1, 1_000_001)).conflictReason, /compra da Origem C24 tem R\$ 10\.000,00 em aberto/);
    assert.match((await payLot(0, 1)).conflictReason, /já foi quitada/);
    await assert.rejects(setPlan(alice, null, plan), /já tem pagamentos/);
  });

  await t.test('purchase values are locked while paid; after reversals, a change drops the plan', async () => {
    const lot = (await workspace(alice)).lots.find((l) => l.id === lotId);
    const previous = { ...lot };
    await assert.rejects(command(alice, 'update_lot', { ...lot, purchaseCents: 2_100_000, previous }), /já tem pagamentos/);
    for (const x of (await workspace(alice)).payments.filter((p) => p.status === 'efetivado' && p.items[0].entryId === lotId)) {
      await command(alice, 'reverse_payment', { id: x.id, operationId: operation, reason: 'Valor errado' });
    }
    const updated = await command(alice, 'update_lot', { ...lot, purchaseCents: 2_100_000, previous });
    assert.equal(updated.purchasePlan, undefined);
    assert.equal(updated.purchaseCents, 2_100_000);
    // Editing other fields keeps the plan.
    const withPlan = await setPlan(alice, { parts: [{ ...plan.parts[0], installments: [{ dueDate: '2026-10-01', cents: 2_100_000 }] }, plan.parts[1]] });
    const renamed = await command(alice, 'update_lot', { ...withPlan, code: 'C24B', previous: { ...withPlan } });
    assert.equal(renamed.purchasePlan.parts.length, 2);
  });

  await t.test('activity shows the plan to partners only, without values', async () => {
    const item = (await workspace(alice)).activity.find((a) => a.kind === 'set_lot_payment_plan');
    assert.equal(item.subject.code, 'C24B');
    assert.equal(item.farmId, farm);
    assert.equal((await workspace(employee)).activity.some((a) => a.kind === 'set_lot_payment_plan'), false);
  });
});
