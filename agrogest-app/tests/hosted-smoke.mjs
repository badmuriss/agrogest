// Opt-in hosted verification. Creates disposable users without sending email.
// Requires an authenticated Supabase CLI; credentials never enter the app bundle.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const ref = process.env.SUPABASE_TEST_PROJECT_REF;
if (!ref || !/^[a-z]{20}$/.test(ref)) throw Error('Set SUPABASE_TEST_PROJECT_REF to the dedicated test project.');
const cli = `npm exec --yes --package supabase -- supabase projects api-keys --project-ref ${ref} --reveal --output json`;
const keys = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', cli], { encoding: 'utf8' }));
const pub = keys.find(k => k.type === 'publishable').api_key;
const secret = keys.find(k => k.type === 'secret').api_key;
const url = `https://${ref}.supabase.co`;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const fixturePath = new URL('../apps/mobile/.expo/qa/hosted-fixture.json', import.meta.url);
if (process.argv.includes('--delete-auth-fixture')) {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(fixture.ref, ref);
  for (const user of fixture.users) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
  await unlink(fixturePath);
  console.log('Disposable Auth users deleted.');
  process.exit(0);
}
try {
  await access(fixturePath);
  throw Error('A hosted fixture already exists. Clean its database rows and Auth users before running again.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const fixture = { ref, operation: randomUUID(), farm: randomUUID(), lot: randomUUID(), users: [] };
await mkdir(new URL('../apps/mobile/.expo/qa/', import.meta.url), { recursive: true });
const clients = [];
for (const name of ['owner', 'partner', 'employee', 'outsider']) {
  const email = `qa-${randomUUID()}@example.invalid`, password = randomBytes(24).toString('base64url');
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: `QA ${name}` } });
  if (error) throw error;
  fixture.users.push({ id: data.user.id, email, password });
  await writeFile(fixturePath, JSON.stringify(fixture));
  const client = createClient(url, pub, options);
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  clients.push(client);
}
const [owner, partner, employee, outsider] = clients;
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw Error(`${error.code}: ${error.message}`);
  return data;
}
const command = (client, kind, payload, id = randomUUID()) => rpc(client, 'agrogest_command', { command_id: id, kind, payload });
const workspace = client => rpc(client, 'agrogest_workspace');
const anon = createClient(url, pub, options);
await assert.rejects(workspace(anon), /42501/);
const farmPayload = { id: fixture.farm, operationId: fixture.operation, name: 'QA hospedado', city: null, pastureRentCents: 300 };
const replayId = randomUUID();
await Promise.all([command(owner, 'create_farm', farmPayload, replayId), command(owner, 'create_farm', farmPayload, replayId)]);
assert.equal((await workspace(owner)).farms.length, 1);
assert.equal((await workspace(outsider)).farms.length, 0);
await assert.rejects(command(outsider, 'update_farm', farmPayload), /42501/);
await command(owner, 'create_lot', { id: fixture.lot, operationId: fixture.operation, farmId: fixture.farm,
  code: 'QA001', managementGroup: 'Pasto', supplier: 'Origem', category: 'Bois', purchasedAt: '2026-10-01',
  headsPurchased: 10, entryWeightKg: 300, purchaseCents: 100000, commissionCents: 100, freightCents: 100,
  gtaNumbers: ['000123/SP', '000124/SP'], invoiceNumbers: ['000045', '000046/2'] });
const savedLot = (await workspace(owner)).lots.find(lot => lot.id === fixture.lot);
assert.deepEqual(savedLot.gtaNumbers, ['000123/SP', '000124/SP']);
assert.deepEqual(savedLot.invoiceNumbers, ['000045', '000046/2']);
for (const [client, index, role] of [[partner, 1, 'socio'], [employee, 2, 'funcionario']]) {
  const id = randomUUID();
  await command(owner, 'invite', { id, operationId: fixture.operation, name: 'QA convite', contact: fixture.users[index].email, role, sharePct: null });
  await assert.rejects(command(outsider, 'accept_invite', { id }), /indisponível/);
  await command(client, 'accept_invite', { id });
}
assert.equal((await workspace(employee)).lots[0].purchaseCents, 0);
assert.equal((await workspace(employee)).farms[0].pastureRentCents, 0);
const payload = () => ({ id: randomUUID(), operationId: fixture.operation, farmId: fixture.farm, submit: true, expectedVersion: null,
  entry: { kind: 'mortalidade', payload: { lotId: fixture.lot, heads: 8, cause: 'QA', notes: '' }, amountCents: null,
    occurredAt: '2026-10-18', title: 'QA concorrente', authorId: fixture.users[3].id, status: 'aprovado' } });
const results = await Promise.all([command(owner, 'save_entry', payload()), command(partner, 'save_entry', payload())]);
assert.deepEqual(results.map(e => e.status).sort(), ['aguardando_aprovacao', 'conflito']);
const pending = results.find(e => e.status === 'aguardando_aprovacao');
const author = pending.authorId === fixture.users[0].id ? owner : partner;
const reviewer = author === owner ? partner : owner;
const decision = { id: pending.id, operationId: fixture.operation, expectedVersion: 1, decision: 'aprovar', note: 'QA' };
await assert.rejects(command(author, 'decide_entry', decision), /outra pessoa/);
await assert.rejects(command(reviewer, 'decide_entry', { ...decision, expectedVersion: 0 }), /mudou/);
const approved = await command(reviewer, 'decide_entry', decision);
assert.equal(approved.status, 'aprovado');
await assert.rejects(command(reviewer, 'decide_entry', decision), /não aguarda/);
assert.equal((await workspace(outsider)).entries.length, 0);
// Issue #43: two accounts on independent connections move the same heads between pastures.
const pasture = (name) => ({ id: randomUUID(), operationId: fixture.operation, farmId: fixture.farm, name, areaHa: 20, forage: 'Brachiaria', notes: '' });
const [p1, p2, p3] = [pasture('QA Pasto 01'), pasture('QA Pasto 02'), pasture('QA Pasto 03')];
for (const p of [p1, p2, p3]) await command(owner, 'create_pasture', p);
await assert.rejects(command(employee, 'create_pasture', pasture('QA funcionário')), /sócio/);
const movedLot = randomUUID();
await command(owner, 'create_lot', { id: movedLot, operationId: fixture.operation, farmId: fixture.farm, code: 'QA002', managementGroup: p1.name,
  pastureId: p1.id, supplier: '', category: 'Novilhas', purchasedAt: '2026-10-01', headsPurchased: 20, entryWeightKg: 200,
  purchaseCents: 100000, commissionCents: 0, freightCents: 0 });
const move = (to) => ({ id: randomUUID(), operationId: fixture.operation, farmId: fixture.farm, submit: true, expectedVersion: null,
  entry: { kind: 'manejo', title: 'QA mudança de pasto', amountCents: null, occurredAt: '2026-10-18',
    payload: { lotId: movedLot, fromPastureId: p1.id, toPastureId: to, heads: 15, notes: '' } } });
const moveRequests = [move(p2.id), move(p3.id)];
const moves = await Promise.all([command(employee, 'save_entry', moveRequests[0]), command(partner, 'save_entry', moveRequests[1])]);
assert.deepEqual(moves.map(e => e.status).sort(), ['aguardando_aprovacao', 'conflito']);
assert.match(moves.find(e => e.status === 'conflito').conflictReason, /QA Pasto 01 tem 5 cabeças/);
const accepted = moves.find(e => e.status === 'aguardando_aprovacao');
const moveDecision = { id: accepted.id, operationId: fixture.operation, expectedVersion: 1, decision: 'aprovar', note: 'QA' };
const decisionId = randomUUID();
const approvedMove = await command(owner, 'decide_entry', moveDecision, decisionId);
assert.equal(approvedMove.status, 'aprovado');
assert.deepEqual(await command(owner, 'decide_entry', moveDecision, decisionId), approvedMove);
assert.ok((await workspace(employee)).entries.some(e => e.id === accepted.id));
assert.equal((await workspace(owner)).lots.find(l => l.id === movedLot).headsPurchased, 20);
console.log(JSON.stringify({ passed: true, checks: ['real password login', 'anonymous denial', 'concurrent UUID replay', 'tenant isolation', 'verified invite recipient', 'employee redaction', 'concurrent head reservation', 'separate author approval', 'stale revision denial', 'pasture registry by partner', 'concurrent pasture moves', 'move approval replay'], operation: fixture.operation, users: fixture.users.map(u => u.id) }));
