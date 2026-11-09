import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
// Node's TS stripping does not resolve the extensionless imports used by Metro.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') && context.parentURL?.includes('/src/domain/') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const stock = await import('../apps/mobile/src/domain/stock.ts');
const { summarizeLot, monthlyCosts } = await import('../apps/mobile/src/domain/lot-metrics.ts');
const { receive, decide } = await import('../apps/mobile/src/domain/workflow.ts');
const { monthlyInstallments } = await import('../apps/mobile/src/domain/allocation.ts');
const { obligations } = await import('../apps/mobile/src/domain/finance.ts');
const { requiresApproval, approvalBlockReason } = await import('../apps/mobile/src/domain/approval.ts');
const {
  stockLedger, stockConflict, costEntries, consumptionTargets, headsOn, weightOn, headDays, stockPositions, toControlUnits, supplyErrors, formatQty,
} = stock;

const salt = { id: 's1', operationId: 'o1', name: 'Sal mineral', kind: 'sal_mineral', unit: 'saco', conversions: [{ unit: 't', factor: 40 }], minQuantity: 50, active: true, createdAt: '2026-01-01' };
const names = { supply: (id) => (id === salt.id ? salt : undefined), farm: (id) => ({ f1: 'Boa Vista', f2: 'Santa Fé' })[id] };
const lot = (id, heads, purchasedAt = '2026-09-01', extra = {}) => ({ id, code: id, operationId: 'o1', farmId: 'f1', managementGroup: 'P', supplier: '', category: 'Novilhas',
  purchasedAt, headsPurchased: heads, entryWeightKg: 200, purchaseCents: 0, commissionCents: 0, freightCents: 0, ...extra });
const l1 = lot('l1', 60), l2 = lot('l2', 40);
let seq = 0;
const entry = (kind, payload, extra = {}) => ({
  id: `e${++seq}`, kind, status: 'aprovado', operationId: 'o1', farmId: 'f1', authorId: 'u1', title: kind, amountCents: null,
  occurredAt: '2026-10-01', createdAt: `2026-10-01T10:${String(seq).padStart(2, '0')}:00.000Z`, decidedBy: 'u2', decidedAt: null, decisionNote: null,
  pendingDecision: null, pendingDecisionBy: null, pendingDecisionNote: null, conflictReason: null, history: [], payload, ...extra,
});
const purchase = (quantity, cents, extra = {}, farmId = 'f1') => entry('despesa', {
  category: 'Compra de insumos para estoque', description: 'Sal', supplier: 'Casa do Campo', document: '', destination: 'estoque',
  installments: monthlyInstallments(cents, 3, '2026-11-01'), criterion: 'cabeca', allocations: [],
  stockItems: [{ supplyId: salt.id, quantity, cents, purchaseQuantity: quantity / 40, purchaseUnit: 't' }],
}, { amountCents: cents, farmId, ...extra });
const consumption = (quantity, occurredAt, targets, extra = {}) => entry('consumo',
  { supplyId: salt.id, quantity, periodStart: null, criterion: 'cabeca', targets, notes: '' }, { occurredAt, ...extra });
const heads = [{ lotId: 'l1', basis: 60 }, { lotId: 'l2', basis: 40 }];

test('salt truck: 12 t in 3 installments enters the stock and the payables, without any cost in the lots', () => {
  assert.equal(toControlUnits(salt, 12, 't'), 480);
  const truck = purchase(480, 1_200_000, { occurredAt: '2026-10-01' });
  const ledger = stockLedger([truck], salt.id, 'confirmado');
  assert.deepEqual(ledger.farms.get('f1'), { qty: 480, value: 1_200_000 });
  assert.equal(obligations([truck]).length, 3);
  const entries = costEntries([truck]);
  assert.equal(summarizeLot(l1, entries, 0, '2026-10-20').expensesCents, 0);
  assert.equal(monthlyCosts(entries, new Set(['o1']), new Set(['f1']), '2026-10-20').at(-1).cents, 0);
});

test('5 bags a week leave the stock at the average cost and the lots receive exactly that value', () => {
  const truck = purchase(480, 1_200_000);
  const weeks = ['2026-10-07', '2026-10-14'].map((d) => consumption(5, d, heads));
  const entries = costEntries([truck, ...weeks]);
  const used = entries.filter((e) => e.kind === 'consumo');
  assert.deepEqual(used.map((e) => e.derivedCents), [12_500, 12_500]);
  assert.deepEqual(used[0].derivedAllocations.map((a) => a.cents), [7_500, 5_000]);
  assert.equal(stockLedger(entries, salt.id, 'confirmado').farms.get('f1').qty, 470);
  const s1 = summarizeLot(l1, entries, 0, '2026-10-20');
  assert.equal(s1.expensesCents, 15_000);
  assert.equal(s1.expenseItems.length, 2);
  assert.equal(summarizeLot(l2, entries, 0, '2026-10-20').expensesCents, 10_000);
  assert.equal(monthlyCosts(entries, new Set(['o1']), new Set(['f1']), '2026-10-20').at(-1).cents, 25_000);
});

test('weighted average across purchases, and the last unit takes exactly what is left (no cent lost)', () => {
  const first = purchase(3, 1_000, { occurredAt: '2026-10-01' });
  const second = purchase(4, 2_001, { occurredAt: '2026-10-02' });
  const a = consumption(2, '2026-10-03', heads);
  const b = consumption(5, '2026-10-04', heads);
  const ledger = stockLedger([first, second, a, b], salt.id, 'confirmado');
  assert.equal(ledger.outflowCents.get(a.id), Math.round(3_001 * 2 / 7));
  assert.equal(ledger.outflowCents.get(a.id) + ledger.outflowCents.get(b.id), 3_001);
  assert.deepEqual(ledger.farms.get('f1'), { qty: 0, value: 0 });
});

test('consumption above the balance, before the purchase, or contradicting a later one is a conflict', () => {
  const truck = purchase(10, 10_000, { occurredAt: '2026-10-05' });
  assert.match(stockConflict([truck], consumption(11, '2026-10-06', heads), 'reserva', names), /Sal mineral em Boa Vista tinha 10 sacos; o lançamento pede 11 sacos/);
  assert.match(stockConflict([truck], consumption(1, '2026-10-04', heads), 'reserva', names), /Em 04\/10\/2026.*tinha 0 sacos/);
  const later = consumption(10, '2026-10-10', heads);
  // A retroactive consumption that fits on its own date still leaves the later one without stock.
  assert.match(stockConflict([truck, later], consumption(1, '2026-10-06', heads), 'confirmado', names), /Em 10\/10\/2026/);
  assert.equal(stockConflict([truck], consumption(10, '2026-10-06', heads), 'reserva', names), null);
});

test('two devices: pending consumptions reserve the stock, pending purchases do not add to it', () => {
  const truck = purchase(10, 10_000);
  const first = consumption(6, '2026-10-02', heads, { status: 'aguardando_aprovacao' });
  const second = consumption(6, '2026-10-02', heads, { status: 'aguardando_aprovacao' });
  assert.equal(stockConflict([truck, first], second, 'confirmado', names), null);
  assert.match(stockConflict([truck, first], second, 'reserva', names), /tinha 4 sacos/);
  const pendingTruck = purchase(10, 10_000, { status: 'aguardando_aprovacao' });
  assert.match(stockConflict([pendingTruck], consumption(1, '2026-10-02', heads), 'reserva', names), /tinha 0 sacos/);
  // The workflow (local server) marks the second delivery as a conflict.
  const ctx = { lots: [l1, l2], farms: [], memberships: [{ operationId: 'o1', userId: 'u1', role: 'funcionario' }, { operationId: 'o1', userId: 'u2', role: 'socio' }],
    entries: [truck, first], pastures: [], supplies: [salt], today: '2026-10-20', now: '2026-10-20T10:00:00.000Z' };
  assert.equal(receive(ctx, { ...second, status: 'aguardando_envio' }).status, 'conflito');
  assert.equal(receive({ ...ctx, entries: [truck] }, { ...second, status: 'aguardando_envio' }).status, 'aguardando_aprovacao');
  // An employee approves a consumption (field), but never a stock adjustment (needs a partner).
  const adjust = entry('ajuste_estoque', { supplyId: salt.id, delta: -1, reason: 'Saco rasgado' }, { authorId: 'u2' });
  assert.match(approvalBlockReason('u1', adjust, ctx.memberships), /sócio/);
  assert.equal(approvalBlockReason('u2', consumption(1, '2026-10-02', heads), ctx.memberships), null);
  assert.equal(requiresApproval(consumption(1, '2026-10-02', heads), ctx.memberships), true);
  const approved = decide({ ...ctx, entries: [truck] }, { ...second, status: 'aguardando_aprovacao' }, 'u2', 'aprovar', '', true);
  assert.equal(approved.status, 'aprovado');
});

test('transfer between farms keeps the average cost; losses leave the stock and never reach the lots', () => {
  const truck = purchase(10, 10_000);
  const move = entry('transferencia_estoque', { supplyId: salt.id, quantity: 4, toFarmId: 'f2', notes: '' }, { occurredAt: '2026-10-02' });
  const loss = entry('ajuste_estoque', { supplyId: salt.id, delta: -2, reason: 'Molhou' }, { occurredAt: '2026-10-03' });
  const found = entry('ajuste_estoque', { supplyId: salt.id, delta: 1, reason: 'Contagem' }, { occurredAt: '2026-10-04', farmId: 'f2' });
  const entries = costEntries([truck, move, loss, found]);
  const ledger = stockLedger(entries, salt.id, 'confirmado');
  assert.deepEqual(ledger.farms.get('f1'), { qty: 4, value: 4_000 });
  assert.deepEqual(ledger.farms.get('f2'), { qty: 5, value: 5_000 });
  assert.equal(entries.find((e) => e.id === loss.id).derivedCents, 2_000);
  assert.equal(summarizeLot(l1, entries, 0, '2026-10-20').expensesCents, 0);
  // A pending transfer reserves at the origin but has not arrived at the destination.
  const pendingMove = { ...move, id: 'pm', status: 'aguardando_aprovacao' };
  assert.match(stockConflict([truck, pendingMove], entry('consumo', { supplyId: salt.id, quantity: 1, periodStart: null, criterion: 'cabeca', targets: heads, notes: '' }, { farmId: 'f2' }), 'reserva', names), /Santa Fé tinha 0 sacos/);
});

test('allocation basis uses the herd on the consumption date, or head-days over a period', () => {
  const death = entry('mortalidade', { lotId: 'l1', heads: 10, cause: '', notes: '' }, { occurredAt: '2026-10-10' });
  const late = lot('l3', 30, '2026-10-12');
  assert.equal(headsOn(l1, [death], '2026-10-09'), 60);
  assert.equal(headsOn(l1, [death], '2026-10-10'), 50);
  assert.equal(headsOn(late, [], '2026-10-11'), 0);
  assert.equal(headDays(l1, [death], '2026-10-08', '2026-10-11'), 60 + 60 + 50 + 50);
  const day = consumptionTargets([l1, l2, late], [death], 'cabeca', '2026-10-10', null, {});
  assert.deepEqual(day, { targets: [{ lotId: 'l1', basis: 50 }, { lotId: 'l2', basis: 40 }], error: null });
  const period = consumptionTargets([l1, late], [death], 'cabeca', '2026-10-13', '2026-10-11', {});
  assert.deepEqual(period.targets, [{ lotId: 'l1', basis: 150 }, { lotId: 'l3', basis: 60 }]);
  assert.match(consumptionTargets([l1, l2], [], 'manual', '2026-10-10', null, { l1: 70, l2: 20 }).error, /somam 90%/);
  assert.match(consumptionTargets([late], [], 'cabeca', '2026-10-01', null, {}).error, /Nenhum lote/);
  assert.match(consumptionTargets([l1], [], 'cabeca', '2026-10-01', '2026-10-05', {}).error, /período/);
  assert.deepEqual(consumptionTargets([l1], [], 'peso', '2026-10-10', null, {}).targets, [{ lotId: 'l1', basis: 12_000 }]);
});

test('stock positions: balance, value, average cost, days left from the last 30 days and the low alert', () => {
  const truck = purchase(100, 250_000, { occurredAt: '2026-09-01' });
  const used = ['2026-10-01', '2026-10-08', '2026-10-15'].map((d) => consumption(10, d, heads));
  const pending = consumption(5, '2026-10-19', heads, { status: 'aguardando_aprovacao' });
  const [pos] = stockPositions([salt], [truck, ...used, pending], ['f1'], '2026-10-20');
  assert.equal(pos.qty, 70);
  assert.equal(pos.valueCents, 175_000);
  assert.equal(pos.avgCostCents, 2_500);
  assert.equal(pos.dailyUse, 1);
  assert.equal(pos.daysLeft, 70);
  assert.equal(pos.reserved, 5);
  assert.equal(pos.available, 65);
  assert.equal(pos.low, false);
  assert.equal(stockPositions([{ ...salt, minQuantity: 70 }], [truck, ...used], ['f1'], '2026-10-20')[0].low, true);
});

test('head-days include both endpoints, stop on the transfer date and honor same-day approved changes', () => {
  const origin = lot('origin', 10, '2024-02-28', { transfer: { outgoing: { at: '2024-03-03' } } });
  const events = [
    entry('mortalidade', { lotId: origin.id, heads: 1 }, { occurredAt: '2024-02-29', createdAt: '2024-03-01T08:00:00Z' }),
    entry('venda', { lotId: origin.id, heads: 3 }, { occurredAt: '2024-02-29', createdAt: '2024-03-01T09:00:00Z' }),
    entry('mortalidade', { lotId: origin.id, heads: 4 }, { occurredAt: '2024-03-01', status: 'aguardando_aprovacao' }),
    entry('mortalidade', { lotId: origin.id, heads: 3 }, { occurredAt: '2024-03-02', status: 'rejeitado' }),
    entry('mortalidade', { lotId: 'another', heads: 8 }, { occurredAt: '2024-03-01' }),
    entry('pesagem', { lotId: origin.id, avgWeightKg: 250 }, { occurredAt: '2024-03-01' }),
  ];
  assert.equal(headDays(origin, events, '2024-02-27', '2024-03-04'), 10 + 6 + 6 + 6);
  assert.equal(headDays(origin, events, '2024-02-29', '2024-02-29'), 6);
  assert.equal(headDays(origin, events, '2024-03-03', '2024-03-04'), 0);
  assert.equal(headDays(origin, events, '2024-03-02', '2024-03-01'), 0);
  assert.equal(headsOn(origin, events, '2024-03-03'), 0);
  assert.equal(weightOn(origin, events, '2024-03-03'), 250);
  assert.equal(weightOn(origin, events, '2024-02-27'), 0);
});

test('historical allocation matches chronological lot reconstruction across dates, statuses and weight ties', async () => {
  const { addDays } = await import('../apps/mobile/src/domain/dates.ts');
  const lots = [lot('first', 25, '2026-09-01'), lot('late', 12, '2026-09-10'),
    lot('moved', 20, '2026-09-01', { transfer: { outgoing: { at: '2026-09-22' } } })];
  const events = lots.flatMap((l, i) => [
    entry('mortalidade', { lotId: l.id, heads: i + 1 }, { occurredAt: '2026-09-11' }),
    entry('venda', { lotId: l.id, heads: 4, carcassKg: 800, pricePerArrobaCents: 30000, deductionsCents: 100 }, { occurredAt: '2026-09-15' }),
    entry('pesagem', { lotId: l.id, avgWeightKg: 220, method: 'medido', headsWeighed: 5 }, { occurredAt: '2026-09-16', createdAt: '2026-09-16T08:00:00Z' }),
    entry('pesagem', { lotId: l.id, avgWeightKg: 230, method: 'estimado', headsWeighed: 5 }, { occurredAt: '2026-09-16', createdAt: '2026-09-16T08:00:00Z' }),
    entry('mortalidade', { lotId: l.id, heads: 2 }, { occurredAt: '2026-09-17', status: 'conflito' }),
    entry('pesagem', { lotId: l.id, avgWeightKg: 300 }, { occurredAt: '2026-09-18', status: 'aguardando_envio' }),
    entry('mortalidade', { lotId: l.id, heads: 2 }, { occurredAt: '2026-10-01' }),
  ]).reverse();
  const serialized = JSON.stringify({ lots, events });
  const legacy = (l, date) => date < l.purchasedAt ? { headsCurrent: 0, lastWeighing: { kg: 0 } }
    : summarizeLot(l, events.filter((e) => e.occurredAt <= date), 0, date);
  for (const l of lots) {
    for (let end = '2026-08-30'; end <= '2026-10-02'; end = addDays(end, 1)) {
      const summary = legacy(l, end);
      assert.equal(headsOn(l, events, end), summary.headsCurrent, `${l.id} heads ${end}`);
      assert.equal(weightOn(l, events, end), summary.lastWeighing.kg, `${l.id} weight ${end}`);
      let expected = 0;
      for (let day = '2026-08-30'; day <= end; day = addDays(day, 1)) expected += legacy(l, day).headsCurrent;
      assert.equal(headDays(l, events, '2026-08-30', end), expected, `${l.id} head-days ${end}`);
    }
  }
  const expectedTargets = lots.map((l) => ({ lotId: l.id, basis: Math.round(legacy(l, '2026-09-20').headsCurrent * legacy(l, '2026-09-20').lastWeighing.kg) }));
  assert.deepEqual(consumptionTargets(lots, events, 'peso', '2026-09-20', null, {}).targets, expectedTargets);
  assert.equal(JSON.stringify({ lots, events }), serialized);
});

test('supply validation and quantity formatting', () => {
  const ok = { name: 'Proteinado', kind: 'proteinado', unit: 'saco', conversions: [{ unit: 'kg', factor: 0.04 }], minQuantity: null, active: true };
  assert.equal(supplyErrors(ok, [salt]), null);
  assert.match(supplyErrors({ ...ok, name: ' sal MINERAL' }, [salt]), /Já existe/);
  assert.match(supplyErrors({ ...ok, conversions: [{ unit: 'saco', factor: 2 }] }, []), /outra unidade/);
  assert.match(supplyErrors({ ...ok, conversions: [{ unit: 't', factor: 0 }] }, []), /maior que zero/);
  assert.equal(toControlUnits(salt, 3, 'kg'), null);
  assert.equal(formatQty(1, 'saco'), '1 saco');
  assert.equal(formatQty(2.5, 'saco'), '2,5 sacos');
});
