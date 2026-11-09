import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
// Node's TS stripping does not resolve the extensionless imports used by Metro.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') && context.parentURL?.includes('/src/domain/') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const pasture = await import('../apps/mobile/src/domain/pasture.ts');
const { receive, decide } = await import('../apps/mobile/src/domain/workflow.ts');
const { summarizeLot } = await import('../apps/mobile/src/domain/lot-metrics.ts');
const { prepareLotTransfer } = await import('../apps/mobile/src/domain/lot-transfer.ts');
const { lotEditLimits } = await import('../apps/mobile/src/domain/lot-edit.ts');

const {
  pastureKey, legacyPastureId, pastureErrors, pastureConflict, lotPastureEvents, lotPastureTimeline,
  lotTimelines, buildPastureReports, NO_FILTER, RESERVING, CONFIRMED, segmentIntervals,
} = pasture;

const P1 = 'p1', P2 = 'p2', P3 = 'p3';
const pastures = [
  { id: P1, farmId: 'f1', operationId: 'o1', name: 'Pasto 01', areaHa: 20, forage: 'Brachiaria', notes: '', active: true, createdAt: '2026-01-01' },
  { id: P2, farmId: 'f1', operationId: 'o1', name: 'Pasto 02', areaHa: 10, forage: 'Mombaça', notes: '', active: true, createdAt: '2026-01-01' },
  { id: P3, farmId: 'f1', operationId: 'o1', name: 'Pasto 03', areaHa: 5, forage: 'brachiaria', notes: '', active: true, createdAt: '2026-01-01' },
];
const name = (id) => pastures.find((p) => p.id === id)?.name ?? 'O pasto';
const lot = { id: 'lot', farmId: 'f1', operationId: 'o1', code: '001', managementGroup: 'Pasto 01', pastureId: P1, supplier: '', category: 'Novilhas',
  purchasedAt: '2026-01-01', headsPurchased: 40, entryWeightKg: 200, purchaseCents: 1_000_000, commissionCents: 0, freightCents: 0 };
let seq = 0;
const at = (date) => `${date}T12:00:${String(seq++).padStart(2, '0')}.000Z`;
const move = (date, from, to, heads, status = 'aprovado', id = `m${seq}`) =>
  ({ id, kind: 'manejo', status, occurredAt: date, createdAt: at(date), payload: { lotId: 'lot', fromPastureId: from, toPastureId: to, heads, notes: '' } });
const weigh = (date, kg, pastureId, headsWeighed, method = 'medido', id = `w${seq}`) =>
  ({ id, kind: 'pesagem', status: 'aprovado', occurredAt: date, createdAt: at(date), payload: { lotId: 'lot', method, avgWeightKg: kg, headsWeighed, notes: '', pastureId } });
const loss = (date, heads, pastureId, id = `d${seq}`) =>
  ({ id, kind: 'mortalidade', status: 'aprovado', occurredAt: date, createdAt: at(date), payload: { lotId: 'lot', heads, cause: 'Doença', notes: '', pastureId } });

test('legacy pasture ids are stable md5 UUIDs of farm and normalized name', () => {
  assert.equal(pastureKey('  Pasto   do Córrego '), 'pasto do corrego');
  assert.equal(pastureKey('PIQUETE Ã'), 'piquete a');
  const farm = '7d9f8a8e-0f43-4d43-9c55-1a2b3c4d5e6f';
  for (const label of ['Pasto do Córrego', 'pasto do corrego', ' PASTO DO CÓRREGO ']) {
    const hex = createHash('md5').update(`${farm}:pasto do corrego`, 'utf8').digest('hex');
    assert.equal(legacyPastureId(farm, label), `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
  }
  // Long and non-ASCII inputs exercise padding and multi-block hashing.
  const long = 'Retiro São João '.repeat(9);
  const hex = createHash('md5').update(`${farm}:${pastureKey(long)}`, 'utf8').digest('hex');
  assert.equal(legacyPastureId(farm, long).replaceAll('-', ''), hex);
  assert.equal(legacyPastureId(farm, ''), legacyPastureId(farm, 'Pasto principal'));
});

test('pasture validation requires name, positive area and forage, and rejects duplicate names in the farm', () => {
  const ok = { name: 'Pasto 04', areaHa: 12.5, forage: 'Brachiaria', notes: '', active: true };
  assert.deepEqual(pastureErrors(ok, pastures), {});
  assert.match(pastureErrors({ ...ok, name: ' pasto  01 ' }, pastures).name, /Já existe/);
  assert.match(pastureErrors({ ...ok, name: '  ' }, pastures).name, /nome/);
  assert.ok(pastureErrors({ ...ok, areaHa: 0 }, pastures).areaHa);
  assert.ok(pastureErrors({ ...ok, areaHa: null }, pastures).areaHa);
  assert.ok(pastureErrors({ ...ok, forage: '' }, pastures).forage);
});

test('partial and total moves keep lot heads, cost and history while groups change pasture', () => {
  const entries = [move('2026-02-01', P1, P2, 15), move('2026-03-01', P2, P3, 15)];
  const timeline = lotPastureTimeline(lot, lotPastureEvents('lot', entries, CONFIRMED), name);
  assert.equal(timeline.error, null);
  assert.deepEqual(Object.fromEntries(timeline.heads), { [P1]: 25, [P3]: 15 });
  const summary = summarizeLot(lot, entries, 0, '2026-04-01');
  assert.equal(summary.headsCurrent, 40);
  assert.equal(summary.remainingCostCents, 1_000_000);
  assert.equal(summary.sales.length, 0);
  assert.deepEqual(timeline.events.filter((e) => e.pastureId === P2).map((e) => [e.type, e.heads]), [['chegada', 15], ['saida', 15]]);
});

test('moves above the pasture balance, to the same pasture, before entry or contradicting later records conflict', () => {
  const base = [move('2026-02-01', P1, P2, 30)];
  assert.match(pastureConflict(lot, base, move('2026-02-02', P1, P2, 11, 'aguardando_envio'), CONFIRMED, name), /Pasto 01 tem 10 cabeças/);
  assert.equal(pastureConflict(lot, base, move('2026-02-02', P1, P2, 10, 'aguardando_envio'), CONFIRMED, name), null);
  assert.match(pastureConflict(lot, base, move('2026-02-02', P2, P2, 1, 'aguardando_envio'), CONFIRMED, name), /diferente/);
  assert.match(pastureConflict(lot, base, move('2025-12-31', P1, P2, 1, 'aguardando_envio'), CONFIRMED, name), /anterior à entrada/);
  // Retroactive move: emptying Pasto 02 before the later recorded move from it is impossible.
  assert.match(pastureConflict(lot, [move('2026-03-01', P1, P2, 40), move('2026-04-01', P2, P3, 40)],
    move('2026-03-15', P2, P1, 5, 'aguardando_envio'), CONFIRMED, name), /Pasto 02 tem 35/);
  // The number of head weighed never makes a weighing conflict (pending deaths may reserve heads).
  assert.equal(pastureConflict(lot, [loss('2026-02-01', 1, P1)], weigh('2026-02-02', 230, null, 40), CONFIRMED, name), null);
  // Death charged to an explicit pasture must fit that group.
  assert.match(pastureConflict(lot, base, loss('2026-02-03', 11, P1), CONFIRMED, name), /Pasto 01 tem 10/);
});

test('two devices reserving the same heads: the second delivery conflicts, the first approves', () => {
  const memberships = [{ operationId: 'o1', userId: 'a', role: 'socio' }, { operationId: 'o1', userId: 'b', role: 'funcionario' }];
  const ctx = { lots: [lot], farms: [], memberships, pastures, today: '2026-02-10', now: '2026-02-10T12:00:00Z', entries: [] };
  const first = { ...move('2026-02-05', P1, P2, 30, 'aguardando_envio', 'first'), authorId: 'a', operationId: 'o1', history: [] };
  const second = { ...move('2026-02-05', P1, P3, 30, 'aguardando_envio', 'second'), authorId: 'b', operationId: 'o1', history: [] };
  const received = receive({ ...ctx, entries: [first, second] }, first);
  assert.equal(received.status, 'aguardando_aprovacao');
  const conflict = receive({ ...ctx, entries: [received, second] }, second);
  assert.equal(conflict.status, 'conflito');
  assert.match(conflict.conflictReason, /Pasto 01 tem 10/);
  const approved = decide({ ...ctx, entries: [received, conflict] }, received, 'b', 'aprovar', '', true);
  assert.equal(approved.status, 'aprovado');
  assert.equal(pastureConflict(lot, [approved], null, RESERVING, name), null);
  // A sole partner's move is effective immediately, still validated.
  const solo = receive({ ...ctx, memberships: [memberships[0]], entries: [first] }, first);
  assert.equal(solo.status, 'aprovado');
});

test('GMD is attributed only to weighings of the same group in the same pasture', () => {
  const entries = [
    weigh('2026-01-31', 230, P1, 40),
    // Whole group weighed and moved the same day: the weighing opens the new stay.
    move('2026-01-31', P1, P2, 40),
    weigh('2026-03-02', 260, P2, 40),
    // Partial move: composition changes, so the next interval starts fresh.
    move('2026-03-02', P2, P3, 10),
    weigh('2026-04-01', 290, P2, 30, 'estimado'),
    weigh('2026-04-01', 275, P3, 10),
  ];
  const timeline = lotPastureTimeline(lot, lotPastureEvents('lot', entries, CONFIRMED), name);
  assert.equal(timeline.error, null);
  const intervals = timeline.segments.flatMap(segmentIntervals);
  assert.deepEqual(intervals.map((i) => [i.pastureId, i.from, i.to, i.heads, i.gmdKg]), [
    [P1, '2026-01-01', '2026-01-31', 40, 1],
    [P2, '2026-01-31', '2026-03-02', 40, 1],
  ]);
  const result = buildPastureReports({ pastures, lots: [lot], timelines: lotTimelines([lot], entries, name), today: '2026-04-10', filter: NO_FILTER });
  const report = (id) => result.reports.find((r) => r.pastureId === id);
  assert.equal(report(P1).gmd.gmdKg, 1);
  assert.equal(report(P2).gmd.gmdKg, 1);
  // Pasto 03 received part of the group with no weighing at arrival: no attributable gain.
  assert.equal(report(P3).gmd, null);
  assert.match(report(P3).insufficient, /Faltam duas pesagens/);
  assert.equal(report(P2).currentHeads, 30);
  assert.equal(report(P1).headsPerHa, 0);
  assert.equal(report(P2).headsPerHa, 3);
  // Head-days: Pasto 01 had 40 heads for 30 days.
  assert.equal(report(P1).headDays, 1200);
  // Forage comparison groups "Brachiaria" pastures regardless of case.
  assert.deepEqual(result.byForage.map((f) => f.label), ['Brachiaria', 'Mombaça']);
});

test('pasture status: occupied since the current lots arrived, resting since the last exit, or never used', () => {
  const entries = [move('2026-01-31', P1, P2, 40), move('2026-03-02', P2, P3, 10)];
  const result = buildPastureReports({ pastures, lots: [lot], timelines: lotTimelines([lot], entries, name), today: '2026-04-10', filter: NO_FILTER });
  const status = (id) => pasture.pastureStatus(result.reports.find((r) => r.pastureId === id), '2026-04-10');
  assert.deepEqual(status(P1), { kind: 'descanso', since: '2026-01-31', days: 69 });
  assert.deepEqual(status(P2), { kind: 'ocupado', since: '2026-01-31', days: 69 });
  assert.deepEqual(status(P3), { kind: 'ocupado', since: '2026-03-02', days: 39 });
  assert.deepEqual(pasture.pastureStatus({ currentHeads: 0, stays: [] }, '2026-04-10'), { kind: 'nunca' });
});

test('a pasture can be deleted only while no lot or entry of any status uses it', () => {
  const others = { id: 'lot2', pastureId: P2 };
  assert.equal(pasture.pastureInUse(P3, [lot, others], []), false);
  assert.equal(pasture.pastureInUse(P2, [lot, others], []), true);
  assert.equal(pasture.pastureInUse(P3, [lot], [move('2026-02-01', P1, P3, 5, 'rascunho')]), true);
  assert.equal(pasture.pastureInUse(P3, [lot], [loss('2026-02-01', 1, P3)]), true);
  assert.equal(pasture.pastureInUse(P3, [lot], [weigh('2026-02-01', 250, P1, 40)]), false);
});

test('estimates are flagged, measured-only and period filters can leave "insufficient data"', () => {
  const entries = [weigh('2026-02-01', 230, P1, 40, 'estimado'), weigh('2026-03-03', 262, P1, 20)];
  const timelines = lotTimelines([lot], entries, name);
  const all = buildPastureReports({ pastures, lots: [lot], timelines, today: '2026-04-01', filter: NO_FILTER }).reports.find((r) => r.pastureId === P1);
  assert.equal(all.gmd.estimated, true);
  assert.equal(all.gmd.sample, true);
  const measured = buildPastureReports({ pastures, lots: [lot], timelines, today: '2026-04-01', filter: { ...NO_FILTER, measuredOnly: true } }).reports.find((r) => r.pastureId === P1);
  assert.equal(measured.gmd, null);
  assert.match(measured.insufficient, /estimativas/);
  const period = buildPastureReports({ pastures, lots: [lot], timelines, today: '2026-04-01', filter: { ...NO_FILTER, from: '2026-02-15', to: '2026-03-01' } }).reports.find((r) => r.pastureId === P1);
  assert.equal(period.gmd, null);
  assert.match(period.insufficient, /período/);
  assert.equal(period.headDays, 40 * 15);
  const other = buildPastureReports({ pastures, lots: [lot], timelines, today: '2026-04-01', filter: { ...NO_FILTER, category: 'Bois' } }).reports.find((r) => r.pastureId === P1);
  assert.equal(other.currentHeads, 0);
});

test('a whole-lot weighing while split is not attributed, and a transferred entry weight is not a base', () => {
  const entries = [move('2026-02-01', P1, P2, 20), { ...weigh('2026-03-01', 250, null, 40) }];
  const timeline = lotPastureTimeline(lot, lotPastureEvents('lot', entries, CONFIRMED), name);
  assert.equal(timeline.unattributed, 1);
  const received = { ...lot, id: 'received', transfer: { incoming: { sourceLotId: 'x', farmId: 'f0', farmName: 'Origem', at: '2026-01-01', weightMethod: 'medido' } } };
  const inherited = lotPastureTimeline(received, [], name);
  assert.equal(inherited.segments[0].points.length, 0);
  assert.equal(inherited.inheritedEntry, true);
});

test('lot edit limits include moves and the farm transfer lands in a pasture of the destination', () => {
  const entries = [{ ...move('2026-02-01', P1, P2, 5), operationId: 'o1' }];
  assert.deepEqual(lotEditLimits('lot', entries), { minHeads: 0, latestPurchasedAt: '2026-02-01' });
  const summary = summarizeLot(lot, [], 0, '2026-02-10');
  const source = { id: 'f1', operationId: 'o1', name: 'Origem' };
  const destination = { id: 'f2', operationId: 'o2', name: 'Destino' };
  const target = { ...pastures[0], id: 'pd', farmId: 'f2', name: 'Chegada' };
  const input = { destinationFarmId: 'f2', code: '002', managementGroup: 'Chegada', pastureId: 'pd', commandId: 'c', destinationLotId: 'd',
    expectedHeads: 40, expectedCostCents: 1_000_000, expectedWeightKg: 200, date: '2026-02-10' };
  const result = prepareLotTransfer(summary, source, destination, input, target);
  assert.equal(result.lot.pastureId, 'pd');
  assert.equal(result.lot.managementGroup, 'Chegada');
  assert.throws(() => prepareLotTransfer(summary, source, destination, input, pastures[0]), /pasto ativo/);
  assert.throws(() => prepareLotTransfer(summary, source, destination, input, { ...target, active: false }), /pasto ativo/);
});
