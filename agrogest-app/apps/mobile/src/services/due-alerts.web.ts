import type { DueAlert, DueAlertTarget } from '@/domain/finance';

export interface DueAlertOwner { accountId: string; userId: string }
export interface OpenedDueAlert extends DueAlertOwner { target: DueAlertTarget }

export function onDueAlertPermissionChanged(_listener: () => void): () => void {
  return () => {};
}

/** Na web não há aviso agendado: os vencimentos aparecem em Pendências e no Financeiro. */
export async function requestDueAlertPermission(): Promise<boolean> {
  return false;
}

export async function syncDueAlerts(_alerts: DueAlert[], _owner: DueAlertOwner | null = null): Promise<void> {}

export function onDueAlertOpened(_open: (alert: OpenedDueAlert) => void): () => void {
  return () => {};
}
