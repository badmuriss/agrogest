import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardInvoices, DEFAULT_CATEGORIES, installmentViews } from '../apps/mobile/src/domain/finance.ts';
import { spending, spendingDetails } from '../apps/mobile/src/domain/reports.ts';
import { assertCostCenter, validateCostCenter } from '../apps/mobile/src/domain/cost-centers.ts';
import { selectWorkspace } from '../apps/mobile/src/state/workspace-selectors.ts';
import { entry, workspaceFixture } from './fixtures/workspace.mjs';

const centers = [
  { id: 'hydro', operationId: 'o1', name: 'Hidráulica', parentId: null, isGroup: true, active: true, version: 1 },
  { id: 'wheel', operationId: 'o1', name: 'Roda d’água', parentId: 'hydro', isGroup: false, active: true, version: 1 },
  { id: 'tank', operationId: 'o1', name: 'Tanque', parentId: 'hydro', isGroup: false, active: true, version: 1 },
  { id: 'pasture', operationId: 'o1', name: 'Reforma de pastagens', parentId: null, isGroup: false, active: true, version: 1 },
];
const expense = (id, cents, categoryId, center, extra = {}) => entry(id, 'despesa', {
  categoryId, category: DEFAULT_CATEGORIES.find((c) => c.id === categoryId)?.name ?? 'Outros', costCenterId: center,
  description: id, supplier: 'Oficina', document: '', criterion: 'cabeca', allocations: [],
  installments: [{ dueDate: '2026-10-20', cents }],
}, { amountCents: cents, ...extra });
const period = { from: '2026-10-01', to: '2026-10-31' };
const payment = (id, items, extra = {}) => ({ id, operationId: 'o1', direction: 'pagar', accountId: 'bank', paidAt: '2026-10-20',
  status: 'efetivado', items, interestCents: 0, fineCents: 0, discountCents: 0, ...extra });
function book(entries, extra = {}) {
  const b = { entries, categories: DEFAULT_CATEGORIES, lots: [], farmIds: new Set(['f1']), operationIds: new Set(['o1']),
    payments: [], renegotiations: [], costCenters: centers, costClassifications: [], ...extra };
  b.views = installmentViews(entries, b.payments, '2026-10-27', b.categories, [], { renegotiations: b.renegotiations });
  return b;
}
const total = (rows) => rows.reduce((sum, r) => sum + r.cents, 0);

test('issue example: Roda 650, pastagens 400, mão de obra 700; no duplicate parent/child or financial records', () => {
  const entries = [expense('labor-wheel', 30000, 'cat-mao-de-obra', 'wheel'), expense('parts', 15000, 'cat-outros', 'wheel'),
    expense('repair', 20000, 'cat-outros', 'wheel'), expense('labor-pasture', 40000, 'cat-mao-de-obra', 'pasture')];
  const original = structuredClone(entries);
  const b = book(entries);
  assert.equal(spending(b, period, 'centro').find((r) => r.key === 'wheel').cents, 65000);
  assert.equal(spending(b, period, 'centro').find((r) => r.key === 'pasture').cents, 40000);
  assert.equal(spending(b, period, 'categoria').find((r) => r.key === 'cat-mao-de-obra').cents, 70000);
  assert.equal(spending(b, period, 'agrupamento').find((r) => r.key === 'hydro').cents, 65000);
  for (const dimension of ['categoria', 'centro', 'agrupamento', 'categoria_centro', 'fornecedor', 'lote']) {
    assert.equal(total(spending(b, period, dimension)), 105000, dimension);
  }
  assert.equal(total(spending(b, period, 'categoria', { categoryId: 'cat-mao-de-obra', costCenterId: 'hydro' })), 30000);
  assert.deepEqual(spendingDetails(b, period, { costCenterId: 'wheel' }).map((d) => d.entryId).sort(), ['labor-wheel', 'parts', 'repair']);
  assert.deepEqual(entries, original);
});

test('unclassified history, previous period, combined farm/category/center filters and inactive references', () => {
  const entries = [expense('old', 1000, 'cat-mao-de-obra', null), expense('previous', 2000, 'cat-mao-de-obra', 'wheel', { occurredAt: '2026-09-10' }),
    expense('other-farm', 9000, 'cat-mao-de-obra', 'wheel', { farmId: 'f2' }),
    expense('foreign', 9000, 'cat-mao-de-obra', 'wheel', { operationId: 'o2' }), expense('pending', 9000, 'cat-mao-de-obra', 'wheel', { status: 'aguardando_aprovacao' })];
  const b = book(entries, { costCenters: centers.map((c) => ({ ...c, active: false })) });
  const rows = spending(b, period, 'centro');
  assert.equal(rows.find((r) => r.key === 'sem-centro').cents, 1000);
  assert.equal(rows.find((r) => r.key === 'wheel').previousCents, 2000);
  b.costClassifications = [{ id: 'old', operationId: 'o1', costCenterId: 'wheel', history: [], version: 1 }];
  assert.equal(total(spending(b, period, 'centro', { categoryId: 'cat-mao-de-obra', costCenterId: 'hydro' })), 1000);
  assert.equal(total(spending(b, period, 'centro', { costCenterId: '' })), 0);
  b.costClassifications[0].costCenterId = null;
  assert.equal(total(spending(b, period, 'centro', { costCenterId: '' })), 1000);
});

test('cash uses partial settlements and proportionate extras, never unpaid installments or reversed/conflicting payments', () => {
  const a = expense('a', 10000, 'cat-mao-de-obra', 'wheel');
  const b = expense('b', 20000, 'cat-outros', 'tank', { farmId: 'f2' });
  const payments = [payment('p1', [{ entryId: 'a', index: 0, cents: 3000 }, { entryId: 'b', index: 0, cents: 6000 }], { interestCents: 900, fineCents: 90, discountCents: 300 }),
    payment('p2', [{ entryId: 'a', index: 0, cents: 2000 }], { paidAt: '2026-11-01' }),
    payment('reversed', [{ entryId: 'a', index: 0, cents: 999 }], { status: 'estornado' }),
    payment('conflict', [{ entryId: 'a', index: 0, cents: 999 }], { status: 'conflito' })];
  const ledger = book([a, b], { payments });
  assert.equal(total(spending(ledger, period, 'centro')), 10000);
  assert.equal(total(spending(ledger, period, 'centro', { basis: 'caixa' })), 3230);
  ledger.farmIds.add('f2');
  assert.equal(total(spending(ledger, period, 'centro', { basis: 'caixa' })), 9690);
  const november = { from: '2026-11-01', to: '2026-11-30' };
  assert.equal(total(spending(ledger, november, 'centro', { basis: 'caixa' })), 2000);
  assert.equal(total(spending(ledger, november, 'centro')), 0);
});

test('cash from renegotiated expenses remains attributable to each original center without duplication', () => {
  const entries = [expense('a', 10000, 'cat-mao-de-obra', 'wheel'), expense('b', 20000, 'cat-outros', 'tank')];
  const renegotiations = [{ id: 'r', operationId: 'o1', direction: 'pagar', status: 'efetivado',
    items: [{ entryId: 'a', index: 0, settledCents: 0 }, { entryId: 'b', index: 0, settledCents: 0 }],
    installments: [{ dueDate: '2026-10-30', cents: 33000 }], createdAt: '2026-10-15' }];
  const b = book(entries, { renegotiations, payments: [payment('p', [{ entryId: 'r', index: 0, cents: 9900 }])] });
  const rows = spending(b, period, 'centro', { basis: 'caixa' });
  assert.equal(total(rows), 9900);
  assert.equal(rows.find((r) => r.key === 'wheel').cents, 3300);
  assert.equal(rows.find((r) => r.key === 'tank').cents, 6600);
});

test('local access mirrors partner-only backend; inactive and foreign centers cannot be selected', () => {
  const snapshot = workspaceFixture(0, 0);
  snapshot.costCenters = centers;
  snapshot.costClassifications = [{ id: 'old', operationId: 'o1', costCenterId: 'wheel', history: [], version: 1 }];
  assert.equal(selectWorkspace(snapshot, 'partner', false, '2026-10-27').costCenters.length, 4);
  assert.deepEqual(selectWorkspace(snapshot, 'employee', false, '2026-10-27').costCenters, []);
  assert.deepEqual(selectWorkspace(snapshot, 'employee', false, '2026-10-27').costClassifications, []);
  assert.throws(() => assertCostCenter(centers, 'o2', 'wheel'), /desta operação/);
  assert.throws(() => assertCostCenter(centers.map((c) => ({ ...c, active: false })), 'o1', 'wheel'), /inativo/);
  assert.throws(() => validateCostCenter({ ...centers[1], parentId: null }, centers, centers[1]), /agrupamento é fixo/);
});

test('nested renegotiations retain non-expense shares and rounding reconciles exactly', () => {
  const entries = [expense('a', 10000, 'cat-mao-de-obra', 'wheel'), expense('b', 10000, 'cat-outros', 'tank')];
  const renegotiations = [
    { id: 'r1', operationId: 'o1', items: [{ entryId: 'a', index: 0, settledCents: 0 }, { entryId: 'imported', index: 0, settledCents: 0 }] },
    { id: 'r2', operationId: 'o1', items: [{ entryId: 'r1', index: 0, settledCents: 3000 }, { entryId: 'b', index: 0, settledCents: 0 }] },
  ];
  const b = book(entries, { payments: [payment('p', [{ entryId: 'r2', index: 0, cents: 40000 }])] });
  b.renegotiations = renegotiations;
  b.views = [
    { entryId: 'a', index: 0, originalCents: 10000, cents: 0 },
    { entryId: 'imported', index: 0, originalCents: 20000, cents: 0 },
    { entryId: 'r1', index: 0, originalCents: 33000, cents: 3000 },
    { entryId: 'b', index: 0, originalCents: 10000, cents: 0 },
  ];
  const rows = spending(b, period, 'centro', { basis: 'caixa' });
  assert.equal(total(rows), 20000, 'the other 20000 belongs to an imported balance, not a new expense');
  assert.equal(rows.find((r) => r.key === 'wheel').cents, 10000);
  assert.equal(rows.find((r) => r.key === 'tank').cents, 10000);
});

test('card purchases become cash spending only on actual partial invoice payments, preserving opening debt and farm scope', () => {
  const entries = [expense('a', 10000, 'cat-mao-de-obra', 'wheel', { occurredAt: '2026-09-20' }),
    expense('b', 20000, 'cat-outros', 'tank', { occurredAt: '2026-09-20', farmId: 'f2' })];
  const bank = { id: 'bank', operationId: 'o1', kind: 'corrente' };
  const card = { id: 'card', operationId: 'o1', kind: 'cartao', closingDay: 5, dueDay: 15,
    openingBalanceCents: -6000, openingDate: '2026-09-20' };
  const payments = [payment('charge-a', [{ entryId: 'a', index: 0, cents: 10000 }], { accountId: 'card', paidAt: '2026-09-20' }),
    payment('charge-b', [{ entryId: 'b', index: 0, cents: 20000 }], { accountId: 'card', paidAt: '2026-09-20' })];
  const b = book(entries, { accounts: [bank, card], payments, movements: [] });
  assert.equal(total(spending(b, period, 'centro', { basis: 'caixa' })), 0, 'charging the card does not spend cash');
  const transfer = (id, cents, occurredAt) => ({ id, cents, occurredAt, createdAt: occurredAt, operationId: 'o1', status: 'efetivado',
    kind: 'transferencia', fromAccountId: 'bank', toAccountId: 'card', invoiceMonth: '2026-10' });
  b.movements = [transfer('first', 9000, '2026-10-15'), transfer('second', 27000, '2026-11-15'),
    { ...transfer('reversed', 9000, '2026-10-20'), status: 'estornado' }];
  b.invoices = cardInvoices(card, payments, b.movements, '2026-11-20');
  assert.equal(total(spending(b, period, 'centro', { basis: 'caixa' })), 2500);
  b.farmIds.add('f2');
  assert.equal(total(spending(b, period, 'centro', { basis: 'caixa' })), 7500);
  assert.equal(total(spending(b, { from: '2026-11-01', to: '2026-11-30' }, 'centro', { basis: 'caixa' })), 22500);
  assert.equal(total(spending(b, { from: '2026-09-01', to: '2026-09-30' }, 'centro', { basis: 'caixa' })), 0);
  assert.deepEqual(spendingDetails(b, period, { basis: 'caixa' }).map((d) => d.movementId), ['first', 'first']);
});

test('invoice partial cents reconcile per original expense; partner reimbursement never repeats supplier spending', () => {
  const a = expense('a', 1, 'cat-mao-de-obra', 'wheel'), b = expense('b', 1, 'cat-outros', 'tank');
  const card = { id: 'card', operationId: 'o1', kind: 'cartao', closingDay: 5, dueDay: 15, openingBalanceCents: 0, openingDate: '2026-09-01' };
  const bank = { id: 'bank', operationId: 'o1', kind: 'corrente' };
  const charge = payment('charge', [{ entryId: 'a', index: 0, cents: 1 }, { entryId: 'b', index: 0, cents: 1 }], { accountId: 'card', paidAt: '2026-09-20' });
  const movements = ['2026-10-10', '2026-10-20'].map((date, i) => ({ id: `invoice-${i}`, operationId: 'o1', kind: 'transferencia',
    status: 'efetivado', fromAccountId: 'bank', toAccountId: 'card', invoiceMonth: '2026-10', cents: 1, occurredAt: date, createdAt: date }));
  const ledger = book([a, b], { payments: [charge], accounts: [bank, card], movements, invoices: cardInvoices(card, [charge], movements, '2026-10-27') });
  const rows = spending(ledger, period, 'centro', { basis: 'caixa' });
  assert.equal(rows.find((r) => r.key === 'wheel').cents, 1);
  assert.equal(rows.find((r) => r.key === 'tank').cents, 1);
  ledger.payments = [payment('own-money', [{ entryId: 'a', index: 0, cents: 1 }], { accountId: null, partnerId: 'partner', partnerMode: 'reembolso' }),
    payment('refund', [{ entryId: 'own-money', index: 0, cents: 1 }])];
  ledger.movements = [];
  assert.equal(total(spending(ledger, period, 'centro', { basis: 'caixa' })), 1);
});
