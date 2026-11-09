import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  FilterTag,
  FinanceHero,
  IconBadge,
  KpiBars,
  KpiFlows,
  PillButton,
  Reveal,
  SelectionBar,
  SheetGroup,
  StatusTiles,
  type FarmChip,
  type KpiSlide,
} from '@/components/finance-home';
import { DueDateTile, InstallmentRow, PAYMENT_STATUS } from '@/components/finance-ui';
import { useMenuTabs } from '@/components/navigation';
import { PendingPurchases } from '@/components/pending-purchases';
import { Button, Chip, Note, StatusText } from '@/components/ui/controls';
import { AccessGrid, type AccessItem } from '@/components/ui/access-grid';
import { EmptyState, Group, ListRow, Screen, Section, TitledSection } from '@/components/ui/layout';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  ChartLine,
  ChartPie,
  CircleAlert,
  CreditCard,
  FileSpreadsheet,
  FolderCog,
  HandCoins,
  Landmark,
  ListChecks,
  ReceiptText,
  ScanLine,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from '@/components/ui/lucide';
import { QuickActions } from '@/components/ui/quick-actions';
import { haptics } from '@/components/ui/motion';
import { FirstVisit, TabSkeleton } from '@/components/ui/skeletons';
import { AppText } from '@/components/ui/text';
import { formatDate, monthTitle } from '@/domain/dates';
import { dueSummary, installmentId, isCashAccount, METHOD_LABEL, paymentTotal, SETTLING, type InstallmentView } from '@/domain/finance';
import { formatCents, plural } from '@/domain/format';
import { MOVEMENT_LABEL } from '@/domain/treasury';
import type { MovementKind, PaymentDirection, PaymentStatus } from '@/domain/types';
import { requestDueAlertPermission } from '@/services/due-alerts';
import { useApp } from '@/state/app-state';
import { usePreferences } from '@/state/preferences';
import { space, usePalette, type Tone } from '@/theme';

type Tab = PaymentDirection | 'baixas';
type Period = 'todas' | 'vencidas' | '7' | '15' | '30';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'vencidas', label: 'Vencidas' },
  { value: '7', label: 'Até 7 dias' },
  { value: '15', label: 'Até 15 dias' },
  { value: '30', label: 'Até 30 dias' },
];

function inPeriod(v: InstallmentView, period: Period): boolean {
  if (period === 'todas') return true;
  if (period === 'vencidas') return v.daysToDue < 0;
  return v.daysToDue <= Number(period);
}

/** Faixas de vencimento da lista: o que já passou primeiro, depois o que está perto. */
const BUCKETS: { key: string; title: string; test: (v: InstallmentView) => boolean }[] = [
  { key: 'vencidas', title: 'Vencidas', test: (v) => v.daysToDue < 0 },
  { key: 'semana', title: 'Próximos 7 dias', test: (v) => v.daysToDue >= 0 && v.daysToDue <= 7 },
  { key: 'mes', title: 'Até 30 dias', test: (v) => v.daysToDue > 7 && v.daysToDue <= 30 },
  { key: 'depois', title: 'Mais adiante', test: (v) => v.daysToDue > 30 },
];

/** Semanas da previsão do carrossel; o que já venceu entra na primeira. */
const WEEKS: { label: string; test: (days: number) => boolean }[] = [
  { label: '7d', test: (d) => d <= 7 },
  { label: '14d', test: (d) => d > 7 && d <= 14 },
  { label: '21d', test: (d) => d > 14 && d <= 21 },
  { label: '30d', test: (d) => d > 21 && d <= 30 },
];

/** Entra (+), sai (−) ou só troca de conta (transferência). */
const MOVEMENT_SIGN: Record<MovementKind, 1 | -1 | 0> = {
  transferencia: 0,
  aporte: 1,
  retirada: -1,
  distribuicao: -1,
  liberacao: 1,
  adiantamento: 1,
};

type FeedItem = {
  id: string;
  date: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  cents: number;
  sign: 1 | -1 | 0;
  status: PaymentStatus;
  onPress: () => void;
};

const sum = (list: InstallmentView[]) => list.reduce((acc, v) => acc + v.openCents, 0);

/**
 * Financeiro dos sócios no formato dos apps de banco (referência: PicPay): faixa escura no topo com
 * as fazendas em pílulas e os indicadores em cartões que se arrastam; abaixo, os atalhos do dia a
 * dia, as contas (a pagar, a receber, extrato) com blocos que filtram e a lista por faixa de
 * vencimento, e o acesso rápido à gestão no fim. Filtros finos ficam num painel. A seleção junta
 * parcelas da mesma operação para uma baixa só (ex.: um Pix que quita duas notas).
 */
/** Primeira visita: o esqueleto responde ao toque e a tela monta no quadro seguinte. */
export default function FinanceiroTab() {
  return (
    <FirstVisit skeleton={<TabSkeleton variant="finance" />}>
      <FinanceiroScreen />
    </FirstVisit>
  );
}

function FinanceiroScreen() {
  const app = useApp();
  const prefs = usePreferences();
  const p = usePalette();
  const [tab, setTab] = useState<Tab>('pagar');
  const [period, setPeriod] = useState<Period>('todas');
  const [counterparty, setCounterparty] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [feedLimit, setFeedLimit] = useState(30);
  // Os cartões principais compartilham a preferência com o Início.
  const hidden = prefs.hideValues;
  const { financeTab } = useMenuTabs();
  const financeFarms = app.scopedFarms.filter((f) => app.canSeeFinance(f.operationId));
  // Pílulas: "Todas" (com mais de uma fazenda) e cada fazenda em que a pessoa vê o financeiro.
  const allFinanceFarms = app.visibleFarms.filter((f) => app.canSeeFinance(f.operationId));
  const farmChips: FarmChip[] = [
    ...(app.visibleFarms.length > 1 ? [{ id: null, label: 'Todas' }] : []),
    // Sem o "Fazenda" do começo, as pílulas cabem lado a lado (o leitor de tela lê "Fazenda …").
    ...allFinanceFarms.map((f) => ({ id: f.id, label: f.name.replace(/^fazenda\s+/i, '') || f.name })),
  ];
  const heroProps = {
    title: 'Financeiro',
    back: !financeTab,
    farms: farmChips,
    selectedFarm: app.contextFarm?.id ?? null,
    onSelectFarm: (id: string | null) => void app.enterFarm(id).catch(() => undefined),
    subtitle: app.contextFarm?.name ?? (app.visibleFarms.length > 1 ? 'Todas as fazendas' : undefined),
    hidden,
    onToggleHidden: () => void prefs.setHideValues(!hidden),
  };

  useEffect(() => {
    if (financeFarms.length > 0) void requestDueAlertPermission();
  }, [financeFarms.length]);

  if (financeFarms.length === 0) {
    return (
      <Screen tab hero header={<FinanceHero {...heroProps} />}>
        <EmptyState
          icon="lock-outline"
          title="Financeiro dos sócios"
          message={
            allFinanceFarms.length > 0
              ? 'Nesta fazenda você não vê o financeiro. Escolha acima uma fazenda em que é sócio.'
              : 'Contas a pagar, a receber e saldos aparecem só para os sócios da operação.'
          }
        />
      </Screen>
    );
  }

  const scopedOps = new Set(financeFarms.map((f) => f.operationId));
  const firstOperation = financeFarms[0].operationId;
  const accounts = app.accounts.filter((a) => scopedOps.has(a.operationId) && a.active);
  const cashAccounts = accounts.filter(isCashAccount);
  const cards = accounts.filter((a) => !isCashAccount(a));
  const balance = cashAccounts.reduce((acc, a) => acc + app.accountBalance(a.id), 0);
  const cardDebt = cards.reduce((acc, a) => acc + Math.max(0, -app.accountBalance(a.id)), 0);
  const openAll = app.installments.filter((v) => v.openCents > 0);
  const within30 = (d: PaymentDirection) => sum(openAll.filter((v) => v.direction === d && v.daysToDue <= 30));
  const receivable30 = within30('receber');
  const payable30 = within30('pagar');
  const projected = balance + receivable30 - payable30;
  const month = app.today.slice(0, 7);
  const monthPayments = app.payments.filter((x) => scopedOps.has(x.operationId) && SETTLING.includes(x.status) && x.paidAt.startsWith(month));
  const monthIn = monthPayments.filter((x) => x.direction === 'receber').reduce((acc, x) => acc + paymentTotal(x), 0);
  const monthOut = monthPayments.filter((x) => x.direction === 'pagar').reduce((acc, x) => acc + paymentTotal(x), 0);
  const monthName = monthTitle(app.today).split(' de ')[0].toLowerCase();

  const overduePayable = sum(openAll.filter((v) => v.direction === 'pagar' && v.daysToDue < 0));
  const slides: KpiSlide[] = [
    // Sem conta cadastrada o saldo seria um R$ 0,00 sem sentido: o primeiro cartão mostra o que
    // vence, e o convite para cadastrar a conta fica no pé dele.
    cashAccounts.length > 0
      ? {
          key: 'saldo',
          icon: Wallet,
          label: 'Saldo',
          value: formatCents(balance),
          caption: `em ${plural(cashAccounts.length, 'conta', 'contas')}`,
          extra: (
            <KpiFlows
              hidden={hidden}
              items={[
                { icon: ArrowDownLeft, label: 'A receber · 30d', cents: receivable30 },
                { icon: ArrowUpRight, label: 'A pagar · 30d', cents: payable30 },
              ]}
            />
          ),
          action: { label: 'Ver contas', onPress: () => router.push('/financeiro/contas') },
        }
      : {
          key: 'saldo',
          tone: overduePayable > 0 ? 'danger' : 'neutral',
          icon: ArrowUpRight,
          label: 'A pagar · 30d',
          value: formatCents(payable30),
          caption: 'Cadastre suas contas para ver também o saldo',
          extra: (
            <KpiFlows
              hidden={hidden}
              items={[
                { icon: ArrowDownLeft, label: 'A receber · 30d', cents: receivable30 },
                { icon: CircleAlert, label: 'Já vencido', cents: overduePayable },
              ]}
            />
          ),
          action: { label: 'Cadastrar', onPress: () => router.push({ pathname: '/financeiro/conta/editar', params: { operacao: firstOperation } }) },
        },
    {
      key: 'previsao',
      tone: projected < 0 ? 'danger' : 'neutral',
      icon: projected < 0 ? TrendingDown : TrendingUp,
      label: 'Previsão 30 dias',
      value: formatCents(projected),
      caption: projected < 0 ? 'Vai faltar dinheiro: antecipe ou renegocie' : 'Saldo de hoje + a receber − a pagar',
      extra: (
        <KpiBars
          weeks={WEEKS.map((w) => ({
            label: w.label,
            inCents: sum(openAll.filter((v) => v.direction === 'receber' && w.test(v.daysToDue))),
            outCents: sum(openAll.filter((v) => v.direction === 'pagar' && w.test(v.daysToDue))),
          }))}
        />
      ),
      action: { label: 'Ver fluxo', onPress: () => router.push({ pathname: '/financeiro/relatorios', params: { aba: 'fluxo' } }) },
    },
    {
      key: 'mes',
      icon: ChartPie,
      label: 'Resultado do mês',
      value: formatCents(monthIn - monthOut),
      caption: `${monthName[0].toUpperCase()}${monthName.slice(1)} · ${monthPayments.length > 0 ? plural(monthPayments.length, 'baixa', 'baixas') : 'nenhuma baixa ainda'}`,
      extra: (
        <KpiFlows
          hidden={hidden}
          items={[
            { icon: ArrowDownLeft, label: 'Entrou', cents: monthIn },
            { icon: ArrowUpRight, label: 'Saiu', cents: monthOut },
          ]}
        />
      ),
      action: { label: 'Ver relatório', onPress: () => router.push({ pathname: '/financeiro/relatorios', params: { aba: 'resultados' } }) },
    },
    ...(cards.length > 0
      ? [
          {
            key: 'cartao',
            icon: CreditCard,
            label: 'Cartões',
            value: formatCents(cardDebt),
            caption: `${plural(cards.length, 'cartão', 'cartões')} · fatura em aberto`,
            action: { label: 'Ver faturas', onPress: () => router.push('/financeiro/contas') },
          } satisfies KpiSlide,
        ]
      : []),
  ];

  const direction: PaymentDirection = tab === 'receber' ? 'receber' : 'pagar';
  const views = app.installments.filter((v) => v.direction === direction);
  const openViews = views.filter((v) => v.openCents > 0);
  const open = openViews
    .filter((v) => inPeriod(v, period) && (!counterparty || (v.counterparty || 'Sem nome') === counterparty) && (!category || v.categoryName === category))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
  const summary = dueSummary(views, direction);
  const counterparties = [...new Set(openViews.map((v) => v.counterparty || 'Sem nome'))].sort();
  const categories = [...new Set(openViews.map((v) => v.categoryName).filter(Boolean))].sort();
  const extraPeriod = period === '15' || period === '30';
  const filterCount = Number(extraPeriod) + Number(!!counterparty) + Number(!!category);
  const listKey = `${tab}-${period}-${counterparty ?? ''}-${category ?? ''}`;
  const waiting = app.visibleEntries.filter(
    (e) => (e.kind === 'despesa' || e.kind === 'venda') && e.status === 'aguardando_aprovacao' && app.scopedFarms.some((f) => f.id === e.farmId),
  ).length;

  const chosen = app.installments.filter((v) => selected.includes(v.id));
  const operationId = chosen[0]?.operationId ?? null;
  const toggle = (v: InstallmentView) => {
    // A fatura do cartão se paga por transferência: abre a fatura em vez de entrar na seleção.
    if (v.source === 'fatura') {
      router.push({ pathname: '/financeiro/parcela/[id]', params: { id: v.id } });
      return;
    }
    haptics.tap();
    setSelected((ids) => (ids.includes(v.id) ? ids.filter((id) => id !== v.id) : [...ids, v.id]));
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };
  const previstas = direction === 'pagar' ? app.occurrences.filter((o) => !o.entryId && o.daysToDue <= 30) : [];
  const pay = (ids: string[]) => router.push({ pathname: '/financeiro/baixa', params: { parcelas: ids.join(','), direcao: direction } });
  const clearFilters = () => {
    setPeriod('todas');
    setCounterparty(null);
    setCategory(null);
  };

  // Índices montados uma vez: o extrato não varre a lista inteira para cada baixa.
  const installmentById = new Map(app.installments.map((v) => [v.id, v]));
  const accountName = new Map(app.accounts.map((a) => [a.id, a.name]));
  const feed: FeedItem[] = [
    ...app.payments
      .filter((x) => scopedOps.has(x.operationId))
      .map((x): FeedItem => {
        const first = installmentById.get(installmentId(x.items[0].entryId, x.items[0].index));
        const account = x.partnerId
          ? `${app.userName(x.partnerId).split(' ')[0]} (próprio bolso)`
          : x.advanceId
            ? 'Adiantamento'
            : ((x.accountId && accountName.get(x.accountId)) || 'Conta');
        return {
          id: x.id,
          date: x.paidAt,
          icon: x.direction === 'pagar' ? ArrowUpRight : ArrowDownLeft,
          title: `${first?.title ?? (x.direction === 'pagar' ? 'Pagamento' : 'Recebimento')}${x.items.length > 1 ? ` +${x.items.length - 1}` : ''}`,
          subtitle: `${account} · ${METHOD_LABEL[x.method]}`,
          cents: paymentTotal(x),
          sign: x.direction === 'pagar' ? -1 : 1,
          status: x.status,
          onPress: () => router.push({ pathname: '/financeiro/parcela/[id]', params: { id: installmentId(x.items[0].entryId, x.items[0].index) } }),
        };
      }),
    ...app.movements
      .filter((m) => scopedOps.has(m.operationId))
      .map((m): FeedItem => {
        const from = m.fromAccountId ? accountName.get(m.fromAccountId) : undefined;
        const to = m.toAccountId ? accountName.get(m.toAccountId) : undefined;
        const sign = MOVEMENT_SIGN[m.kind];
        return {
          id: m.id,
          date: m.occurredAt,
          icon: sign > 0 ? ArrowDownLeft : sign < 0 ? ArrowUpRight : ArrowLeftRight,
          title: `${MOVEMENT_LABEL[m.kind]}${m.partnerId ? ` · ${app.userName(m.partnerId).split(' ')[0]}` : ''}`,
          subtitle: [from, to].filter(Boolean).join(' → ') || 'Movimentação',
          cents: m.cents,
          sign,
          status: m.status,
          onPress: () => router.push({ pathname: '/financeiro/movimento/[id]', params: { id: m.id } }),
        };
      }),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const feedShown = feed.slice(0, feedLimit);
  const feedMonths = [...new Set(feedShown.map((f) => f.date.slice(0, 7)))];

  const tools: AccessItem[] = [
    { key: 'contas', icon: Wallet, label: 'Contas e saldos', hint: plural(accounts.length, 'conta', 'contas'), onPress: () => router.push('/financeiro/contas') },
    { key: 'relatorios', icon: ChartPie, label: 'Relatórios', hint: 'Fluxo, orçamento, DRE', onPress: () => router.push('/financeiro/relatorios') },
    {
      key: 'financiamentos',
      icon: Landmark,
      label: 'Financiamentos',
      hint: plural(app.financings.filter((f) => scopedOps.has(f.operationId)).length, 'contrato', 'contratos'),
      onPress: () => router.push('/financeiro/financiamentos'),
    },
    { key: 'cadastros', icon: FolderCog, label: 'Cadastros', hint: 'Fornecedores, sócios, categorias', onPress: () => router.push('/financeiro/cadastros') },
    { key: 'conciliar', icon: ScanLine, label: 'Conciliar extrato', hint: 'Banco × lançamentos', onPress: () => router.push('/financeiro/conciliacao') },
    { key: 'importar', icon: FileSpreadsheet, label: 'Importar', hint: 'Planilha e saldos', onPress: () => router.push('/financeiro/importar') },
  ];

  return (
    <Screen
      tab
      hero
      header={<FinanceHero {...heroProps} slides={slides} />}
      footer={
        tab !== 'baixas' && selecting && selected.length > 0 ? (
          <SelectionBar summary={`${plural(selected.length, 'parcela escolhida', 'parcelas escolhidas')} · ${formatCents(chosen.reduce((acc, v) => acc + v.openCents, 0))}`}>
            <Button title="Renegociar" variant="secondary" onPress={() => router.push({ pathname: '/financeiro/renegociar', params: { parcelas: selected.join(',') } })} />
            <Button title={direction === 'pagar' ? 'Pagar' : 'Receber'} icon="check" onPress={() => pay(selected)} style={styles.grow} />
          </SelectionBar>
        ) : undefined
      }>
      <TitledSection title="Pro dia a dia">
        <QuickActions
          actions={[
            { key: 'despesa', label: 'Nova despesa', icon: ReceiptText, primary: true, onPress: () => router.push('/novo/despesa') },
            { key: 'receita', label: 'Nova receita', icon: HandCoins, onPress: () => router.push('/novo/receita') },
            { key: 'movimentar', label: 'Movimentar', icon: ArrowLeftRight, onPress: () => router.push({ pathname: '/financeiro/movimentar', params: { operacao: firstOperation } }) },
            { key: 'fluxo', label: 'Fluxo de caixa', icon: ChartLine, onPress: () => router.push({ pathname: '/financeiro/relatorios', params: { aba: 'fluxo' } }) },
          ]}
        />
      </TitledSection>

      <PendingPurchases lots={app.pendingPurchases} compact />

      <TitledSection title="Suas contas">
        <SegmentedTabs<Tab>
          accessibilityLabel="Contas"
          options={[
            { value: 'pagar', label: 'A pagar', count: openAll.filter((v) => v.direction === 'pagar').length },
            { value: 'receber', label: 'A receber', count: openAll.filter((v) => v.direction === 'receber').length },
            { value: 'baixas', label: 'Extrato' },
          ]}
          value={tab}
          onChange={(next) => {
            setTab(next);
            stopSelecting();
            clearFilters();
          }}
        />

        {tab !== 'baixas' ? (
          <>
            <StatusTiles
              hidden={hidden}
              tiles={[
                { key: 'vencidas', icon: CircleAlert, label: 'Vencidas', cents: summary.overdueCents, count: summary.overdueCount, tone: 'danger', selected: period === 'vencidas', onPress: () => setPeriod(period === 'vencidas' ? 'todas' : 'vencidas') },
                { key: '7', icon: CalendarClock, label: 'Em 7 dias', cents: summary.next7Cents, count: summary.next7Count, tone: 'warning', selected: period === '7', onPress: () => setPeriod(period === '7' ? 'todas' : '7') },
                { key: 'todas', icon: Wallet, label: direction === 'pagar' ? 'Em aberto' : 'A receber', cents: summary.openCents, count: openViews.length, tone: 'neutral', selected: period === 'todas', onPress: () => setPeriod('todas') },
              ]}
            />

            {openViews.length > 0 ? (
              <View style={styles.toolbar}>
                <PillButton icon={SlidersHorizontal} label="Filtrar" count={filterCount} active={filterCount > 0} onPress={() => setFiltersOpen(true)} />
                <PillButton icon={selecting ? X : ListChecks} label={selecting ? 'Cancelar' : 'Selecionar'} active={selecting} onPress={() => (selecting ? stopSelecting() : setSelecting(true))} />
              </View>
            ) : null}

            {filterCount > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tags}>
                {extraPeriod ? <FilterTag label={PERIODS.find((x) => x.value === period)?.label ?? ''} onRemove={() => setPeriod('todas')} /> : null}
                {counterparty ? <FilterTag label={counterparty} onRemove={() => setCounterparty(null)} /> : null}
                {category ? <FilterTag label={category} onRemove={() => setCategory(null)} /> : null}
              </ScrollView>
            ) : null}

            {selecting ? <Note icon="gesture-tap">Toque nas parcelas pagas juntas, da mesma operação. Depois informe a conta, a data e os acréscimos.</Note> : null}
          </>
        ) : null}
      </TitledSection>

      {tab !== 'baixas' ? (
        <>
          {open.length === 0 ? (
            <EmptyState
              icon={openViews.length > 0 ? 'filter-off-outline' : direction === 'pagar' ? 'cash-check' : 'cash-plus'}
              title={openViews.length > 0 ? 'Nada neste filtro' : direction === 'pagar' ? 'Nenhuma conta a pagar' : 'Nada a receber'}
              message={
                openViews.length > 0
                  ? 'Mude o período ou limpe os filtros para ver as outras parcelas.'
                  : direction === 'pagar'
                    ? app.pendingPurchases.length > 0
                      ? 'Há compras com pagamento não informado acima. Confira como foram ou serão pagas para completar o financeiro.'
                      : 'Cada despesa aprovada vira conta a pagar, com as parcelas que você informou.'
                    : 'Cada venda aprovada vira conta a receber, à vista ou nas parcelas combinadas.'
              }>
              {openViews.length > 0 ? (
                <Button title="Limpar filtros" variant="secondary" icon="filter-remove-outline" onPress={clearFilters} />
              ) : direction === 'pagar' && !views.length ? (
                <Button title="Registrar despesa" variant="secondary" icon="plus" onPress={() => router.push('/novo/despesa')} />
              ) : null}
            </EmptyState>
          ) : (
            BUCKETS.filter((bucket) => open.some(bucket.test)).map((bucket, i) => {
              const items = open.filter(bucket.test);
              return (
                <Reveal key={`${listKey}-${bucket.key}`} index={i}>
                  <Section title={`${bucket.title} · ${hidden ? 'R$ •••' : formatCents(sum(items))}`}>
                    <Group>
                      {items.map((v) => (
                        <InstallmentRow
                          key={v.id}
                          view={v}
                          selected={selecting ? selected.includes(v.id) : undefined}
                          onPress={selecting ? (operationId && v.operationId !== operationId ? () => undefined : () => toggle(v)) : undefined}
                        />
                      ))}
                    </Group>
                  </Section>
                </Reveal>
              );
            })
          )}

          {previstas.length > 0 ? (
            <Section title="Recorrentes a lançar" action={{ label: 'Ver todas', onPress: () => router.push('/financeiro/recorrencias') }}>
              <Group>
                {previstas.slice(0, 3).map((o) => (
                  <ListRow
                    key={o.id}
                    leading={<DueDateTile date={o.dueDate} tone={o.daysToDue < 0 ? 'danger' : 'info'} />}
                    accessibilityLabel={`${o.title}, ${formatCents(o.cents)}, vence ${formatDate(o.dueDate)}. Lançar a despesa do mês`}
                    title={
                      <View style={styles.titleRow}>
                        <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                          {o.title}
                        </AppText>
                        <AppText variant="bodyStrong" numeric>
                          {formatCents(o.cents)}
                        </AppText>
                      </View>
                    }
                    subtitle={
                      <View style={styles.titleRow}>
                        <AppText variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
                          {`${monthTitle(`${o.month}-01`).split(' de ')[0]} · toque para lançar`}
                        </AppText>
                        <StatusText label="Prevista" tone="info" />
                      </View>
                    }
                    onPress={() => router.push({ pathname: '/novo/despesa', params: { recorrencia: o.recurrenceId, mes: o.month } })}
                  />
                ))}
              </Group>
            </Section>
          ) : null}

          {waiting > 0 ? (
            <Note icon="account-clock-outline">{`${plural(waiting, 'lançamento aguarda', 'lançamentos aguardam')} aprovação. A conta aparece aqui quando for aprovada.`}</Note>
          ) : null}
        </>
      ) : feed.length === 0 ? (
        <EmptyState icon="history" title="Nenhuma baixa ainda" message="Pagamentos, recebimentos e movimentações registrados aparecem aqui, com a conta e o comprovante." />
      ) : (
        <>
          {feedMonths.map((m, i) => (
            <Reveal key={m} index={i}>
              <Section title={monthTitle(`${m}-01`)}>
                <Group>
                  {feedShown
                    .filter((f) => f.date.startsWith(m))
                    .map((f) => {
                      const meta = PAYMENT_STATUS[f.status];
                      const tone: Tone = f.sign > 0 ? 'success' : 'neutral';
                      const voided = f.status === 'estornado' || f.status === 'descartado';
                      return (
                        <ListRow
                          key={f.id}
                          leading={<IconBadge icon={f.icon} tone={tone} size={42} />}
                          accessibilityLabel={`${f.title}, ${f.sign < 0 ? 'saída' : f.sign > 0 ? 'entrada' : 'transferência'} de ${formatCents(f.cents)}, ${formatDate(f.date)}, ${meta.label}`}
                          title={
                            <View style={styles.titleRow}>
                              <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
                                {f.title}
                              </AppText>
                              <AppText variant="bodyStrong" numeric style={[{ color: f.sign > 0 ? p.success : p.text }, voided && styles.voided]}>
                                {hidden ? 'R$ •••' : `${f.sign > 0 ? '+ ' : f.sign < 0 ? '− ' : ''}${formatCents(f.cents)}`}
                              </AppText>
                            </View>
                          }
                          subtitle={
                            <View style={styles.titleRow}>
                              <AppText variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
                                {`${formatDate(f.date).slice(0, 5)} · ${f.subtitle}`}
                              </AppText>
                              {f.status !== 'efetivado' ? <StatusText label={meta.label} tone={meta.tone} /> : null}
                            </View>
                          }
                          onPress={f.onPress}
                        />
                      );
                    })}
                </Group>
              </Section>
            </Reveal>
          ))}
          {feed.length > feedShown.length ? (
            <Button title={`Mostrar mais ${Math.min(30, feed.length - feedShown.length)}`} variant="secondary" onPress={() => setFeedLimit(feedLimit + 30)} />
          ) : null}
        </>
      )}

      <TitledSection title="Acesso rápido">
        <AccessGrid items={tools} />
      </TitledSection>

      <BottomSheet
        visible={filtersOpen}
        title="Filtrar contas"
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <Button title="Limpar" variant="secondary" onPress={clearFilters} disabled={filterCount === 0 && period === 'todas'} />
            <Button title={`Ver ${plural(open.length, 'parcela', 'parcelas')}`} onPress={() => setFiltersOpen(false)} style={styles.grow} />
          </>
        }>
        <SheetGroup title="Vencimento">
          {PERIODS.map((x) => (
            <Chip key={x.value} label={x.label} selected={period === x.value} onPress={() => setPeriod(x.value)} />
          ))}
        </SheetGroup>
        {counterparties.length > 1 ? (
          <SheetGroup title={direction === 'pagar' ? 'Fornecedor' : 'Cliente'}>
            <Chip label="Todos" selected={!counterparty} onPress={() => setCounterparty(null)} />
            {counterparties.map((c) => (
              <Chip key={c} label={c} selected={counterparty === c} onPress={() => setCounterparty(c)} />
            ))}
          </SheetGroup>
        ) : null}
        {categories.length > 1 ? (
          <SheetGroup title="Categoria">
            <Chip label="Todas" selected={!category} onPress={() => setCategory(null)} />
            {categories.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </SheetGroup>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 2 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm },
  tags: { gap: space.sm },
  titleRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  voided: { textDecorationLine: 'line-through', opacity: 0.6 },
});
