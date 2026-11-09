import { randomUUID } from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import * as repo from '@/db/repo';
import { wipeDatabase } from '@/db/schema';
import * as sample from '@/db/seed';
import { approvalBlockReason, eligibleApprovers, requiresApproval } from '@/domain/approval';
import { nowISO, todayISO } from '@/domain/dates';
import { closeRing, isSimpleRing, isValidPosition, type Position } from '@/domain/geo';
import type { ActivityItem } from '@/domain/activity';
import {
  accountBalance,
  accountErrors,
  installmentViews,
  lotHasPayments,
  paymentConflict,
  purchasePlanError,
  paymentErrors,
  REVENUE_NATURES,
  reversalBlock,
  SETTLING,
  type AccountInput,
  type AlertOptions,
  type CardInvoice,
  type InstallmentView,
  type PaymentInput,
  type RecurrenceOccurrence,
} from '@/domain/finance';
import type { FinanceBook } from '@/domain/reports';
import type { SheetRow } from '@/domain/sheet-import';
import {
  financingErrors,
  movementErrors,
  recurrenceErrors,
  renegotiationErrors,
  undoRenegotiationBlock,
  type FinancingInput,
  type MovementInput,
  type RecurrenceInput,
  type RenegotiationInput,
} from '@/domain/treasury';
import { purchaseItems, stockPositions, supplyErrors, type StockPosition, type SupplyInput } from '@/domain/stock';
import { lotEditLimits, type LotEditLimits } from '@/domain/lot-edit';
import { prepareLotTransfer, type TransferLotInput } from '@/domain/lot-transfer';
import { entryLotIds, type LotSummary } from '@/domain/lot-metrics';
import {
  buildPastureReports,
  lotGroups as groupsOf,
  pastureConflict,
  pastureErrors,
  pastureInUse,
  RESERVING,
  type PastureFilter,
  type PastureInput,
  type PastureReportResult,
} from '@/domain/pasture';
import { assertCostCenter, validateCostCenter } from '@/domain/cost-centers';
import type {
  Budget,
  CostCenter,
  CostClassification,
  CategoryNature,
  Counterparty,
  Decision,
  Entry,
  EntryContent,
  Farm,
  Financing,
  FinancialAccount,
  ImportedTitle,
  Invite,
  LedgerCategory,
  Lot,
  MemberRole,
  Membership,
  Movement,
  Operation,
  Pasture,
  Payment,
  PaymentMethod,
  PurchasePlan,
  Recurrence,
  Renegotiation,
  Supply,
  User,
} from '@/domain/types';
import {
  decide as decideEntry,
  receive,
  submittedStatus,
  SYSTEM_USER,
  syncAll,
  type WorkflowContext,
} from '@/domain/workflow';
import { cloudTransaction, enqueue, queuedCommandCount, queuedCommands, syncCloud, type CloudCommandKind } from '@/services/cloud-sync';
import { cloudTask } from '@/services/cloud-task';
import { watchCloudSync } from '@/services/sync-lifecycle';
import { authError, cloudEnabled, cloudToken, requireSupabase } from '@/services/supabase';
import { authRedirect, useAuth } from '@/state/auth-state';
import { countAppRead } from '@/state/perf-probe';
import { PreferencesProvider } from '@/state/preferences';
import { shareSnapshot } from '@/state/share-snapshot';
import { createSyncStatusStore, SyncStatusProvider, type ContextTransition } from '@/state/sync-status';
import { selectWorkspace } from '@/state/workspace-selectors';
import { usePalette } from '@/theme';

export type EntryInput = EntryContent & {
  operationId: string;
  farmId: string;
  title: string;
  amountCents: number | null;
  occurredAt: string;
};

export type FarmInput = Pick<Farm, 'name' | 'city' | 'pastureRentCents'>;
export type LotInput = Omit<Lot, 'id' | 'operationId'>;
/** Fazenda fica fixa: pesagens, vendas e rateios do lote pertencem a ela. */
export type LotEditInput = Omit<Lot, 'id' | 'operationId' | 'farmId'>;
export type InviteInput = Pick<Invite, 'operationId' | 'contact' | 'role' | 'sharePct'>;
/** Parcela da compra do lote que já foi paga no ato: vira uma baixa junto com o plano. */
export interface PaidAtPurchase {
  index: number;
  accountId: string;
  paidAt: string;
  method: PaymentMethod;
}

export type CounterpartyInput = Pick<Counterparty, 'name' | 'kind' | 'document' | 'contact' | 'pixKey' | 'notes' | 'active'>;

type EntryRef = Pick<Entry, 'authorId' | 'operationId' | 'kind'>;

export interface Person {
  user: User;
  role: MemberRole;
  sharePct: number | null;
}

const MASCULINE_PLACES = ['sítio', 'sitio', 'rancho', 'haras', 'retiro'];

function enteringPhrase(place: string): string {
  return MASCULINE_PLACES.includes(place.split(' ')[0].toLowerCase()) ? 'Entrando no' : 'Entrando na';
}

/** "gabriel.freitas" → "Gabriel Freitas": nome provisório quando a pessoa só informa o e-mail. */
function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function firstName(name: string): string {
  return name.trim().split(' ')[0] ?? '';
}

const SIGNED_OUT: User = { id: '', name: '', email: null };

interface AppContextValue {
  cloudMode: boolean;
  signedIn: boolean;
  /** Conta logada neste aparelho. */
  account: User | null;
  today: string;
  /** Pessoa em uso: a conta, ou outra pessoa simulada em "Ver como". */
  user: User;
  users: User[];
  online: boolean;
  hasSampleData: boolean;
  /** Fazendas das operações em que o usuário tem vínculo. */
  visibleFarms: Farm[];
  /** Fazenda escolhida no seletor de contexto; null = todas. */
  contextFarm: Farm | null;
  scopedFarms: Farm[];
  /** Lotes das fazendas no contexto atual. */
  lotSummaries: LotSummary[];
  /** Lançamentos de todas as operações visíveis. */
  visibleEntries: Entry[];
  /** Quem fez o quê, mais recente primeiro, nas fazendas do contexto. */
  activity: ActivityItem[];
  /** Pastos das fazendas visíveis, ativos e inativos. */
  pastures: Pasture[];
  /** Pastos da fazenda; por padrão só os ativos. */
  farmPastures: (farmId: string, includeInactive?: boolean) => Pasture[];
  pasture: (id: string) => Pasture | undefined;
  pastureName: (id: string | null | undefined) => string;
  /** Grupos confirmados do lote por pasto, hoje. */
  lotGroups: (lotId: string) => { pastureId: string; heads: number }[];
  /** Ocupação, permanências e GMD por pasto nas fazendas pedidas. */
  pastureReport: (farmIds: string[], filter: PastureFilter) => PastureReportResult;
  /** Cadastra e edita pastos: só sócio da operação. */
  canManagePastures: (operationId: string) => boolean;
  /** Convites pendentes das operações do usuário. */
  invites: Invite[];
  /** Plano de contas: padrão + criadas nas operações visíveis. */
  categories: LedgerCategory[];
  costCenters: CostCenter[];
  costClassifications: CostClassification[];
  saveCostCenter: (input: Omit<CostCenter, 'id' | 'createdAt' | 'version'>, id?: string) => Promise<void>;
  classifyCost: (entryId: string, costCenterId: string | null, reason: string) => Promise<void>;
  /** Financeiro das operações em que o usuário é sócio (vazio para funcionário). */
  accounts: FinancialAccount[];
  counterparties: Counterparty[];
  payments: Payment[];
  /** Parcelas a pagar e a receber das fazendas do contexto, com a situação de hoje. */
  installments: InstallmentView[];
  /** Todas as parcelas das operações em que é sócio (para os avisos do aparelho). */
  allInstallments: InstallmentView[];
  /** Compras sem plano no contexto, incluindo origens de transferências acessíveis ao sócio. */
  pendingPurchases: Lot[];
  /** Compras sem plano de todas as fazendas visíveis, para o sino. */
  allPendingPurchases: Lot[];
  accountBalance: (accountId: string) => number;
  /** Transferências, aportes, retiradas, distribuições, liberações e adiantamentos. */
  movements: Movement[];
  financings: Financing[];
  renegotiations: Renegotiation[];
  recurrences: Recurrence[];
  budgets: Budget[];
  titles: ImportedTitle[];
  /** Faturas dos cartões das operações em que é sócio. */
  invoices: CardInvoice[];
  /** Meses das despesas recorrentes (lançados ou previstos) das fazendas do contexto, até 12 meses à frente. */
  occurrences: RecurrenceOccurrence[];
  /** Tudo o que os relatórios gerenciais leem, nas fazendas pedidas (padrão: as do contexto). */
  financeBook: (farmIds?: string[]) => FinanceBook;
  /** Sócios da operação (para aporte, retirada, distribuição e pagamento com dinheiro próprio). */
  partnersOf: (operationId: string) => { id: string; name: string; sharePct: number | null }[];
  /** Antecedência dos avisos e lembrete das vencidas, por pessoa neste aparelho. */
  alertOptions: AlertOptions;
  setAlertPreferences: (days: number[], overdueReminder: boolean) => Promise<void>;
  registerMovement: (input: MovementInput) => Promise<Movement>;
  /** Estorna uma movimentação efetivada ou descarta uma em conflito. */
  reverseMovement: (movementId: string, reason: string) => Promise<void>;
  /** Cadastra o contrato; com `release`, registra também a liberação na conta. */
  saveFinancing: (operationId: string, input: FinancingInput, release?: { accountId: string; occurredAt: string; cents: number }) => Promise<Financing>;
  renegotiate: (input: RenegotiationInput) => Promise<Renegotiation>;
  undoRenegotiation: (renegotiationId: string, reason: string) => Promise<void>;
  saveRecurrence: (operationId: string, input: RecurrenceInput, id?: string) => Promise<Recurrence>;
  setBudget: (operationId: string, categoryId: string, month: string, cents: number) => Promise<void>;
  /** Importa da planilha as contas em aberto (sem duplicar) e os saldos iniciais (contas novas). */
  importSheet: (operationId: string, farmId: string, rows: SheetRow[]) => Promise<{ imported: number; skipped: number; accounts: number }>;
  /** Insumos das operações visíveis (todos os membros veem nomes e quantidades). */
  supplies: Supply[];
  supply: (id: string) => Supply | undefined;
  /** Estoque por insumo nas fazendas pedidas (padrão: as do contexto). */
  stock: (farmIds?: string[]) => StockPosition[];
  counts: { unsent: number; intents: number; toApprove: number; conflicts: number; drafts: number };
  /** Fazenda sugerida nos formulários ('' quando ainda não há nenhuma). */
  defaultFarmId: string;
  userName: (id: string) => string;
  farm: (id: string) => Farm | undefined;
  operation: (id: string) => Operation | undefined;
  /** Legenda da fazenda: nome da sociedade, ou quem participa quando a operação é só dela. */
  farmCaption: (farm: Farm) => string;
  lotSummary: (lotId: string) => LotSummary | undefined;
  farmLotSummaries: (farmId: string) => LotSummary[];
  nextLotCode: () => string;
  entry: (id: string) => Entry | undefined;
  roleIn: (operationId: string, userId?: string) => MemberRole | null;
  membershipsOf: (userId: string) => { operation: Operation; role: MemberRole; sharePct: number | null }[];
  peopleIn: (operationId: string) => Person[];
  canSeeFinance: (operationId: string) => boolean;
  blockReason: (entry: EntryRef) => string | null;
  approversFor: (entry: EntryRef) => User[];
  /** Há outra pessoa que precisa aprovar? Sem ninguém, o lançamento entra direto. */
  needsApproval: (entry: EntryRef) => boolean;

  signUp: (input: { name: string; email: string; password: string }) => Promise<{ confirmationRequired: boolean }>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  /** Troca de fazenda (ou visão geral, com null), sem espera de apresentação. */
  enterFarm: (farmId: string | null) => Promise<void>;
  createFarm: (input: FarmInput) => Promise<Farm>;
  updateFarm: (farmId: string, input: FarmInput) => Promise<void>;
  createLot: (input: LotInput) => Promise<Lot>;
  updateLot: (lotId: string, input: LotEditInput) => Promise<void>;
  createPasture: (farmId: string, input: PastureInput) => Promise<Pasture>;
  updatePasture: (pastureId: string, input: PastureInput) => Promise<void>;
  transferLot: (lotId: string, input: TransferLotInput) => Promise<Lot>;
  /** Contorno da fazenda no mapa; `null` apaga. Só sócio. */
  updateFarmBoundary: (farmId: string, boundary: Position[] | null) => Promise<void>;
  /** Pasto nunca usado por lote ou lançamento: pode ser excluído (os outros só inativam). */
  canDeletePasture: (pastureId: string) => boolean;
  deletePasture: (pastureId: string) => Promise<void>;
  /** Contorno opcional do pasto no satélite; null apaga. */
  updatePastureBoundary: (pastureId: string, boundary: Position[] | null) => Promise<void>;
  /** Posição do lote no mapa; `null` tira o pino. Qualquer pessoa da operação. */
  placeLot: (lotId: string, location: Position | null) => Promise<void>;
  lotEditLimits: (lotId: string) => LotEditLimits;
  invitePerson: (input: InviteInput) => Promise<Invite>;
  memberManagementReason: (operationId: string, userId: string) => string | null;
  updateMemberRole: (operationId: string, userId: string, role: MemberRole, previous: Pick<Membership, 'role' | 'sharePct'>) => Promise<void>;
  removeMember: (operationId: string, userId: string, previous: Pick<Membership, 'role' | 'sharePct'>) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  /** Protótipo: simula a pessoa aceitando o convite (vira vínculo e passa a aprovar). */
  acceptInvite: (inviteId: string) => Promise<void>;
  createAccount: (operationId: string, input: AccountInput) => Promise<FinancialAccount>;
  updateAccount: (accountId: string, input: AccountInput) => Promise<void>;
  createCategory: (operationId: string, name: string, nature: CategoryNature) => Promise<LedgerCategory>;
  /** Cria ou edita fornecedor/cliente. */
  saveCounterparty: (operationId: string, input: CounterpartyInput, id?: string) => Promise<Counterparty>;
  /** Cria ou edita insumo: só sócio. */
  saveSupply: (operationId: string, input: SupplyInput, id?: string) => Promise<Supply>;
  /** Baixa por quem pagou ou recebeu, sem segunda aprovação, sobre obrigação já aprovada. */
  registerPayment: (input: PaymentInput) => Promise<Payment>;
  /** Estorna uma baixa efetivada ou descarta uma em conflito. Nada é apagado. */
  reversePayment: (paymentId: string, reason: string) => Promise<void>;
  /**
   * Informa como a compra do lote é paga: as parcelas viram contas a pagar e as já pagas viram
   * baixas. Só sócio; travado depois que alguma parcela foi paga.
   */
  setLotPurchasePlan: (lotId: string, plan: PurchasePlan, paid: PaidAtPurchase[]) => Promise<void>;
  /** A compra do lote já tem baixa (efetivada ou na fila)? Então valores e parcelas ficam travados. */
  lotPurchasePaid: (lotId: string) => boolean;
  setOnline: (online: boolean) => Promise<void>;
  sync: () => Promise<void>;
  discardPendingChanges: () => Promise<void>;
  saveEntry: (input: EntryInput, options: { submit: boolean; existingId?: string }) => Promise<Entry>;
  decide: (entryId: string, decision: Decision, note: string) => Promise<Entry>;
  discard: (entryId: string) => Promise<void>;
  loadSampleData: () => Promise<void>;
  removeSampleData: () => Promise<void>;
  /** Apaga tudo deste aparelho, inclusive a conta. */
  wipeDevice: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Preferências lidas por `selectWorkspace`. */
const WORKSPACE_SETTING = /^(accountId|currentUserId|contextFarmId|alertDays:|overdueReminder:)/;

function keepWritesAfter<T extends { write: number }>(patch: Record<string, T>, since: number): Record<string, T> {
  const kept = Object.entries(patch).filter(([, entry]) => entry.write > since);
  return kept.length === Object.keys(patch).length ? patch : Object.fromEntries(kept);
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  countAppRead();
  if (!value) throw new Error('useApp precisa estar dentro de AppStateProvider');
  return value;
}

export function AppStateProvider({ children, onReady }: { children: ReactNode; onReady?: () => void }) {
  const db = useSQLiteContext();
  const auth = useAuth();
  const p = usePalette();
  const [snapshot, setSnapshot] = useState<repo.Snapshot | null>(null);
  /**
   * Preferências gravadas depois da última leitura. Trocar um ajuste não relê o banco inteiro nem
   * refaz as projeções do workspace; uma leitura nova descarta o que já estava nela.
   */
  const [settingsPatch, setSettingsPatch] = useState<Record<string, { value: string; write: number }>>({});
  const settingWrites = useRef(0);
  /** Gravações de preferência anteriores à última leitura: o que está em `snapshot.settings` vale. */
  const [loadedSince, setLoadedSince] = useState(0);
  /** Sincronização e transição: fora do valor do contexto (ver `sync-status.tsx`). */
  const [status] = useState(createSyncStatusStore);
  const transitionSequence = useRef(0);
  const reloadSequence = useRef(0);
  const mounted = useRef(true);
  const runningSync = useRef<Promise<void> | null>(null);
  const networkAvailableRef = useRef(true);
  const [networkAvailable, setNetworkAvailable] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const cloudUser = auth.session?.user;
  const cloudUserId = cloudUser?.id;
  const cloudEmail = cloudUser?.email ?? null;
  const cloudName = typeof cloudUser?.user_metadata?.name === 'string' ? cloudUser.user_metadata.name : nameFromEmail(cloudEmail ?? '');
  const ready = snapshot !== null;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const reload = useCallback(async () => {
    const sequence = ++reloadSequence.current;
    const since = settingWrites.current;
    const next = cloudEnabled ? await cloudTransaction(db, () => repo.loadSnapshot(db)) : await repo.loadSnapshot(db);
    if (mounted.current && sequence === reloadSequence.current) {
      status.update({ lastSyncAt: next.settings.lastSyncAt ?? null });
      // Tabelas iguais mantêm a referência; sem novidade, nada renderiza (ver share-snapshot.ts).
      setSnapshot((current) => shareSnapshot(current, next));
      setLoadedSince(since);
      setSettingsPatch((patch) => keepWritesAfter(patch, since));
    }
  }, [db, status]);
  const syncConnected = useCallback((): Promise<void> => {
    if (runningSync.current) return runningSync.current;
    if (!mounted.current || !cloudUserId || !networkAvailableRef.current) return Promise.resolve();
    const work = (async () => {
      status.update({ syncing: true });
      try {
        const result = await syncCloud(db, cloudUserId);
        if (!mounted.current) return;
        status.update({ pendingCommands: result.pending, syncError: result.error });
        await reload();
      } catch {
        if (mounted.current) status.update({ syncError: 'Não foi possível sincronizar. Seus registros continuam salvos neste aparelho.' });
      } finally {
        runningSync.current = null;
        if (mounted.current) status.update({ syncing: false });
      }
    })();
    runningSync.current = work;
    return work;
  }, [cloudUserId, db, reload, status]);

  useEffect(() => {
    if (!cloudEnabled || !cloudUserId || !ready) return;
    return watchCloudSync(syncConnected, (available) => {
      networkAvailableRef.current = available;
      setNetworkAvailable(available);
    });
  }, [cloudUserId, ready, syncConnected]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadError(false);
      const read = async () => {
        if (cloudEnabled && cloudUserId) {
          await repo.insertUser(db, { id: cloudUserId, email: cloudEmail, name: cloudName });
          await repo.setSetting(db, 'accountId', cloudUserId);
          await repo.setSetting(db, 'currentUserId', cloudUserId);
        }
        return { snapshot: await repo.loadSnapshot(db), pending: cloudEnabled ? await queuedCommandCount(db) : 0 };
      };
      return cloudEnabled ? cloudTransaction(db, read) : read();
    };
    void load().then((loaded) => {
      if (!active) return;
      setSnapshot(loaded.snapshot);
      status.update({ lastSyncAt: loaded.snapshot.settings.lastSyncAt ?? null, pendingCommands: loaded.pending });
      onReady?.();
    }).catch(() => {
      if (active) { setLoadError(true); onReady?.(); }
    });
    return () => { active = false; };
  }, [db, onReady, cloudUserId, cloudEmail, cloudName, loadAttempt, status]);

  const today = todayISO();
  const mergedSettings = useMemo(() => {
    if (!snapshot) return null;
    const merged = { ...snapshot.settings };
    for (const [key, { value }] of Object.entries(settingsPatch)) merged[key] = value;
    return merged;
  }, [snapshot, settingsPatch]);
  // Só as preferências que mudam as projeções (pessoa, fazenda do contexto e avisos) refazem o workspace.
  const workspaceSettings = mergedSettings ? JSON.stringify(Object.entries(mergedSettings).filter(([key]) => WORKSPACE_SETTING.test(key)).sort()) : '[]';
  const workspace = useMemo(() => {
    if (!snapshot) return null;
    const settings: Record<string, string> = Object.fromEntries(JSON.parse(workspaceSettings) as [string, string][]);
    const { users } = snapshot;
    const account = users.find((u) => u.id === (cloudEnabled ? cloudUserId : settings.accountId)) ?? null;
    const user = (cloudEnabled ? account : (account && users.find((u) => u.id === settings.currentUserId)) ?? account) ?? SIGNED_OUT;
    return { account, user, ...selectWorkspace({ ...snapshot, settings }, user.id, cloudEnabled, today) };
  }, [snapshot, workspaceSettings, cloudUserId, today]);

  if (!snapshot || !workspace || !mergedSettings) {
    if (loadError) return <View style={[styles.loading, { backgroundColor: p.background, justifyContent: 'center', padding: 24, gap: 16 }]}>
      <Text style={{ color: p.text }}>Não foi possível abrir os dados deste aparelho. Seus registros não foram apagados.</Text>
      <Pressable accessibilityRole="button" onPress={() => setLoadAttempt((attempt) => attempt + 1)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}><Text style={{ color: p.accent }}>Tentar novamente</Text></Pressable>
    </View>;
    return <View style={[styles.loading, { backgroundColor: p.background }]} />;
  }

  const { users, operations, memberships, farms, pastures, lots, invites } = snapshot;
  const settings = mergedSettings;
  const { account, user } = workspace;
  const signedIn = account !== null;
  const online = cloudEnabled ? networkAvailable : settings.online !== '0';

  const {
    entries,
    visibleOperationIds,
    visibleFarms,
    contextFarm,
    scopedFarms,
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
  } = workspace;
  /** Status que já contam ou vão contar: o app valida antes do servidor, como no lote. */
  const binding: Entry['status'][] = [...RESERVING, 'aguardando_envio'];

  const blockReason = (e: EntryRef) => approvalBlockReason(user.id, e, memberships);
  const roleIn = (operationId: string, userId = user.id) =>
    memberships.find((m) => m.operationId === operationId && m.userId === userId)?.role ?? null;
  const peopleIn = (operationId: string): Person[] =>
    memberships
      .filter((m) => m.operationId === operationId)
      .flatMap((m) => {
        const person = users.find((u) => u.id === m.userId);
        return person ? [{ user: person, role: m.role, sharePct: m.sharePct }] : [];
      });

  const counts = {
    unsent: visibleEntries.filter((e) => e.status === 'aguardando_envio').length,
    intents: visibleEntries.filter((e) => e.pendingDecision !== null).length,
    toApprove: visibleEntries.filter(
      (e) => e.status === 'aguardando_aprovacao' && !e.pendingDecision && blockReason(e) === null,
    ).length,
    conflicts: visibleEntries.filter((e) => e.status === 'conflito').length,
    drafts: visibleEntries.filter((e) => e.authorId === user.id && e.status === 'rascunho').length,
  };

  const workflowContext = (): WorkflowContext => ({
    lots,
    farms,
    memberships,
    entries,
    pastures,
    supplies: snapshot.supplies,
    today,
    now: nowISO(),
  });

  const setSetting = async (key: string, value: string) => {
    await repo.setSetting(db, key, value);
    const write = ++settingWrites.current;
    if (mounted.current) setSettingsPatch((patch) => ({ ...patch, [key]: { value, write } }));
  };

  /** Mostra feedback só durante o trabalho real, sem atrasar o início nem a conclusão. */
  const runTransition = async (info: Omit<ContextTransition, 'id'>, change: () => Promise<void>) => {
    const id = ++transitionSequence.current;
    status.update({ transition: { ...info, id } });
    try {
      await change();
    } finally {
      status.update((current) => ({ transition: current.transition?.id === id ? null : current.transition }));
    }
  };

  const enterAccount = async (target: User, info: Pick<ContextTransition, 'eyebrow' | 'subtitle'>, create: boolean) => {
    await runTransition({ kind: 'user', title: firstName(target.name), ...info }, async () => {
      if (create) await repo.insertUser(db, target);
      await repo.setSetting(db, 'accountId', target.id);
      await repo.setSetting(db, 'currentUserId', target.id);
      await reload();
    });
  };

  const runSync = async () => {
    if (cloudEnabled) {
      await syncConnected();
      return;
    }
    status.update({ syncing: true });
    try {
      const changed = syncAll(workflowContext(), () => { throw new Error('A leitura simulada foi removida. Use Importar comprovante para extração real.'); });
      for (const entry of changed) await repo.saveEntry(db, entry);
      await repo.setSetting(db, 'lastSyncAt', nowISO());
      await reload();
    } finally { status.update({ syncing: false }); }
  };

  const persistCloud = async (kind: CloudCommandKind, payload: Record<string, unknown>, write?: () => Promise<void>) => {
    await cloudTransaction(db, async () => {
      await write?.();
      await enqueue(db, kind, payload);
    });
    status.update({ pendingCommands: await queuedCommandCount(db) });
    await reload();
    await runSync();
  };

  const farmOperation = (farmId: string) => {
    const farm = farms.find((f) => f.id === farmId);
    if (!farm) throw new Error('Fazenda não encontrada.');
    return farm.operationId;
  };

  /** Pasto ativo da fazenda, para o lote entrar ou receber animais. */
  const activePasture = (farmId: string, pastureId: string | null | undefined) => {
    const found = pastures.find((p) => p.id === pastureId);
    if (!found || found.farmId !== farmId) throw new Error('Escolha um pasto desta fazenda.');
    if (!found.active) throw new Error(`${found.name} está inativo. Escolha um pasto ativo.`);
    return found;
  };

  const canManagePastures = (operationId: string) => roleIn(operationId) === 'socio';
  const requirePartner = (operationId: string, action: string) => {
    if (roleIn(operationId) !== 'socio') throw new Error(`Somente um sócio pode ${action}.`);
  };
  const memberManagementReason = (operationId: string, targetId: string): string | null => {
    if (roleIn(operationId) !== 'socio') return 'Somente um sócio pode gerenciar pessoas nesta operação.';
    if (targetId === user.id) return 'Você não pode alterar nem remover seu próprio acesso.';
    const ownerId = operations.find((o) => o.id === operationId)?.ownerId ?? (!cloudEnabled ? account?.id : null);
    if (!ownerId) return 'Sincronize para identificar o criador da operação antes de editar.';
    if (targetId === ownerId) return 'O criador da operação não pode ter o acesso alterado ou removido.';
    return memberships.some((m) => m.operationId === operationId && m.userId === targetId) ? null : 'Esta pessoa não participa mais da operação.';
  };
  const manageMember = async (kind: 'update_member' | 'remove_member', operationId: string, targetId: string, previous: Pick<Membership, 'role' | 'sharePct'>, role?: MemberRole) => {
    const reason = memberManagementReason(operationId, targetId);
    if (reason) throw new Error(reason);
    if (kind === 'update_member' && role !== 'socio' && role !== 'funcionario') throw new Error('Escolha o cargo.');
    const member = memberships.find((m) => m.operationId === operationId && m.userId === targetId)!;
    if (member.role !== previous.role || member.sharePct !== previous.sharePct) throw new Error('O acesso mudou. Volte para Pessoas e abra a edição novamente.');
    if (cloudEnabled) {
      if (!online || status.get().pendingCommands > 0) throw new Error('Conecte-se e sincronize os registros pendentes antes de gerenciar acessos.');
      await cloudTask(db, async () => {
        const token = await cloudToken(account!.id);
        const { error } = await requireSupabase().rpc('agrogest_command', { command_id: randomUUID(), kind,
          payload: { id: targetId, operationId, ...(role ? { role } : {}), previous } })
          .setHeader('Authorization', `Bearer ${token}`);
        if (error) throw new Error(error.message);
      });
      await runSync();
      return;
    }
    if (kind === 'remove_member') await repo.deleteMembership(db, operationId, targetId);
    else await repo.insertMembership(db, { ...member, role: role!, sharePct: role === 'funcionario' ? null : member.sharePct });
    await reload();
  };

  const value: AppContextValue = {
    cloudMode: cloudEnabled,
    signedIn,
    account,
    today,
    user,
    users,
    online,
    hasSampleData: operations.some((o) => sample.SAMPLE_OPERATION_IDS.includes(o.id)),
    visibleFarms,
    contextFarm,
    scopedFarms,
    lotSummaries,
    visibleEntries,
    activity,
    pastures: visiblePastures,
    farmPastures: (farmId, includeInactive = false) =>
      visiblePastures
        .filter((p) => p.farmId === farmId && (includeInactive || p.active))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    pasture: (id) => pastures.find((p) => p.id === id),
    pastureName,
    lotGroups: (lotId) => groupsOf(timelines.get(lotId)),
    pastureReport: (farmIds, filter) =>
      buildPastureReports({
        pastures: visiblePastures.filter((p) => farmIds.includes(p.farmId)),
        lots: visibleLots.filter((l) => farmIds.includes(l.farmId)),
        timelines,
        today,
        filter,
      }),
    canManagePastures,
    invites: invites.filter((i) => visibleOperationIds.has(i.operationId) || (cloudEnabled && i.contact === account?.email)),
    categories,
    costCenters,
    costClassifications,
    accounts,
    counterparties,
    payments,
    installments,
    allInstallments,
    pendingPurchases,
    allPendingPurchases,
    accountBalance: (accountId) => {
      const found = accounts.find((a) => a.id === accountId);
      return found ? accountBalance(found, payments, SETTLING, movements) : 0;
    },
    movements,
    financings,
    renegotiations,
    recurrences,
    budgets,
    titles,
    invoices,
    occurrences,
    partnersOf,
    alertOptions,
    financeBook: (farmIds = scopedFarms.map((f) => f.id)) => {
      const ids = new Set(farmIds);
      const ops = new Set(farms.filter((f) => ids.has(f.id) && financeOperationIds.has(f.operationId)).map((f) => f.operationId));
      return {
        farmIds: ids,
        operationIds: ops,
        entries: visibleEntries.filter((e) => ops.has(e.operationId)),
        lots: lots.filter((l) => ops.has(l.operationId)),
        lotSummaries: lots
          .filter((l) => ids.has(l.farmId) && ops.has(l.operationId))
          .map((l) => summarize(l.id))
          .filter((s): s is LotSummary => s !== undefined),
        categories,
        costCenters: costCenters.filter((c) => ops.has(c.operationId)),
        costClassifications: costClassifications.filter((c) => ops.has(c.operationId)),
        accounts: accounts.filter((a) => ops.has(a.operationId)),
        payments: payments.filter((x) => ops.has(x.operationId)),
        movements: movements.filter((m) => ops.has(m.operationId)),
        views: obligationViews.filter((v) => ops.has(v.operationId)),
        invoices: invoices.filter((i) => ops.has(i.operationId)),
        occurrences: allOccurrences.filter((o) => ids.has(o.farmId)),
        financings: financings.filter((f) => ops.has(f.operationId)),
        renegotiations: renegotiations.filter((r) => ops.has(r.operationId)),
        budgets: budgets.filter((b) => ops.has(b.operationId)),
        today,
      };
    },
    setAlertPreferences: async (days, overdueReminder) => {
      await setSetting(`alertDays:${user.id}`, days.join(','));
      await setSetting(`overdueReminder:${user.id}`, overdueReminder ? '1' : '0');
    },
    registerMovement: async (input) => {
      requirePartner(input.operationId, 'movimentar as contas');
      const clean: MovementInput = { ...input, counterparty: input.counterparty.trim(), proof: input.proof.trim(), notes: input.notes.trim() };
      const failure = movementErrors(clean, snapshot.accounts, today, {
        partners: partnersOf(input.operationId).map((p) => p.id),
        financings: snapshot.financings,
        movements: snapshot.movements,
      });
      if (failure) throw new Error(failure);
      const movement: Movement = {
        ...clean,
        id: randomUUID(),
        status: cloudEnabled ? 'aguardando_envio' : 'efetivado',
        conflictReason: null,
        authorId: user.id,
        createdAt: nowISO(),
        reversedBy: null,
        reversedAt: null,
        reverseReason: null,
      };
      if (cloudEnabled) {
        await persistCloud('register_movement', { id: movement.id, ...clean }, () => repo.saveDoc(db, 'movements', movement));
        return movement;
      }
      await repo.saveDoc(db, 'movements', movement);
      await reload();
      return movement;
    },
    reverseMovement: async (movementId, reason) => {
      const current = snapshot.movements.find((m) => m.id === movementId);
      if (!current) throw new Error('Movimentação não encontrada.');
      requirePartner(current.operationId, 'estornar movimentações');
      if (current.status !== 'efetivado' && current.status !== 'conflito') throw new Error('Esta movimentação não pode mais ser estornada.');
      const note = reason.trim();
      if (current.status === 'efetivado' && !note) throw new Error('Informe o motivo do estorno.');
      if (note.length > 500) throw new Error('Use até 500 caracteres no motivo.');
      if (current.status === 'efetivado' && current.kind === 'adiantamento' && snapshot.payments.some((p) => p.advanceId === current.id && SETTLING.includes(p.status))) {
        throw new Error('Este adiantamento já foi compensado em recebimentos. Estorne-os antes.');
      }
      const next: Movement = { ...current, status: current.status === 'efetivado' ? 'estornado' : 'descartado', reversedBy: user.id, reversedAt: nowISO(), reverseReason: note || null };
      if (cloudEnabled) {
        await persistCloud('reverse_movement', { id: movementId, operationId: current.operationId, reason: note }, () => repo.saveDoc(db, 'movements', next));
        return;
      }
      await repo.saveDoc(db, 'movements', next);
      await reload();
    },
    saveFinancing: async (operationId, input, release) => {
      requirePartner(operationId, 'cadastrar financiamentos');
      const clean: FinancingInput = { ...input, bank: input.bank.trim(), contract: input.contract.trim(), guarantees: input.guarantees.trim(), notes: input.notes.trim() };
      const failure = financingErrors(clean);
      if (failure) throw new Error(failure);
      if (farms.find((f) => f.id === clean.farmId)?.operationId !== operationId) throw new Error('Escolha uma fazenda desta operação.');
      const financing: Financing = { ...clean, id: randomUUID(), operationId, authorId: user.id, createdAt: nowISO() };
      let movement: Movement | null = null;
      if (release) {
        const releaseInput: MovementInput = {
          operationId, kind: 'liberacao', fromAccountId: null, toAccountId: release.accountId, partnerId: null, financingId: financing.id,
          counterparty: clean.bank, counterpartyId: null, invoiceMonth: null, cents: release.cents, occurredAt: release.occurredAt, method: 'transferencia', proof: '', notes: '',
        };
        const releaseError = movementErrors(releaseInput, snapshot.accounts, today, { financings: [financing], movements: [] });
        if (releaseError) throw new Error(releaseError);
        movement = { ...releaseInput, id: randomUUID(), status: cloudEnabled ? 'aguardando_envio' : 'efetivado', conflictReason: null, authorId: user.id,
          createdAt: nowISO(), reversedBy: null, reversedAt: null, reverseReason: null };
      }
      if (cloudEnabled) {
        await cloudTransaction(db, async () => {
          await repo.saveDoc(db, 'financings', financing);
          const { id, authorId: _a, createdAt: _c, ...fields } = financing;
          await enqueue(db, 'save_financing', { id, ...fields });
          if (movement) {
            await repo.saveDoc(db, 'movements', movement);
            const { status: _s, conflictReason: _r, authorId: _au, createdAt: _ca, reversedBy: _rb, reversedAt: _ra, reverseReason: _rr, ...payload } = movement;
            await enqueue(db, 'register_movement', payload);
          }
        });
        status.update({ pendingCommands: await queuedCommandCount(db) });
        await reload();
        await runSync();
        return financing;
      }
      await db.withTransactionAsync(async () => {
        await repo.saveDoc(db, 'financings', financing);
        if (movement) await repo.saveDoc(db, 'movements', movement);
      });
      await reload();
      return financing;
    },
    renegotiate: async (input) => {
      requirePartner(input.operationId, 'renegociar contas');
      const failure = renegotiationErrors(input, obligationViews);
      if (failure) throw new Error(failure);
      const chosen = input.items.map((i) => obligationViews.find((v) => v.entryId === i.entryId && v.index === i.index)!);
      const reneg: Renegotiation = {
        id: randomUUID(),
        operationId: input.operationId,
        direction: chosen[0].direction,
        items: chosen.map((v) => ({ entryId: v.entryId, index: v.index, settledCents: v.paidCents })),
        installments: input.installments,
        reason: input.reason.trim(),
        status: cloudEnabled ? 'aguardando_envio' : 'efetivado',
        conflictReason: null,
        authorId: user.id,
        createdAt: nowISO(),
        reversedBy: null,
        reversedAt: null,
        reverseReason: null,
      };
      if (cloudEnabled) {
        await persistCloud('renegotiate', { id: reneg.id, operationId: reneg.operationId, direction: reneg.direction, reason: reneg.reason,
          items: input.items.map((i) => ({ entryId: i.entryId, index: i.index })), installments: reneg.installments }, () => repo.saveDoc(db, 'renegotiations', reneg));
        return reneg;
      }
      await repo.saveDoc(db, 'renegotiations', reneg);
      await reload();
      return reneg;
    },
    undoRenegotiation: async (renegotiationId, reason) => {
      const current = snapshot.renegotiations.find((r) => r.id === renegotiationId);
      if (!current) throw new Error('Renegociação não encontrada.');
      requirePartner(current.operationId, 'desfazer renegociações');
      const block = undoRenegotiationBlock(current, obligationViews);
      if (block) throw new Error(block);
      const note = reason.trim();
      if (current.status === 'efetivado' && !note) throw new Error('Informe o motivo.');
      const next: Renegotiation = { ...current, status: current.status === 'efetivado' ? 'estornado' : 'descartado', reversedBy: user.id, reversedAt: nowISO(), reverseReason: note || null };
      if (cloudEnabled) {
        await persistCloud('undo_renegotiation', { id: renegotiationId, operationId: current.operationId, reason: note }, () => repo.saveDoc(db, 'renegotiations', next));
        return;
      }
      await repo.saveDoc(db, 'renegotiations', next);
      await reload();
    },
    saveRecurrence: async (operationId, input, id) => {
      requirePartner(operationId, 'cadastrar despesas recorrentes');
      assertCostCenter(costCenters, operationId, input.costCenterId);
      const clean: RecurrenceInput = { ...input, title: input.title.trim().replace(/\s+/g, ' '), counterparty: input.counterparty.trim() };
      const failure = recurrenceErrors(clean, categories.filter((c) => c.operationId === null || c.operationId === operationId));
      if (failure) throw new Error(failure);
      if (farms.find((f) => f.id === clean.farmId)?.operationId !== operationId) throw new Error('Escolha uma fazenda desta operação.');
      const current = id ? snapshot.recurrences.find((r) => r.id === id) : undefined;
      if (id && !current) throw new Error('Despesa recorrente não encontrada.');
      const saved: Recurrence = { ...clean, id: current?.id ?? randomUUID(), operationId, createdAt: current?.createdAt ?? nowISO() };
      if (cloudEnabled) {
        const fields = (r: RecurrenceInput) => ({ title: r.title, categoryId: r.categoryId, counterparty: r.counterparty, counterpartyId: r.counterpartyId,
          cents: r.cents, dayOfMonth: r.dayOfMonth, startMonth: r.startMonth, endMonth: r.endMonth, active: r.active, farmId: r.farmId, ...(r.costCenterId !== undefined ? { costCenterId: r.costCenterId } : {}) });
        await persistCloud('save_recurrence', { id: saved.id, operationId, ...fields(saved), ...(current ? { previous: fields(current) } : {}) },
          () => repo.saveDoc(db, 'recurrences', saved));
        return saved;
      }
      await repo.saveDoc(db, 'recurrences', saved);
      await reload();
      return saved;
    },
    setBudget: async (operationId, categoryId, month, cents) => {
      requirePartner(operationId, 'definir o orçamento');
      if (!Number.isInteger(cents) || cents < 0) throw new Error('Valor inválido.');
      if (!categories.some((c) => c.id === categoryId && (c.operationId === null || c.operationId === operationId))) throw new Error('Categoria fora do plano de contas.');
      const existing = snapshot.budgets.find((b) => b.operationId === operationId && b.categoryId === categoryId && b.month === month);
      const budget: Budget = { id: existing?.id ?? randomUUID(), operationId, categoryId, month, cents };
      if (cloudEnabled) {
        await persistCloud('set_budget', { ...budget }, () => repo.saveDoc(db, 'budgets', budget));
        return;
      }
      await repo.saveDoc(db, 'budgets', budget);
      await reload();
    },
    importSheet: async (operationId, farmId, rows) => {
      requirePartner(operationId, 'importar a planilha');
      if (farms.find((f) => f.id === farmId)?.operationId !== operationId) throw new Error('Escolha uma fazenda desta operação.');
      const known = new Set(snapshot.titles.filter((t) => t.operationId === operationId).map((t) => t.importKey));
      const now = nowISO();
      const fresh: ImportedTitle[] = [];
      let skipped = 0;
      for (const row of rows) {
        if (row.kind !== 'titulo') continue;
        if (known.has(row.importKey)) { skipped++; continue; }
        known.add(row.importKey);
        fresh.push({ id: randomUUID(), operationId, farmId, direction: row.direction, title: row.title, counterparty: row.counterparty, categoryId: row.categoryId,
          occurredAt: row.occurredAt, installments: [{ dueDate: row.dueDate, cents: row.cents }], importKey: row.importKey, authorId: user.id, createdAt: now });
      }
      const names = new Set(snapshot.accounts.filter((a) => a.operationId === operationId).map((a) => a.name.trim().toLowerCase()));
      const newAccounts: FinancialAccount[] = [];
      for (const row of rows) {
        if (row.kind !== 'saldo' || names.has(row.name.trim().toLowerCase())) continue;
        names.add(row.name.trim().toLowerCase());
        newAccounts.push({ id: randomUUID(), operationId, name: row.name.trim(), kind: 'corrente', bank: '', agency: '', number: '', openingBalanceCents: row.cents,
          openingDate: row.date, active: true, createdAt: now, closingDay: null, dueDay: null });
      }
      if (cloudEnabled) {
        await cloudTransaction(db, async () => {
          for (const account of newAccounts) {
            await repo.saveAccount(db, account);
            const { createdAt: _c, ...payload } = account;
            await enqueue(db, 'create_account', payload);
          }
          for (let i = 0; i < fresh.length; i += 500) {
            const batch = fresh.slice(i, i + 500);
            for (const title of batch) await repo.saveDoc(db, 'titles', title);
            await enqueue(db, 'import_titles', { id: randomUUID(), operationId, farmId, titles: batch.map((t) => ({ id: t.id, direction: t.direction, title: t.title,
              counterparty: t.counterparty, categoryId: t.categoryId, occurredAt: t.occurredAt, installments: t.installments, importKey: t.importKey })) });
          }
        });
        status.update({ pendingCommands: await queuedCommandCount(db) });
        await reload();
        await runSync();
      } else {
        await db.withTransactionAsync(async () => {
          for (const account of newAccounts) await repo.saveAccount(db, account);
          for (const title of fresh) await repo.saveDoc(db, 'titles', title);
        });
        await reload();
      }
      return { imported: fresh.length, skipped, accounts: newAccounts.length };
    },
    supplies,
    supply: (id) => snapshot.supplies.find((x) => x.id === id),
    stock: (farmIds = scopedFarms.map((f) => f.id)) =>
      stockPositions(
        supplies.filter((x) => farmIds.some((id) => farms.find((f) => f.id === id)?.operationId === x.operationId)),
        entries,
        farmIds,
        today,
      ),
    counts,
    defaultFarmId: contextFarm?.id ?? visibleFarms[0]?.id ?? '',
    userName: (id) => (id === SYSTEM_USER ? 'Sistema' : (users.find((u) => u.id === id)?.name ?? 'Desconhecido')),
    farm: (id) => farms.find((f) => f.id === id),
    operation: (id) => operations.find((o) => o.id === id),
    farmCaption: (farm) => {
      const operation = operations.find((o) => o.id === farm.operationId);
      if (operation && operation.name !== farm.name) return operation.name;
      const others = memberships.filter((m) => m.operationId === farm.operationId && m.userId !== user.id).length;
      const people = others === 0 ? 'Só você' : `Você e mais ${others}`;
      return farm.city ? `${people} · ${farm.city}` : people;
    },
    lotSummary: summarize,
    farmLotSummaries: (farmId) =>
      lots
        .filter((l) => l.farmId === farmId)
        .map((l) => summarize(l.id))
        .filter((s): s is LotSummary => s !== undefined),
    nextLotCode: () => {
      const numbers = lots
        .filter((l) => visibleOperationIds.has(l.operationId))
        .map((l) => Number.parseInt(l.code, 10))
        .filter(Number.isFinite);
      return String((numbers.length > 0 ? Math.max(...numbers) : 0) + 1).padStart(3, '0');
    },
    entry: (id) => entries.find((e) => e.id === id),
    roleIn,
    membershipsOf: (userId) =>
      memberships
        .filter((m) => m.userId === userId)
        .flatMap((m) => {
          const operation = operations.find((o) => o.id === m.operationId);
          return operation ? [{ operation, role: m.role, sharePct: m.sharePct }] : [];
        }),
    peopleIn,
    memberManagementReason,
    updateMemberRole: (operationId, userId, role, previous) => manageMember('update_member', operationId, userId, previous, role),
    removeMember: (operationId, userId, previous) => manageMember('remove_member', operationId, userId, previous),
    canSeeFinance: (operationId) => roleIn(operationId) === 'socio',
    blockReason,
    approversFor: (e) => eligibleApprovers(e, memberships, users),
    needsApproval: (e) => requiresApproval(e, memberships),

    signUp: async ({ name, email, password }) => {
      if (cloudEnabled) {
        const { data, error } = await requireSupabase().auth.signUp({ email: email.trim().toLowerCase(), password,
          options: { data: { name: name.trim() }, emailRedirectTo: authRedirect() } });
        if (error) throw authError(error);
        if (!data.session) auth.beginConfirmation(email);
        return { confirmationRequired: !data.session };
      }
      const normalized = email.trim().toLowerCase();
      if (users.some((u) => u.email === normalized)) {
        throw new Error('Já existe uma conta com este e-mail neste aparelho. Use Entrar.');
      }
      await enterAccount(
        { id: randomUUID(), name: name.trim(), email: normalized },
        { eyebrow: 'Boas-vindas,', subtitle: 'Preparando seu espaço' },
        true,
      );
      return { confirmationRequired: false };
    },
    signIn: async ({ email, password }) => {
      if (cloudEnabled) {
        const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw authError(error);
        return;
      }
      const normalized = email.trim().toLowerCase();
      const existing = users.find((u) => u.email === normalized);
      // Login ainda não é real: um e-mail novo cria a conta local na hora.
      const target = existing ?? { id: randomUUID(), name: nameFromEmail(normalized), email: normalized };
      await enterAccount(target, { eyebrow: 'Entrando como', subtitle: '' }, !existing);
    },
    signOut: async () => {
      if (cloudEnabled) {
        const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
        if (error) throw authError(error);
        return;
      }
      await runTransition({ kind: 'user', eyebrow: 'Até logo,', title: firstName(account?.name ?? ''), subtitle: '' }, async () => {
        await repo.deleteSetting(db, 'accountId');
        await repo.deleteSetting(db, 'currentUserId');
        await reload();
      });
    },
    switchUser: async (userId) => {
      if (cloudEnabled) throw new Error('Para trocar de pessoa, saia e entre com a conta dela.');
      const next = users.find((u) => u.id === userId);
      if (!next || userId === user.id) return;
      const roles = memberships.filter((m) => m.userId === userId);
      const opIds = new Set(roles.map((m) => m.operationId));
      await runTransition(
        {
          kind: 'user',
          eyebrow: userId === account?.id ? 'Voltando para' : 'Vendo como',
          title: next.name,
          subtitle: roles.some((m) => m.role === 'socio') ? 'Sócio' : 'Funcionário',
        },
        async () => {
          const stillVisible = farms.some((f) => f.id === settings.contextFarmId && opIds.has(f.operationId));
          if (!stillVisible) {
            const first = farms.find((f) => opIds.has(f.operationId));
            if (first) await setSetting('contextFarmId', first.id);
          }
          await setSetting('currentUserId', userId);
        },
      );
    },
    enterFarm: async (farmId) => {
      if (farmId === (contextFarm?.id ?? null)) return;
      if (farmId !== null && !visibleFarms.some((farm) => farm.id === farmId)) return;
      const next = farmId ?? 'todas';
      // Só mudou o filtro: preserve os dados já carregados, sem oito novas consultas.
      await setSetting('contextFarmId', next);
    },
    createFarm: async (input) => {
      const operation: Operation = { id: randomUUID(), name: input.name, ownerId: user.id };
      const farm: Farm = { id: randomUUID(), operationId: operation.id, ...input };
      if (cloudEnabled) {
        await persistCloud('create_farm', { ...farm }, async () => {
          await repo.insertOperation(db, operation);
          await repo.insertMembership(db, { operationId: operation.id, userId: user.id, role: 'socio', sharePct: 100 });
          await repo.saveFarm(db, farm);
          await repo.setSetting(db, 'contextFarmId', farm.id);
        });
        return farm;
      }
      await runTransition(
        { kind: 'farm', eyebrow: enteringPhrase(farm.name), title: farm.name, subtitle: farm.city ?? '' },
        async () => {
          await db.withTransactionAsync(async () => {
            await repo.insertOperation(db, operation);
            await repo.insertMembership(db, { operationId: operation.id, userId: user.id, role: 'socio', sharePct: 100 });
            await repo.saveFarm(db, farm);
            await repo.setSetting(db, 'contextFarmId', farm.id);
          });
          await reload();
        },
      );
      return farm;
    },
    updateFarm: async (farmId, input) => {
      const current = farms.find((f) => f.id === farmId);
      if (!current) return;
      if (cloudEnabled) {
        if (roleIn(current.operationId) !== 'socio') throw new Error('Somente um sócio pode editar a fazenda.');
        await persistCloud('update_farm', { id: farmId, operationId: current.operationId, ...input,
          previous: { name: current.name, city: current.city, pastureRentCents: current.pastureRentCents } },
          () => repo.saveFarm(db, { ...current, ...input }));
        return;
      }
      const operation = operations.find((o) => o.id === current.operationId);
      await repo.saveFarm(db, { ...current, ...input });
      // Operação criada junto com a fazenda acompanha o nome dela.
      if (operation && operation.name === current.name) {
        await db.runAsync('UPDATE operations SET name = ? WHERE id = ?', [input.name, operation.id]);
      }
      await reload();
    },
    createLot: async (input) => {
      const pasture = activePasture(input.farmId, input.pastureId);
      const lot: Lot = { id: randomUUID(), operationId: farmOperation(input.farmId), ...input, managementGroup: pasture.name, pastureId: pasture.id };
      if (cloudEnabled) {
        if (roleIn(lot.operationId) !== 'socio') throw new Error('Peça a um sócio para cadastrar o lote.');
        await persistCloud('create_lot', { ...lot }, () => repo.insertLot(db, lot));
        return lot;
      }
      await repo.insertLot(db, lot);
      await reload();
      return lot;
    },
    updateLot: async (lotId, input) => {
      const current = lots.find((l) => l.id === lotId);
      if (!current) throw new Error('Lote não encontrado.');
      if (current.transfer?.incoming || current.transfer?.outgoing) throw new Error('Os dados de entrada da transferência são preservados.');
      if (roleIn(current.operationId) !== 'socio') throw new Error('Somente um sócio pode editar o lote.');
      const limits = lotEditLimits(lotId, entries);
      if (input.headsPurchased < limits.minHeads) {
        throw new Error(`O lote já tem ${limits.minHeads} cabeças vendidas, mortas ou aguardando aprovação.`);
      }
      if (limits.latestPurchasedAt && input.purchasedAt > limits.latestPurchasedAt) {
        throw new Error('A entrada não pode ser depois do primeiro lançamento do lote.');
      }
      const code = input.code.trim().toLowerCase();
      if (lots.some((l) => l.id !== lotId && l.operationId === current.operationId && l.code.trim().toLowerCase() === code)) {
        throw new Error('Já existe outro lote com este código.');
      }
      // Um pasto de entrada que foi inativado depois continua válido para quem não o troca.
      const pasture =
        input.pastureId && input.pastureId === current.pastureId
          ? pastures.find((p) => p.id === input.pastureId)
          : activePasture(current.farmId, input.pastureId);
      const valuesChanged =
        input.purchaseCents !== current.purchaseCents || input.commissionCents !== current.commissionCents || input.freightCents !== current.freightCents;
      if (current.purchasePlan && valuesChanged && lotHasPayments(lotId, snapshot.payments)) {
        throw new Error('A compra deste lote já tem pagamentos. Estorne-os antes de mudar os valores da compra.');
      }
      // O plano deixa de fechar com os valores novos: o servidor o descarta, e o aparelho também.
      const purchasePlan = current.purchasePlan && valuesChanged ? null : (current.purchasePlan ?? null);
      const lot: Lot = { ...current, ...input, purchasePlan, managementGroup: pasture?.name ?? input.managementGroup };
      // Entrada, cabeças ou pasto de entrada não podem contradizer as movimentações já feitas.
      const conflict = pastureConflict(lot, entries, null, binding, pastureName);
      if (conflict) throw new Error(`${conflict} Revise as movimentações do lote antes de mudar a entrada.`);
      if (cloudEnabled) {
        const { purchasePlan: _plan, ...payload } = lot;
        const { purchasePlan: _previousPlan, ...previous } = current;
        await persistCloud('update_lot', { ...payload, previous }, async () => {
          await repo.updateLot(db, lot);
          await repo.setLotPurchasePlan(db, lot.id, purchasePlan);
        });
        return;
      }
      await repo.updateLot(db, lot);
      await repo.setLotPurchasePlan(db, lot.id, purchasePlan);
      await reload();
    },
    createPasture: async (farmId, input) => {
      const farm = farms.find((f) => f.id === farmId);
      if (!farm) throw new Error('Fazenda não encontrada.');
      if (!canManagePastures(farm.operationId)) throw new Error('Somente um sócio pode cadastrar pastos.');
      const failure = Object.values(pastureErrors(input, pastures.filter((p) => p.farmId === farmId)))[0];
      if (failure) throw new Error(failure);
      const pasture: Pasture = {
        id: randomUUID(),
        operationId: farm.operationId,
        farmId,
        name: input.name.trim().replace(/\s+/g, ' '),
        areaHa: input.areaHa,
        forage: input.forage.trim(),
        notes: input.notes.trim(),
        active: true,
        createdAt: nowISO(),
      };
      if (cloudEnabled) {
        await persistCloud(
          'create_pasture',
          { id: pasture.id, operationId: pasture.operationId, farmId, name: pasture.name, areaHa: pasture.areaHa, forage: pasture.forage, notes: pasture.notes },
          () => repo.savePasture(db, pasture),
        );
        return pasture;
      }
      await repo.savePasture(db, pasture);
      await reload();
      return pasture;
    },
    updatePasture: async (pastureId, input) => {
      const current = pastures.find((p) => p.id === pastureId);
      if (!current) throw new Error('Pasto não encontrado.');
      if (!canManagePastures(current.operationId)) throw new Error('Somente um sócio pode editar pastos.');
      const failure = Object.values(pastureErrors(input, pastures.filter((p) => p.farmId === current.farmId && p.id !== pastureId)))[0];
      if (failure) throw new Error(failure);
      if (current.active && !input.active) {
        // Inativar preserva o histórico, mas o pasto não pode ficar com animais ou chegadas pendentes.
        const occupied = [...timelines.values()].some((t) => (t.heads.get(pastureId) ?? 0) > 0);
        const arriving = entries.some(
          (e) => e.kind === 'manejo' && e.payload.toPastureId === pastureId && binding.includes(e.status) && e.status !== 'aprovado',
        );
        if (occupied || arriving) throw new Error('Mova os animais deste pasto antes de inativá-lo.');
      }
      const next: Pasture = {
        ...current,
        name: input.name.trim().replace(/\s+/g, ' '),
        areaHa: input.areaHa,
        forage: input.forage.trim(),
        notes: input.notes.trim(),
        active: input.active,
      };
      if (cloudEnabled) {
        await persistCloud(
          'update_pasture',
          {
            id: pastureId,
            operationId: current.operationId,
            name: next.name,
            areaHa: next.areaHa,
            forage: next.forage,
            notes: next.notes,
            active: next.active,
            previous: { name: current.name, areaHa: current.areaHa, forage: current.forage, notes: current.notes, active: current.active },
          },
          () => repo.savePasture(db, next),
        );
        return;
      }
      await repo.savePasture(db, next);
      await reload();
    },
    transferLot: async (lotId, input) => {
      const summary = summarize(lotId);
      const source = summary && farms.find((f) => f.id === summary.lot.farmId);
      const destination = farms.find((f) => f.id === input.destinationFarmId);
      if (!summary || !source || !destination) throw new Error('Lote ou fazenda indisponível.');
      if (roleIn(source.operationId) !== 'socio' || roleIn(destination.operationId) !== 'socio') {
        throw new Error('A transferência exige ser sócio nas duas fazendas.');
      }
      if (input.date !== today) throw new Error('A data mudou. Reabra a transferência para revisar.');
      if (entries.some((e) => entryLotIds(e).includes(lotId) && e.status === 'aprovado' && e.occurredAt > today)) throw new Error('O lote tem lançamentos futuros. Revise antes de transferir.');
      const prepared = prepareLotTransfer(summary, source, destination, input, pastures.find((p) => p.id === input.pastureId));
      if (lots.some((l) => l.operationId === destination.operationId && l.code.trim().toLowerCase() === input.code.trim().toLowerCase())) {
        throw new Error('Já existe um lote com este código na operação de destino.');
      }
      const cacheConfirmed = async (result: typeof prepared) => {
        await cloudTransaction(db, async () => {
          await repo.setLotTransfer(db, lotId, result.sourceTransfer);
          const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM lots WHERE id = ?', [result.lot.id]);
          if (!existing) await repo.insertLot(db, result.lot);
          await repo.setSetting(db, 'contextFarmId', destination.id);
        });
        await reload();
        return result.lot;
      };
      if (!cloudEnabled) return cacheConfirmed(prepared);
      if (!online) throw new Error('Conecte-se à internet para confirmar a transferência.');
      return cloudTask(db, async () => {
        if (await queuedCommandCount(db) > 0) throw new Error('Sincronize os registros pendentes antes de transferir.');
        const token = await cloudToken(user.id);
        const { data, error } = await requireSupabase().rpc('agrogest_command', { command_id: input.commandId, kind: 'transfer_lot', payload: {
          ...input, id: lotId, operationId: source.operationId, sourceFarmId: source.id,
        } }).setHeader('Authorization', `Bearer ${token}`);
        if (error) throw new Error(error.code === '23505' ? 'Já existe um lote com este código no destino.' : error.message);
        // No optimistic movement: cache only the confirmed result. Network
        // snapshots share this lock so an old reply cannot erase the transfer.
        return cacheConfirmed(data as unknown as typeof prepared);
      });
    },
    lotEditLimits: (lotId) => lotEditLimits(lotId, entries),
    updateFarmBoundary: async (farmId, boundary) => {
      const current = farms.find((f) => f.id === farmId);
      if (!current) throw new Error('Fazenda não encontrada.');
      if (roleIn(current.operationId) !== 'socio') throw new Error('Somente um sócio pode desenhar a área da fazenda.');
      const ring = boundary ? closeRing(boundary) : null;
      if (ring && !isSimpleRing(ring)) throw new Error('A área precisa de pelo menos 3 pontos e não pode se cruzar.');
      if (cloudEnabled) {
        await persistCloud(
          'update_farm_boundary',
          { id: farmId, operationId: current.operationId, boundary: ring, previous: current.boundary ?? null },
          () => repo.setFarmBoundary(db, farmId, ring),
        );
        return;
      }
      await repo.setFarmBoundary(db, farmId, ring);
      await reload();
    },
    canDeletePasture: (pastureId) => {
      const current = pastures.find((p) => p.id === pastureId);
      return !!current && canManagePastures(current.operationId) && !pastureInUse(pastureId, lots, entries);
    },
    deletePasture: async (pastureId) => {
      const current = pastures.find((p) => p.id === pastureId);
      if (!current) throw new Error('Pasto não encontrado.');
      if (!canManagePastures(current.operationId)) throw new Error('Somente um sócio pode excluir pastos.');
      if (pastureInUse(pastureId, lots, entries)) throw new Error('Este pasto já tem lotes ou lançamentos. Inative-o para preservar o histórico.');
      if (cloudEnabled) {
        await persistCloud('delete_pasture', { id: pastureId, operationId: current.operationId }, () => repo.deletePasture(db, pastureId));
        return;
      }
      await repo.deletePasture(db, pastureId);
      await reload();
    },
    updatePastureBoundary: async (pastureId, boundary) => {
      const current = pastures.find((p) => p.id === pastureId);
      if (!current) throw new Error('Pasto não encontrado.');
      if (!canManagePastures(current.operationId)) throw new Error('Somente um sócio pode desenhar o pasto.');
      const ring = boundary ? closeRing(boundary) : null;
      if (ring && !isSimpleRing(ring)) throw new Error('O contorno precisa de pelo menos 3 pontos e não pode se cruzar.');
      if (cloudEnabled) {
        await persistCloud(
          'update_pasture_boundary',
          { id: pastureId, operationId: current.operationId, boundary: ring, previous: current.boundary ?? null },
          () => repo.setPastureBoundary(db, pastureId, ring),
        );
        return;
      }
      await repo.setPastureBoundary(db, pastureId, ring);
      await reload();
    },
    placeLot: async (lotId, location) => {
      const current = lots.find((l) => l.id === lotId);
      if (!current) throw new Error('Lote não encontrado.');
      if (!roleIn(current.operationId)) throw new Error('Sem acesso a este lote.');
      if (location && !isValidPosition(location)) throw new Error('Posição inválida.');
      if (cloudEnabled) {
        await persistCloud('place_lot', { id: lotId, operationId: current.operationId, location }, () =>
          repo.setLotLocation(db, lotId, location),
        );
        return;
      }
      await repo.setLotLocation(db, lotId, location);
      await reload();
    },
    invitePerson: async (input) => {
      requirePartner(input.operationId, 'convidar pessoas');
      const contact = input.contact.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(contact)) throw new Error('Informe o e-mail da conta convidada.');
      if (users.some((u) => u.email?.toLowerCase() === contact && memberships.some((m) => m.operationId === input.operationId && m.userId === u.id))) {
        throw new Error('Esta pessoa já participa da operação.');
      }
      if (invites.some((i) => i.operationId === input.operationId && i.contact === contact)) throw new Error('Já existe um convite pendente para este e-mail.');
      const invite: Invite = { id: randomUUID(), createdAt: nowISO(), createdBy: user.id, ...input, contact,
        name: users.find((u) => u.email?.toLowerCase() === contact)?.name ?? contact };
      if (cloudEnabled) {
        await persistCloud('invite', { ...input, id: invite.id, contact }, () => repo.insertInvite(db, invite));
        return (await cloudTransaction(db, () => repo.loadSnapshot(db))).invites.find((i) => i.id === invite.id) ?? invite;
      }
      await repo.insertInvite(db, invite);
      await reload();
      return invite;
    },
    cancelInvite: async (inviteId) => {
      if (cloudEnabled) {
        const invite = invites.find((i) => i.id === inviteId);
        if (!invite) return;
        await persistCloud('cancel_invite', { id: inviteId, operationId: invite.operationId }, () => repo.deleteInvite(db, inviteId));
        return;
      }
      await repo.deleteInvite(db, inviteId);
      await reload();
    },
    acceptInvite: async (inviteId) => {
      const invite = invites.find((i) => i.id === inviteId);
      if (!invite) return;
      if (cloudEnabled) {
        if (invite.contact !== account?.email) throw new Error('Este convite precisa ser aceito pela conta convidada.');
        await persistCloud('accept_invite', { id: inviteId });
        return;
      }
      const person: User = users.find((u) => u.email?.toLowerCase() === invite.contact) ?? { id: randomUUID(), name: invite.name, email: invite.contact };
      await db.withTransactionAsync(async () => {
        await repo.insertUser(db, person);
        await repo.insertMembership(db, {
          operationId: invite.operationId,
          userId: person.id,
          role: invite.role,
          sharePct: invite.sharePct,
        });
        await repo.deleteInvite(db, invite.id);
      });
      await reload();
    },
    createAccount: async (operationId, input) => {
      requirePartner(operationId, 'cadastrar contas');
      const failure = accountErrors(input, snapshot.accounts.filter((a) => a.operationId === operationId));
      if (failure) throw new Error(failure);
      const created: FinancialAccount = {
        id: randomUUID(),
        operationId,
        ...input,
        name: input.name.trim(),
        bank: input.bank.trim(),
        agency: input.agency.trim(),
        number: input.number.trim(),
        closingDay: input.kind === 'cartao' ? (input.closingDay ?? null) : null,
        dueDay: input.kind === 'cartao' ? (input.dueDay ?? null) : null,
        createdAt: nowISO(),
      };
      if (cloudEnabled) {
        const { createdAt: _createdAt, ...payload } = created;
        await persistCloud('create_account', payload, () => repo.saveAccount(db, created));
        return created;
      }
      await repo.saveAccount(db, created);
      await reload();
      return created;
    },
    updateAccount: async (accountId, input) => {
      const current = snapshot.accounts.find((a) => a.id === accountId);
      if (!current) throw new Error('Conta não encontrada.');
      requirePartner(current.operationId, 'editar contas');
      const failure = accountErrors(input, snapshot.accounts.filter((a) => a.operationId === current.operationId && a.id !== accountId));
      if (failure) throw new Error(failure);
      // O saldo inicial não pode começar depois de uma baixa já registrada na conta.
      const first = [
        ...snapshot.payments.filter((x) => x.accountId === accountId && SETTLING.includes(x.status)).map((x) => x.paidAt),
        ...snapshot.movements.filter((m) => (m.fromAccountId === accountId || m.toAccountId === accountId) && SETTLING.includes(m.status)).map((m) => m.occurredAt),
      ].sort()[0];
      if (first && input.openingDate > first) throw new Error('Já há baixas antes desta data. O saldo inicial precisa ser anterior a elas.');
      const used = snapshot.payments.some((x) => x.accountId === accountId && x.status !== 'descartado' && x.status !== 'estornado')
        || snapshot.movements.some((m) => (m.fromAccountId === accountId || m.toAccountId === accountId) && m.status !== 'descartado' && m.status !== 'estornado');
      if (used && current.kind !== input.kind && (current.kind === 'cartao' || input.kind === 'cartao')) {
        throw new Error('Esta conta já tem movimentos. Um cartão não vira conta de caixa (nem o contrário).');
      }
      const next: FinancialAccount = { ...current, ...input, name: input.name.trim(), bank: input.bank.trim(), agency: input.agency.trim(), number: input.number.trim(),
        closingDay: input.kind === 'cartao' ? (input.closingDay ?? null) : null, dueDay: input.kind === 'cartao' ? (input.dueDay ?? null) : null };
      if (cloudEnabled) {
        const fields = (a: FinancialAccount) => ({ name: a.name, kind: a.kind, bank: a.bank, agency: a.agency, number: a.number,
          openingBalanceCents: a.openingBalanceCents, openingDate: a.openingDate, active: a.active, closingDay: a.closingDay ?? null, dueDay: a.dueDay ?? null });
        await persistCloud('update_account', { id: accountId, operationId: current.operationId, ...fields(next), previous: fields(current) },
          () => repo.saveAccount(db, next));
        return;
      }
      await repo.saveAccount(db, next);
      await reload();
    },
    saveCostCenter: async (input, id) => {
      requirePartner(input.operationId, 'cadastrar centros de custo');
      const current = id ? costCenters.find((c) => c.id === id) : undefined;
      if (id && (!current || current.operationId !== input.operationId)) throw new Error('Centro de outra operação.');
      const center: CostCenter = { ...input, version: (current?.version ?? 0) + 1, name: input.name.trim().replace(/\s+/g, ' '), id: id ?? randomUUID(), createdAt: current?.createdAt ?? nowISO() };
      validateCostCenter(center, costCenters, current);
      if (cloudEnabled) {
        await persistCloud('save_cost_center', { ...center, previous: current ?? null }, () => repo.saveDoc(db, 'costCenters', center));
      } else {
        await repo.saveDoc(db, 'costCenters', center);
        await reload();
      }
    },
    classifyCost: async (entryId, costCenterId, reason) => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry || (entry.kind !== 'despesa' && entry.kind !== 'nota_fiscal') || entry.status !== 'aprovado') throw new Error('Escolha uma despesa aprovada.');
      requirePartner(entry.operationId, 'classificar o histórico');
      assertCostCenter(costCenters, entry.operationId, costCenterId);
      const note = reason.trim();
      if (!note || note.length > 500) throw new Error('Informe o motivo (até 500 caracteres).');
      const current = costClassifications.find((c) => c.id === entryId);
      const from = current ? current.costCenterId : entry.payload.costCenterId ?? null;
      if (from === costCenterId) return;
      const doc: CostClassification = { version: (current?.version ?? 0) + 1, id: entryId, operationId: entry.operationId, costCenterId,
        history: [...(current?.history ?? []), { at: nowISO(), by: user.id, from, to: costCenterId, reason: note }] };
      if (cloudEnabled) {
        await persistCloud('classify_cost', { id: entryId, operationId: entry.operationId, costCenterId, reason: note, previous: current ?? null },
          () => repo.saveDoc(db, 'costClassifications', doc));
      } else {
        await repo.saveDoc(db, 'costClassifications', doc);
        await reload();
      }
    },
    createCategory: async (operationId, name, nature) => {
      requirePartner(operationId, 'criar categorias');
      const trimmed = name.trim().replace(/\s+/g, ' ');
      if (!trimmed || trimmed.length > 80) throw new Error('Dê um nome à categoria (até 80 caracteres).');
      if (categories.some((c) => (c.operationId === null || c.operationId === operationId) && c.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error('Já existe uma categoria com este nome.');
      }
      const created: LedgerCategory = { id: randomUUID(), operationId, name: trimmed, nature, active: true };
      if (cloudEnabled) {
        await persistCloud('create_category', { id: created.id, operationId, name: trimmed, nature }, () => repo.saveCategory(db, created));
        return created;
      }
      await repo.saveCategory(db, created);
      await reload();
      return created;
    },
    saveCounterparty: async (operationId, input, id) => {
      requirePartner(operationId, 'cadastrar fornecedores e clientes');
      const name = input.name.trim().replace(/\s+/g, ' ');
      if (!name || name.length > 150) throw new Error('Informe o nome (até 150 caracteres).');
      if ([input.document, input.contact, input.pixKey].some((v) => v.length > 150) || input.notes.length > 500) {
        throw new Error('Use até 150 caracteres nos dados e 500 nas observações.');
      }
      const current = id ? snapshot.counterparties.find((c) => c.id === id) : undefined;
      if (id && !current) throw new Error('Contato não encontrado.');
      const saved: Counterparty = {
        id: current?.id ?? randomUUID(),
        operationId,
        createdAt: current?.createdAt ?? nowISO(),
        ...input,
        name,
        document: input.document.trim(),
        contact: input.contact.trim(),
        pixKey: input.pixKey.trim(),
        notes: input.notes.trim(),
      };
      if (cloudEnabled) {
        const { createdAt: _createdAt, ...payload } = saved;
        await persistCloud('save_counterparty', payload, () => repo.saveCounterparty(db, saved));
        return saved;
      }
      await repo.saveCounterparty(db, saved);
      await reload();
      return saved;
    },
    saveSupply: async (operationId, input, id) => {
      requirePartner(operationId, 'cadastrar insumos');
      const current = id ? snapshot.supplies.find((x) => x.id === id) : undefined;
      if (id && !current) throw new Error('Insumo não encontrado.');
      const failure = supplyErrors(input, snapshot.supplies.filter((x) => x.operationId === operationId && x.id !== id));
      if (failure) throw new Error(failure);
      // A unidade de controle não muda depois de usada: as quantidades gravadas estão nela.
      if (current && current.unit !== input.unit && entries.some((e) => purchaseItems(e).some((i) => i.supplyId === current.id) ||
        ((e.kind === 'consumo' || e.kind === 'ajuste_estoque' || e.kind === 'transferencia_estoque') && e.payload.supplyId === current.id))) {
        throw new Error('Este insumo já tem movimentações. A unidade de controle não pode mudar.');
      }
      const saved: Supply = {
        id: current?.id ?? randomUUID(),
        operationId,
        createdAt: current?.createdAt ?? nowISO(),
        ...input,
        name: input.name.trim().replace(/\s+/g, ' '),
      };
      if (cloudEnabled) {
        const fields = (x: Supply) => ({ name: x.name, kind: x.kind, unit: x.unit, conversions: x.conversions, minQuantity: x.minQuantity, active: x.active });
        await persistCloud(
          current ? 'update_supply' : 'create_supply',
          { id: saved.id, operationId, ...fields(saved), ...(current ? { previous: fields(current) } : {}) },
          () => repo.saveSupply(db, saved),
        );
        return saved;
      }
      await repo.saveSupply(db, saved);
      await reload();
      return saved;
    },
    registerPayment: async (input) => {
      requirePartner(input.operationId, 'registrar pagamentos e recebimentos');
      const failure = paymentErrors(input, snapshot.accounts, today, {
        partners: partnersOf(input.operationId).map((p) => p.id),
        movements: snapshot.movements,
        payments: snapshot.payments,
      });
      if (failure) throw new Error(failure);
      const payment: Payment = {
        ...input,
        accountId: input.accountId || null,
        partnerId: input.partnerId || null,
        partnerMode: input.partnerId ? (input.partnerMode ?? null) : null,
        advanceId: input.advanceId || null,
        proof: input.proof.trim(),
        notes: input.notes.trim(),
        id: randomUUID(),
        status: cloudEnabled ? 'aguardando_envio' : 'efetivado',
        conflictReason: null,
        authorId: user.id,
        createdAt: nowISO(),
        reversedBy: null,
        reversedAt: null,
        reverseReason: null,
      };
      // Aqui o aparelho já recusa o que não cabe, inclusive somando as baixas ainda na fila.
      const conflict = paymentConflict(payment, entries, snapshot.payments, undefined, financeLots, {
        financings: snapshot.financings, renegotiations: snapshot.renegotiations, titles: snapshot.titles, users,
      });
      if (conflict) throw new Error(conflict);
      if (cloudEnabled) {
        const { status: _s, conflictReason: _c, authorId: _a, createdAt: _t, reversedBy: _rb, reversedAt: _ra, reverseReason: _rr, ...payload } = payment;
        await persistCloud('register_payment', payload, () => repo.savePayment(db, payment));
        return payment;
      }
      await repo.savePayment(db, payment);
      await reload();
      return payment;
    },
    reversePayment: async (paymentId, reason) => {
      const current = snapshot.payments.find((x) => x.id === paymentId);
      if (!current) throw new Error('Baixa não encontrada.');
      requirePartner(current.operationId, 'estornar baixas');
      if (current.status !== 'efetivado' && current.status !== 'conflito') throw new Error('Esta baixa não pode mais ser estornada.');
      const blocked = reversalBlock(current, snapshot.payments, snapshot.renegotiations);
      if (blocked) throw new Error(blocked);
      const note = reason.trim();
      if (current.status === 'efetivado' && !note) throw new Error('Informe o motivo do estorno.');
      if (note.length > 500) throw new Error('Use até 500 caracteres no motivo.');
      const next: Payment = {
        ...current,
        status: current.status === 'efetivado' ? 'estornado' : 'descartado',
        reversedBy: user.id,
        reversedAt: nowISO(),
        reverseReason: note || null,
      };
      if (cloudEnabled) {
        await persistCloud('reverse_payment', { id: paymentId, operationId: current.operationId, reason: note }, () => repo.savePayment(db, next));
        return;
      }
      await repo.savePayment(db, next);
      await reload();
    },
    lotPurchasePaid: (lotId) => lotHasPayments(lotId, snapshot.payments),
    setLotPurchasePlan: async (lotId, plan, paid) => {
      const current = lots.find((l) => l.id === lotId);
      if (!current) throw new Error('Lote não encontrado.');
      requirePartner(current.operationId, 'informar o pagamento da compra');
      if (current.purchasePlan && lotHasPayments(lotId, snapshot.payments)) {
        throw new Error('A compra deste lote já tem pagamentos. Estorne-os antes de mudar as parcelas.');
      }
      const failure = purchasePlanError(current, plan);
      if (failure) throw new Error(failure);
      const next: Lot = { ...current, purchasePlan: plan };
      // As parcelas pagas no ato viram baixas, validadas como qualquer outra.
      const now = nowISO();
      const settled: Payment[] = [];
      for (const item of paid) {
        const obligation = installmentViews([], [], today, categories, [next]).find((o) => o.index === item.index);
        if (!obligation) throw new Error('Parcela da compra não encontrada.');
        const payment: Payment = {
          id: randomUUID(),
          operationId: current.operationId,
          direction: 'pagar',
          accountId: item.accountId,
          paidAt: item.paidAt,
          items: [{ entryId: lotId, index: item.index, cents: obligation.cents }],
          interestCents: 0,
          fineCents: 0,
          discountCents: 0,
          method: item.method,
          proof: '',
          notes: 'Pago no ato da compra',
          status: cloudEnabled ? 'aguardando_envio' : 'efetivado',
          conflictReason: null,
          authorId: user.id,
          createdAt: now,
          reversedBy: null,
          reversedAt: null,
          reverseReason: null,
        };
        const formError = paymentErrors(payment, snapshot.accounts, today);
        if (formError) throw new Error(formError);
        settled.push(payment);
      }
      if (cloudEnabled) {
        await cloudTransaction(db, async () => {
          await repo.setLotPurchasePlan(db, lotId, plan);
          await enqueue(db, 'set_lot_payment_plan', { id: lotId, operationId: current.operationId, plan, previous: current.purchasePlan ?? null });
          for (const payment of settled) {
            await repo.savePayment(db, payment);
            const { status: _s, conflictReason: _c, authorId: _a, createdAt: _t, reversedBy: _rb, reversedAt: _ra, reverseReason: _rr, ...payload } = payment;
            await enqueue(db, 'register_payment', payload);
          }
        });
        status.update({ pendingCommands: await queuedCommandCount(db) });
        await reload();
        await runSync();
        return;
      }
      await db.withTransactionAsync(async () => {
        await repo.setLotPurchasePlan(db, lotId, plan);
        for (const payment of settled) await repo.savePayment(db, payment);
      });
      await reload();
    },
    setOnline: async (next) => {
      if (cloudEnabled) { if (next) { await NetInfo.refresh(); await runSync(); } return; }
      await setSetting('online', next ? '1' : '0');
      if (next) await runSync();
    },
    sync: async () => {
      if (online) await runSync();
    },
    discardPendingChanges: async () => {
      if (!cloudEnabled || !online) throw new Error('Conecte-se para conferir os registros confirmados antes de descartar a fila.');
      if (status.get().syncing) throw new Error('Aguarde a sincronização terminar.');
      const token = await cloudToken(user.id);
      const { data, error } = await requireSupabase().rpc('agrogest_workspace').setHeader('Authorization', `Bearer ${token}`);
      if (error) throw new Error('Não foi possível conferir o servidor. Sua fila foi preservada.');
      await cloudTransaction(db, async () => {
        await db.runAsync('DELETE FROM cloud_outbox');
        await repo.replaceCloudSnapshot(db, data as unknown as repo.CloudWorkspace);
      });
      status.update({ pendingCommands: 0, syncError: null });
      await reload();
    },

    saveEntry: async (input, { submit, existingId }) => {
      const now = nowISO();
      const existing = existingId ? entries.find((e) => e.id === existingId) : undefined;
      const history = existing
        ? [...existing.history, { at: now, by: user.id, action: 'revisado' as const }]
        : [{ at: now, by: user.id, action: 'criado' as const }];
      if (submit) history.push({ at: now, by: user.id, action: 'enviado' });
      const { kind, payload, operationId, farmId, title, amountCents, occurredAt } = input;
      if (kind === 'despesa' || kind === 'nota_fiscal') assertCostCenter(costCenters, operationId, payload.costCenterId);
      let entry = {
        id: existing?.id ?? randomUUID(),
        status: submit ? submittedStatus(online) : 'rascunho',
        operationId,
        farmId,
        authorId: existing?.authorId ?? user.id,
        title,
        amountCents,
        occurredAt,
        createdAt: existing?.createdAt ?? now,
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        pendingDecision: null,
        pendingDecisionBy: null,
        pendingDecisionNote: null,
        conflictReason: null,
        history,
        kind,
        payload,
      } as Entry;
      for (const relatedId of entryLotIds(entry)) {
        const related = lots.find((l) => l.id === relatedId);
        if (related?.transfer?.outgoing) throw new Error('Este lote já foi transferido. Registre na fazenda de destino.');
        if (related?.transfer?.incoming && occurredAt < related.transfer.incoming.at) throw new Error('A ocorrência não pode ser anterior à chegada do lote.');
      }
      // Pastos citados pertencem à fazenda do lançamento; o destino de uma movimentação está ativo.
      if (kind === 'manejo') {
        if (payload.fromPastureId === payload.toPastureId) throw new Error('Escolha um pasto de destino diferente da origem.');
        if (pastures.find((p) => p.id === payload.fromPastureId)?.farmId !== farmId) throw new Error('O pasto de origem não é desta fazenda.');
        activePasture(farmId, payload.toPastureId);
        if (occurredAt > today) throw new Error('A movimentação não pode ter data futura.');
      } else if ((kind === 'pesagem' || kind === 'mortalidade' || kind === 'venda') && payload.pastureId) {
        if (pastures.find((p) => p.id === payload.pastureId)?.farmId !== farmId) throw new Error('O pasto informado não é desta fazenda.');
      }
      // Estoque: insumo da operação; compras fecham o valor; saídas cabem no saldo (validado ao receber).
      const supplyOf = (supplyId: string) => {
        const found = snapshot.supplies.find((x) => x.id === supplyId);
        if (!found || found.operationId !== operationId) throw new Error('Escolha um insumo desta operação.');
        return found;
      };
      if ((kind === 'despesa' || kind === 'nota_fiscal') && payload.destination === 'estoque' && (kind === 'despesa' || submit)) {
        const items = payload.stockItems ?? [];
        if (items.length === 0) throw new Error('Informe os insumos que entram no estoque.');
        for (const item of items) {
          if (!supplyOf(item.supplyId).active) throw new Error('Um dos insumos está inativo.');
          if (!(item.quantity > 0)) throw new Error('Informe a quantidade de cada insumo.');
        }
        if (items.reduce((acc, i) => acc + i.cents, 0) !== amountCents) throw new Error('Os itens precisam somar o valor da compra.');
      }
      if (kind === 'consumo' || kind === 'ajuste_estoque' || kind === 'transferencia_estoque') {
        supplyOf(payload.supplyId);
        if (occurredAt > today) throw new Error('A data não pode ser futura.');
      }
      if (kind === 'consumo') {
        if (!(payload.quantity > 0)) throw new Error('Informe a quantidade consumida.');
        if (payload.targets.length === 0) throw new Error('Escolha os lotes que consumiram.');
        if (payload.targets.some((t) => lots.find((l) => l.id === t.lotId)?.farmId !== farmId)) throw new Error('Os lotes precisam ser desta fazenda.');
      }
      if (kind === 'ajuste_estoque' && (payload.delta === 0 || !payload.reason.trim())) throw new Error('Informe a diferença e o motivo do ajuste.');
      if (kind === 'receita') {
        if (roleIn(operationId) !== 'socio') throw new Error('Somente um sócio pode registrar uma receita.');
        const category = categories.find((c) => c.id === payload.categoryId && (c.operationId === null || c.operationId === operationId));
        if (!category || !REVENUE_NATURES.includes(category.nature)) throw new Error('Escolha uma categoria de receita do plano de contas.');
        if (!amountCents || payload.installments.length === 0 || payload.installments.reduce((acc, i) => acc + i.cents, 0) !== amountCents) {
          throw new Error('As parcelas precisam fechar o valor total.');
        }
      }
      if (kind === 'despesa' && payload.recurrence) {
        const { id: recurrenceId, month } = payload.recurrence;
        if (!snapshot.recurrences.some((r) => r.id === recurrenceId && r.operationId === operationId)) throw new Error('Despesa recorrente fora desta operação.');
        if (entries.some((e) => e.id !== existingId && e.kind === 'despesa' && e.status !== 'rejeitado' && e.payload.recurrence?.id === recurrenceId && e.payload.recurrence.month === month)) {
          throw new Error('A despesa deste mês já foi lançada.');
        }
      }
      if (kind === 'transferencia_estoque') {
        const destination = farms.find((f) => f.id === payload.toFarmId);
        if (!destination || destination.operationId !== operationId || destination.id === farmId) {
          throw new Error('Escolha outra fazenda da mesma operação.');
        }
        if (!(payload.quantity > 0)) throw new Error('Informe a quantidade transferida.');
      }
      if (cloudEnabled) {
        if (kind === 'nota_fiscal') throw new Error('A leitura real de notas ainda está em preparação. Registre uma despesa manual.');
        if (kind === 'venda' && roleIn(operationId) !== 'socio') throw new Error('Somente um sócio pode registrar uma venda.');
        entry.status = submit ? 'aguardando_envio' : 'rascunho';
        const prior = (await queuedCommands(db)).some((command) => command.payload.id === entry.id);
        await persistCloud('save_entry', { id: entry.id, operationId, farmId, entry: input, submit,
          expectedVersion: prior ? 'after-previous' : existing?.version ?? (settings[`entryVersion:${entry.id}`] ? Number(settings[`entryVersion:${entry.id}`]) : null) },
          () => repo.saveEntry(db, entry));
        return (await cloudTransaction(db, () => repo.loadSnapshot(db))).entries.find((e) => e.id === entry.id) ?? entry;
      }
      if (submit && online) entry = receive(workflowContext(), entry);
      await repo.saveEntry(db, entry);
      await reload();
      return entry;
    },
    decide: async (entryId, decision, note) => {
      const current = entries.find((e) => e.id === entryId);
      if (!current) throw new Error('Lançamento não encontrado.');
      if (cloudEnabled) {
        const reason = blockReason(current);
        if (reason) throw new Error(reason);
        const updated = decideEntry(workflowContext(), current, user.id, decision, note, false);
        await persistCloud('decide_entry', { id: entryId, operationId: current.operationId, decision, note,
          expectedVersion: current.version ?? (settings[`entryVersion:${entryId}`] ? Number(settings[`entryVersion:${entryId}`]) : null) },
          () => repo.saveEntry(db, updated));
        return (await cloudTransaction(db, () => repo.loadSnapshot(db))).entries.find((e) => e.id === entryId) ?? updated;
      }
      const updated = decideEntry(workflowContext(), current, user.id, decision, note, online);
      await repo.saveEntry(db, updated);
      await reload();
      return updated;
    },
    discard: async (entryId) => {
      if (cloudEnabled) {
        const entry = entries.find((e) => e.id === entryId);
        if (!entry) return;
        await persistCloud('discard_entry', { id: entryId, operationId: entry.operationId }, () => repo.deleteEntry(db, entryId));
        return;
      }
      await repo.deleteEntry(db, entryId);
      await reload();
    },
    loadSampleData: async () => {
      if (cloudEnabled) throw new Error('Dados de exemplo estão disponíveis somente no modo local.');
      if (!account || operations.some((o) => sample.SAMPLE_OPERATION_IDS.includes(o.id))) return;
      await runTransition(
        { kind: 'data', eyebrow: 'Carregando', title: 'Dados de exemplo', subtitle: '2 fazendas, 4 lotes e lançamentos' },
        async () => {
          await sample.loadSampleData(db, account.id);
          await repo.setSetting(db, 'currentUserId', account.id);
          await reload();
        },
      );
    },
    removeSampleData: async () => {
      if (cloudEnabled) return;
      await runTransition({ kind: 'data', eyebrow: 'Removendo', title: 'Dados de exemplo', subtitle: '' }, async () => {
        await sample.removeSampleData(db);
        if (account) await repo.setSetting(db, 'currentUserId', account.id);
        await repo.setSetting(db, 'online', '1');
        await reload();
      });
    },
    wipeDevice: async () => {
      if (cloudEnabled) {
        if (await queuedCommandCount(db) > 0) throw new Error('Sincronize os registros pendentes antes de limpar este aparelho.');
        await wipeDatabase(db);
        const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
        if (error) throw authError(error);
        return;
      }
      await runTransition({ kind: 'data', eyebrow: 'Apagando', title: 'Dados deste aparelho', subtitle: '' }, async () => {
        await wipeDatabase(db);
        await reload();
      });
    },
  };

  return (
    <AppContext.Provider value={value}>
      <SyncStatusProvider store={status}>
        <PreferencesProvider
          db={db}
          userId={user.id}
          saved={snapshot.settings}
          activity={activity}
          writesRef={settingWrites}
          loadedSince={loadedSince}>
          {children}
        </PreferencesProvider>
      </SyncStatusProvider>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },
});
