import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

// Native adapters are replaced at the boundary; the SQLite, queue and sync code
// below runs from the app sources, with real SQL and controlled network replies.
const native = {
  appState: 'active', networkListener: null, lifecycleListener: null,
  networkRemoved: 0, lifecycleRemoved: 0,
};
const cloud = { account: 'account', calls: [], reply: async () => ({ data: workspace(), error: null }) };
globalThis.__agrogestSyncTest = { native, cloud };
const moduleURL = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'expo') return { shortCircuit: true, url: moduleURL(`
      export function requireOptionalNativeModule(name) {
        if (name !== 'ExpoTopicSubscriptionModule') throw new Error('Unexpected module');
        return globalThis.__agrogestSyncTest.native.topicAvailable === false ? null : {};
      }
    `) };
    if (specifier === 'react-native') return { shortCircuit: true, url: moduleURL(`
      const n = globalThis.__agrogestSyncTest.native;
      export const Platform = { OS: 'android' };
      export const AppState = {
        get currentState() { return n.appState; },
        addEventListener(event, listener) {
          n.lifecycleListener = listener;
          return { remove() { n.lifecycleRemoved++; } };
        },
      };
    `) };
    if (specifier === '@react-native-community/netinfo') return { shortCircuit: true, url: moduleURL(`
      const n = globalThis.__agrogestSyncTest.native;
      export default { configure(options) { n.reachabilityUrl = options.reachabilityUrl; }, addEventListener(listener) {
        n.networkListener = listener;
        return () => { n.networkRemoved++; };
      } };
    `) };
    if (specifier === 'expo-crypto') return next('node:crypto', context);
    if (/^\.\/supabase(?:\.ts)?$/.test(specifier) && context.parentURL?.includes('/src/services/')) {
      return { shortCircuit: true, url: moduleURL(`
        const c = globalThis.__agrogestSyncTest.cloud;
        export async function cloudToken(account) {
          if (account !== c.account) throw new Error('A conta mudou.');
          return 'token-for-' + account;
        }
        export function requireSupabase() { return { rpc(kind, payload) {
          return { setHeader(header, token) {
            c.calls.push({ kind, payload, header, token });
            return c.reply(kind, payload);
          } };
        } }; }
      `) };
    }
    return next(specifier, context);
  },
});

const { watchCloudSync } = await import('../apps/mobile/src/services/sync-lifecycle.ts');
const { syncCloud, enqueue, queuedCommands, queuedCommandCount, cloudTransaction } = await import('../apps/mobile/src/services/cloud-sync.ts');
const { migrate } = await import('../apps/mobile/src/db/schema.ts');
const repo = await import('../apps/mobile/src/db/repo.ts');

function workspace(users = []) {
  return { users, operations: [], memberships: [], farms: [], lots: [], entries: [], invites: [] };
}

test('cost centers and historical classification survive queue retry and snapshot roundtrip without rewriting expenses', async (t) => {
  const db = await database(t);
  cloud.account = 'account'; cloud.calls = [];
  const center = { id: 'center', operationId: 'op', name: 'Roda', parentId: null, isGroup: false, active: true, version: 1 };
  const classified = { id: 'entry', operationId: 'op', costCenterId: 'center', version: 1,
    history: [{ at: '2026-10-27T12:00:00Z', by: 'account', from: null, to: 'center', reason: 'Histórico' }] };
  await repo.saveDoc(db, 'costCenters', center);
  await repo.saveDoc(db, 'costClassifications', classified);
  const first = await enqueue(db, 'save_cost_center', { ...center, previous: null });
  const second = await enqueue(db, 'classify_cost', { id: 'entry', operationId: 'op', costCenterId: 'center', reason: 'Histórico', previous: null });
  let fail = true;
  cloud.reply = async (kind, args) => {
    if (kind === 'agrogest_workspace') return { data: { ...workspace(), costCenters: [center], costClassifications: [classified] }, error: null };
    if (fail) { fail = false; return { error: { code: 'network', message: 'offline' }, data: null }; }
    return { data: args.kind === 'save_cost_center' ? center : classified, error: null };
  };
  assert.equal((await syncCloud(db, 'account')).pending, 2);
  assert.equal((await repo.loadSnapshot(db)).costClassifications[0].costCenterId, 'center');
  assert.equal((await syncCloud(db, 'account')).pending, 0);
  assert.deepEqual(cloud.calls.filter((c) => c.kind === 'agrogest_command').map((c) => c.payload.command_id), [first, first, second]);
  const snapshot = await repo.loadSnapshot(db);
  assert.deepEqual(snapshot.costCenters, [center]);
  assert.deepEqual(snapshot.costClassifications, [classified]);
  assert.deepEqual(snapshot.entries, []);
  await repo.refreshOperationAccess(db, workspace(), 'op');
  assert.deepEqual((await repo.loadSnapshot(db)).costClassifications, []);
  assert.deepEqual((await repo.loadSnapshot(db)).costCenters, []);
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const db = {
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, params = []) { return sqlite.prepare(sql).run(...params); },
    async getFirstAsync(sql, params = []) { return sqlite.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, params = []) { return sqlite.prepare(sql).all(...params); },
    async withTransactionAsync(task) {
      sqlite.exec('BEGIN');
      try { await task(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  await migrate(db);
  return db;
}

test('automatic sync only runs in foreground while connected and releases all listeners', (t) => {
  native.appState = 'active';
  native.networkRemoved = native.lifecycleRemoved = 0;
  let tick;
  let syncs = 0;
  const networks = [];
  t.mock.method(globalThis, 'setInterval', (callback, ms) => {
    assert.equal(ms, 30000);
    tick = callback;
    return 17;
  });
  let cleared;
  t.mock.method(globalThis, 'clearInterval', (handle) => { cleared = handle; });
  const stop = watchCloudSync(async () => { syncs++; }, (available) => networks.push(available));
  tick();
  assert.equal(syncs, 0, 'wait for the initial network status');
  native.networkListener({ isConnected: true, isInternetReachable: true });
  native.networkListener({ isConnected: true, isInternetReachable: true });
  assert.equal(syncs, 1, 'unchanged network details do not repeat the sync');
  native.lifecycleListener('background');
  tick();
  native.networkListener({ isConnected: false, isInternetReachable: false });
  native.networkListener({ isConnected: true, isInternetReachable: true });
  assert.equal(syncs, 1, 'background network events do not pull a workspace');
  native.lifecycleListener('active');
  assert.equal(syncs, 2);
  tick();
  assert.equal(syncs, 3);
  native.networkListener({ isConnected: true, isInternetReachable: false });
  tick();
  assert.equal(syncs, 3, 'a Wi-Fi connection without internet is offline');
  native.networkListener({ isConnected: true, isInternetReachable: null });
  assert.equal(syncs, 4, 'unknown reachability retains the existing optimistic policy');
  stop();
  const events = networks.length;
  native.networkListener({ isConnected: true });
  native.lifecycleListener('active');
  tick();
  assert.equal(networks.length, events);
  assert.equal(syncs, 4);
  assert.equal(cleared, 17);
  assert.equal(native.networkRemoved, 1);
  assert.equal(native.lifecycleRemoved, 1);
});

test('the queue badge counts in SQLite without fetching or parsing payloads', async (t) => {
  const db = await database(t);
  await enqueue(db, 'create_farm', { name: 'Fazenda', notes: 'a'.repeat(100000) });
  await enqueue(db, 'create_farm', { name: 'Outra fazenda' });
  t.mock.method(db, 'getAllAsync', () => { throw new Error('count must not fetch payloads'); });
  assert.equal(await queuedCommandCount(db), 2);
});

test('simultaneous sync triggers share one request and preserve edits queued during its reply', async (t) => {
  const db = await database(t);
  const entered = deferred();
  const release = deferred();
  cloud.calls = [];
  cloud.account = 'account';
  cloud.reply = async () => { entered.resolve(); await release.promise; return { data: workspace(), error: null }; };
  const first = syncCloud(db, 'account');
  assert.strictEqual(syncCloud(db, 'account'), first);
  await entered.promise;
  await cloudTransaction(db, async () => {
    await repo.insertUser(db, { id: 'local', name: 'Ainda no aparelho', email: null });
    await enqueue(db, 'create_farm', { name: 'Alteração durante a rede' });
  });
  release.resolve();
  assert.deepEqual(await first, { pending: 1, error: null });
  assert.equal(cloud.calls.length, 1);
  assert.equal(cloud.calls[0].token, 'Bearer token-for-account');
  assert.equal((await repo.loadSnapshot(db)).users[0].id, 'local');
  assert.equal(await queuedCommandCount(db), 1);
});

test('an account mismatch never sends queued data and a later retry keeps its command ID', async (t) => {
  const db = await database(t);
  const id = await enqueue(db, 'create_farm', { name: 'Pendente' });
  cloud.calls = [];
  cloud.account = 'another-account';
  await assert.rejects(syncCloud(db, 'account'), /conta mudou/);
  assert.equal(cloud.calls.length, 0);
  assert.equal(await queuedCommandCount(db), 1);
  cloud.account = 'account';
  let fail = true;
  cloud.reply = async (kind) => {
    if (kind === 'agrogest_workspace') return { data: workspace(), error: null };
    if (fail) { fail = false; return { data: null, error: { code: 'network', message: 'lost reply' } }; }
    return { data: null, error: null };
  };
  assert.equal((await syncCloud(db, 'account')).pending, 1);
  assert.ok((await queuedCommands(db))[0].error);
  assert.deepEqual(await syncCloud(db, 'account'), { pending: 0, error: null });
  assert.deepEqual(cloud.calls.filter((call) => call.kind === 'agrogest_command').map((call) => call.payload.command_id), [id, id]);
});

test('missing native topic support never evaluates the notifications entry point', async (t) => {
  native.topicAvailable = false;
  let imports = 0;
  const previousRequire = Object.getOwnPropertyDescriptor(globalThis, 'require');
  Object.defineProperty(globalThis, 'require', { configurable: true, value: () => {
    imports++;
    throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
  } });
  t.after(() => {
    native.topicAvailable = true;
    if (previousRequire) Object.defineProperty(globalThis, 'require', previousRequire);
    else delete globalThis.require;
  });
  const alerts = await import('../apps/mobile/src/services/due-alerts.ts?missing-native');
  assert.equal(await alerts.requestDueAlertPermission(), false);
  await alerts.syncDueAlerts([]);
  const unsubscribe = alerts.onDueAlertOpened(() => assert.fail('no native events are available'));
  assert.doesNotThrow(unsubscribe);
  assert.equal(imports, 0, 'a caught import still reaches Metro; avoid evaluating it entirely');
});

test('logout reconciles after a slow native schedule so the previous account leaves no alerts', async (t) => {
  const scheduled = new Map([['another-app', { identifier: 'another-app', content: { title: 'Other', body: '' } }]]);
  const entered = deferred();
  const release = deferred();
  const notifications = {
    AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler() {}, async setNotificationChannelAsync() {},
    async getPermissionsAsync() { return { granted: true }; },
    async getAllScheduledNotificationsAsync() { return [...scheduled.values()]; },
    async cancelScheduledNotificationAsync(id) { scheduled.delete(id); },
    async scheduleNotificationAsync(notification) {
      entered.resolve();
      await release.promise;
      scheduled.set(notification.identifier, notification);
    },
  };
  const previousRequire = Object.getOwnPropertyDescriptor(globalThis, 'require');
  Object.defineProperty(globalThis, 'require', { configurable: true, value: (name) => {
    assert.equal(name, 'expo-notifications');
    return notifications;
  } });
  t.after(() => {
    if (previousRequire) Object.defineProperty(globalThis, 'require', previousRequire);
    else delete globalThis.require;
  });
  const { syncDueAlerts } = await import('../apps/mobile/src/services/due-alerts.ts');
  const oldAccount = syncDueAlerts([{ id: 'old-account', date: '2099-10-22', title: 'Conta anterior', body: 'Privado' }]);
  await entered.promise;
  const logout = syncDueAlerts([]);
  release.resolve();
  await Promise.all([oldAccount, logout]);
  assert.deepEqual([...scheduled.keys()], ['another-app']);
});
