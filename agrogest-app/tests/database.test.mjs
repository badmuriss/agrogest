import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../apps/mobile/src/db/schema.ts';
import { insertInvite, insertLot, loadSnapshot, setLotTransfer, saveAccount, saveCategory, saveCounterparty, saveFarm, savePasture, savePayment, saveSupply, setFarmBoundary, setLotLocation, setLotPurchasePlan } from '../apps/mobile/src/db/repo.ts';
import { legacyPastureId } from '../apps/mobile/src/domain/pasture.ts';
import { insertOperation, insertUser, insertMembership, deleteMembership, refreshOperationAccess } from '../apps/mobile/src/db/repo.ts';

// Real PostgreSQL execution in WASM. The Auth schema is a fixture, so these
// tests prove SQL authorization/invariants, not hosted GoTrue or network races.
let pg;
const alice = randomUUID(), bob = randomUUID(), employee = randomUUID(), outsider = randomUUID();
const farm = randomUUID(), operation = randomUUID(), lot = randomUUID();
const farmPayload = { id: farm, operationId: operation, name: 'Fazenda teste', city: null, pastureRentCents: 300 };

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
  for (const [id, name] of [[alice, 'Alice'], [bob, 'Bob'], [employee, 'Campo'], [outsider, 'Outra pessoa']]) {
    await pg.query('insert into auth.users values($1,$2,now(),$3)', [id, `${id}@example.invalid`, JSON.stringify({ name })]);
  }
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    await pg.exec(await readFile(new URL(file, migrations), 'utf8'));
  }
});
after(async () => { await pg?.close(); });

function sqliteAdapter(db) {
  return {
    getFirstAsync: async (sql) => db.prepare(sql).get(),
    getAllAsync: async (sql) => db.prepare(sql).all(),
    runAsync: async (sql, params) => db.prepare(sql).run(...params),
    execAsync: async (sql) => db.exec(sql),
    withTransactionAsync: async (work) => {
      db.exec('BEGIN');
      try { await work(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

test('SQLite v12 upgrade keeps the outbox, owner and membership edits after reopening', async () => {
  const db = new DatabaseSync(':memory:');
  const sql = sqliteAdapter(db);
  await migrate(sql);
  await insertUser(sql, { id: 'owner', name: 'Dono', email: 'owner@example.invalid' });
  await insertUser(sql, { id: 'member', name: 'Pessoa', email: 'member@example.invalid' });
  await insertOperation(sql, { id: 'op', name: 'Operação', ownerId: 'owner' });
  await insertMembership(sql, { operationId: 'op', userId: 'member', role: 'socio', sharePct: 40 });
  db.exec("alter table operations drop column owner_id; insert into cloud_outbox values('pending','invite','{}','2026-10-21',null); pragma user_version=12;");
  await migrate(sql);
  assert.equal(db.prepare('pragma user_version').get().user_version, 15);
  assert.equal(db.prepare('select count(*) as n from cloud_outbox').get().n, 1);
  assert.equal((await loadSnapshot(sql)).operations[0].ownerId, null);
  db.exec("update operations set owner_id='owner'");
  await insertMembership(sql, { operationId: 'op', userId: 'member', role: 'funcionario', sharePct: null });
  await migrate(sql);
  assert.equal((await loadSnapshot(sql)).operations[0].ownerId, 'owner');
  assert.equal((await loadSnapshot(sql)).memberships[0].role, 'funcionario');
  await deleteMembership(sql, 'op', 'member');
  assert.equal((await loadSnapshot(sql)).memberships.length, 0);
  assert.equal((await loadSnapshot(sql)).users.length, 2, 'removing access preserves accounts');
  db.close();
});

test('a permission error refreshes demoted access without losing the queued commands or another operation', async () => {
  const db = new DatabaseSync(':memory:');
  const sql = sqliteAdapter(db);
  await migrate(sql);
  await insertUser(sql, { id: 'me', name: 'Pessoa', email: null });
  for (const id of ['op', 'other']) {
    await insertOperation(sql, { id, name: id, ownerId: 'owner' });
    await insertMembership(sql, { operationId: id, userId: 'me', role: 'socio', sharePct: null });
    await saveAccount(sql, { id: `account-${id}`, operationId: id, name: 'Banco', kind: 'caixa', bank: '', agency: '', number: '', openingBalanceCents: 100, openingDate: '2026-10-01', active: true, createdAt: '2026-10-01' });
  }
  db.exec("insert into cloud_outbox values('pending','register_payment','{\"operationId\":\"op\"}','2026-10-21',null)");
  const authorized = { users: [{ id: 'me', name: 'Pessoa', email: null }], operations: [{ id: 'op', name: 'op', ownerId: 'owner' }],
    memberships: [{ operationId: 'op', userId: 'me', role: 'funcionario', sharePct: null }], farms: [], lots: [], entries: [], invites: [] };
  await sql.withTransactionAsync(() => refreshOperationAccess(sql, authorized, 'op'));
  const demoted = await loadSnapshot(sql);
  assert.equal(demoted.memberships.find((m) => m.operationId === 'op').role, 'funcionario');
  assert.deepEqual(demoted.accounts.map((a) => a.id), ['account-other']);
  assert.equal(db.prepare('select count(*) as n from cloud_outbox').get().n, 1);
  await sql.withTransactionAsync(() => refreshOperationAccess(sql, { ...authorized, operations: [], memberships: [] }, 'op'));
  assert.deepEqual((await loadSnapshot(sql)).operations.map((o) => o.id), ['other']);
  assert.equal(db.prepare('select count(*) as n from cloud_outbox').get().n, 1);
  db.close();
});

test('SQLite upgrade preserves existing v2 lots and creates the durable outbox', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec("create table settings(key text primary key,value text); insert into settings values('sentinel','keep'); create table farms(id text primary key); create table lots(id text primary key); insert into lots values('existing'); create table invites(id text primary key); pragma user_version=2;");
  await migrate(sqliteAdapter(db));
  assert.equal(db.prepare("select value from settings where key='sentinel'").get().value, 'keep');
  assert.equal(db.prepare('pragma user_version').get().user_version, 15);
  assert.equal(db.prepare('select count(*) as n from cloud_outbox').get().n, 0);
  assert.deepEqual({ ...db.prepare('select * from lots').get() }, { id: 'existing', gta_numbers: '[]', invoice_numbers: '[]', location: null, transfer: '{}', pasture_id: null, purchase_plan: null });
  await migrate(sqliteAdapter(db)); // Reopening a migrated database is safe.
  db.close();
});

test('SQLite v3 upgrade preserves pending commands and document numbers round-trip', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec("create table farms(id text primary key); create table lots(id text primary key); insert into lots values('existing'); create table cloud_outbox(id text,payload text); insert into cloud_outbox values('pending','keep'); create table invites(id text primary key); pragma user_version=3;");
  await migrate(sqliteAdapter(db));
  assert.equal(db.prepare('select payload from cloud_outbox').get().payload, 'keep');
  assert.equal(db.prepare('select gta_numbers from lots').get().gta_numbers, '[]');
  db.close();

  const fresh = new DatabaseSync(':memory:');
  const adapter = sqliteAdapter(fresh);
  await migrate(adapter);
  const base = { id: 'documents', code: '001', operationId: 'operation', farmId: 'farm', managementGroup: 'Pasto', supplier: '', category: 'Bois', purchasedAt: '2026-10-18', headsPurchased: 10, entryWeightKg: 300, purchaseCents: 100, commissionCents: 0, freightCents: 0 };
  await insertLot(adapter, { ...base, gtaNumbers: ['000123/SP', '000124/SP'], invoiceNumbers: ['000045', '000046/2'] });
  await insertLot(adapter, { ...base, id: 'without-documents', code: '002' });
  const { lots } = await loadSnapshot(adapter);
  assert.deepEqual(lots[0].gtaNumbers, ['000123/SP', '000124/SP']);
  assert.deepEqual(lots[0].invoiceNumbers, ['000045', '000046/2']);
  assert.deepEqual(lots[1].gtaNumbers, []);
  assert.deepEqual(lots[1].invoiceNumbers, []);
  fresh.close();
});

test('SQLite v4 upgrade adds the farm boundary and lot location', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec("create table farms(id text primary key, name text, operation_id text, pasture_rent_cents integer, city text); insert into farms values('f','Fazenda','op',0,null); create table lots(id text primary key, gta_numbers text, invoice_numbers text); insert into lots values('l','[]','[]'); create table cloud_outbox(id text,payload text); insert into cloud_outbox values('pending','keep'); create table invites(id text primary key); pragma user_version=4;");
  const adapter = sqliteAdapter(db);
  await migrate(adapter);
  assert.equal(db.prepare('pragma user_version').get().user_version, 15);
  assert.equal(db.prepare('select payload from cloud_outbox').get().payload, 'keep');
  const ring = [[-54.6, -20.45], [-54.59, -20.45], [-54.59, -20.44], [-54.6, -20.45]];
  await setFarmBoundary(adapter, 'f', ring);
  await setLotLocation(adapter, 'l', [-54.595, -20.447]);
  assert.deepEqual(JSON.parse(db.prepare('select boundary from farms').get().boundary), ring);
  assert.deepEqual(JSON.parse(db.prepare('select location from lots').get().location), [-54.595, -20.447]);
  await saveFarm(adapter, { id: 'f', name: 'Renomeada', operationId: 'op', pastureRentCents: 0, city: null, boundary: ring });
  assert.deepEqual(JSON.parse(db.prepare('select boundary from farms').get().boundary), ring);
  db.close();
});

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
async function workspace(user) {
  return (await asUser(user, 'select public.agrogest_workspace() as result')).rows[0].result;
}
async function invite(user, role) {
  const id = randomUUID();
  await command(alice, 'invite', { id, operationId: operation, name: 'Convidado', contact: `${user}@example.invalid`, role, sharePct: null });
  await command(user, 'accept_invite', { id });
}
function entryPayload(kind, payload, amountCents = null, id = randomUUID()) {
  return { id, operationId: operation, farmId: farm, submit: true, expectedVersion: null,
    entry: { kind, payload, amountCents, occurredAt: '2026-10-18', title: 'Registro de teste', authorId: outsider, status: 'aprovado' } };
}

test('AgroGest command API: isolation, replay, approvals and balances', async (t) => {
  await t.test('anonymous callers cannot read or write', async () => {
    await assert.rejects(workspace(null), /permission denied/);
    await assert.rejects(command(null, 'create_farm', farmPayload), /permission denied/);
  });
  await t.test('farm creation is atomic and idempotent', async () => {
    const id = randomUUID();
    await command(alice, 'create_farm', farmPayload, id);
    await command(alice, 'create_farm', farmPayload, id);
    assert.equal((await workspace(alice)).farms.length, 1);
    await assert.rejects(command(alice, 'create_farm', { ...farmPayload, name: 'Outro nome' }, id), /reutilizado/);
    assert.equal((await workspace(bob)).farms.length, 0);
    await assert.rejects(command(bob, 'update_farm', farmPayload), /Sem acesso/);
  });
  await t.test('lot scope and integer cents are validated', async () => {
    const data = { id: lot, operationId: operation, farmId: farm, code: '001', managementGroup: 'Pasto', supplier: 'Origem',
      category: 'Bois', purchasedAt: '2026-10-01', headsPurchased: 10, entryWeightKg: 300,
      purchaseCents: 100000, commissionCents: 100, freightCents: 100 };
    await assert.rejects(command(alice, 'create_lot', { ...data, purchaseCents: 1.5 }), /centavos/);
    await assert.rejects(command(alice, 'create_lot', { ...data, farmId: randomUUID() }), /fora da operação/);
    await command(alice, 'create_lot', data);
    const documents = { ...data, id: randomUUID(), code: '002', gtaNumbers: ['000123/SP', '000124/SP'], invoiceNumbers: ['000045', '000046/2'] };
    await command(alice, 'create_lot', documents);
    const saved = (await workspace(alice)).lots.find(item => item.id === documents.id);
    assert.deepEqual(saved.gtaNumbers, documents.gtaNumbers);
    assert.deepEqual(saved.invoiceNumbers, documents.invoiceNumbers);
    for (const invalid of [{ gtaNumbers: '123' }, { invoiceNumbers: [123] }, { gtaNumbers: [''] }, { invoiceNumbers: Array(101).fill('1') }]) {
      await assert.rejects(command(alice, 'create_lot', { ...data, id: randomUUID(), code: 'invalid', ...invalid }), /lots_(gta|invoice)_numbers_valid/);
    }
  });
  await t.test('solo operational entries are confirmed only by the server', async () => {
    const payload = entryPayload('pesagem', { lotId: lot, method: 'medido', avgWeightKg: 310, headsWeighed: 10, notes: '' });
    const entry = await command(alice, 'save_entry', payload);
    assert.equal(entry.authorId, alice);
    assert.equal(entry.decidedBy, 'sistema');
    assert.equal(entry.status, 'aprovado');
    assert.equal(entry.version, 1);
  });
  await t.test('an invitation can only be accepted by its verified email owner', async () => {
    const id = randomUUID();
    await command(alice, 'invite', { id, operationId: operation, name: 'Bob', contact: `${bob}@example.invalid`, role: 'socio', sharePct: null });
    await assert.rejects(command(outsider, 'accept_invite', { id }), /indisponível/);
    const beforeAccept = await workspace(bob);
    assert.equal(beforeAccept.invites.length, 1);
    assert.deepEqual(beforeAccept.invites[0].context, { inviterName: 'Alice', operationName: farmPayload.name, farmNames: [farmPayload.name] });
    assert.equal(beforeAccept.farms.length, 0);
    assert.equal(beforeAccept.lots.length, 0);
    assert.equal(beforeAccept.entries.length, 0);
    assert.equal((await workspace(outsider)).invites.length, 0);
    await command(bob, 'accept_invite', { id });
    assert.equal((await workspace(bob)).farms[0].id, farm);
    await invite(employee, 'funcionario');
  });
  await t.test('employees cannot extract purchase costs or become partners', async () => {
    const data = await workspace(employee);
    assert.equal(data.lots[0].purchaseCents, 0);
    assert.equal(data.farms[0].pastureRentCents, 0);
    await assert.rejects(asUser(employee, 'select * from private.lots'), /permission denied/);
    await assert.rejects(command(employee, 'invite', { id: randomUUID(), operationId: operation }), /exige um sócio/);
    await assert.rejects(asUser(employee, "update private.memberships set role='socio'"), /permission denied/);
  });
  await t.test('installments and allocations must close exactly, another partner approves', async () => {
    const data = entryPayload('despesa', { category: 'Insumos', description: 'Custo', supplier: '', document: '',
      installments: [{ dueDate: '2026-11-18', cents: 101 }], criterion: 'cabeca', allocations: [{ lotId: lot, cents: 101, basis: 10 }] }, 101);
    await assert.rejects(command(alice, 'save_entry', { ...data, entry: { ...data.entry, amountCents: 100 } }), /parcelas/);
    const entry = await command(alice, 'save_entry', data);
    assert.equal(entry.status, 'aguardando_aprovacao');
    assert.equal((await workspace(employee)).entries.some((e) => e.id === data.id), false);
    const decision = { id: data.id, operationId: operation, expectedVersion: 1, decision: 'aprovar', note: 'Conferido' };
    await assert.rejects(command(alice, 'decide_entry', decision), /outra pessoa/);
    await assert.rejects(command(employee, 'decide_entry', decision), /outra pessoa/);
    await assert.rejects(command(bob, 'decide_entry', { ...decision, expectedVersion: 0 }), /mudou/);
    const id = randomUUID();
    const approved = await command(bob, 'decide_entry', decision, id);
    assert.equal(approved.status, 'aprovado');
    assert.equal(approved.decidedBy, bob);
    assert.equal((await command(bob, 'decide_entry', decision, id)).version, 2);
    await assert.rejects(command(alice, 'save_entry', { ...data, expectedVersion: 2 }), /já foi enviado/);
  });
  await t.test('two deliveries cannot reserve more heads than available', async () => {
    const first = entryPayload('mortalidade', { lotId: lot, heads: 8, cause: 'Teste', notes: '' });
    const second = entryPayload('mortalidade', { lotId: lot, heads: 8, cause: 'Teste', notes: '' });
    assert.equal((await command(alice, 'save_entry', first)).status, 'aguardando_aprovacao');
    assert.equal((await command(bob, 'save_entry', second)).status, 'conflito');
    const approved = await command(bob, 'decide_entry', { id: first.id, operationId: operation, expectedVersion: 1, decision: 'aprovar', note: '' });
    assert.equal(approved.status, 'aprovado');
    await assert.rejects(command(alice, 'discard_entry', { id: first.id, operationId: operation }), /rascunho/);
  });
  await t.test('employees receive sale quantities for accurate herd balances without financial data', async () => {
    const data = entryPayload('venda', { lotId: lot, heads: 1, carcassKg: 150, buyer: 'Comprador', pricePerArrobaCents: 30000, deductionsCents: 100 }, 300000);
    const sale = await command(alice, 'save_entry', data);
    assert.equal(sale.status, 'aguardando_aprovacao');
    await command(bob, 'decide_entry', { id: data.id, operationId: operation, expectedVersion: 1, decision: 'aprovar', note: 'Valor 300000' });
    const redacted = (await workspace(employee)).entries.find((entry) => entry.id === data.id);
    assert.equal(redacted.payload.heads, 1);
    assert.equal(redacted.payload.pricePerArrobaCents, 0);
    assert.equal(redacted.amountCents, 0);
    assert.equal(redacted.history.some((item) => item.note), false);
    await assert.rejects(command(alice, 'save_entry', { ...entryPayload('venda', data.entry.payload, 1) }), /peso e preço/);
  });
  await t.test('partners edit lot root data without breaking balances or history', async () => {
    const previous = (await workspace(alice)).lots.find((item) => item.id === lot);
    const edit = { ...previous, previous, code: '001A', supplier: 'Novo fornecedor', headsPurchased: 12, purchasedAt: '2026-09-30',
      purchaseCents: 120000, gtaNumbers: ['000999/MS'], invoiceNumbers: [] };
    await assert.rejects(command(employee, 'update_lot', edit), /exige um sócio/);
    await assert.rejects(command(alice, 'update_lot', { ...edit, previous: { ...previous, supplier: 'Outro' } }), /mudou em outro aparelho/);
    // 8 deaths and 1 sale are already approved for this lot.
    await assert.rejects(command(alice, 'update_lot', { ...edit, headsPurchased: 8 }), /9 cabeças/);
    await assert.rejects(command(alice, 'update_lot', { ...edit, purchasedAt: '2026-10-19' }), /primeiro lançamento/);
    await assert.rejects(command(alice, 'update_lot', { ...edit, code: '002' }), /lots_operation_code_idx/);
    await assert.rejects(command(alice, 'update_lot', { ...edit, gtaNumbers: [''] }), /lots_gta_numbers_valid/);
    await assert.rejects(command(alice, 'update_lot', { ...edit, operationId: randomUUID() }), /Sem acesso/);
    const id = randomUUID();
    const saved = await command(alice, 'update_lot', edit, id);
    assert.equal(saved.code, '001A');
    assert.equal(saved.farmId, farm);
    assert.equal(saved.previous, undefined);
    assert.deepEqual(await command(alice, 'update_lot', edit, id), saved);
    const partner = (await workspace(alice)).lots.find((item) => item.id === lot);
    assert.deepEqual({ heads: partner.headsPurchased, gta: partner.gtaNumbers, cents: partner.purchaseCents }, { heads: 12, gta: ['000999/MS'], cents: 120000 });
    assert.equal((await workspace(employee)).lots.find((item) => item.id === lot).purchaseCents, 0);
    await assert.rejects(command(alice, 'update_lot', edit), /mudou em outro aparelho/);
  });
  await t.test('farm boundary and lot pins: roles, validation, conflicts and projection', async () => {
    const ring = [[-54.6, -20.45], [-54.59, -20.45], [-54.59, -20.44], [-54.6, -20.44], [-54.6, -20.45]];
    const draw = { id: farm, operationId: operation, boundary: ring, previous: null };
    await assert.rejects(command(employee, 'update_farm_boundary', draw), /exige um sócio/);
    await assert.rejects(command(alice, 'update_farm_boundary', { ...draw, boundary: ring.slice(0, 3) }), /Área inválida/);
    await assert.rejects(command(alice, 'update_farm_boundary', { ...draw, boundary: [...ring.slice(0, 4), [0, 0]] }), /Área inválida/);
    await assert.rejects(command(alice, 'update_farm_boundary', { ...draw, boundary: ring.map(([x]) => [x, 95]) }), /Área inválida/);
    await assert.rejects(command(alice, 'update_farm_boundary', { id: farm, operationId: operation, boundary: ring }), /Área inválida/);
    const id = randomUUID();
    await command(alice, 'update_farm_boundary', draw, id);
    assert.deepEqual(await command(alice, 'update_farm_boundary', draw, id), { id: farm, boundary: ring });
    await assert.rejects(command(alice, 'update_farm_boundary', draw), /mudou em outro aparelho/);
    assert.deepEqual((await workspace(employee)).farms[0].boundary, ring);
    assert.equal((await workspace(employee)).farms[0].pastureRentCents, 0);

    const pin = { id: lot, operationId: operation, location: [-54.595, -20.447] };
    await assert.rejects(command(alice, 'place_lot', { ...pin, location: [200, 0] }), /Posição inválida/);
    await assert.rejects(command(alice, 'place_lot', { id: lot, operationId: operation }), /Posição inválida/);
    await assert.rejects(command(outsider, 'place_lot', pin), /Sem acesso/);
    await command(employee, 'place_lot', pin);
    assert.deepEqual((await workspace(alice)).lots.find((item) => item.id === lot).location, pin.location);
    // Editing the lot keeps its pin; removing the pin keeps the lot.
    const current = (await workspace(alice)).lots.find((item) => item.id === lot);
    await command(alice, 'update_lot', { ...current, previous: current, supplier: 'Com pino' });
    assert.deepEqual((await workspace(alice)).lots.find((item) => item.id === lot).location, pin.location);
    await command(alice, 'place_lot', { ...pin, location: null });
    assert.equal((await workspace(alice)).lots.find((item) => item.id === lot).location, undefined);
    await command(alice, 'update_farm_boundary', { ...draw, boundary: null, previous: ring });
    assert.equal((await workspace(alice)).farms[0].boundary, null);
  });
  await t.test('unrelated accounts still have no access after sharing and approvals', async () => {
    const data = await workspace(outsider);
    assert.equal(data.operations.length, 0);
    assert.equal(data.entries.length, 0);
    assert.equal(data.lots.length, 0);
  });
  await t.test('a revoked partner immediately loses server reads and commands', async () => {
    await pg.query('delete from private.memberships where operation_id=$1 and user_id=$2', [operation, bob]);
    assert.equal((await workspace(bob)).farms.length, 0);
    await assert.rejects(command(bob, 'create_lot', { id: randomUUID(), operationId: operation, farmId: farm }), /Sem acesso/);
  });
});

test('SQLite v5 upgrade preserves invites and their display context survives reopening', async () => {
  const db = new DatabaseSync(':memory:');
  const adapter = sqliteAdapter(db);
  await migrate(adapter);
  db.exec('alter table invites drop column context; alter table lots drop column transfer; pragma user_version=5;');
  await migrate(adapter);
  const context = { inviterName: 'Alice', operationName: 'Sociedade', farmNames: ['Fazenda teste'] };
  await insertInvite(adapter, { id: 'inv', operationId: 'op', name: 'Bob', contact: 'bob@example.invalid', role: 'socio', sharePct: null, createdAt: '2026-10-19', createdBy: 'alice', context });
  await migrate(adapter);
  assert.deepEqual((await loadSnapshot(adapter)).invites[0].context, context);
  db.close();
});

test('whole-lot transfers carry remaining cost atomically, isolate history and reject stale or unauthorized moves', async () => {
  const from = { id: randomUUID(), operationId: randomUUID(), name: 'Origem transferência', city: null, pastureRentCents: 200 };
  const to = { id: randomUUID(), operationId: randomUUID(), name: 'Destino transferência', city: null, pastureRentCents: 300 };
  await command(alice, 'create_farm', from);
  await command(alice, 'create_farm', to);
  const today = (await pg.query("select to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') as day")).rows[0].day;
  const source = { id: randomUUID(), operationId: from.operationId, farmId: from.id, code: 'source', managementGroup: 'Pasto antigo', supplier: 'Fornecedor',
    category: 'Bois', purchasedAt: today, headsPurchased: 10, entryWeightKg: 300, purchaseCents: 100000, commissionCents: 1000, freightCents: 2000,
    gtaNumbers: ['000123'], invoiceNumbers: ['000045'], location: [-54.6,-20.4] };
  await command(alice, 'create_lot', source);
  const other = {...source,id:randomUUID(),code:'other'};
  await command(alice,'create_lot',other);
  const save = async (kind, payload, amountCents = null, submit = true) => command(alice, 'save_entry', {
    id: randomUUID(), operationId: from.operationId, farmId: from.id, submit, expectedVersion: null,
    entry: { kind, payload, title: 'Histórico da origem', amountCents, occurredAt: today },
  });
  await save('despesa', { category: 'Outros', title: 'Ração', supplier: 'Loja', installments: [{dueDate:today,cents:10000}], criterion: 'manual', allocations: [{lotId:source.id,cents:7000,basis:7},{lotId:other.id,cents:3000,basis:3}] }, 10000);
  await save('venda', { lotId: source.id, heads: 2, buyer: 'Cliente', carcassKg: 300, pricePerArrobaCents: 1000, deductionsCents: 0 }, 20000);
  await save('mortalidade', {lotId:source.id,heads:1,cause:'Acidente',notes:''});
  await save('pesagem', {lotId:source.id,headsWeighed:7,avgWeightKg:350,method:'estimado',notes:''});
  const payload = { id:source.id, operationId:from.operationId, sourceFarmId:from.id, destinationFarmId:to.id, destinationLotId:randomUUID(),
    code:'received', managementGroup:'Pasto novo', date:today, expectedHeads:7, expectedCostCents:88000, expectedWeightKg:350 };
  await assert.rejects(command(outsider,'transfer_lot',payload), /sócio/);
  await assert.rejects(command(alice,'transfer_lot',{...payload,expectedHeads:8}), /mudou/);
  await assert.rejects(command(alice,'transfer_lot',{...payload,destinationFarmId:from.id}), /diferente/);
  assert.equal((await workspace(alice)).lots.find(l=>l.id===source.id).transfer.outgoing, undefined);
  const draft = await save('pesagem', {lotId:source.id,headsWeighed:7,avgWeightKg:351,method:'medido',notes:''}, null, false);
  await assert.rejects(command(alice,'transfer_lot',payload), /pendentes/);
  await command(alice,'discard_entry',{id:draft.id,operationId:from.operationId,expectedVersion:draft.version});
  await command(alice,'create_lot',{...source,id:randomUUID(),operationId:to.operationId,farmId:to.id,code:'received'});
  await assert.rejects(command(alice,'transfer_lot',payload), /duplicate key/);
  assert.equal((await workspace(alice)).lots.find(l=>l.id===source.id).transfer.outgoing,undefined);
  payload.code = 'received-2';
  const requestId = randomUUID();
  const moved = await command(alice,'transfer_lot',payload,requestId);
  assert.equal(moved.lot.headsPurchased,7);
  assert.equal(moved.lot.purchaseCents,88000);
  assert.equal(moved.lot.entryWeightKg,350);
  assert.equal(moved.lot.transfer.incoming.weightMethod,'estimado');
  assert.equal(moved.lot.farmId,to.id);
  assert.equal(moved.lot.location,undefined);
  assert.deepEqual(moved.lot.gtaNumbers,['000123']);
  assert.deepEqual(await command(alice,'transfer_lot',payload,requestId),moved);
  await assert.rejects(command(alice,'transfer_lot',{...payload,destinationLotId:randomUUID()}),/já foi transferido/);
  await assert.rejects(save('mortalidade',{lotId:source.id,heads:1,cause:'Acidente',notes:''}), /já foi transferido/);
  await assert.rejects(command(alice,'update_lot',{...source,previous:source}), /preservados/);
  const data = await workspace(alice);
  assert.equal(data.entries.filter(e=>e.operationId===from.operationId).length,4);
  assert.equal(data.entries.filter(e=>e.operationId===to.operationId).length,0);
  assert.equal(data.entries.find(e=>e.kind==='despesa' && e.operationId===from.operationId).amountCents,10000);
  assert.equal(data.entries.find(e=>e.kind==='despesa' && e.operationId===from.operationId).payload.allocations.length,2);
  assert.equal(data.lots.filter(l=>l.transfer.incoming?.sourceLotId===source.id).length,1);
  // Destination-only employee sees stock and links, without carried financial cost.
  const invitation = randomUUID();
  await command(alice,'invite',{id:invitation,operationId:to.operationId,name:'Campo',contact:`${employee}@example.invalid`,role:'funcionario',sharePct:null});
  await command(employee,'accept_invite',{id:invitation});
  const restricted = await workspace(employee);
  assert.equal(restricted.lots.find(l=>l.id===moved.lot.id).purchaseCents,0);
  assert.equal(restricted.lots.some(l=>l.id===source.id),false);
  await assert.rejects(command(employee,'transfer_lot',{...payload,id:moved.lot.id,destinationLotId:randomUUID(),operationId:to.operationId,destinationFarmId:from.id,sourceFarmId:to.id}),/sócio/);
  // The receiving lot still uses the existing stock reservation protections.
  const receiveSale = { id:randomUUID(),operationId:to.operationId,farmId:to.id,submit:true,expectedVersion:null,
    entry:{kind:'venda',title:'Excesso',amountCents:20000,occurredAt:today,payload:{lotId:moved.lot.id,heads:8,buyer:'Cliente',carcassKg:300,pricePerArrobaCents:1000,deductionsCents:0}} };
  assert.equal((await command(alice,'save_entry',receiveSale)).status,'conflito');
});

test('SQLite v6 upgrade preserves the outbox and round-trips both sides of a transfer', async () => {
  const db = new DatabaseSync(':memory:');
  const adapter = sqliteAdapter(db);
  await migrate(adapter);
  const lot = {id:'from',code:'001',operationId:'op',farmId:'farm',managementGroup:'Pasto',supplier:'',category:'Bois',purchasedAt:'2026-10-19',headsPurchased:10,entryWeightKg:300,purchaseCents:100,commissionCents:0,freightCents:0};
  await insertLot(adapter,lot);
  db.exec("alter table lots drop column transfer; insert into cloud_outbox values('pending','save_entry','{}','2026-10-19',null); pragma user_version=6;");
  await migrate(adapter);
  const outgoing = {outgoing:{destinationLotId:'to',farmId:'other',farmName:'Destino',at:'2026-10-19',heads:10}};
  await setLotTransfer(adapter,'from',outgoing);
  await insertLot(adapter,{...lot,id:'to',code:'002',transfer:{incoming:{sourceLotId:'from',farmId:'farm',farmName:'Origem',at:'2026-10-19',weightMethod:'estimado'}}});
  await migrate(adapter);
  const snapshot = await loadSnapshot(adapter);
  assert.deepEqual(snapshot.lots.find(l=>l.id==='from').transfer,outgoing);
  assert.equal(snapshot.lots.find(l=>l.id==='to').transfer.incoming.weightMethod,'estimado');
  assert.equal(db.prepare('select id from cloud_outbox').get().id,'pending');
  db.close();
});

test('SQLite v7 upgrade converts free-text pastures into farm pastures without losing the text', async () => {
  const db = new DatabaseSync(':memory:');
  const adapter = sqliteAdapter(db);
  await migrate(adapter);
  const base = { code: '001', operationId: 'op', farmId: 'farm', supplier: '', category: 'Bois', purchasedAt: '2026-10-01', headsPurchased: 10,
    entryWeightKg: 300, purchaseCents: 100, commissionCents: 0, freightCents: 0 };
  await insertLot(adapter, { ...base, id: 'a', managementGroup: 'Pasto do Córrego' });
  await insertLot(adapter, { ...base, id: 'b', code: '002', managementGroup: ' pasto  do corrego ' });
  await insertLot(adapter, { ...base, id: 'c', code: '003', managementGroup: 'Piquete 3' });
  await insertLot(adapter, { ...base, id: 'd', code: '004', farmId: 'other', managementGroup: 'Piquete 3' });
  db.exec("alter table lots drop column pasture_id; drop table pastures; insert into cloud_outbox values('pending','create_lot','{}','2026-10-19',null); pragma user_version=7;");
  await migrate(adapter);
  await migrate(adapter); // Reopening is idempotent.
  const snapshot = await loadSnapshot(adapter);
  const lot = (id) => snapshot.lots.find((l) => l.id === id);
  assert.equal(lot('a').pastureId, legacyPastureId('farm', 'Pasto do Córrego'));
  assert.equal(lot('b').pastureId, lot('a').pastureId);
  assert.notEqual(lot('c').pastureId, lot('d').pastureId);
  assert.equal(lot('b').managementGroup, ' pasto  do corrego ');
  assert.equal(snapshot.pastures.length, 3);
  const converted = snapshot.pastures.find((p) => p.id === lot('a').pastureId);
  assert.deepEqual({ name: converted.name, area: converted.areaHa, forage: converted.forage, legacy: converted.legacy, active: converted.active },
    { name: 'Pasto do Córrego', area: null, forage: '', legacy: true, active: true });
  assert.equal(db.prepare('select id from cloud_outbox').get().id, 'pending');
  await savePasture(adapter, { ...converted, areaHa: 20, forage: 'Brachiaria', legacy: false });
  assert.equal((await loadSnapshot(adapter)).pastures.find((p) => p.id === converted.id).areaHa, 20);
  // v9: the optional outline round-trips as JSON.
  const outline = [[-50, -15], [-49.99, -15], [-49.99, -14.99], [-50, -15]];
  await savePasture(adapter, { ...converted, areaHa: 20, forage: 'Brachiaria', legacy: false, boundary: outline });
  assert.deepEqual((await loadSnapshot(adapter)).pastures.find((p) => p.id === converted.id).boundary, outline);
  db.close();
});

test('SQLite v8 upgrade adds the optional pasture outline and keeps the pastures', async () => {
  const db = new DatabaseSync(':memory:');
  const adapter = sqliteAdapter(db);
  await migrate(adapter);
  db.exec("alter table pastures drop column boundary; insert into pastures (id, operation_id, farm_id, name, created_at) values ('p', 'op', 'farm', 'Pasto 01', '2026-10-19'); pragma user_version=8;");
  await migrate(adapter);
  assert.equal(db.prepare('pragma user_version').get().user_version, 15);
  const pasture = (await loadSnapshot(adapter)).pastures.find((p) => p.id === 'p');
  assert.deepEqual({ name: pasture.name, boundary: pasture.boundary }, { name: 'Pasto 01', boundary: null });
  db.close();
});

test('SQLite v10 upgrade adds finance and stock tables, keeps entries and the outbox, and round-trips them', async () => {
  const db = new DatabaseSync(':memory:');
  const adapter = sqliteAdapter(db);
  await migrate(adapter);
  db.exec(`drop table financial_accounts; drop table categories; drop table counterparties; drop table supplies; drop table payments;
    insert into cloud_outbox (id, kind, payload, created_at) values ('pending', 'save_entry', '{}', '2026-10-20');
    insert into entries (id, kind, status, operation_id, farm_id, author_id, title, amount_cents, occurred_at, created_at, payload, history)
      values ('old', 'despesa', 'aprovado', 'op', 'farm', 'u', 'Sal', 100, '2026-09-01', '2026-09-01', '{"installments":[{"dueDate":"2026-10-01","cents":100}]}', '[]');
    pragma user_version=10;`);
  await migrate(adapter);
  assert.equal(db.prepare('pragma user_version').get().user_version, 15);
  assert.equal(db.prepare('select count(*) as n from cloud_outbox').get().n, 1);
  assert.equal(db.prepare('select count(*) as n from entries').get().n, 1);
  await saveAccount(adapter, { id: 'a', operationId: 'op', name: 'Banco', kind: 'corrente', bank: 'X', agency: '1', number: '2', openingBalanceCents: -500, openingDate: '2026-10-01', active: true, createdAt: '2026-10-01' });
  await saveSupply(adapter, { id: 's', operationId: 'op', name: 'Sal', kind: 'sal', unit: 'saco', conversions: [{ unit: 't', factor: 40 }], minQuantity: 10, active: true, createdAt: '2026-10-01' });
  await saveCategory(adapter, { id: 'c', operationId: 'op', name: 'Arrendamento', nature: 'custo_producao', active: true });
  await saveCounterparty(adapter, { id: 'k', operationId: 'op', name: 'Casa do Campo', kind: 'fornecedor', document: '12.345.678/0001-90', contact: '', pixKey: '', notes: '', active: true, createdAt: '2026-10-01' });
  const payment = { id: 'p', operationId: 'op', direction: 'pagar', accountId: 'a', paidAt: '2026-10-02', items: [{ entryId: 'old', index: 0, cents: 100 }],
    interestCents: 1, fineCents: 2, discountCents: 0, method: 'pix', proof: 'E123', notes: '', status: 'efetivado', conflictReason: null, authorId: 'u',
    createdAt: '2026-10-02T10:00:00.000Z', reversedBy: null, reversedAt: null, reverseReason: null };
  await savePayment(adapter, payment);
  await savePayment(adapter, { ...payment, status: 'estornado', reversedBy: 'u', reverseReason: 'Pix devolvido' });
  const snapshot = await loadSnapshot(adapter);
  assert.equal(snapshot.accounts[0].openingBalanceCents, -500);
  assert.equal(snapshot.accounts[0].active, true);
  assert.deepEqual(snapshot.supplies[0].conversions, [{ unit: 't', factor: 40 }]);
  assert.equal(snapshot.categories[0].nature, 'custo_producao');
  assert.equal(snapshot.counterparties[0].document, '12.345.678/0001-90');
  assert.equal(snapshot.payments.length, 1);
  assert.deepEqual({ status: snapshot.payments[0].status, items: snapshot.payments[0].items }, { status: 'estornado', items: payment.items });
  await migrate(adapter);
  db.close();
});

test('SQLite v11 upgrade adds the lot purchase plan, keeps old lots without one, and round-trips it', async () => {
  const db = new DatabaseSync(':memory:');
  const adapter = sqliteAdapter(db);
  await migrate(adapter);
  db.exec("alter table lots drop column purchase_plan; pragma user_version=11;");
  const base = { id: 'old', code: '001', operationId: 'op', farmId: 'farm', managementGroup: 'Pasto', supplier: '', category: 'Bois', purchasedAt: '2026-10-01', headsPurchased: 10, entryWeightKg: 300, purchaseCents: 100, commissionCents: 0, freightCents: 0 };
  db.prepare("insert into lots (id, code, operation_id, farm_id, management_group, supplier, category, purchased_at, heads_purchased, entry_weight_kg, purchase_cents, commission_cents, freight_cents) values ('old','001','op','farm','P','','Bois','2026-10-01',10,300,100,0,0)").run();
  await migrate(adapter);
  assert.equal(db.prepare('pragma user_version').get().user_version, 15);
  assert.equal((await loadSnapshot(adapter)).lots[0].purchasePlan, null);
  const plan = { parts: [{ kind: 'animais', counterparty: 'Vendedor', counterpartyId: null, installments: [{ dueDate: '2026-11-01', cents: 100 }] }] };
  await setLotPurchasePlan(adapter, 'old', plan);
  assert.deepEqual((await loadSnapshot(adapter)).lots[0].purchasePlan, plan);
  await insertLot(adapter, { ...base, id: 'new', code: '002', purchasePlan: plan });
  assert.deepEqual((await loadSnapshot(adapter)).lots.find((l) => l.id === 'new').purchasePlan, plan);
  db.close();
});

test('pastures and moves: registry, legacy conversion, balances per pasture, approvals and projection', async (t) => {
  const farmA = { id: randomUUID(), operationId: randomUUID(), name: 'Fazenda pastos', city: null, pastureRentCents: 0 };
  const op = farmA.operationId;
  await command(alice, 'create_farm', farmA);
  const today = (await pg.query("select to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD') as day")).rows[0].day;
  const p1 = { id: randomUUID(), operationId: op, farmId: farmA.id, name: 'Pasto 01', areaHa: 20, forage: 'Brachiaria', notes: '' };
  const p2 = { ...p1, id: randomUUID(), name: 'Pasto 02', areaHa: 12.5, forage: 'Mombaça' };
  const p3 = { ...p1, id: randomUUID(), name: 'Pasto 03', areaHa: 5 };
  const lotData = { id: randomUUID(), operationId: op, farmId: farmA.id, code: 'P-001', managementGroup: 'Pasto 01', pastureId: p1.id, supplier: '',
    category: 'Novilhas', purchasedAt: '2026-10-01', headsPurchased: 40, entryWeightKg: 200, purchaseCents: 100000, commissionCents: 0, freightCents: 0 };
  const moveId = () => randomUUID();
  const move = (heads, from = p1.id, to = p2.id, occurredAt = today, id = moveId()) => ({ id, operationId: op, farmId: farmA.id, submit: true, expectedVersion: null,
    entry: { kind: 'manejo', title: 'Movimentação', amountCents: null, occurredAt, payload: { lotId: lotData.id, fromPastureId: from, toPastureId: to, heads, notes: '' } } });

  await t.test('partners register pastures; names are unique per farm and area/forage are validated', async () => {
    const id = randomUUID();
    const saved = await command(alice, 'create_pasture', p1, id);
    assert.deepEqual({ name: saved.name, area: saved.areaHa, forage: saved.forage, active: saved.active }, { name: 'Pasto 01', area: 20, forage: 'Brachiaria', active: true });
    assert.deepEqual(await command(alice, 'create_pasture', p1, id), saved);
    await command(alice, 'create_pasture', p2);
    await command(alice, 'create_pasture', p3);
    await assert.rejects(command(alice, 'create_pasture', { ...p1, id: randomUUID(), name: ' pasto  01 ' }), /Já existe um pasto/);
    await assert.rejects(command(alice, 'create_pasture', { ...p1, id: randomUUID(), name: 'Sem área', areaHa: 0 }), /área/);
    await assert.rejects(command(alice, 'create_pasture', { ...p1, id: randomUUID(), name: 'Sem área', areaHa: '20' }), /área/);
    await assert.rejects(command(alice, 'create_pasture', { ...p1, id: randomUUID(), name: 'Sem capim', forage: ' ' }), /capim/);
    await assert.rejects(command(alice, 'create_pasture', { ...p1, id: randomUUID(), name: 'Outra fazenda', farmId: farm }), /Fazenda fora/);
    await assert.rejects(command(outsider, 'create_pasture', { ...p1, id: randomUUID(), name: 'Intruso' }), /Sem acesso/);
    assert.deepEqual((await workspace(alice)).pastures.filter((p) => p.farmId === farmA.id).map((p) => p.name), ['Pasto 01', 'Pasto 02', 'Pasto 03']);
    assert.equal((await workspace(bob)).pastures.some((p) => p.farmId === farmA.id), false);
  });

  await t.test('lots reference an active pasture of their farm; old clients get a converted pasture', async () => {
    await assert.rejects(command(alice, 'create_lot', { ...lotData, pastureId: randomUUID() }), /pasto ativo/);
    const created = await command(alice, 'create_lot', lotData);
    assert.equal(created.pastureId, p1.id);
    const legacy = await command(alice, 'create_lot', { ...lotData, id: randomUUID(), code: 'P-OLD', pastureId: undefined, managementGroup: 'Retiro Velho' });
    assert.equal(legacy.pastureId, legacyPastureId(farmA.id, 'Retiro Velho'));
    const converted = (await workspace(alice)).pastures.find((p) => p.id === legacy.pastureId);
    assert.deepEqual({ area: converted.areaHa, forage: converted.forage, legacy: converted.legacy }, { area: null, forage: '', legacy: true });
    // A second old lot with the same text reuses the converted pasture.
    const again = await command(alice, 'create_lot', { ...lotData, id: randomUUID(), code: 'P-OLD2', pastureId: undefined, managementGroup: 'retiro  velho' });
    assert.equal(again.pastureId, legacy.pastureId);
  });

  await t.test('employees move animals; partial and total moves keep the economic lot intact', async () => {
    const invitation = randomUUID();
    await command(alice, 'invite', { id: invitation, operationId: op, name: 'Campo', contact: `${employee}@example.invalid`, role: 'funcionario', sharePct: null });
    await command(employee, 'accept_invite', { id: invitation });
    await assert.rejects(command(employee, 'create_pasture', { ...p1, id: randomUUID(), name: 'Pasto do funcionário' }), /exige um sócio/);
    const partial = move(15);
    const sent = await command(employee, 'save_entry', partial);
    assert.equal(sent.status, 'aguardando_aprovacao');
    // The author cannot approve; the partner can, and replays do not duplicate the effect.
    const decision = { id: partial.id, operationId: op, expectedVersion: 1, decision: 'aprovar', note: '' };
    await assert.rejects(command(employee, 'decide_entry', decision), /outra pessoa/);
    const decisionId = randomUUID();
    const approved = await command(alice, 'decide_entry', decision, decisionId);
    assert.equal(approved.status, 'aprovado');
    assert.deepEqual(await command(alice, 'decide_entry', decision, decisionId), approved);
    const lotNow = (await workspace(alice)).lots.find((l) => l.id === lotData.id);
    assert.deepEqual({ heads: lotNow.headsPurchased, cost: lotNow.purchaseCents, pasture: lotNow.pastureId }, { heads: 40, cost: 100000, pasture: p1.id });
    // Employees see every move of the operation, not only their own.
    const byAlice = move(5, p2.id, p3.id);
    await command(alice, 'save_entry', byAlice);
    assert.ok((await workspace(employee)).entries.some((e) => e.id === byAlice.id));
  });

  await t.test('moves above the pasture balance, invalid pastures and future dates are refused or conflict', async () => {
    const replay = async (sql) => (await pg.query(sql)).rows[0];
    const balance = async (reserve) => (await replay(`select private.lot_pasture_replay('${op}','${lotData.id}',null,null,${reserve}) as r`)).r.heads;
    assert.deepEqual(await balance(false), { [p1.id]: 25, [p2.id]: 15 });
    assert.deepEqual(await balance(true), { [p1.id]: 25, [p2.id]: 10, [p3.id]: 5 });
    const tooMany = await command(alice, 'save_entry', move(26));
    assert.equal(tooMany.status, 'conflito');
    assert.match(tooMany.conflictReason, /Pasto 01 tem 25 cabeças deste lote; a movimentação pede 26/);
    await assert.rejects(command(alice, 'save_entry', move(1, p1.id, p1.id)), /diferente/);
    await assert.rejects(command(alice, 'save_entry', move(1, p1.id, randomUUID())), /desta fazenda/);
    await assert.rejects(command(alice, 'save_entry', move(1, p1.id, p2.id, '2999-01-01')), /data futura/);
    const before = await command(alice, 'save_entry', move(1, p1.id, p2.id, '2026-09-30'));
    assert.equal(before.status, 'conflito');
    assert.match(before.conflictReason, /anterior à entrada/);
  });

  await t.test('two devices cannot reserve the same heads, and approval rechecks confirmed history', async () => {
    const first = move(20, p1.id, p3.id);
    const second = move(20, p1.id, p2.id);
    const [a, b] = await Promise.all([command(employee, 'save_entry', first), command(employee, 'save_entry', second)]);
    assert.deepEqual([a.status, b.status].sort(), ['aguardando_aprovacao', 'conflito']);
    const accepted = a.status === 'aguardando_aprovacao' ? first : second;
    await command(alice, 'decide_entry', { id: accepted.id, operationId: op, expectedVersion: 1, decision: 'aprovar', note: '' });
    assert.equal((await workspace(alice)).entries.find((e) => e.id === accepted.id).status, 'aprovado');
  });

  await t.test('exits and weighings tied to a pasture must fit that group; retroactive moves cannot break later history', async () => {
    const heads = (await pg.query(`select private.lot_pasture_replay('${op}','${lotData.id}',null,null,false) as r`)).rows[0].r.heads;
    const p1Heads = heads[p1.id];
    const death = { id: randomUUID(), operationId: op, farmId: farmA.id, submit: true, expectedVersion: null,
      entry: { kind: 'mortalidade', title: 'Baixa', amountCents: null, occurredAt: today, payload: { lotId: lotData.id, heads: p1Heads + 1, cause: 'Doença', notes: '', pastureId: p1.id } } };
    const conflict = await command(alice, 'save_entry', death);
    assert.equal(conflict.status, 'conflito');
    assert.match(conflict.conflictReason, /Pasto 01 tem/);
    const weighing = { id: randomUUID(), operationId: op, farmId: farmA.id, submit: true, expectedVersion: null,
      entry: { kind: 'pesagem', title: 'Pesagem', amountCents: null, occurredAt: today, payload: { lotId: lotData.id, method: 'medido', avgWeightKg: 230, headsWeighed: 5, notes: '', pastureId: randomUUID() } } };
    await assert.rejects(command(alice, 'save_entry', weighing), /não é desta fazenda/);
    // Lot edits are checked against the moves: fewer heads than already moved out of Pasto 01 is refused.
    const current = (await workspace(alice)).lots.find((l) => l.id === lotData.id);
    await assert.rejects(command(alice, 'update_lot', { ...current, previous: current, headsPurchased: 10 }), /Revise as movimentações/);
    await assert.rejects(command(alice, 'update_lot', { ...current, previous: current, pastureId: p2.id }), /Revise as movimentações/);
    // An old client that does not send the pasture cannot silently clear it.
    const { pastureId, ...withoutPasture } = current;
    await assert.rejects(command(alice, 'update_lot', { ...withoutPasture, previous: withoutPasture, supplier: 'Antigo' }), /mudou em outro aparelho/);
    assert.equal(pastureId, p1.id);
  });

  await t.test('editing a pasture detects conflicts, renames the lot text and cannot inactivate an occupied pasture', async () => {
    const stored = (await workspace(alice)).pastures.find((p) => p.id === p1.id);
    const previous = { name: stored.name, areaHa: stored.areaHa, forage: stored.forage, notes: stored.notes, active: stored.active };
    const edit = { id: p1.id, operationId: op, name: 'Pasto 01 - Baixada', areaHa: 22, forage: 'Brachiaria', notes: 'Cocho novo', active: true, previous };
    await assert.rejects(command(employee, 'update_pasture', edit), /exige um sócio/);
    await assert.rejects(command(alice, 'update_pasture', { ...edit, previous: { ...previous, areaHa: 21 } }), /mudou em outro aparelho/);
    await assert.rejects(command(alice, 'update_pasture', { ...edit, name: 'Pasto 02' }), /Já existe um pasto/);
    const renamed = await command(alice, 'update_pasture', edit);
    assert.equal(renamed.name, 'Pasto 01 - Baixada');
    assert.equal((await workspace(alice)).lots.find((l) => l.id === lotData.id).managementGroup, 'Pasto 01 - Baixada');
    const next = { name: renamed.name, areaHa: renamed.areaHa, forage: renamed.forage, notes: renamed.notes, active: true };
    await assert.rejects(command(alice, 'update_pasture', { ...edit, previous: next, active: false }), /Mova os animais/);
    // An empty pasture can be inactivated; it keeps its history and cannot receive animals.
    const empty = { ...p1, id: randomUUID(), name: 'Pasto vazio' };
    const saved = await command(alice, 'create_pasture', empty);
    const inactive = await command(alice, 'update_pasture', { ...empty, active: false,
      previous: { name: saved.name, areaHa: saved.areaHa, forage: saved.forage, notes: saved.notes, active: true } });
    assert.equal(inactive.active, false);
    await assert.rejects(command(alice, 'save_entry', move(1, p1.id, empty.id)), /inativo/);
    await assert.rejects(command(alice, 'create_lot', { ...lotData, id: randomUUID(), code: 'P-INATIVO', pastureId: empty.id }), /pasto ativo/);
    assert.ok((await workspace(alice)).pastures.some((p) => p.id === empty.id && !p.active));
  });

  await t.test('the server conversion is idempotent and matches the app id for existing lots', async () => {
    const legacyLot = randomUUID();
    await pg.query(`insert into private.lots(id, operation_id, farm_id, data) values ($1, $2, $3, $4)`,
      [legacyLot, op, farmA.id, JSON.stringify({ id: legacyLot, operationId: op, farmId: farmA.id, code: 'ANTIGO', managementGroup: 'Várzea Funda', headsPurchased: 3, purchasedAt: '2026-10-01' })]);
    const migration = (await readdir(new URL('../supabase/migrations/', import.meta.url))).find((name) => name.endsWith('_pastures_manejo.sql'));
    const sql = await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    const backfill = sql.slice(sql.indexOf('do $$'), sql.indexOf('end $$;', sql.indexOf('do $$')) + 'end $$;'.length);
    await pg.exec(backfill);
    await pg.exec(backfill);
    const data = (await pg.query('select data from private.lots where id = $1', [legacyLot])).rows[0].data;
    assert.equal(data.pastureId, legacyPastureId(farmA.id, 'Várzea Funda'));
    assert.equal(data.managementGroup, 'Várzea Funda');
    assert.equal((await pg.query('select count(*)::int as n from private.pastures where farm_id = $1 and name_key = private.pasture_key($2)', [farmA.id, 'Várzea Funda'])).rows[0].n, 1);
  });

  await t.test('a farm transfer lands in an active pasture of the destination farm', async () => {
    const target = { id: randomUUID(), operationId: randomUUID(), name: 'Destino pastos', city: null, pastureRentCents: 0 };
    await command(alice, 'create_farm', target);
    const arrival = { id: randomUUID(), operationId: target.operationId, farmId: target.id, name: 'Chegada', areaHa: 30, forage: 'Tanzânia', notes: '' };
    await command(alice, 'create_pasture', arrival);
    const source = { ...lotData, id: randomUUID(), code: 'P-TRANSF', purchasedAt: today };
    await command(alice, 'create_lot', source);
    const payload = { id: source.id, operationId: op, sourceFarmId: farmA.id, destinationFarmId: target.id, destinationLotId: randomUUID(),
      code: 'P-RECEBIDO', managementGroup: 'Chegada', pastureId: p1.id, date: today, expectedHeads: 40, expectedCostCents: 100000, expectedWeightKg: 200 };
    await assert.rejects(command(alice, 'transfer_lot', payload), /pasto ativo da fazenda de destino/);
    const requestId = randomUUID();
    const moved = await command(alice, 'transfer_lot', { ...payload, pastureId: arrival.id }, requestId);
    assert.equal(moved.lot.pastureId, arrival.id);
    assert.deepEqual(await command(alice, 'transfer_lot', { ...payload, pastureId: arrival.id }, requestId), moved);
    assert.equal((await workspace(alice)).lots.find((l) => l.id === payload.destinationLotId).pastureId, arrival.id);
  });

  await t.test('partners may draw an optional pasture outline; it is validated, conflict-checked and projected', async () => {
    const ring = [[-50.1, -15.1], [-50.09, -15.1], [-50.09, -15.09], [-50.1, -15.09], [-50.1, -15.1]];
    const draw = { id: p2.id, operationId: op, boundary: ring, previous: null };
    await assert.rejects(command(employee, 'update_pasture_boundary', draw), /exige um sócio/);
    await assert.rejects(command(alice, 'update_pasture_boundary', { ...draw, boundary: ring.slice(0, 3) }), /Contorno inválido/);
    await assert.rejects(command(alice, 'update_pasture_boundary', { ...draw, id: randomUUID() }), /Pasto não encontrado/);
    const requestId = randomUUID();
    const saved = await command(alice, 'update_pasture_boundary', draw, requestId);
    assert.deepEqual(saved.boundary, ring);
    assert.deepEqual(await command(alice, 'update_pasture_boundary', draw, requestId), saved);
    await assert.rejects(command(alice, 'update_pasture_boundary', draw), /mudou em outro aparelho/);
    // Employees see the outline: it is field information, not finance.
    assert.deepEqual((await workspace(employee)).pastures.find((p) => p.id === p2.id).boundary, ring);
    // Editing the registry keeps the outline.
    const stored = (await workspace(alice)).pastures.find((p) => p.id === p2.id);
    await command(alice, 'update_pasture', { id: p2.id, operationId: op, name: stored.name, areaHa: 13, forage: stored.forage, notes: '', active: true,
      previous: { name: stored.name, areaHa: stored.areaHa, forage: stored.forage, notes: stored.notes, active: stored.active } });
    assert.deepEqual((await workspace(alice)).pastures.find((p) => p.id === p2.id).boundary, ring);
    const cleared = await command(alice, 'update_pasture_boundary', { ...draw, boundary: null, previous: ring });
    assert.equal(cleared.boundary, null);
  });

  await t.test('only a never-used pasture can be deleted; one with history must be inactivated', async () => {
    const typo = { ...p1, id: randomUUID(), name: 'Pasto errado' };
    await command(alice, 'create_pasture', typo);
    const remove = { id: typo.id, operationId: op };
    await assert.rejects(command(employee, 'delete_pasture', remove), /exige um sócio/);
    await assert.rejects(command(alice, 'delete_pasture', { ...remove, id: randomUUID() }), /Pasto não encontrado/);
    const requestId = randomUUID();
    const deleted = await command(alice, 'delete_pasture', remove, requestId);
    assert.deepEqual(deleted, { id: typo.id, deleted: true });
    assert.deepEqual(await command(alice, 'delete_pasture', remove, requestId), deleted);
    assert.equal((await workspace(alice)).pastures.some((p) => p.id === typo.id), false);
    // Pasto 01 holds the lot and Pasto 03 only appears in moves: both keep their history.
    await assert.rejects(command(alice, 'delete_pasture', { id: p1.id, operationId: op }), /Inative-o/);
    await assert.rejects(command(alice, 'delete_pasture', { id: p3.id, operationId: op }), /Inative-o/);
  });

  await t.test('the activity log names who did what, without money, and employees see field activity only', async () => {
    const partnerLog = (await workspace(alice)).activity.filter((a) => a.operationId === op);
    const employeeLog = (await workspace(employee)).activity.filter((a) => a.operationId === op);
    const created = partnerLog.find((a) => a.kind === 'create_pasture' && a.subject.pastureId === p1.id);
    assert.equal(created.actorName, 'Alice');
    assert.equal(created.farmId, farmA.id);
    assert.equal(created.subject.name, 'Pasto 01 - Baixada');
    // A deleted pasture keeps its last name in the log.
    assert.ok(partnerLog.some((a) => a.kind === 'delete_pasture' && a.subject.name === 'Pasto errado'));
    const moved = partnerLog.find((a) => a.kind === 'save_entry' && a.subject.entryKind === 'manejo' && a.actorName === 'Campo');
    assert.equal(moved.subject.fromPasture, 'Pasto 01 - Baixada');
    assert.equal(typeof moved.subject.heads, 'number');
    // Newest first, and never an amount anywhere in the summaries.
    assert.deepEqual(partnerLog.map((a) => a.at), [...partnerLog.map((a) => a.at)].sort().reverse());
    assert.equal(JSON.stringify(partnerLog).includes('amountCents'), false);
    assert.ok(partnerLog.some((a) => a.kind === 'invite'));
    assert.equal(employeeLog.some((a) => a.kind === 'invite' || a.kind === 'create_farm'), false);
    assert.ok(employeeLog.some((a) => a.kind === 'create_pasture'));
    assert.ok(employeeLog.some((a) => a.subject.entryKind === 'mortalidade'));
    assert.equal((await workspace(outsider)).activity.some((a) => a.operationId === op), false);
  });

  await t.test('a lot transferred out leaves its pastures, which can then be inactivated', async () => {
    const target = { id: randomUUID(), operationId: randomUUID(), name: 'Destino saída', city: null, pastureRentCents: 0 };
    await command(alice, 'create_farm', target);
    const arrival = { id: randomUUID(), operationId: target.operationId, farmId: target.id, name: 'Recepção', areaHa: 10, forage: 'Massai', notes: '' };
    await command(alice, 'create_pasture', arrival);
    const exit = { ...p1, id: randomUUID(), name: 'Pasto de saída' };
    const saved = await command(alice, 'create_pasture', exit);
    const source = { ...lotData, id: randomUUID(), code: 'P-SAIDA', pastureId: exit.id, purchasedAt: today };
    await command(alice, 'create_lot', source);
    await command(alice, 'transfer_lot', { id: source.id, operationId: op, sourceFarmId: farmA.id, destinationFarmId: target.id, destinationLotId: randomUUID(),
      code: 'P-SAIDA-D', managementGroup: 'Recepção', pastureId: arrival.id, date: today, expectedHeads: 40, expectedCostCents: 100000, expectedWeightKg: 200 });
    const replay = (await pg.query(`select private.lot_pasture_replay('${op}','${source.id}',null,null,true) as r`)).rows[0].r;
    assert.deepEqual(replay, { error: null, heads: {} });
    const inactive = await command(alice, 'update_pasture', { ...exit, active: false,
      previous: { name: saved.name, areaHa: saved.areaHa, forage: saved.forage, notes: saved.notes, active: true } });
    assert.equal(inactive.active, false);
  });

  await t.test('employees receive the pasture of masked sales, so their occupancy matches the partners', async () => {
    const heads = (await pg.query(`select private.lot_pasture_replay('${op}','${lotData.id}',null,null,true) as r`)).rows[0].r.heads;
    const [pastureId] = Object.entries(heads).sort((a, b) => b[1] - a[1])[0];
    const sale = { id: randomUUID(), operationId: op, farmId: farmA.id, submit: true, expectedVersion: null,
      entry: { kind: 'venda', title: 'Venda do pasto', amountCents: 20000, occurredAt: today,
        payload: { lotId: lotData.id, heads: 1, buyer: 'Frigorífico', carcassKg: 300, pricePerArrobaCents: 1000, deductionsCents: 0, pastureId } } };
    await command(alice, 'save_entry', sale);
    const seen = (await workspace(employee)).entries;
    const masked = seen.find((e) => e.id === sale.id);
    assert.deepEqual({ amount: masked.amountCents, buyer: masked.payload.buyer, pasture: masked.payload.pastureId }, { amount: 0, buyer: '', pasture: pastureId });
    const activity = (await workspace(employee)).activity;
    assert.equal(activity.some((a) => a.subject.entryId === sale.id), false);
    assert.ok((await workspace(alice)).activity.some((a) => a.subject.entryId === sale.id && a.subject.entryKind === 'venda'));
    const order = seen.map((e) => e.createdAt);
    assert.deepEqual(order, [...order].sort().reverse());
  });
});

test('people: email-only invitations resolve account names, role changes revoke privileges, and removals preserve history', async () => {
  const op = randomUUID(), fid = randomUUID();
  await command(alice, 'create_farm', { id: fid, operationId: op, name: 'Gestão de pessoas', city: null, pastureRentCents: 0 });
  const contact = `${employee}@example.invalid`;
  const invitation = { id: randomUUID(), operationId: op, contact: `  ${contact.toUpperCase()}  `, role: 'funcionario', sharePct: null };
  const commandId = randomUUID();
  assert.equal((await command(alice, 'invite', invitation, commandId)).name, 'Campo');
  await pg.query('update auth.users set raw_user_meta_data=$1 where id=$2', [JSON.stringify({ name: 'Nome da conta atualizado' }), employee]);
  assert.equal((await command(alice, 'invite', invitation, commandId)).name, 'Campo', 'delivery replay returns the original result');
  assert.equal((await workspace(alice)).invites.find((i) => i.id === invitation.id).name, 'Nome da conta atualizado');
  await assert.rejects(command(alice, 'invite', { ...invitation, id: randomUUID() }), /convite pendente/);
  await command(employee, 'accept_invite', { id: invitation.id });
  const previous = { role: 'funcionario', sharePct: null };
  const promote = { id: employee, operationId: op, role: 'socio', previous };
  await assert.rejects(command(employee, 'update_member', promote), /sócio/);
  await assert.rejects(command(outsider, 'update_member', promote), /sócio/);
  await command(alice, 'update_member', promote);
  assert.equal((await workspace(employee)).memberships.find((m) => m.operationId === op && m.userId === employee).role, 'socio');
  assert.equal((await workspace(employee)).operations.find((o) => o.id === op).ownerId, alice);
  const account = { id: randomUUID(), operationId: op, name: 'Caixa de teste', kind: 'caixa', bank: '', agency: '', number: '', openingBalanceCents: 0, openingDate: '2026-10-01', active: true };
  await command(employee, 'create_account', account);
  assert.ok((await workspace(employee)).financialAccounts.some((a) => a.id === account.id));
  await assert.rejects(command(employee, 'update_member', { id: employee, operationId: op, role: 'funcionario', previous: { role: 'socio', sharePct: null } }), /próprio acesso/);
  await assert.rejects(command(employee, 'remove_member', { id: alice, operationId: op, previous: { role: 'socio', sharePct: 100 } }), /criador/);
  await assert.rejects(command(employee, 'update_member', { id: alice, operationId: op, role: 'funcionario', previous: { role: 'socio', sharePct: 100 } }), /criador/);
  await assert.rejects(command(alice, 'remove_member', { id: alice, operationId: op, previous: { role: 'socio', sharePct: 100 } }), /próprio/);
  await assert.rejects(command(alice, 'remove_member', { id: employee, operationId: op, previous }), /mudou em outro aparelho/);
  await command(alice, 'update_member', { id: employee, operationId: op, role: 'funcionario', previous: { role: 'socio', sharePct: null } });
  assert.equal((await workspace(employee)).financialAccounts.length, 0, 'demotion immediately masks finance on the server');
  await assert.rejects(command(employee, 'create_account', { ...account, id: randomUUID() }), /sócio/);
  await assert.rejects(command(alice, 'invite', { ...invitation, id: randomUUID() }), /já participa/);
  const remove = { id: employee, operationId: op, previous };
  const removeId = randomUUID();
  await command(alice, 'remove_member', remove, removeId);
  await command(alice, 'remove_member', remove, removeId);
  assert.ok(!(await workspace(employee)).operations.some((o) => o.id === op));
  assert.equal((await pg.query('select count(*)::int as n from private.financial_accounts where id=$1', [account.id])).rows[0].n, 1);
  assert.equal((await pg.query('select count(*)::int as n from auth.users where id=$1', [employee])).rows[0].n, 1);
  const actions = (await workspace(alice)).activity.filter((a) => a.operationId === op);
  assert.ok(actions.some((a) => a.kind === 'remove_member' && a.subject.name === 'Nome da conta atualizado'));
  const unknown = { id: randomUUID(), operationId: op, contact: 'future@example.invalid', role: 'funcionario', sharePct: null };
  assert.equal((await command(alice, 'invite', unknown)).name, unknown.contact);
  await assert.rejects(command(alice, 'invite', { ...unknown, id: randomUUID(), contact: 'invalid' }), /e-mail/);
  await pg.query('update auth.users set raw_user_meta_data=$1 where id=$2', [JSON.stringify({ name: 'Campo' }), employee]);
});

test('SQLite v14→v15 preserves account and outbox; image drafts survive authoritative snapshot replacement', async () => {
  const db = new DatabaseSync(':memory:');
  const sql = sqliteAdapter(db);
  await migrate(sql);
  db.exec("DROP TABLE local_documents; PRAGMA user_version=14; INSERT INTO cloud_outbox VALUES('queued-ocr','save_entry','{}','2026-11-06',NULL); INSERT INTO settings VALUES('account-proof','ana');");
  await migrate(sql);
  db.prepare('INSERT INTO local_documents VALUES(?,?,?)').run('capture', JSON.stringify({ serverId: 'document', base64: 'actual-captured-bytes', reviewed: { amountCents: 125040 } }), '2026-11-06');
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 15);
  assert.equal(db.prepare('SELECT value FROM settings WHERE key=?').get('account-proof').value, 'ana');
  assert.equal(db.prepare('SELECT count(*) n FROM cloud_outbox').get().n, 1);
  const { replaceCloudSnapshot } = await import('../apps/mobile/src/db/repo.ts');
  await replaceCloudSnapshot(sql, { users: [], operations: [], memberships: [], farms: [], lots: [], entries: [], invites: [] });
  assert.equal(JSON.parse(db.prepare('SELECT data FROM local_documents').get().data).reviewed.amountCents, 125040);
  assert.equal(db.prepare('SELECT count(*) n FROM cloud_outbox').get().n, 1);
  await migrate(sql);
  assert.equal(db.prepare('SELECT count(*) n FROM local_documents').get().n, 1, 'reinitialization does not remove drafts');
  db.close();
});
