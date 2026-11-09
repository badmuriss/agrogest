import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
// Node's TS stripping does not resolve the extensionless imports used by Metro.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') && context.parentURL?.includes('/src/domain/') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const finance = await import('../apps/mobile/src/domain/finance.ts');
const { monthlyInstallments } = await import('../apps/mobile/src/domain/allocation.ts');
const {
  obligations, installmentViews, paymentConflict, paymentErrors, paymentTotal, statement, accountBalance,
  dueAlerts, dueSummary, categoryOf, DEFAULT_CATEGORIES, saleInstallments,
} = finance;

const today = '2026-10-20';

test('missing purchase payments follow transferred animals back to the original purchase exactly once', () => {
  const source = { id: 'source', farmId: 'f1', operationId: 'o1', purchaseCents: 24597260, freightCents: 1016000, commissionCents: 0,
    transfer: { outgoing: { destinationLotId: 'received' } } };
  const received = { ...source, id: 'received', farmId: 'f2', operationId: 'o2', purchaseCents: 25613260, freightCents: 0,
    transfer: { incoming: { sourceLotId: source.id }, outgoing: { destinationLotId: 'again' } } };
  const again = { ...received, id: 'again', farmId: 'f3', transfer: { incoming: { sourceLotId: received.id } } };
  const lots = [again, received, source];
  const partner = new Set(['o1', 'o2']);
  const find = (farms, input = lots, roles = partner) => finance.pendingLotPurchases(input, new Set(farms), roles).map((l) => l.id);
  assert.deepEqual(find(['f2']), ['source']);
  assert.deepEqual(find(['f3']), ['source']);
  assert.deepEqual(find(['f1', 'f2', 'f3']), ['source']);
  assert.deepEqual(find(['unrelated']), []);
  assert.deepEqual(find([]), []);
  assert.deepEqual(find(['f2'], [received]), [], 'an inaccessible source must not turn transferred cost into a purchase');
  assert.deepEqual(find(['f2'], lots, new Set(['o2'])), [], 'partner at destination cannot see source finances');
  assert.deepEqual(find(['f1', 'f2'], lots, new Set()), [], 'employees do not receive financial reminders');
  const withPlan = lots.map((l) => l.id === source.id ? { ...l, purchasePlan: { parts: [{ kind: 'animais', installments: [{ cents: 24597260 }] }] } } : l);
  assert.deepEqual(find(['f1', 'f2', 'f3'], withPlan), [], 'informing the plan clears the reminder even before payment is due');
});

test('missing purchase payment reminders include closed purchases and freight, skip zero values, and tolerate broken transfer chains', () => {
  const lot = { id: 'closed', farmId: 'f1', operationId: 'o1', purchaseCents: 0, commissionCents: 0, freightCents: 100, headsPurchased: 0 };
  const zero = { ...lot, id: 'zero', freightCents: 0 };
  const a = { ...lot, id: 'a', transfer: { incoming: { sourceLotId: 'b' } } };
  const b = { ...lot, id: 'b', transfer: { incoming: { sourceLotId: 'a' } } };
  assert.deepEqual(finance.pendingLotPurchases([lot, zero, a, b], new Set(['f1']), new Set(['o1'])).map((l) => l.id), ['closed']);
});

let seq = 0;
const entry = (kind, payload, extra = {}) => ({
  id: `e${++seq}`, kind, status: 'aprovado', operationId: 'o1', farmId: 'f1', authorId: 'u1', title: `Lançamento ${seq}`,
  amountCents: null, occurredAt: '2026-10-13', createdAt: `2026-10-13T10:00:${String(seq).padStart(2, '0')}.000Z`,
  decidedBy: 'u2', decidedAt: null, decisionNote: null, pendingDecision: null, pendingDecisionBy: null, pendingDecisionNote: null,
  conflictReason: null, history: [], payload, ...extra,
});
const despesa = (cents, installments, extra = {}, payload = {}) => entry('despesa', {
  category: 'Alimentação e insumos', description: 'Sal', supplier: 'Casa do Campo', document: '', installments,
  criterion: 'cabeca', allocations: [], ...payload,
}, { amountCents: cents, ...extra });
const account = { id: 'a1', operationId: 'o1', name: 'Banco', kind: 'corrente', bank: '', agency: '', number: '', openingBalanceCents: 100_000, openingDate: '2026-10-01', active: true, createdAt: '2026-10-01' };
const payment = (items, extra = {}) => ({
  id: `p${++seq}`, operationId: 'o1', direction: 'pagar', accountId: 'a1', paidAt: '2026-10-15', items,
  interestCents: 0, fineCents: 0, discountCents: 0, method: 'pix', proof: '', notes: '', status: 'efetivado',
  conflictReason: null, authorId: 'u1', createdAt: `2026-10-15T10:00:${String(seq).padStart(2, '0')}.000Z`,
  reversedBy: null, reversedAt: null, reverseReason: null, ...extra,
});

test('a purchase in 3 installments is one obligation with 3 payables; pending and rejected entries owe nothing yet', () => {
  const truck = despesa(1_200_000, monthlyInstallments(1_200_000, 3, '2026-11-13'));
  const pending = despesa(50_000, [{ dueDate: '2026-11-01', cents: 50_000 }], { status: 'aguardando_aprovacao' });
  const list = obligations([truck, pending]);
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((o) => [o.id, o.dueDate, o.cents]), [
    [`${truck.id}:0`, '2026-11-13', 400_000], [`${truck.id}:1`, '2026-12-13', 400_000], [`${truck.id}:2`, '2027-01-13', 400_000],
  ]);
  assert.ok(list.every((o) => o.direction === 'pagar' && o.count === 3 && o.categoryId === 'cat-alimentacao'));
});

test('old expenses with installments become open payables without any copy; old sales receive the net on the sale date', () => {
  const old = despesa(30_000, [{ dueDate: '2026-09-01', cents: 30_000 }], { occurredAt: '2026-08-20' }, { category: 'Mão de obra' });
  const sale = entry('venda', { lotId: 'l1', buyer: 'Frigorífico', heads: 10, carcassKg: 3000, pricePerArrobaCents: 30_000, deductionsCents: 50_000 });
  const views = installmentViews([old, sale], [], today);
  assert.equal(views[0].state, 'vencida');
  assert.equal(views[0].categoryName, 'Mão de obra');
  assert.equal(views[1].direction, 'receber');
  assert.equal(views[1].cents, 6_000_000 - 50_000);
  assert.deepEqual(saleInstallments({ ...sale, payload: { ...sale.payload, installments: [{ dueDate: '2026-11-12', cents: 5_950_000 }] } }), [{ dueDate: '2026-11-12', cents: 5_950_000 }]);
});

test('partial and multiple payments: the rest stays open, a reversed payment stops counting, and interest/discount move only cash', () => {
  const a = despesa(100_000, [{ dueDate: '2026-10-20', cents: 100_000 }]);
  const b = despesa(50_000, [{ dueDate: '2026-10-25', cents: 50_000 }]);
  const partial = payment([{ entryId: a.id, index: 0, cents: 40_000 }]);
  let views = installmentViews([a, b], [partial], today);
  assert.deepEqual([views[0].paidCents, views[0].openCents, views[0].state], [40_000, 60_000, 'parcial']);
  const both = payment([{ entryId: a.id, index: 0, cents: 60_000 }, { entryId: b.id, index: 0, cents: 50_000 }], { interestCents: 1_000, discountCents: 3_000 });
  views = installmentViews([a, b], [partial, both], today);
  assert.deepEqual(views.map((v) => v.state), ['paga', 'paga']);
  assert.equal(paymentTotal(both), 108_000);
  const reversed = { ...both, status: 'estornado' };
  views = installmentViews([a, b], [partial, reversed], today);
  assert.deepEqual(views.map((v) => v.openCents), [60_000, 50_000]);
  assert.equal(views[0].state, 'parcial');
});

test('payment conflicts: beyond the open amount, an unapproved obligation, another operation or direction', () => {
  const a = despesa(100_000, [{ dueDate: '2026-10-30', cents: 100_000 }]);
  const pending = despesa(10_000, [{ dueDate: '2026-10-30', cents: 10_000 }], { status: 'aguardando_aprovacao' });
  const first = payment([{ entryId: a.id, index: 0, cents: 70_000 }]);
  const second = payment([{ entryId: a.id, index: 0, cents: 40_000 }]);
  assert.match(paymentConflict(second, [a], [first]), /R\$\s?300,00 em aberto/);
  assert.equal(paymentConflict(second, [a], [{ ...first, status: 'conflito' }]), null);
  assert.equal(paymentConflict(second, [a], [{ ...first, status: 'estornado' }]), null);
  // Pending local payments reserve the balance too (two payments typed offline).
  assert.match(paymentConflict(second, [a], [{ ...first, status: 'aguardando_envio' }]), /em aberto/);
  assert.match(paymentConflict(payment([{ entryId: pending.id, index: 0, cents: 10_000 }]), [pending], []), /ainda não foi aprovada/);
  assert.match(paymentConflict({ ...first, id: 'x', operationId: 'o2' }, [a], []), /operação/);
  assert.match(paymentConflict({ ...first, id: 'x', direction: 'receber' }, [a], []), /não encontrada/);
  const paid = payment([{ entryId: a.id, index: 0, cents: 100_000 }]);
  assert.match(paymentConflict(second, [a], [paid]), /já foi quitada/);
});

test('payment form validation: account, values, dates and duplicated installments', () => {
  const base = { operationId: 'o1', direction: 'pagar', accountId: 'a1', paidAt: '2026-10-15', items: [{ entryId: 'e', index: 0, cents: 100 }],
    interestCents: 0, fineCents: 0, discountCents: 0, method: 'pix', proof: '', notes: '' };
  assert.equal(paymentErrors(base, [account], today), null);
  assert.match(paymentErrors({ ...base, accountId: 'x' }, [account], today), /conta/);
  assert.match(paymentErrors(base, [{ ...account, active: false }], today), /inativa/);
  assert.match(paymentErrors({ ...base, items: [] }, [account], today), /parcela/);
  assert.match(paymentErrors({ ...base, items: [{ entryId: 'e', index: 0, cents: 1.5 }] }, [account], today), /valor/);
  assert.match(paymentErrors({ ...base, items: [base.items[0], base.items[0]] }, [account], today), /duas vezes/);
  assert.match(paymentErrors({ ...base, discountCents: 101 }, [account], today), /desconto/);
  assert.match(paymentErrors({ ...base, paidAt: '2026-10-21' }, [account], today), /futura/);
  assert.match(paymentErrors({ ...base, paidAt: '2026-09-30' }, [account], today), /começa em 01\/10\/2026/);
});

test('account statement: opening balance, receipts in, payments out, conflicts and reversals ignored', () => {
  const out = payment([{ entryId: 'e', index: 0, cents: 30_000 }], { paidAt: '2026-10-05', fineCents: 500 });
  const income = payment([{ entryId: 'v', index: 0, cents: 80_000 }], { direction: 'receber', paidAt: '2026-10-10' });
  const conflict = payment([{ entryId: 'e', index: 0, cents: 9_999 }], { status: 'conflito' });
  const reversed = payment([{ entryId: 'e', index: 0, cents: 9_999 }], { status: 'estornado' });
  const lines = statement(account, [income, conflict, out, reversed]);
  assert.deepEqual(lines.map((l) => [l.cents, l.balanceCents]), [[-30_500, 69_500], [80_000, 149_500]]);
  assert.equal(accountBalance(account, [income, out]), 149_500);
  assert.equal(accountBalance(account, []), 100_000);
});

test('due alerts 3 days before and on the day, only for open installments, never in the past', () => {
  const a = despesa(90_000, monthlyInstallments(90_000, 3, '2026-10-22'));
  const views = installmentViews([a], [payment([{ entryId: a.id, index: 1, cents: 30_000 }])], today);
  const alerts = dueAlerts(views, today);
  // 22/10: 3 days before (19/10) already passed; on the day stays. 22/11 is paid. 22/12: both.
  assert.deepEqual(alerts.map((x) => x.date), ['2026-10-22', '2026-12-19', '2026-12-22']);
  assert.match(alerts[0].title, /Pagar hoje/);
  assert.match(alerts[1].body, /parcela 3\/3 · Casa do Campo · vence 22\/12\/2026/);
  assert.equal(dueAlerts(views, today, 1).length, 1);
});

test('due summary splits overdue and the next 7 days', () => {
  const a = despesa(10_000, [{ dueDate: '2026-10-10', cents: 10_000 }]);
  const b = despesa(20_000, [{ dueDate: '2026-10-25', cents: 20_000 }]);
  const c = despesa(40_000, [{ dueDate: '2026-12-25', cents: 40_000 }]);
  const summary = dueSummary(installmentViews([a, b, c], [], today), 'pagar');
  assert.deepEqual(summary, { overdueCents: 10_000, overdueCount: 1, next7Cents: 20_000, next7Count: 1, openCents: 70_000 });
});

test('a stock purchase is a payable in the stock category; categories resolve by id or by the old name', () => {
  const purchase = despesa(100_000, [{ dueDate: '2026-11-01', cents: 100_000 }], {}, { destination: 'estoque', stockItems: [] });
  assert.equal(obligations([purchase])[0].categoryId, 'cat-estoque');
  assert.equal(categoryOf({ category: 'frete' }, DEFAULT_CATEGORIES).id, 'cat-frete');
  assert.equal(categoryOf({ categoryId: 'cat-impostos', category: 'Outros' }, DEFAULT_CATEGORIES).nature, 'imposto');
  assert.equal(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size, DEFAULT_CATEGORIES.length);
});

const { purchasePlanError, lotHasPayments, planInstallments } = finance;
const boughtLot = (plan) => ({ id: 'lot-24', code: '024', operationId: 'o1', farmId: 'f1', managementGroup: 'P', supplier: 'Fazenda Boa Esperança', category: 'Novilhas',
  purchasedAt: '2026-10-01', headsPurchased: 100, entryWeightKg: 210, purchaseCents: 22_000_000, commissionCents: 600_000, freightCents: 400_000, ...(plan ? { purchasePlan: plan } : {}) });
const plan = { parts: [
  { kind: 'frete', counterparty: 'Transportes Rio', counterpartyId: null, installments: [{ dueDate: '2026-10-01', cents: 400_000 }] },
  { kind: 'animais', counterparty: 'Fazenda Boa Esperança', counterpartyId: null, installments: [{ dueDate: '2026-10-31', cents: 11_000_000 }, { dueDate: '2026-11-30', cents: 11_000_000 }] },
  { kind: 'comissao', counterparty: 'Corretor', counterpartyId: null, installments: [{ dueDate: '2026-10-01', cents: 600_000 }] },
] };

test('a lot purchase becomes payables only when its payment is informed; old lots stay out', () => {
  assert.equal(obligations([], DEFAULT_CATEGORIES, [boughtLot()]).length, 0);
  const list = obligations([], DEFAULT_CATEGORIES, [boughtLot(plan)]);
  // Fixed order: animals, commission, freight, whatever order the parts were saved in.
  assert.deepEqual(list.map((o) => [o.id, o.title, o.position, o.count, o.cents, o.counterparty]), [
    ['lot-24:0', 'Compra de animais · Origem 024', 1, 2, 11_000_000, 'Fazenda Boa Esperança'],
    ['lot-24:1', 'Compra de animais · Origem 024', 2, 2, 11_000_000, 'Fazenda Boa Esperança'],
    ['lot-24:2', 'Comissão da compra · Origem 024', 1, 1, 600_000, 'Corretor'],
    ['lot-24:3', 'Frete da compra · Origem 024', 1, 1, 400_000, 'Transportes Rio'],
  ]);
  assert.ok(list.every((o) => o.direction === 'pagar' && o.categoryId === 'cat-animais' && o.occurredAt === '2026-10-01'));
  assert.equal(planInstallments(plan).length, 4);
});

test('the purchase plan closes each part of the lot cost', () => {
  assert.equal(purchasePlanError(boughtLot(), plan), null);
  assert.match(purchasePlanError(boughtLot(), { parts: plan.parts.filter((p) => p.kind !== 'animais') }), /pagamento dos animais/);
  assert.match(purchasePlanError({ ...boughtLot(), freightCents: 0 }, plan), /Frete não tem valor/);
  const short = { parts: plan.parts.map((p) => (p.kind === 'animais' ? { ...p, installments: [{ dueDate: '2026-10-31', cents: 1 }] } : p)) };
  assert.match(purchasePlanError(boughtLot(), short), /somar R\$\s?220\.000,00/);
  assert.match(purchasePlanError(boughtLot(), { parts: [...plan.parts, plan.parts[0]] }), /uma vez só/);
});

test('paying the lot purchase: open amount, overpayment and the lock on editing the plan', () => {
  const lot = boughtLot(plan);
  const first = payment([{ entryId: lot.id, index: 0, cents: 11_000_000 }]);
  assert.equal(paymentConflict(first, [], [], undefined, [lot]), null);
  assert.match(paymentConflict({ ...first, id: 'x' }, [], [first], undefined, [lot]), /parcela 1 de "Compra de animais · Origem 024" já foi quitada/);
  assert.match(paymentConflict({ ...first, id: 'y', items: [{ entryId: lot.id, index: 3, cents: 400_001 }] }, [], [], undefined, [lot]), /tem R\$\s?4\.000,00 em aberto/);
  assert.match(paymentConflict(first, [], [], undefined, [boughtLot()]), /não encontrada/);
  const views = installmentViews([], [first], '2026-10-20', DEFAULT_CATEGORIES, [lot]);
  assert.deepEqual(views.map((v) => v.state), ['paga', 'em_aberto', 'vencida', 'vencida']);
  assert.equal(lotHasPayments(lot.id, [first]), true);
  assert.equal(lotHasPayments(lot.id, [{ ...first, status: 'estornado' }]), false);
});
