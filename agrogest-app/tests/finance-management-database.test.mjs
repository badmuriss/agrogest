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
const settled = async (entryId, index = 0) => Number((await pg.query('select private.settled_cents($1, $2, $3) as n', [operation, entryId, index])).rows[0].n);

test('card accounts need the closing and due days; employees never receive the new finance data', async () => {
  await assert.rejects(command(alice, 'create_account', { id: randomUUID(), operationId: operation, name: 'Outro cartão', kind: 'cartao', bank: '', agency: '', number: '',
    openingBalanceCents: 0, openingDate: '2026-09-01', active: true }), /fechamento e de vencimento/);
  const mine = await workspace(alice);
  assert.deepEqual(mine.financialAccounts.find((a) => a.id === card).closingDay, 5);
  assert.equal(mine.financialAccounts.find((a) => a.id === bank).closingDay, null);
  const theirs = await workspace(employee);
  for (const key of ['movements', 'financings', 'renegotiations', 'recurrences', 'budgets', 'titles', 'financialAccounts']) assert.deepEqual(theirs[key], [], key);
  await assert.rejects(move('transferencia', { fromAccountId: bank, toAccountId: cash }, employee), /exclusivo dos sócios/);
});

test('movements: transfers, partner contributions and withdrawals change balances, not results; conflicts never block the queue', async (t) => {
  await t.test('a transfer needs two different accounts of the operation; it is idempotent', async () => {
    await assert.rejects(move('transferencia', { fromAccountId: bank, toAccountId: bank }), /contas diferentes/);
    await assert.rejects(move('transferencia', { fromAccountId: bank }), /inválida/);
    const id = randomUUID();
    const payload = { id: randomUUID(), operationId: operation, kind: 'transferencia', fromAccountId: bank, toAccountId: cash, partnerId: null, financingId: null,
      counterparty: '', counterpartyId: null, invoiceMonth: null, cents: 50_000, occurredAt: '2026-10-10', method: 'transferencia', proof: '', notes: '' };
    const first = await command(alice, 'register_movement', payload, id);
    assert.equal(first.status, 'efetivado');
    assert.deepEqual(await command(alice, 'register_movement', payload, id), first);
    assert.equal((await pg.query('select count(*)::int as n from private.movements where id = $1', [first.id])).rows[0].n, 1);
  });

  await t.test('contributions and withdrawals belong to a partner of the operation', async () => {
    await assert.rejects(move('aporte', { toAccountId: bank }), /inválida/);
    assert.equal((await move('aporte', { toAccountId: bank, partnerId: bob, cents: 200_000 })).status, 'efetivado');
    const notPartner = await move('retirada', { fromAccountId: bank, partnerId: employee });
    assert.equal(notPartner.status, 'conflito');
    assert.match(notPartner.conflictReason, /não é sócio/);
    assert.equal((await move('distribuicao', { fromAccountId: bank, partnerId: alice, cents: 30_000 })).status, 'efetivado');
    await assert.rejects(move('aporte', { toAccountId: card, partnerId: bob }), /não seja cartão/);
  });

  await t.test('an inactive account or a date before its opening is a conflict', async () => {
    assert.match((await move('transferencia', { fromAccountId: bank, toAccountId: cash, occurredAt: '2026-08-01' })).conflictReason, /começa em 01\/09\/2026/);
    await assert.rejects(move('transferencia', { fromAccountId: bank, toAccountId: cash, occurredAt: '2999-01-01' }), /futura/);
  });

  await t.test('paying the card invoice is a transfer to the card with the invoice month', async () => {
    await assert.rejects(move('transferencia', { fromAccountId: bank, toAccountId: cash, invoiceMonth: '2026-10' }), /Fatura inválida/);
    assert.equal((await move('transferencia', { fromAccountId: bank, toAccountId: card, invoiceMonth: '2026-10' })).invoiceMonth, '2026-10');
  });

  await t.test('reversal requires a reason and keeps the row', async () => {
    const m = await move('transferencia', { fromAccountId: bank, toAccountId: cash, cents: 1 });
    await assert.rejects(command(alice, 'reverse_movement', { id: m.id, operationId: operation, reason: '' }), /motivo/);
    const reversed = await command(alice, 'reverse_movement', { id: m.id, operationId: operation, reason: 'Duplicada' });
    assert.deepEqual([reversed.status, reversed.reverseReason], ['estornado', 'Duplicada']);
    await assert.rejects(command(alice, 'reverse_movement', { id: m.id, operationId: operation, reason: 'de novo' }), /não pode mais/);
  });
});

test('an expense paid by a partner with own money becomes a reimbursement payable to them', async () => {
  const entry = await approve(await saveEntry(alice, expense(80_000, [{ dueDate: '2026-10-20', cents: 80_000 }])));
  await assert.rejects(pay([{ entryId: entry.id, index: 0, cents: 80_000 }], { accountId: bank, partnerId: bob, partnerMode: 'reembolso' }), /Escolha a conta/);
  await assert.rejects(pay([{ entryId: entry.id, index: 0, cents: 80_000 }], { accountId: null, partnerId: bob }), /reembolso ou aporte/);
  const own = await pay([{ entryId: entry.id, index: 0, cents: 80_000 }], { accountId: null, partnerId: bob, partnerMode: 'reembolso' });
  assert.deepEqual([own.status, own.accountId, own.partnerId, own.partnerMode], ['efetivado', null, bob, 'reembolso']);
  assert.equal(await settled(entry.id), 80_000);
  // The reimbursement is a payable (payment id, index 0) for the payment total.
  assert.match((await pay([{ entryId: own.id, index: 0, cents: 80_001 }])).conflictReason, /reembolso a Bob tem R\$ 800,00 em aberto/);
  const refund = await pay([{ entryId: own.id, index: 0, cents: 80_000 }]);
  assert.equal(refund.status, 'efetivado');
  await assert.rejects(command(alice, 'reverse_payment', { id: own.id, operationId: operation, reason: 'Errado' }), /reembolso desta baixa já foi pago/);
  await command(alice, 'reverse_payment', { id: refund.id, operationId: operation, reason: 'Errado' });
  await command(alice, 'reverse_payment', { id: own.id, operationId: operation, reason: 'Errado' });
  assert.match((await pay([{ entryId: own.id, index: 0, cents: 1 }])).conflictReason, /estornada/);
  // As a contribution, nothing is owed back.
  const asContribution = await pay([{ entryId: entry.id, index: 0, cents: 80_000 }], { accountId: null, partnerId: alice, partnerMode: 'aporte' });
  assert.equal(asContribution.status, 'efetivado');
  assert.match((await pay([{ entryId: asContribution.id, index: 0, cents: 1 }])).conflictReason, /não pertence/);
  // Only payments can come from a partner's pocket.
  await assert.rejects(pay([{ entryId: entry.id, index: 0, cents: 1 }], { direction: 'receber', accountId: null, partnerId: bob, partnerMode: 'aporte' }), /Só pagamentos/);
});

test('a client advance is cash in, then compensated on the sale receivable without moving cash again', async () => {
  await assert.rejects(move('adiantamento', { toAccountId: bank, counterparty: '' }), /quem adiantou/);
  const advance = await move('adiantamento', { toAccountId: bank, counterparty: 'Frigorífico Boi Bom', cents: 300_000 });
  assert.equal(advance.status, 'efetivado');
  const sale = await approve(await saveEntry(alice, { kind: 'venda', amountCents: 600_000, title: 'Venda', payload: { lotId: lot, buyer: 'Frigorífico Boi Bom', heads: 2,
    carcassKg: 300, pricePerArrobaCents: 30_000, deductionsCents: 0, installments: [{ dueDate: '2026-11-12', cents: 600_000 }] } }));
  const receive = (cents, extra = {}) => pay([{ entryId: sale.id, index: 0, cents }], { direction: 'receber', accountId: null, advanceId: advance.id, ...extra });
  await assert.rejects(pay([{ entryId: sale.id, index: 0, cents: 1 }], { accountId: null, advanceId: advance.id }), /só compensa recebimentos/);
  assert.match((await receive(300_001)).conflictReason, /adiantamento tem R\$ 3\.000,00 para compensar/);
  assert.equal((await receive(200_000)).status, 'efetivado');
  assert.match((await receive(100_001)).conflictReason, /R\$ 1\.000,00 para compensar/);
  await assert.rejects(command(alice, 'reverse_movement', { id: advance.id, operationId: operation, reason: 'x' }), /já foi compensado/);
  assert.equal(await settled(sale.id), 200_000);
});

test('financings: the release is cash in without result; installments are payables (principal + interest)', async (t) => {
  const financing = randomUUID();
  const contract = { id: financing, operationId: operation, farmId: farm, bank: 'Banco do Brasil', line: 'custeio', contract: '40/123', releasedCents: 1_000_000,
    ratePct: 8.5, graceMonths: 0, guarantees: 'Penhor do rebanho', notes: '',
    schedule: [{ dueDate: '2026-11-30', principalCents: 500_000, interestCents: 7_000 }, { dueDate: '2027-05-30', principalCents: 500_000, interestCents: 3_500 }] };
  await t.test('the schedule must amortize exactly the contracted amount', async () => {
    await assert.rejects(command(alice, 'save_financing', { ...contract, id: randomUUID(), schedule: contract.schedule.slice(0, 1) }), /somar o valor contratado/);
    await assert.rejects(command(employee, 'save_financing', contract), /exclusivo/);
    const saved = await command(alice, 'save_financing', contract);
    assert.equal(saved.schedule.length, 2);
    await assert.rejects(command(alice, 'save_financing', contract), /já foi cadastrado/);
  });
  await t.test('releases cannot exceed the contract', async () => {
    await assert.rejects(move('liberacao', { toAccountId: bank }), /inválida/);
    assert.equal((await move('liberacao', { toAccountId: bank, financingId: financing, cents: 600_000 })).status, 'efetivado');
    assert.match((await move('liberacao', { toAccountId: bank, financingId: financing, cents: 400_001 })).conflictReason, /R\$ 4\.000,00 a liberar/);
  });
  await t.test('installments are paid like any payable', async () => {
    assert.match((await pay([{ entryId: financing, index: 0, cents: 507_001 }])).conflictReason, /financiamento Banco do Brasil tem R\$ 5\.070,00 em aberto/);
    assert.equal((await pay([{ entryId: financing, index: 0, cents: 507_000 }])).status, 'efetivado');
    assert.match((await pay([{ entryId: financing, index: 2, cents: 1 }])).conflictReason, /não encontrada/);
  });
});

test('renegotiation closes the originals at what was paid and creates the new installments; undo is auditable', async (t) => {
  const entry = await approve(await saveEntry(alice, expense(1_200_000, [
    { dueDate: '2026-10-13', cents: 400_000 }, { dueDate: '2026-11-13', cents: 400_000 }, { dueDate: '2026-12-13', cents: 400_000 },
  ])));
  const partial = await pay([{ entryId: entry.id, index: 0, cents: 100_000 }]);
  const reneg = randomUUID();
  const payload = { id: reneg, operationId: operation, direction: 'pagar', reason: 'Fornecedor aceitou dividir em mais vezes',
    items: [{ entryId: entry.id, index: 0 }, { entryId: entry.id, index: 1 }],
    installments: [{ dueDate: '2026-12-20', cents: 350_000 }, { dueDate: '2027-01-20', cents: 350_000 }] };

  await t.test('the reason is required; the frozen paid amount comes from the server', async () => {
    await assert.rejects(command(alice, 'renegotiate', { ...payload, id: randomUUID(), reason: ' ' }), /motivo/);
    const result = await command(alice, 'renegotiate', payload);
    assert.equal(result.status, 'efetivado');
    assert.deepEqual(result.items, [{ entryId: entry.id, index: 0, settledCents: 100_000 }, { entryId: entry.id, index: 1, settledCents: 0 }]);
  });
  await t.test('the originals take no more payments; the new installments do', async () => {
    assert.match((await pay([{ entryId: entry.id, index: 1, cents: 1 }])).conflictReason, /renegociada\. Pague as parcelas novas/);
    assert.match((await command(alice, 'renegotiate', { ...payload, id: randomUUID() })).conflictReason, /já foi renegociada/);
    await assert.rejects(command(alice, 'reverse_payment', { id: partial.id, operationId: operation, reason: 'x' }), /Desfaça a renegociação/);
    const paidNew = await pay([{ entryId: reneg, index: 0, cents: 350_000 }]);
    assert.equal(paidNew.status, 'efetivado');
    await assert.rejects(command(alice, 'undo_renegotiation', { id: reneg, operationId: operation, reason: 'Errei' }), /Já há pagamento/);
    await command(alice, 'reverse_payment', { id: paidNew.id, operationId: operation, reason: 'Pix devolvido' });
  });
  await t.test('a renegotiated renegotiation must be undone first; undoing reopens the originals', async () => {
    const second = await command(alice, 'renegotiate', { id: randomUUID(), operationId: operation, direction: 'pagar', reason: 'Prorrogação',
      items: [{ entryId: reneg, index: 1 }], installments: [{ dueDate: '2027-03-20', cents: 360_000 }] });
    assert.equal(second.status, 'efetivado');
    await assert.rejects(command(alice, 'undo_renegotiation', { id: reneg, operationId: operation, reason: 'Errei' }), /renegociadas de novo/);
    await command(alice, 'undo_renegotiation', { id: second.id, operationId: operation, reason: 'Errei' });
    const undone = await command(alice, 'undo_renegotiation', { id: reneg, operationId: operation, reason: 'Errei' });
    assert.deepEqual([undone.status, undone.reverseReason], ['estornado', 'Errei']);
    assert.equal((await pay([{ entryId: entry.id, index: 1, cents: 400_000 }])).status, 'efetivado');
    assert.match((await pay([{ entryId: reneg, index: 0, cents: 1 }])).conflictReason, /desfeita/);
  });
  await t.test('cancelling (no new installments) closes the installment at what was paid', async () => {
    const cancel = await command(alice, 'renegotiate', { id: randomUUID(), operationId: operation, direction: 'pagar', reason: 'Fornecedor perdoou',
      items: [{ entryId: entry.id, index: 2 }], installments: [] });
    assert.equal(cancel.status, 'efetivado');
    assert.match((await pay([{ entryId: entry.id, index: 2, cents: 1 }])).conflictReason, /renegociada/);
  });
  await t.test('a paid installment cannot be renegotiated; the conflict keeps the queue moving', async () => {
    const result = await command(alice, 'renegotiate', { id: randomUUID(), operationId: operation, direction: 'pagar', reason: 'x',
      items: [{ entryId: entry.id, index: 1 }], installments: [{ dueDate: '2027-01-01', cents: 1 }] });
    assert.equal(result.status, 'conflito');
    assert.match(result.conflictReason, /já foi quitada/);
    assert.equal((await command(alice, 'undo_renegotiation', { id: result.id, operationId: operation, reason: '' })).status, 'descartado');
  });
});

test('other revenues need another partner to approve; employees neither register nor approve them', async () => {
  const revenue = (extra = {}) => ({ kind: 'receita', amountCents: 150_000, title: 'Venda do couro',
    payload: { categoryId: 'cat-outras-receitas', category: 'Outras receitas', description: 'Couro', counterparty: 'Curtume', document: '',
      installments: [{ dueDate: '2026-11-10', cents: 150_000 }], ...extra } });
  await assert.rejects(saveEntry(employee, revenue()), /Somente um sócio/);
  await assert.rejects(saveEntry(alice, revenue({ categoryId: 'cat-alimentacao' })), /categoria de receita/);
  await assert.rejects(saveEntry(alice, revenue({ installments: [{ dueDate: '2026-11-10', cents: 1 }] })), /fechar o valor/);
  const saved = await saveEntry(alice, revenue());
  assert.equal(saved.status, 'aguardando_aprovacao');
  await assert.rejects(approve(saved, employee), /outra pessoa habilitada/);
  const approved = await approve(saved);
  assert.equal(approved.status, 'aprovado');
  assert.match((await pay([{ entryId: approved.id, index: 0, cents: 150_000 }])).conflictReason, /não encontrada/);
  assert.equal((await pay([{ entryId: approved.id, index: 0, cents: 150_000 }], { direction: 'receber' })).status, 'efetivado');
  assert.equal((await workspace(employee)).entries.some((e) => e.kind === 'receita'), false);
});

test('recurring expenses: the template is versioned and each month is launched once', async () => {
  const id = randomUUID();
  const template = { farmId: farm, title: 'Energia', categoryId: 'cat-administrativas', counterparty: 'Concessionária', counterpartyId: null,
    cents: 45_000, dayOfMonth: 10, startMonth: '2026-10', endMonth: null, active: true };
  await assert.rejects(command(alice, 'save_recurrence', { ...template, id: randomUUID(), operationId: operation, categoryId: 'cat-venda-animais' }), /categoria/);
  await assert.rejects(command(alice, 'save_recurrence', { ...template, id: randomUUID(), operationId: operation, dayOfMonth: 31 }), /dia 1 ao 28/);
  const saved = await command(alice, 'save_recurrence', { ...template, id, operationId: operation });
  assert.equal(saved.title, 'Energia');
  await assert.rejects(command(alice, 'save_recurrence', { ...template, id, operationId: operation, cents: 50_000, previous: { ...template, cents: 1 } }), /mudou em outro aparelho/);
  const updated = await command(alice, 'save_recurrence', { ...template, id, operationId: operation, cents: 50_000, previous: template });
  assert.equal(updated.cents, 50_000);
  const month = (m, entryId) => saveEntry(alice, expense(50_000, [{ dueDate: `${m}-10`, cents: 50_000 }], { recurrence: { id, month: m } }), entryId);
  await assert.rejects(saveEntry(alice, expense(1, [{ dueDate: '2026-10-10', cents: 1 }], { recurrence: { id: randomUUID(), month: '2026-10' } })), /fora desta operação/);
  const october = await month('2026-10');
  await assert.rejects(month('2026-10'), /já foi lançada/);
  // A rejected month can be launched again.
  await command(bob, 'decide_entry', { id: october.id, operationId: operation, decision: 'recusar', note: 'valor errado', expectedVersion: october.version });
  assert.equal((await month('2026-10')).status, 'aguardando_aprovacao');
  assert.equal((await workspace(alice)).recurrences.find((r) => r.id === id).cents, 50_000);
});

test('budgets are one value per category and month', async () => {
  await assert.rejects(command(alice, 'set_budget', { id: randomUUID(), operationId: operation, categoryId: 'cat-x', month: '2026-10', cents: 1 }), /plano de contas/);
  await command(alice, 'set_budget', { id: randomUUID(), operationId: operation, categoryId: 'cat-alimentacao', month: '2026-10', cents: 500_000 });
  await command(alice, 'set_budget', { id: randomUUID(), operationId: operation, categoryId: 'cat-alimentacao', month: '2026-10', cents: 600_000 });
  const budgets = (await workspace(alice)).budgets.filter((b) => b.categoryId === 'cat-alimentacao');
  assert.deepEqual(budgets.map((b) => b.cents), [600_000]);
});

test('imported titles are opening payables and receivables; importing again does not duplicate', async () => {
  const row = (key, extra = {}) => ({ id: randomUUID(), direction: 'pagar', title: 'Ração de setembro', counterparty: 'Casa do Campo', categoryId: 'cat-alimentacao',
    occurredAt: '2026-09-20', installments: [{ dueDate: '2026-11-15', cents: 350_000 }], importKey: key, ...extra });
  const batch = { id: randomUUID(), operationId: operation, farmId: farm, titles: [row('a'), row('b', { direction: 'receber', title: 'Venda antiga' })] };
  const first = await command(alice, 'import_titles', batch);
  assert.deepEqual([first.imported, first.skipped], [2, 0]);
  const again = await command(alice, 'import_titles', { ...batch, id: randomUUID(), titles: [row('a'), row('c')] });
  assert.deepEqual([again.imported, again.skipped], [1, 1]);
  const titles = (await workspace(alice)).titles;
  assert.equal(titles.length, 3);
  const payable = titles.find((x) => x.importKey === 'a');
  assert.equal((await pay([{ entryId: payable.id, index: 0, cents: 350_000 }])).status, 'efetivado');
  const receivable = titles.find((x) => x.importKey === 'b');
  assert.match((await pay([{ entryId: receivable.id, index: 0, cents: 1 }])).conflictReason, /não encontrada/);
  await assert.rejects(command(employee, 'import_titles', batch), /exclusivo/);
});

test('activity shows the new finance actions without amounts, only to partners', async () => {
  const kinds = ['register_movement', 'renegotiate', 'save_financing', 'save_recurrence', 'import_titles', 'set_budget'];
  const items = (await workspace(alice)).activity.filter((a) => kinds.includes(a.kind));
  assert.deepEqual(new Set(items.map((a) => a.kind)), new Set(kinds));
  assert.ok(items.every((a) => !JSON.stringify(a.subject).match(/[Cc]ents/)));
  assert.equal(items.find((a) => a.kind === 'register_movement' && a.subject.movementKind === 'aporte').subject.partnerName, 'Bob');
  assert.equal((await workspace(employee)).activity.some((a) => kinds.includes(a.kind)), false);
});
