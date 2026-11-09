import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
// Node's TS stripping does not resolve the extensionless imports used by Metro.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') && context.parentURL?.includes('/src/domain/') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const finance = await import('../apps/mobile/src/domain/finance.ts');
const treasury = await import('../apps/mobile/src/domain/treasury.ts');
const reports = await import('../apps/mobile/src/domain/reports.ts');
const bank = await import('../apps/mobile/src/domain/bank-import.ts');
const sheet = await import('../apps/mobile/src/domain/sheet-import.ts');
const exporter = await import('../apps/mobile/src/domain/export.ts');
const { summarizeLot } = await import('../apps/mobile/src/domain/lot-metrics.ts');
const { monthlyInstallments } = await import('../apps/mobile/src/domain/allocation.ts');
const { DEFAULT_CATEGORIES, installmentViews, accountBalance, cardInvoices, paymentConflict, paymentErrors, reversalBlock, dueAlerts } = finance;

const today = '2026-10-20';
let seq = 0;
const entry = (kind, payload, extra = {}) => ({
  id: `e${++seq}`, kind, status: 'aprovado', operationId: 'o1', farmId: 'f1', authorId: 'u1', title: `Lançamento ${seq}`,
  amountCents: null, occurredAt: '2026-10-13', createdAt: `2026-10-13T10:00:${String(seq).padStart(2, '0')}.000Z`,
  decidedBy: 'u2', decidedAt: null, decisionNote: null, pendingDecision: null, pendingDecisionBy: null, pendingDecisionNote: null,
  conflictReason: null, history: [], payload, ...extra,
});
const despesa = (cents, installments, extra = {}, payload = {}) => entry('despesa', {
  category: 'Alimentação e insumos', categoryId: 'cat-alimentacao', description: 'Sal', supplier: 'Casa do Campo', document: '', installments,
  criterion: 'cabeca', allocations: [], ...payload,
}, { amountCents: cents, ...extra });
const bankAccount = { id: 'a1', operationId: 'o1', name: 'Banco', kind: 'corrente', bank: 'BB', agency: '', number: '', openingBalanceCents: 1_000_000, openingDate: '2026-09-01', active: true, createdAt: '2026-09-01' };
const cashAccount = { ...bankAccount, id: 'a2', name: 'Caixa', kind: 'caixa', openingBalanceCents: 0 };
const cardAccount = { ...bankAccount, id: 'c1', name: 'Cartão', kind: 'cartao', openingBalanceCents: 0, closingDay: 5, dueDay: 15 };
const payment = (items, extra = {}) => ({
  id: `p${++seq}`, operationId: 'o1', direction: 'pagar', accountId: 'a1', paidAt: '2026-10-15', items,
  interestCents: 0, fineCents: 0, discountCents: 0, method: 'pix', proof: '', notes: '', status: 'efetivado',
  conflictReason: null, authorId: 'u1', createdAt: `2026-10-15T10:00:${String(seq).padStart(2, '0')}.000Z`,
  reversedBy: null, reversedAt: null, reverseReason: null, partnerId: null, partnerMode: null, advanceId: null, ...extra,
});
const movement = (kind, cents, extra = {}) => ({
  id: `m${++seq}`, operationId: 'o1', kind, fromAccountId: null, toAccountId: null, partnerId: null, financingId: null, counterparty: '',
  counterpartyId: null, invoiceMonth: null, cents, occurredAt: '2026-10-10', method: 'pix', proof: '', notes: '', status: 'efetivado',
  conflictReason: null, authorId: 'u1', createdAt: `2026-10-10T10:00:${String(seq).padStart(2, '0')}.000Z`, reversedBy: null, reversedAt: null, reverseReason: null, ...extra,
});
const book = (overrides) => {
  const base = {
    farmIds: new Set(['f1']), operationIds: new Set(['o1']), entries: [], lots: [], lotSummaries: [], categories: DEFAULT_CATEGORIES,
    accounts: [bankAccount, cashAccount, cardAccount], payments: [], movements: [], views: [], invoices: [], occurrences: [], financings: [],
    renegotiations: [], budgets: [], today,
  };
  const b = { ...base, ...overrides };
  if (!overrides.views) b.views = installmentViews(b.entries, b.payments, today, DEFAULT_CATEGORIES, b.lots, { financings: b.financings, renegotiations: b.renegotiations, titles: overrides.titles ?? [] });
  return b;
};

test('acceptance: a R$ 12.000 purchase in 3 installments stays in October; cash changes only on each payment', () => {
  const truck = despesa(1_200_000, monthlyInstallments(1_200_000, 3, '2026-11-13'), { occurredAt: '2026-10-05' });
  const p1 = payment([{ entryId: truck.id, index: 0, cents: 400_000 }], { paidAt: '2026-11-13' });
  const october = { from: '2026-10-01', to: '2026-10-31' };
  const november = { from: '2026-11-01', to: '2026-11-30' };
  const b = book({ entries: [truck], payments: [p1] });
  assert.equal(reports.buildDre(b, october).lines.find((l) => l.key === 'producao').cents, -1_200_000);
  assert.equal(reports.buildDre(b, november).realResultCents, 0);
  assert.equal(reports.realizedFlow(b, october, 'mes').buckets.length, 0);
  assert.equal(reports.realizedFlow(b, november, 'mes').buckets[0].outCents, 400_000);
  // A stock purchase is not a cost until consumed.
  const stock = despesa(500_000, [{ dueDate: '2026-10-30', cents: 500_000 }], {}, { destination: 'estoque', stockItems: [] });
  const s = reports.buildDre(book({ entries: [stock] }), october);
  assert.equal(s.realResultCents, 0);
  assert.deepEqual(s.outsideResult, [{ label: 'Compras para o estoque', cents: 500_000 }]);
});

test('acceptance: transfers, partner contributions and financing releases change balances, not the result', () => {
  const financing = { id: 'fin1', operationId: 'o1', farmId: 'f1', bank: 'BB', line: 'custeio', contract: '', releasedCents: 1_000_000, ratePct: 8, graceMonths: 0,
    guarantees: '', notes: '', schedule: [{ dueDate: '2026-10-30', principalCents: 1_000_000, interestCents: 20_000 }], authorId: 'u1', createdAt: '2026-10-01' };
  const movements = [
    movement('transferencia', 100_000, { fromAccountId: 'a1', toAccountId: 'a2' }),
    movement('aporte', 300_000, { toAccountId: 'a1', partnerId: 'u2' }),
    movement('liberacao', 1_000_000, { toAccountId: 'a1', financingId: 'fin1' }),
  ];
  const b = book({ movements, financings: [financing] });
  const october = { from: '2026-10-01', to: '2026-10-31' };
  const dre = reports.buildDre(b, october);
  // Only the financing interest that falls due in the period is a (financial) expense.
  assert.equal(dre.realResultCents, -20_000);
  assert.equal(accountBalance(bankAccount, [], undefined, movements), 1_000_000 - 100_000 + 300_000 + 1_000_000);
  assert.equal(accountBalance(cashAccount, [], undefined, movements), 100_000);
  const bridge = reports.resultToCashBridge(b, october);
  assert.equal(bridge.cashCents, 1_300_000, 'the internal transfer does not change total cash');
  assert.equal(bridge.rows.reduce((acc, r) => acc + r.differenceCents, 0), bridge.cashCents - bridge.resultCents);
  assert.deepEqual(bridge.rows.find((r) => r.group === 'socios'), { group: 'socios', resultCents: 0, cashCents: 300_000, differenceCents: 300_000 });
  // Paying the financing installment: the interest share is financial, the principal is not result.
  const views = installmentViews([], [], today, DEFAULT_CATEGORIES, [], { financings: [financing] });
  const pay = payment([{ entryId: 'fin1', index: 0, cents: 1_020_000 }], { paidAt: '2026-10-30' });
  const flow = reports.cashLines(book({ movements, financings: [financing], payments: [pay], views }), october);
  assert.deepEqual(flow.filter((l) => l.paymentId === pay.id).map((l) => [l.group, l.cents]), [['financiamentos', -1_000_000], ['financeiro', -20_000]]);
  const s = treasury.financingSummary(financing, movements, installmentViews([], [pay], today, DEFAULT_CATEGORIES, [], { financings: [financing] }));
  assert.deepEqual([s.principalPaidCents, s.interestPaidCents, s.outstandingCents], [1_000_000, 20_000, 0]);
});

test('acceptance: DRE and cash flow of the same period reconcile exactly through the bridge', () => {
  const lot = { id: 'l1', code: '001', operationId: 'o1', farmId: 'f1', managementGroup: 'P', supplier: '', category: 'Bois', purchasedAt: '2026-08-01',
    headsPurchased: 10, entryWeightKg: 300, purchaseCents: 3_000_000, commissionCents: 0, freightCents: 0 };
  const sale = entry('venda', { lotId: 'l1', buyer: 'Frigorífico', heads: 4, carcassKg: 1200, pricePerArrobaCents: 30_000, deductionsCents: 10_000,
    installments: [{ dueDate: '2026-10-20', cents: 2_390_000 }] }, { occurredAt: '2026-10-10', amountCents: 2_400_000 });
  const salary = despesa(300_000, [{ dueDate: '2026-10-05', cents: 300_000 }], { occurredAt: '2026-09-30' }, { categoryId: 'cat-mao-de-obra', category: 'Mão de obra' });
  const admin = despesa(50_000, [{ dueDate: '2026-11-05', cents: 50_000 }], {}, { categoryId: 'cat-administrativas', category: 'Despesas administrativas' });
  const entries = [sale, salary, admin];
  const payments = [
    payment([{ entryId: sale.id, index: 0, cents: 2_000_000 }], { direction: 'receber', paidAt: '2026-10-20', fineCents: 1_000 }),
    payment([{ entryId: salary.id, index: 0, cents: 300_000 }], { paidAt: '2026-10-05', interestCents: 2_000 }),
  ];
  const summary = summarizeLot(lot, entries, 0, today);
  const b = book({ entries, payments, lots: [lot], lotSummaries: [summary] });
  const october = { from: '2026-10-01', to: '2026-10-31' };
  const dre = reports.buildDre(b, october);
  assert.equal(dre.grossRevenueCents, 2_400_000);
  assert.equal(dre.lines.find((l) => l.key === 'animais').cents, -1_200_000, 'acquisition of 4 of 10 heads');
  assert.equal(dre.lines.find((l) => l.key === 'adm').cents, -50_000);
  assert.equal(dre.financialResultCents, 1_000 - 2_000);
  const bridge = reports.resultToCashBridge(b, october);
  assert.equal(bridge.resultCents, dre.realResultCents);
  assert.equal(bridge.cashCents, 2_001_000 - 302_000);
  assert.equal(bridge.rows.reduce((acc, r) => acc + r.differenceCents, 0), bridge.cashCents - bridge.resultCents);
  // The September salary is cash in October but cost in September; the October expense is cost, not cash yet.
  assert.deepEqual(bridge.rows.find((r) => r.group === 'custos'), { group: 'custos', resultCents: 0, cashCents: -300_000, differenceCents: -300_000 });
  assert.deepEqual(bridge.rows.find((r) => r.group === 'administrativas'), { group: 'administrativas', resultCents: -50_000, cashCents: 0, differenceCents: 50_000 });
});

test('acceptance: an expense paid with own money becomes a reimbursement payable to the partner', () => {
  const e = despesa(80_000, [{ dueDate: '2026-10-20', cents: 80_000 }]);
  const own = payment([{ entryId: e.id, index: 0, cents: 80_000 }], { accountId: null, partnerId: 'u2', partnerMode: 'reembolso' });
  assert.equal(paymentErrors(own, [bankAccount], today, { partners: ['u1', 'u2'] }), null);
  assert.match(paymentErrors({ ...own, partnerId: 'u9' }, [bankAccount], today, { partners: ['u1', 'u2'] }), /sócio desta operação/);
  assert.match(paymentErrors({ ...own, accountId: 'a1' }, [bankAccount], today), /Escolha a conta/);
  const views = installmentViews([e], [own], today, DEFAULT_CATEGORIES, [], { users: [{ id: 'u2', name: 'Bob Silva' }] });
  const refund = views.find((v) => v.source === 'reembolso');
  assert.deepEqual([refund.title.startsWith('Reembolso a Bob Silva'), refund.openCents, refund.partnerId], [true, 80_000, 'u2']);
  assert.equal(views.find((v) => v.entryId === e.id).state, 'paga');
  // It does not move any account of the operation.
  assert.equal(accountBalance(bankAccount, [own]), 1_000_000);
  const positions = treasury.partnerPositions('o1', [{ id: 'u2', name: 'Bob', sharePct: 50 }], [own], [], views);
  assert.equal(positions[0].reimbursementOpenCents, 80_000);
  const paid = payment([{ entryId: own.id, index: 0, cents: 80_000 }]);
  assert.match(reversalBlock(own, [own, paid], []), /reembolso desta baixa já foi pago/);
  // As a contribution, it adds to the partner's capital and nothing is owed.
  const asContribution = { ...own, id: 'own2', partnerMode: 'aporte' };
  const p2 = treasury.partnerPositions('o1', [{ id: 'u2', name: 'Bob', sharePct: 50 }], [asContribution], [], installmentViews([e], [asContribution], today));
  assert.deepEqual([p2[0].contributedCents, p2[0].reimbursementOpenCents], [80_000, 0]);
});

test('a client advance is compensated on the receivable without moving cash twice', () => {
  const advance = movement('adiantamento', 300_000, { toAccountId: 'a1', counterparty: 'Frigorífico' });
  const sale = entry('venda', { lotId: 'l1', buyer: 'Frigorífico', heads: 2, carcassKg: 300, pricePerArrobaCents: 30_000, deductionsCents: 0 }, { amountCents: 600_000 });
  const comp = payment([{ entryId: sale.id, index: 0, cents: 200_000 }], { direction: 'receber', accountId: null, advanceId: advance.id });
  assert.equal(paymentErrors(comp, [bankAccount], today, { movements: [advance], payments: [] }), null);
  assert.equal(finance.advanceBalance(advance, [comp]), 100_000);
  assert.match(paymentErrors({ ...comp, id: 'x', items: [{ entryId: sale.id, index: 0, cents: 100_001 }] }, [bankAccount], today, { movements: [advance], payments: [comp] }), /R\$\s?1\.000,00 para compensar/);
  assert.equal(accountBalance(bankAccount, [comp], undefined, [advance]), 1_300_000);
});

test('card purchases go to the invoice of the cycle; paying the invoice is a transfer that leaves cash', () => {
  assert.equal(finance.invoiceMonthOf('2026-10-05', 5), '2026-10');
  assert.equal(finance.invoiceMonthOf('2026-10-06', 5), '2026-11');
  assert.equal(finance.invoiceDueDate('2026-10', 5, 15), '2026-10-15');
  assert.equal(finance.invoiceDueDate('2026-10', 25, 5), '2026-11-05');
  const e = despesa(90_000, [{ dueDate: '2026-10-08', cents: 90_000 }]);
  const charge = payment([{ entryId: e.id, index: 0, cents: 90_000 }], { accountId: 'c1', paidAt: '2026-10-08', method: 'cartao' });
  const invoices = cardInvoices(cardAccount, [charge], [], today);
  assert.deepEqual(invoices.map((i) => [i.month, i.dueDate, i.chargesCents, i.openCents]), [['2026-11', '2026-11-15', 90_000, 90_000]]);
  const payInvoice = movement('transferencia', 90_000, { fromAccountId: 'a1', toAccountId: 'c1', invoiceMonth: '2026-11', occurredAt: '2026-11-15' });
  assert.equal(cardInvoices(cardAccount, [charge], [payInvoice], today)[0].openCents, 0);
  const b = book({ entries: [e], payments: [charge], movements: [payInvoice] });
  const flow = reports.cashLines(b);
  assert.deepEqual(flow.map((l) => [l.group, l.cents]), [['cartao', -90_000]], 'the card purchase itself is not cash');
  // The expense competence stays on the purchase date.
  assert.equal(reports.buildDre(b, { from: '2026-10-01', to: '2026-10-31' }).lines.find((l) => l.key === 'producao').cents, -90_000);
  assert.equal(finance.accountErrors({ ...cardAccount, closingDay: null }, []), 'Informe os dias de fechamento e de vencimento da fatura (1 a 28).');
});

test('renegotiation: the originals close at what was paid; new installments carry the rest; cancelling closes without new ones', () => {
  const e = despesa(1_200_000, monthlyInstallments(1_200_000, 3, '2026-10-13'));
  const partial = payment([{ entryId: e.id, index: 0, cents: 100_000 }]);
  const views = installmentViews([e], [partial], today);
  const input = { operationId: 'o1', items: [{ entryId: e.id, index: 0 }, { entryId: e.id, index: 1 }], installments: [{ dueDate: '2026-12-20', cents: 750_000 }], reason: 'Prorrogação' };
  assert.equal(treasury.renegotiationErrors(input, views), null);
  assert.match(treasury.renegotiationErrors({ ...input, reason: ' ' }, views), /motivo/);
  assert.equal(treasury.renegotiationDelta(input.installments, 700_000), 50_000);
  const reneg = { id: 'r1', operationId: 'o1', direction: 'pagar', items: [{ entryId: e.id, index: 0, settledCents: 100_000 }, { entryId: e.id, index: 1, settledCents: 0 }],
    installments: input.installments, reason: 'Prorrogação', status: 'efetivado', conflictReason: null, authorId: 'u1', createdAt: '2026-10-18T10:00:00.000Z',
    reversedBy: null, reversedAt: null, reverseReason: null };
  const after = installmentViews([e], [partial], today, DEFAULT_CATEGORIES, [], { renegotiations: [reneg] });
  const byId = Object.fromEntries(after.map((v) => [v.id, v]));
  assert.deepEqual([byId[`${e.id}:0`].state, byId[`${e.id}:0`].openCents, byId[`${e.id}:0`].originalCents], ['renegociada', 0, 400_000]);
  assert.deepEqual([byId[`${e.id}:1`].state, byId[`${e.id}:1`].openCents], ['renegociada', 0]);
  assert.deepEqual([byId['r1:0'].openCents, byId['r1:0'].source, byId['r1:0'].origin, byId['r1:0'].occurredAt], [750_000, 'renegociacao', 'lancamento', e.occurredAt]);
  assert.match(paymentConflict(payment([{ entryId: e.id, index: 1, cents: 1 }]), [e], [partial], undefined, [], { renegotiations: [reneg] }), /renegociada/);
  assert.equal(paymentConflict(payment([{ entryId: 'r1', index: 0, cents: 750_000 }]), [e], [partial], undefined, [], { renegotiations: [reneg] }), null);
  assert.match(reversalBlock(partial, [partial], [reneg]), /Desfaça a renegociação/);
  assert.equal(treasury.undoRenegotiationBlock(reneg, after), null);
  const paidNew = payment([{ entryId: 'r1', index: 0, cents: 1 }]);
  assert.match(treasury.undoRenegotiationBlock(reneg, installmentViews([e], [partial, paidNew], today, DEFAULT_CATEGORIES, [], { renegotiations: [reneg] })), /Já há pagamento/);
  // The renegotiation surcharge is financial result on its date.
  const dre = reports.buildDre(book({ entries: [e], payments: [partial], renegotiations: [reneg], views: after }), { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(dre.lines.find((l) => l.key === 'financeiro').details.find((d) => d.label === 'Renegociações').cents, -50_000);
  // Cancelling: no new installments.
  const cancel = { ...reneg, id: 'r2', items: [{ entryId: e.id, index: 2, settledCents: 0 }], installments: [] };
  assert.equal(installmentViews([e], [], today, DEFAULT_CATEGORIES, [], { renegotiations: [cancel] }).find((v) => v.index === 2).state, 'cancelada');
});

test('recurring expenses: monthly forecasts until launched; one expense per month', () => {
  const r = { id: 'rec1', operationId: 'o1', farmId: 'f1', title: 'Energia', categoryId: 'cat-administrativas', counterparty: 'Concessionária', counterpartyId: null,
    cents: 45_000, dayOfMonth: 10, startMonth: '2026-10', endMonth: '2026-12', active: true, createdAt: '2026-10-01' };
  const launched = despesa(45_000, [{ dueDate: '2026-10-10', cents: 45_000 }], {}, { recurrence: { id: 'rec1', month: '2026-10' } });
  const list = treasury.recurrenceOccurrences([r], [launched], '2027-06', today);
  assert.deepEqual(list.map((o) => [o.month, o.dueDate, o.entryId]), [['2026-10', '2026-10-10', launched.id], ['2026-11', '2026-11-10', null], ['2026-12', '2026-12-10', null]]);
  assert.equal(treasury.recurrenceErrors({ ...r, categoryId: 'cat-venda-animais' }, DEFAULT_CATEGORIES), 'Escolha a categoria da despesa.');
  assert.equal(treasury.recurrenceErrors({ ...r, endMonth: '2026-09' }, DEFAULT_CATEGORIES), 'O último mês precisa vir depois do primeiro.');
  const projected = reports.projectedFlow(book({ occurrences: list }), '2026-12-31', 'mes');
  assert.deepEqual(projected.items.map((i) => [i.kind, i.cents]), [['prevista', -45_000], ['prevista', -45_000]]);
  const alerts = dueAlerts([], today, 60, { occurrences: list, days: [3] });
  assert.equal(alerts[0].title, 'Despesa prevista: R$ 450,00');
});

test('projected cash flow starts from today, counts overdue items today and warns of a negative balance', () => {
  const e = despesa(1_500_000, [{ dueDate: '2026-10-01', cents: 500_000 }, { dueDate: '2026-11-10', cents: 1_000_000 }]);
  const b = book({ entries: [e] });
  const flow = reports.projectedFlow(b, '2026-12-31', 'mes');
  assert.equal(flow.opening, 1_000_000);
  assert.deepEqual(flow.items.map((i) => [i.kind, i.date]), [['vencida', today], ['parcela', '2026-11-10']]);
  assert.equal(flow.firstNegative.key, '2026-11');
  assert.equal(flow.firstNegative.balanceCents, -500_000);
});

test('aging, spending by category and budget variance', () => {
  const old = despesa(10_000, [{ dueDate: '2026-08-01', cents: 10_000 }], { occurredAt: '2026-07-20' });
  const recent = despesa(20_000, [{ dueDate: '2026-10-10', cents: 20_000 }], {}, { categoryId: 'cat-combustivel', category: 'Combustível' });
  const future = despesa(30_000, [{ dueDate: '2026-11-10', cents: 30_000 }]);
  const b = book({ entries: [old, recent, future], budgets: [{ id: 'b1', operationId: 'o1', categoryId: 'cat-alimentacao', month: '2026-10', cents: 25_000 }] });
  const a = reports.aging(b);
  assert.deepEqual([a.pagar.a_vencer.cents, a.pagar['1_30'].cents, a.pagar['60_mais'].cents], [30_000, 20_000, 10_000]);
  const rows = reports.spending(b, { from: '2026-10-01', to: '2026-10-31' }, 'categoria');
  assert.deepEqual(rows.map((r) => [r.label, r.cents]), [['Alimentação e insumos', 30_000], ['Combustível', 20_000]]);
  const budget = reports.budgetReport(b, '2026-10');
  assert.deepEqual(budget.find((r) => r.categoryId === 'cat-alimentacao'), { categoryId: 'cat-alimentacao', name: 'Alimentação e insumos', budgetCents: 25_000, actualCents: 30_000, varianceCents: 5_000 });
});

test('distribution by share closes the cents exactly; SAC schedule amortizes the contract', () => {
  const split = treasury.distributeByShare(100_001, [{ id: 'a', sharePct: 50 }, { id: 'b', sharePct: 30 }, { id: 'c', sharePct: 20 }]);
  assert.equal([...split.values()].reduce((x, y) => x + y, 0), 100_001);
  assert.deepEqual([...split.entries()], [['a', 50_001], ['b', 30_000], ['c', 20_000]]);
  assert.deepEqual([...treasury.distributeByShare(10, [{ id: 'a', sharePct: null }, { id: 'b', sharePct: 50 }]).values()], [5, 5]);
  const schedule = treasury.sacSchedule(1_000_000, 12, '2027-01-15', 4, 2, 1);
  assert.equal(schedule.length, 6);
  assert.equal(schedule.reduce((acc, i) => acc + i.principalCents, 0), 1_000_000);
  assert.ok(schedule.slice(0, 2).every((i) => i.principalCents === 0 && i.interestCents > 0));
  assert.equal(treasury.financingErrors({ farmId: 'f1', bank: 'BB', line: 'custeio', contract: '', releasedCents: 1_000_000, ratePct: 12, graceMonths: 2, guarantees: '', notes: '', schedule }), null);
});

test('movement rules mirror the server', () => {
  const base = { operationId: 'o1', kind: 'transferencia', fromAccountId: 'a1', toAccountId: 'a2', partnerId: null, financingId: null, counterparty: '', counterpartyId: null,
    invoiceMonth: null, cents: 1_000, occurredAt: today, method: 'pix', proof: '', notes: '' };
  const accounts = [bankAccount, cashAccount, cardAccount];
  assert.equal(treasury.movementErrors(base, accounts, today), null);
  assert.equal(treasury.movementErrors({ ...base, toAccountId: 'a1' }, accounts, today), 'Escolha contas diferentes.');
  assert.equal(treasury.movementErrors({ ...base, kind: 'aporte', fromAccountId: null }, accounts, today), 'Escolha o sócio.');
  assert.equal(treasury.movementErrors({ ...base, kind: 'aporte', fromAccountId: null, toAccountId: 'c1', partnerId: 'u1' }, accounts, today), 'Escolha uma conta que não seja cartão.');
  assert.equal(treasury.movementErrors({ ...base, toAccountId: 'c1', invoiceMonth: '2026-11' }, accounts, today), null);
  assert.equal(treasury.movementErrors({ ...base, invoiceMonth: '2026-11' }, accounts, today), 'Fatura inválida.');
  assert.equal(treasury.movementErrors({ ...base, occurredAt: '2026-08-01' }, accounts, today), 'A conta Banco começa em 01/09/2026.');
});

test('bank statements: OFX and CSV lines, match suggestions and already imported lines', () => {
  const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261014120000[-3:BRT]<TRNAMT>-4000.00<FITID>ABC123<MEMO>PIX CASA DO CAMPO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261015<TRNAMT>150,50<FITID>XYZ<NAME>TED RECEBIDA</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const parsed = bank.parseStatement('extrato.ofx', ofx);
  assert.deepEqual(parsed.lines.map((l) => [l.id, l.date, l.cents]), [['ABC123', '2026-10-14', -400_000], ['XYZ', '2026-10-15', 15_050]]);
  const csv = 'Data;Histórico;Valor\n14/10/2026;PIX CASA DO CAMPO;-4.000,00\n15/10/2026;"TED; RECEBIDA";150,50\n';
  assert.deepEqual(bank.parseBankCsv(csv).lines.map((l) => [l.date, l.cents, l.description]), [['2026-10-14', -400_000, 'PIX CASA DO CAMPO'], ['2026-10-15', 15_050, 'TED; RECEBIDA']]);
  const split = 'data,descricao,credito,debito\n2026-10-14,Sal,,4000.00\n';
  assert.equal(bank.parseBankCsv(split).lines[0].cents, -400_000);
  const e = despesa(400_000, [{ dueDate: '2026-10-13', cents: 400_000 }]);
  const views = installmentViews([e], [], today);
  const suggestions = bank.suggestMatches(parsed.lines, views, []);
  assert.equal(suggestions[0].candidates[0].entryId, e.id);
  assert.equal(suggestions[1].candidates.length, 0);
  assert.equal(bank.suggestMatches(parsed.lines, views, [payment([], { proof: 'ABC123' })])[0].imported, true);
});

test('bank matching keeps direction, exact open amount, ten-day limits and stable order for ties', () => {
  const base = installmentViews([despesa(1000, [{ dueDate: '2026-10-15', cents: 1000 }])], [], today)[0];
  const view = (id, changes = {}) => ({ ...base, id, entryId: id, ...changes });
  const views = [view('later', { dueDate: '2026-10-17' }), view('earlier', { dueDate: '2026-10-13' }),
    view('same'), view('limit', { dueDate: '2026-10-25' }), view('far', { dueDate: '2026-10-26' }),
    view('receipt', { direction: 'receber' }), view('card', { source: 'fatura' }),
    view('partial', { openCents: 999 }), view('settled', { openCents: 0 })];
  const lines = [{ id: 'out', date: '2026-10-15', cents: -1000, description: 'Saída' },
    { id: 'in', date: '2026-10-15', cents: 1000, description: 'Entrada' },
    { id: 'unknown', date: '2026-10-15', cents: -888, description: 'Outro valor' }];
  const before = JSON.stringify({ lines, views });
  const suggestions = bank.suggestMatches(lines, views, [payment([], { proof: 'out', status: 'estornado' }), payment([], { proof: 'in', status: 'descartado' })]);
  assert.deepEqual(suggestions.map((s) => s.candidates.map((v) => v.id)), [['same', 'later', 'earlier', 'limit'], ['receipt'], []]);
  assert.deepEqual(suggestions.map((s) => s.imported), [true, false, false]);
  assert.equal(JSON.stringify({ lines, views }), before);
});

test('report and export installment lookups keep indexes, first references and farm filters', () => {
  const expense = despesa(2000, [{ dueDate: today, cents: 1000 }, { dueDate: today, cents: 1000 }], { id: 'expense', title: 'Primeira parcela' });
  const views = installmentViews([expense], [], today);
  views[1] = { ...views[1], title: 'Segunda parcela', farmId: 'f2' };
  const duplicate = { ...views[0], title: 'Referência duplicada', farmId: 'f2' };
  const indexed = finance.indexInstallments([views[0], duplicate, views[1]]);
  assert.equal(indexed.size, 2);
  assert.strictEqual(indexed.get(finance.installmentId(expense.id, 0)), views[0]);
  assert.strictEqual(indexed.get(finance.installmentId(expense.id, 1)), views[1]);
  const p = payment([{ entryId: expense.id, index: 0, cents: 100 }, { entryId: expense.id, index: 1, cents: 200 }, { entryId: 'missing', index: 0, cents: 300 }], { interestCents: 10 });
  const b = book({ entries: [expense], payments: [p], views: [views[0], duplicate, views[1]] });
  const period = { from: '2026-10-01', to: '2026-10-31' };
  const before = JSON.stringify(b);
  const lines = reports.cashLines(b, period);
  assert.deepEqual(lines.map((l) => [l.description, l.cents]), [['Primeira parcela', -100], ['Parcela', -300], ['Juros e multa', -10]]);
  assert.equal(reports.buildDre(b, period).financialResultCents, -10);
  const sheets = exporter.accountantPackage(b, period, { user: (id) => id, account: (id) => id ?? '', farm: (id) => id });
  assert.equal(sheets.find((s) => s.name === 'Baixas').rows[1][4], 'Primeira parcela | Segunda parcela | missing');
  assert.equal(JSON.stringify(b), before);
});

test('spreadsheet import: titles with stable keys, opening balances and line errors', () => {
  const { rows, errors } = sheet.parseSheet(sheet.SHEET_TEMPLATE + '\npagar;;X;01/11/2026;10,00;;\nreceber;Errada;Y;31/02/2026;10,00;;\npagar;Ração;Z;01/11/2026;5,00;Inexistente;', DEFAULT_CATEGORIES);
  const titles = rows.filter((r) => r.kind === 'titulo');
  assert.deepEqual(titles.map((t) => [t.direction, t.dueDate, t.cents, t.categoryId]), [
    ['pagar', '2026-11-15', 350_000, 'cat-alimentacao'], ['receber', '2026-11-30', 4_820_000, null], ['pagar', '2026-11-01', 500, null],
  ]);
  assert.equal(titles[0].occurredAt, '2026-09-20');
  assert.deepEqual(rows.filter((r) => r.kind === 'saldo').map((r) => [r.name, r.cents]), [['Banco do Brasil', 1_234_567]]);
  assert.equal(errors.length, 3);
  assert.equal(sheet.parseSheet(sheet.SHEET_TEMPLATE, DEFAULT_CATEGORIES).rows[0].importKey, titles[0].importKey, 'the same line has the same key');
  // Imported titles are payables without result.
  const title = { id: 't1', operationId: 'o1', farmId: 'f1', direction: 'pagar', title: 'Ração', counterparty: 'Casa', categoryId: 'cat-alimentacao', occurredAt: '2026-09-20',
    installments: [{ dueDate: '2026-11-15', cents: 350_000 }], importKey: 'k', authorId: 'u1', createdAt: '2026-10-20' };
  const views = installmentViews([], [], today, DEFAULT_CATEGORIES, [], { titles: [title] });
  assert.deepEqual([views[0].source, views[0].openCents], ['importacao', 350_000]);
  assert.equal(reports.buildDre(book({ views }), { from: '2026-09-01', to: '2026-12-31' }).realResultCents, 0);
});

test('exports: CSV with Brazilian decimals, a multi-sheet workbook and a printable report', () => {
  const csv = exporter.toCsv([['Descrição', 'Valor'], ['Sal; mineral', { cents: 123_456 }]]);
  assert.equal(csv, '﻿Descrição;Valor\r\n"Sal; mineral";1234,56');
  const xls = exporter.toSpreadsheet([{ name: 'DRE', rows: [['Linha', 'Valor'], ['Receita & outros', { cents: 100 }]] }]);
  assert.match(xls, /<Worksheet ss:Name="DRE">/);
  assert.match(xls, /Receita &amp; outros/);
  assert.match(xls, /<Data ss:Type="Number">1\.00<\/Data>/);
  const e = despesa(400_000, [{ dueDate: '2026-10-13', cents: 400_000 }]);
  const b = book({ entries: [e], payments: [payment([{ entryId: e.id, index: 0, cents: 400_000 }], { proof: 'E2E1' })] });
  const sheets = exporter.accountantPackage(b, { from: '2026-10-01', to: '2026-10-31' }, { user: () => 'Alice', account: () => 'Banco', farm: () => 'Fazenda' });
  assert.deepEqual(sheets.map((s) => s.name), ['Lançamentos', 'Parcelas', 'Baixas', 'Movimentações', 'Fluxo de caixa', 'DRE']);
  assert.ok(sheets[2].rows[1].includes('E2E1'));
  assert.match(exporter.reportHtml('Relatório', 'Período', sheets.slice(5)), /<h2>DRE<\/h2>/);
});

test('alerts: chosen advance, card invoices and a daily overdue reminder', () => {
  const e = despesa(10_000, [{ dueDate: '2026-10-25', cents: 10_000 }]);
  const late = despesa(5_000, [{ dueDate: '2026-10-01', cents: 5_000 }]);
  const views = installmentViews([e, late], [], today);
  const invoice = { id: 'fatura:c1:2026-11', accountId: 'c1', operationId: 'o1', month: '2026-11', closingDate: '2026-11-05', dueDate: '2026-11-15', chargesCents: 9_000, paidCents: 0, openCents: 9_000, daysToDue: 26, closed: false };
  const alerts = dueAlerts(views, today, 60, { days: [1], overdueReminder: true, invoices: [invoice] });
  assert.ok(alerts.some((a) => a.id === `${e.id}:0:1` && a.date === '2026-10-24'));
  assert.ok(alerts.some((a) => a.id === 'fatura:c1:2026-11:1' && a.date === '2026-11-14'));
  assert.equal(alerts.filter((a) => a.id.startsWith('vencidas:')).length, 7);
  assert.deepEqual(finance.parseAlertDays('7,0,9'), [7, 0]);
  assert.deepEqual(finance.parseAlertDays(''), []);
  assert.deepEqual(finance.parseAlertDays(undefined), [3, 0]);
});
