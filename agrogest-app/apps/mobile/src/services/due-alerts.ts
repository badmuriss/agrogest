import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { ALERT_HOUR, type DueAlert, type DueAlertTarget } from '@/domain/finance';

type NotificationsModule = typeof import('expo-notifications');

const PREFIX = 'agrogest-due:';
const CHANNEL = 'vencimentos';

/** Load on demand so runtimes without the native module can still use the app. */
export interface DueAlertOwner { accountId: string; userId: string }
export interface OpenedDueAlert extends DueAlertOwner { target: DueAlertTarget }

const permissionListeners = new Set<() => void>();
export function onDueAlertPermissionChanged(listener: () => void): () => void {
  permissionListeners.add(listener);
  return () => { permissionListeners.delete(listener); };
}

let cached: NotificationsModule | null | undefined;
function notifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  try {
    // SDK 58's public entry point eagerly imports topic subscriptions even when
    // we only use local alerts. Some Expo Go runtimes omit this Android module.
    // Check before evaluating that entry point: Metro can report its native
    // import failure before an outer catch is able to provide a fallback.
    if (Platform.OS === 'android' && !requireOptionalNativeModule('ExpoTopicSubscriptionModule')) {
      cached = null;
      return cached;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-notifications') as NotificationsModule;
    module.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    cached = module;
  } catch {
    cached = null;
  }
  return cached;
}

let channelReady = false;
async function ensureChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Vencimentos',
    description: 'Parcelas a pagar e a receber perto do vencimento.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Pede a permissão uma vez (o sistema não pergunta de novo depois de uma resposta). */
export async function requestDueAlertPermission(): Promise<boolean> {
  const Notifications = notifications();
  if (!Notifications) return false;
  try {
    await ensureChannel(Notifications);
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  } finally {
    permissionListeners.forEach((listener) => listener());
  }
}

function fireAt(alert: DueAlert): Date {
  const [y, m, d] = alert.date.split('-').map(Number);
  return new Date(y, m - 1, d, ALERT_HOUR, 0, 0);
}

/**
 * Deixa agendados exatamente os avisos pedidos: cancela os que não valem mais (parcela paga,
 * conta estornada, troca de conta) e agenda os novos. Avisos cuja hora já passou não voltam.
 */
let pendingSync: Promise<void> = Promise.resolve();

let syncRevision = 0;

export function syncDueAlerts(alerts: DueAlert[], owner: DueAlertOwner | null = null): Promise<void> {
  const revision = ++syncRevision;
  const work = pendingSync.catch(() => {}).then(() => reconcileDueAlerts(alerts, owner, revision));
  pendingSync = work;
  return work;
}

function payload(alert: DueAlert, owner: DueAlertOwner | null) {
  return {
    version: 1,
    accountId: owner?.accountId ?? null,
    userId: owner?.userId ?? null,
    target: alert.target ?? { kind: 'finance' },
    fireAt: fireAt(alert).getTime(),
    channelId: CHANNEL,
  };
}

function payloadKey(data: Record<string, unknown> | undefined): string {
  const target = data?.target as { kind?: string; id?: string; operationId?: string } | undefined;
  return JSON.stringify([data?.version, data?.accountId, data?.userId, data?.fireAt, data?.channelId,
    target?.kind, target?.id, target?.operationId]);
}

function triggerMatches(trigger: unknown, date: Date): boolean {
  if (!trigger || typeof trigger !== 'object') return false;
  const value = trigger as { type?: string; value?: number; date?: number | Date; channelId?: string; repeats?: boolean };
  // Android returns a native date/value, whereas iOS serializes DATE as a non-repeating interval.
  if (value.type === 'date') {
    const timestamp = value.value ?? (value.date instanceof Date ? value.date.getTime() : value.date);
    return timestamp === date.getTime() && value.channelId === CHANNEL;
  }
  // The absolute date is retained in our payload because iOS does not return it in the trigger.
  return Platform.OS === 'ios' && value.type === 'timeInterval' && value.repeats === false;
}

async function dismissOtherAccounts(Notifications: NotificationsModule, owner: DueAlertOwner | null, revision: number) {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notification of presented) {
      if (revision !== syncRevision) return;
      const { identifier, content } = notification.request;
      if (identifier.startsWith(PREFIX) && (!owner || content.data?.accountId !== owner.accountId || content.data?.userId !== owner.userId)) {
        await Notifications.dismissNotificationAsync(identifier);
      }
    }
  } catch {
    // A presenter unavailable on this runtime must not prevent schedule reconciliation.
  }
}

async function reconcileDueAlerts(alerts: DueAlert[], owner: DueAlertOwner | null, revision: number): Promise<void> {
  const Notifications = notifications();
  if (!Notifications || revision !== syncRevision) return;
  try {
    await dismissOtherAccounts(Notifications, owner, revision);
    if (revision !== syncRevision) return;
    await ensureChannel(Notifications);
    const permission = await Notifications.getPermissionsAsync();
    const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) => n.identifier.startsWith(PREFIX));
    const wanted = new Map(alerts.filter((a) => fireAt(a).getTime() > Date.now()).map((a) => [PREFIX + a.id, a]));
    for (const n of scheduled) {
      if (revision !== syncRevision) return;
      const alert = wanted.get(n.identifier);
      if (!alert || !permission.granted || n.content.title !== alert.title || n.content.body !== alert.body ||
          payloadKey(n.content.data) !== payloadKey(payload(alert, owner)) || !triggerMatches(n.trigger, fireAt(alert))) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      } else {
        wanted.delete(n.identifier);
      }
    }
    if (!permission.granted) return;
    for (const [identifier, alert] of wanted) {
      if (revision !== syncRevision) return;
      if (fireAt(alert).getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: { title: alert.title, body: alert.body, data: payload(alert, owner) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt(alert), channelId: CHANNEL },
      });
      // A logout can arrive while the native call is still in flight.
      if (revision !== syncRevision) {
        await Notifications.cancelScheduledNotificationAsync(identifier);
        return;
      }
    }
  } catch {
    // A later foreground/permission/data change retries; vencimentos remain available in the app.
  }
}

const handledResponses = new Set<string>();

function openedAlert(data: Record<string, unknown> | undefined): OpenedDueAlert | null {
  if (!data || data.version !== 1 || typeof data.accountId !== 'string' || typeof data.userId !== 'string') return null;
  const target = data.target as Record<string, unknown> | undefined;
  let destination: DueAlertTarget = { kind: 'finance' };
  if (target && (target.kind === 'installment' || target.kind === 'recurrence') &&
      typeof target.id === 'string' && typeof target.operationId === 'string') {
    destination = { kind: target.kind, id: target.id, operationId: target.operationId };
  }
  return { accountId: data.accountId, userId: data.userId, target: destination };
}

/** Subscribe only once auth, account snapshot and router are ready; also handles a cold launch. */
export function onDueAlertOpened(open: (alert: OpenedDueAlert) => void): () => void {
  const Notifications = notifications();
  if (!Notifications) return () => {};
  const receive = (response: import('expo-notifications').NotificationResponse) => {
    const { notification } = response;
    if (!notification.request.identifier.startsWith(PREFIX)) return;
    const key = JSON.stringify([notification.request.identifier, notification.date, response.actionIdentifier]);
    if (handledResponses.has(key)) return;
    handledResponses.add(key);
    // Bound memory while retaining deduplication across provider/account remounts.
    if (handledResponses.size > 100) handledResponses.delete(handledResponses.values().next().value!);
    const alert = openedAlert(notification.request.content.data);
    try { Notifications.clearLastNotificationResponse(); } catch { /* Unsupported runtime. */ }
    if (alert) open(alert);
  };
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener(receive);
    try {
      const response = Notifications.getLastNotificationResponse();
      if (response) receive(response);
    } catch { /* The live listener remains available. */ }
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}
