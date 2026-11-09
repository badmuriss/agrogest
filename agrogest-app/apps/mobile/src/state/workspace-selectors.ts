import type { Snapshot } from '@/db/repo';
import { localActivity, type ActivityItem } from '@/domain/activity';
import {
  cardInvoices,
  DEFAULT_CATEGORIES,
  installmentViews,
  parseAlertDays,
  pendingLotPurchases,
  type AlertOptions,
  type ObligationExtras,
} from '@/domain/finance';
import { createLotSummarizer, type LotSummary } from '@/domain/lot-metrics';
import { lotTimelines, UNKNOWN_PASTURE } from '@/domain/pasture';
import { costEntries } from '@/domain/stock';
import { shiftMonth } from '@/domain/dates';
import { invoiceView, recurrenceOccurrences } from '@/domain/treasury';

/** Projeções de uma leitura, sem I/O. O provedor as reutiliza até mudar dados, pessoa ou dia. */
export function selectWorkspace(snapshot: Snapshot, userId: string, cloudEnabled: boolean, today: string) {
  const { users, memberships, farms, pastures, lots, settings } = snapshot;
  const entries = costEntries(snapshot.entries);
  const visibleOperationIds = new Set(memberships.filter((m) => m.userId === userId).map((m) => m.operationId));
  const visibleFarms = farms.filter((f) => visibleOperationIds.has(f.operationId));
  // Com uma fazenda só, "visão geral" não faz sentido: o contexto é ela.
  const contextFarm =
    visibleFarms.find((f) => f.id === settings.contextFarmId) ?? (visibleFarms.length === 1 ? visibleFarms[0] : null);
  const scopedFarms = contextFarm ? [contextFarm] : visibleFarms;
  const scopedFarmIds = new Set(scopedFarms.map((f) => f.id));
  const visibleEntries = entries.filter((e) => visibleOperationIds.has(e.operationId));
  const visiblePastures = pastures.filter((p) => visibleOperationIds.has(p.operationId));
  const pastureName = (id: string | null | undefined) =>
    !id || id === UNKNOWN_PASTURE ? 'Pasto não informado' : (pastures.find((p) => p.id === id)?.name ?? 'Pasto indisponível');
  const activity: ActivityItem[] = (cloudEnabled
      ? snapshot.activity
      : localActivity({
          entries: visibleEntries,
          pastures: visiblePastures,
          users,
          lotCode: (lotId) => lots.find((l) => l.id === lotId)?.code,
          pastureName,
          supply: (id) => snapshot.supplies.find((x) => x.id === id),
        })
    ).filter((a) => visibleOperationIds.has(a.operationId) && (a.farmId ? scopedFarmIds.has(a.farmId) : scopedFarms.some((f) => f.operationId === a.operationId)));
  const visibleLots = lots.filter((l) => visibleOperationIds.has(l.operationId));
  // Financeiro só para sócio: no protótipo os dados estão todos no aparelho, inclusive em "Ver como".
  const financeOperationIds = new Set(
    memberships.filter((m) => m.userId === userId && m.role === 'socio').map((m) => m.operationId),
  );
  const categories = [...DEFAULT_CATEGORIES, ...snapshot.categories.filter((c) => c.operationId && visibleOperationIds.has(c.operationId))];
  const financeOnly = <T extends { operationId: string }>(rows: T[]) => rows.filter((x) => financeOperationIds.has(x.operationId));
  const costCenters = financeOnly(snapshot.costCenters ?? []);
  const costClassifications = financeOnly(snapshot.costClassifications ?? []);
  const accounts = financeOnly(snapshot.accounts);
  const payments = financeOnly(snapshot.payments);
  const counterparties = financeOnly(snapshot.counterparties);
  const supplies = snapshot.supplies.filter((x) => visibleOperationIds.has(x.operationId));
  const financeLots = financeOnly(lots);
  const movements = financeOnly(snapshot.movements);
  const financings = financeOnly(snapshot.financings);
  const renegotiations = financeOnly(snapshot.renegotiations);
  const recurrences = financeOnly(snapshot.recurrences);
  const budgets = financeOnly(snapshot.budgets);
  const titles = financeOnly(snapshot.titles);
  const extras: ObligationExtras = { financings, renegotiations, payments, titles, users };
  const obligationViews = installmentViews(
    financeOnly(visibleEntries),
    payments,
    today,
    categories,
    financeLots,
    extras,
  );
  // Faturas do cartão entram na lista de contas a pagar (pagas por transferência para o cartão).
  const invoices = accounts.flatMap((a) => cardInvoices(a, payments, movements, today));
  const firstFarmOf = (operationId: string) => farms.find((f) => f.operationId === operationId)?.id ?? '';
  const allInstallments = [
    ...obligationViews,
    ...invoices.filter((i) => i.chargesCents > 0).map((i) => invoiceView(i, accounts.find((a) => a.id === i.accountId)!, firstFarmOf(i.operationId), today)),
  ];
  const installments = allInstallments.filter((v) => scopedFarmIds.has(v.farmId));
  const allOccurrences = recurrenceOccurrences(recurrences, entries, shiftMonth(today.slice(0, 7), 12), today);
  const occurrences = allOccurrences.filter((o) => scopedFarmIds.has(o.farmId));
  const partnersOf = (operationId: string) =>
    memberships
      .filter((m) => m.operationId === operationId && m.role === 'socio')
      .map((m) => ({ id: m.userId, name: users.find((u) => u.id === m.userId)?.name ?? 'Sócio', sharePct: m.sharePct }));
  const alertOptions: AlertOptions = {
    days: parseAlertDays(settings[`alertDays:${userId}`]),
    overdueReminder: settings[`overdueReminder:${userId}`] !== '0',
    invoices,
    occurrences: allOccurrences,
  };
  const pendingPurchases = pendingLotPurchases(visibleLots, scopedFarmIds, financeOperationIds);
  const allPendingPurchases = pendingLotPurchases(visibleLots, new Set(visibleFarms.map((f) => f.id)), financeOperationIds);
  const timelines = lotTimelines(visibleLots, visibleEntries, pastureName);
  const summarize = createLotSummarizer(lots, entries, farms, today);
  const lotSummaries = lots
    .filter((l) => scopedFarmIds.has(l.farmId))
    .map((l) => summarize(l.id))
    .filter((s): s is LotSummary => s !== undefined);

  return {
    entries,
    visibleOperationIds,
    visibleFarms,
    contextFarm,
    scopedFarms,
    scopedFarmIds,
    visibleEntries,
    visiblePastures,
    pastureName,
    activity,
    visibleLots,
    financeOperationIds,
    categories,
    costCenters,
    costClassifications,
    accounts,
    payments,
    counterparties,
    supplies,
    movements,
    financings,
    renegotiations,
    recurrences,
    budgets,
    titles,
    obligationViews,
    invoices,
    allInstallments,
    installments,
    allOccurrences,
    occurrences,
    partnersOf,
    alertOptions,
    pendingPurchases,
    allPendingPurchases,
    financeLots,
    timelines,
    summarize,
    lotSummaries,
  };
}
