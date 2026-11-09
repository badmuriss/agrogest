import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
// Node's TS stripping does not resolve the extensionless imports used by Metro.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('./') && context.parentURL?.includes('/src/domain/') && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
  return next(specifier, context);
} });
const { summarizeLot, summarizePortfolio } = await import('../apps/mobile/src/domain/lot-metrics.ts');
const { prepareLotTransfer } = await import('../apps/mobile/src/domain/lot-transfer.ts');
const base = { id:'source',farmId:'f1',operationId:'o1',code:'001',managementGroup:'Pasto',supplier:'Fornecedor',category:'Bois',purchasedAt:'2026-10-01',headsPurchased:10,entryWeightKg:300,purchaseCents:100000,commissionCents:1000,freightCents:2000,location:[-54,-20] };
const sourceFarm = {id:'f1',operationId:'o1',name:'Origem'};
const targetFarm = {id:'f2',operationId:'o2',name:'Destino'};
const entry = (kind,payload,date,id) => ({id,kind,payload,status:'aprovado',occurredAt:date,createdAt:date});
const entries = [
  entry('despesa',{allocations:[{lotId:'source',cents:7000,basis:1}],criterion:'manual'},'2026-10-02','cost'),
  entry('venda',{lotId:'source',heads:2,carcassKg:300,pricePerArrobaCents:1000,deductionsCents:0,buyer:'Cliente'},'2026-10-03','sale'),
  entry('mortalidade',{lotId:'source',heads:1},'2026-10-04','loss'),
  entry('pesagem',{lotId:'source',headsWeighed:7,avgWeightKg:350,method:'estimado'},'2026-10-05','weight'),
];
const arrival = {id:'pd',farmId:'f2',operationId:'o2',name:'Pasto novo',areaHa:10,forage:'Brachiaria',notes:'',active:true,createdAt:'2026-10-01'};
const input = {destinationFarmId:'f2',code:'002',managementGroup:'Pasto novo',pastureId:'pd',commandId:'request',destinationLotId:'received',expectedHeads:7,expectedCostCents:88000,expectedWeightKg:350,date:'2026-10-19'};

test('a full transfer preserves total heads and invested capital without fabricating a sale or expense', () => {
  const before = summarizeLot(base,entries,300,'2026-10-19');
  const result = prepareLotTransfer(before,sourceFarm,targetFarm,input,arrival);
  const closed = summarizeLot({...base,transfer:result.sourceTransfer},entries,300,'2026-10-19');
  const received = summarizeLot(result.lot,[],500,'2026-10-19');
  assert.equal(closed.headsCurrent,0);
  assert.equal(closed.remainingCostCents,0);
  assert.equal(received.headsCurrent,7);
  assert.equal(received.remainingCostCents,88000);
  assert.equal(received.lastWeighing.method,'estimado');
  assert.equal(result.lot.location,null);
  assert.deepEqual(summarizePortfolio([closed,received]),summarizePortfolio([before]));
  const later = summarizeLot({...base,transfer:result.sourceTransfer},entries,300,'2026-11-19');
  assert.equal(later.pastureRentAccruedCents,closed.pastureRentAccruedCents);
  assert.equal(result.lot.transfer.incoming.sourceLotId,'source');
  assert.equal(result.lot.pastureId,'pd');
});

test('the domain rejects same-farm, pending and stale transfer previews', () => {
  const summary = summarizeLot(base,entries,300,'2026-10-19');
  assert.throws(()=>prepareLotTransfer(summary,sourceFarm,sourceFarm,input,arrival),/diferente/);
  assert.throws(()=>prepareLotTransfer({...summary,pendingCount:1},sourceFarm,targetFarm,input,arrival),/pendentes/);
  assert.throws(()=>prepareLotTransfer(summary,sourceFarm,targetFarm,{...input,expectedHeads:8},arrival),/mudou/);
  assert.throws(()=>prepareLotTransfer({...summary,lot:{...base,transfer:{outgoing:{}}}},sourceFarm,targetFarm,input,arrival),/já foi transferido/);
});

test('network snapshots cannot overwrite a transfer and a failed request releases the queue', async () => {
  const { cloudTask } = await import('../apps/mobile/src/services/cloud-task.ts');
  const database = {};
  const events = [];
  let release;
  const first = cloudTask(database, async () => { events.push('snapshot-start'); await new Promise(resolve=>{release=resolve;}); events.push('snapshot-end'); });
  const move = cloudTask(database, async () => {events.push('transfer');});
  const refresh = cloudTask(database, async () => {events.push('refresh');});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(events,['snapshot-start']);
  release();
  await Promise.all([first,move,refresh]);
  assert.deepEqual(events,['snapshot-start','snapshot-end','transfer','refresh']);
  await assert.rejects(cloudTask(database,async()=>{throw new Error('lost reply');}),/lost reply/);
  assert.equal(await cloudTask(database,async()=>42),42);
});
