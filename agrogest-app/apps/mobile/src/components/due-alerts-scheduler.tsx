import { router, useRootNavigationState, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { daysBetween, todayISO } from '@/domain/dates';
import { dueAlerts } from '@/domain/finance';
import { onDueAlertOpened, onDueAlertPermissionChanged, syncDueAlerts } from '@/services/due-alerts';
import { useApp } from '@/state/app-state';
import { useAuth } from '@/state/auth-state';

/** Reconciles this device on data, account, permission and foreground changes. */
export function DueAlertsScheduler() {
  const app = useApp();
  const auth = useAuth();
  const navigation = useRootNavigationState();
  const [revision, setRevision] = useState(0);
  const today = todayISO();
  const owner = app.signedIn && !auth.recovering && app.account
    ? { accountId: app.account.id, userId: app.user.id } : null;
  const alerts = owner ? dueAlerts(
    today === app.today ? app.allInstallments : app.allInstallments.map((view) => ({ ...view, daysToDue: daysBetween(today, view.dueDate) })),
    today, 60, app.alertOptions,
  ) : [];
  const key = JSON.stringify({ alerts, owner });

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const permission = onDueAlertPermissionChanged(refresh);
    const lifecycle = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { permission(); lifecycle.remove(); };
  }, []);

  useEffect(() => {
    const { alerts: next, owner: account } = JSON.parse(key);
    void syncDueAlerts(next, account);
  }, [key, revision]);

  useEffect(() => () => { void syncDueAlerts([]); }, []);

  // O toque usa o estado mais recente sem refazer a inscrição a cada mudança dos dados.
  const latest = useRef(app);
  useEffect(() => { latest.current = app; });
  const accountId = app.signedIn ? app.account?.id ?? null : null;
  const userId = app.user.id;

  // AppStateProvider renders its children only after loading the account's SQLite snapshot.
  useEffect(() => {
    if (!auth.ready || auth.recovering || !accountId || !navigation?.key) return;
    return onDueAlertOpened((opened) => {
      const app = latest.current;
      if (opened.accountId !== accountId || opened.userId !== userId) return;
      let destination: Href = app.visibleFarms.some((farm) => app.canSeeFinance(farm.operationId))
        ? '/financeiro' : '/atividade';
      const target = opened.target;
      if (target.kind === 'installment') {
        const view = app.allInstallments.find((item) => item.id === target.id && item.operationId === target.operationId);
        if (view && app.canSeeFinance(view.operationId)) {
          destination = { pathname: '/financeiro/parcela/[id]', params: { id: view.id } };
        }
      } else if (target.kind === 'recurrence') {
        const recurrence = app.recurrences.find((item) => item.id === target.id && item.operationId === target.operationId);
        if (recurrence && app.canSeeFinance(recurrence.operationId)) {
          destination = { pathname: '/financeiro/recorrencia', params: { id: recurrence.id } };
        }
      }
      router.push(destination);
    });
  }, [accountId, userId, auth.ready, auth.recovering, navigation?.key]);

  return null;
}
