import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectWorkspace } from '../apps/mobile/src/state/workspace-selectors.ts';
import { createLotSummarizer, summarizeLot } from '../apps/mobile/src/domain/lot-metrics.ts';
import { costEntries, stockLedger, consumptionAllocations, stockPositions } from '../apps/mobile/src/domain/stock.ts';
import { installmentViews, obligations, DEFAULT_CATEGORIES, dueAlerts } from '../apps/mobile/src/domain/finance.ts';
import { formatNumber } from '../apps/mobile/src/domain/format.ts';
import { shiftMonth } from '../apps/mobile/src/domain/dates.ts';
import { shiftMonth as treasuryShiftMonth } from '../apps/mobile/src/domain/treasury.ts';
import { entry, today, workspaceFixture } from './fixtures/workspace.mjs';

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('workspace projections retain member visibility, partner-only finance, farm context and sign-out', () => {
  const snapshot = workspaceFixture();
  for (const key of ['accounts', 'categories', 'counterparties', 'payments', 'supplies', 'movements', 'financings', 'recurrences', 'budgets', 'titles']) {
    snapshot[key].push({ ...snapshot[key][0], id: `foreign-${key}`, operationId: 'o2' });
  }
  // Hidden collections are never processed by finance projections.
  snapshot.recurrences[0].startMonth = '2027-01';
  snapshot.recurrences[0].endMonth = '2026-01';
  snapshot.lots.push({ ...snapshot.lots[0], id: 'foreign-lot', operationId: 'o2', farmId: 'f3' });
  freeze(snapshot);
  const partner = selectWorkspace(snapshot, 'partner', true, today);
  assert.deepEqual([...partner.visibleOperationIds], ['o1', 'o2']);
  assert.deepEqual([...partner.financeOperationIds], ['o1']);
  assert.equal(partner.contextFarm, null);
  assert.equal(partner.lotSummaries.length, 5);
  for (const key of ['accounts', 'payments', 'counterparties', 'movements', 'financings', 'renegotiations', 'recurrences', 'budgets', 'titles', 'financeLots', 'obligationViews']) {
    assert.ok(partner[key].every((row) => row.operationId === 'o1'), key);
  }
  const employee = selectWorkspace(snapshot, 'employee', true, today);
  assert.equal(employee.visibleFarms.length, 2);
  for (const key of ['accounts', 'payments', 'counterparties', 'movements', 'financings', 'renegotiations', 'recurrences', 'budgets', 'titles', 'installments', 'financeLots', 'pendingPurchases']) {
    assert.deepEqual(employee[key], [], key);
  }
  const scoped = selectWorkspace({ ...snapshot, settings: { ...snapshot.settings, contextFarmId: 'f2' } }, 'partner', true, today);
  assert.deepEqual(scoped.lotSummaries.map((s) => s.lot.farmId), ['f2', 'f2']);
  assert.ok(scoped.installments.every((v) => v.farmId === 'f2'));
  const signedOut = selectWorkspace(snapshot, '', true, today);
  assert.deepEqual(signedOut.visibleFarms, []);
  assert.deepEqual(signedOut.installments, []);
  assert.deepEqual(signedOut.activity, []);
});

test('lot indexing preserves approved, pending, rejected, shared allocations and transfers without mutating input', () => {
  const snapshot = workspaceFixture();
  snapshot.entries.push(
    entry('shared', 'despesa', { criterion: 'cabeca', allocations: [{ lotId: 'l0', cents: 11 }, { lotId: 'l1', cents: 12 }, { lotId: 'l0', cents: 13 }] }),
    entry('pending', 'mortalidade', { lotId: 'l0', heads: 3 }, { status: 'aguardando_envio' }),
    entry('rejected', 'venda', { lotId: 'l1', heads: 2 }, { status: 'rejeitado' }),
    entry('sale', 'venda', { lotId: 'l0', heads: 2, carcassKg: 400, pricePerArrobaCents: 30000, deductionsCents: 100 }),
  );
  snapshot.lots[1].transfer = { outgoing: { at: '2026-10-20', destinationLotId: 'l2' } };
  freeze(snapshot);
  const entries = costEntries(snapshot.entries);
  const summarize = createLotSummarizer(snapshot.lots, entries, snapshot.farms, today);
  for (const lot of snapshot.lots) {
    const farm = snapshot.farms.find((f) => f.id === lot.farmId);
    assert.deepEqual(summarize(lot.id), summarizeLot(lot, entries, farm.pastureRentCents, today));
    assert.strictEqual(summarize(lot.id), summarize(lot.id));
  }
  assert.equal(summarize('missing'), undefined);
  const tomorrow = createLotSummarizer(snapshot.lots, entries, snapshot.farms, '2026-10-23');
  assert.notEqual(tomorrow('l0').headDays, summarize('l0').headDays);
  const revised = createLotSummarizer(snapshot.lots, [...entries, entry('death', 'mortalidade', { lotId: 'l0', heads: 1 })], snapshot.farms, today);
  assert.equal(revised('l0').headsCurrent, summarize('l0').headsCurrent - 1);
});

test('stock grouping preserves multi-item purchases, pending previews, transfers and rejected records', () => {
  const snapshot = workspaceFixture();
  snapshot.entries[ snapshot.entries.findIndex((e) => e.id === 'buy0') ].payload.stockItems.push({ supplyId: 's0', quantity: 10, cents: 1500 });
  snapshot.entries.push(
    entry('pending-use', 'consumo', { supplyId: 's0', quantity: 3, criterion: 'cabeca', targets: [{ lotId: 'l0', basis: 1 }] }, { status: 'aguardando_envio' }),
    entry('rejected-use', 'consumo', { supplyId: 's1', quantity: 1, criterion: 'cabeca', targets: [{ lotId: 'l0', basis: 1 }] }, { status: 'rejeitado' }),
    entry('transfer', 'transferencia_estoque', { supplyId: 's1', quantity: 2, toFarmId: 'f2' }),
    entry('loss', 'ajuste_estoque', { supplyId: 's2', delta: -1 }),
  );
  freeze(snapshot);
  const result = costEntries(snapshot.entries);
  for (const e of result) {
    if (e.kind !== 'consumo' && e.kind !== 'ajuste_estoque') continue;
    const ledger = stockLedger(snapshot.entries, e.payload.supplyId, 'confirmado', undefined, e.status === 'aguardando_envio' ? e : undefined);
    const cents = ledger.outflowCents.get(e.id);
    assert.equal(e.derivedCents, cents);
    if (e.kind === 'consumo' && cents !== undefined) assert.deepEqual(e.derivedAllocations, consumptionAllocations(cents, e.payload.targets));
  }
  for (const position of stockPositions(snapshot.supplies, result, ['f1', 'f2'], today)) {
    const ledger = stockLedger(result, position.supply.id, 'confirmado');
    assert.equal(position.qty, ledger.farms.get(position.farmId)?.qty ?? 0);
    assert.equal(position.valueCents, ledger.farms.get(position.farmId)?.value ?? 0);
  }
});

test('payment history keeps order and reversals, counts repeated references once and settles only binding statuses', () => {
  const snapshot = workspaceFixture();
  const first = snapshot.payments[0];
  snapshot.payments.push(
    { ...first, id: 'reversed', status: 'estornado' },
    { ...first, id: 'pending', status: 'aguardando_envio', items: [...first.items, { ...first.items[0], cents: 50 }] },
    { ...first, id: 'conflict', status: 'conflito' },
  );
  freeze(snapshot);
  const views = installmentViews(snapshot.entries, snapshot.payments, today);
  const view = views.find((v) => v.entryId === 'd0' && v.index === 0);
  assert.equal(view.paidCents, 450);
  assert.equal(view.openCents, 150);
  assert.deepEqual(view.payments.map((p) => p.id), ['p0', 'reversed', 'pending', 'conflict']);
  assert.equal(views.find((v) => v.entryId === 'd0' && v.index === 1).payments.length, 0);
  assert.ok(dueAlerts(views, today).length > 0);
  assert.equal(views.find((v) => v.entryId === 'buy0').state, 'vence_hoje');
  assert.equal(installmentViews(snapshot.entries, snapshot.payments, '2026-10-23').find((v) => v.entryId === 'buy0').state, 'vencida');
});

test('purchase installment positions stay within each component in the fixed animals, commission, freight order', () => {
  const { lots } = workspaceFixture();
  const lot = { ...lots[0], purchasePlan: { parts: [
    { kind: 'animais', counterparty: 'Vendedor', installments: [{ dueDate: today, cents: 10 }, { dueDate: today, cents: 20 }] },
    { kind: 'frete', counterparty: 'Frete', installments: [{ dueDate: today, cents: 30 }] },
    { kind: 'comissao', counterparty: 'Corretor', installments: [{ dueDate: today, cents: 40 }] },
  ] } };
  assert.deepEqual(obligations([], DEFAULT_CATEGORIES, [lot]).map((o) => [o.index, o.position, o.count]), [[0, 1, 2], [1, 2, 2], [2, 1, 1], [3, 1, 1]]);
});

test('shared month arithmetic and reused number formatters preserve displayed values', () => {
  assert.strictEqual(treasuryShiftMonth, shiftMonth);
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  for (const decimals of [0, 1, 2, 3]) {
    for (const value of [0, -0, 0.005, -1234.567, 1000000, NaN, Infinity]) {
      assert.equal(formatNumber(value, decimals), new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value));
    }
  }
  assert.throws(() => formatNumber(1, -1), RangeError);
});
