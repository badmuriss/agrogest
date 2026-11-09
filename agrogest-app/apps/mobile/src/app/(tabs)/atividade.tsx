import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { InstallmentRow } from '@/components/finance-ui';
import { AppHeader } from '@/components/header';
import { InviteCard } from '@/components/invite-card';
import { useMenuTabs } from '@/components/navigation';
import { useNotifications } from '@/components/notifications';
import { PendingPurchases } from '@/components/pending-purchases';
import { EntryRow } from '@/components/rows';
import { KIND_META } from '@/components/status';
import { StockRow } from '@/components/stock-ui';
import { SyncBar } from '@/components/sync-bar';
import { Button, Chip, ChipRow } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen, Section, SectionListScreen, type ListSection } from '@/components/ui/layout';
import { FadeIn, haptics } from '@/components/ui/motion';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { FirstVisit, TabSkeleton } from '@/components/ui/skeletons';
import { AppText, Avatar, Icon } from '@/components/ui/text';
import { activityDay, activityTime, describeActivity, type ActivityItem } from '@/domain/activity';
import { formatDate, monthTitle } from '@/domain/dates';
import { ALERT_DAYS, installmentId } from '@/domain/finance';
import { formatCents } from '@/domain/format';
import type { Entry, EntryKind } from '@/domain/types';
import { firstName, useApp } from '@/state/app-state';
import { usePreferences } from '@/state/preferences';
import { space, usePalette } from '@/theme';

type Filter = 'tudo' | 'voce' | 'convites';
/** `registros` é o Tudo visto como histórico (o que foi lançado, por mês). */
type Recorte = Filter | 'registros';

function parseView(value: string | undefined): Recorte | null {
  return value === 'tudo' || value === 'voce' || value === 'convites' || value === 'registros' ? value : null;
}

/**
 * Uma linha do tempo, três filtros: **Tudo** (quem fez o quê, por dia, ou o histórico de
 * registros, por mês e tipo), **Para você** (o que pede ação: aprovações, conflitos, contas,
 * estoque baixo, compras sem pagamento) e **Convites** (os recebidos e os enviados que aguardam
 * aceite). Substitui as antigas Pendências, Notificações e Histórico.
 */
/** Primeira visita: o esqueleto responde ao toque e a tela monta no quadro seguinte. */
export default function AtividadeTab() {
  return (
    <FirstVisit skeleton={<TabSkeleton variant="list" />}>
      <AtividadeScreen />
    </FirstVisit>
  );
}

function AtividadeScreen() {
  const params = useLocalSearchParams<{ filtro?: string }>();
  const { activityTab } = useMenuTabs();
  const { count, invites } = useNotifications();
  // O recorte vive no endereço: o sino, o Início e os links antigos abrem direto nele.
  const view = parseView(params.filtro) ?? 'tudo';
  const show = (next: Recorte) => router.setParams({ filtro: next });

  const header = (
    <>
      <AppHeader title="Atividade" context back={!activityTab} bell={false} />
      <SegmentedTabs<Filter>
        accessibilityLabel="Filtro da atividade"
        options={[
          { value: 'tudo', label: 'Tudo' },
          { value: 'voce', label: 'Para você', count: count - invites.length },
          { value: 'convites', label: 'Convites', count: invites.length },
        ]}
        value={view === 'registros' ? 'tudo' : view}
        onChange={show}
      />
    </>
  );
  if (view === 'voce') return <ForYou header={header} onShowRecords={() => show('registros')} />;
  if (view === 'convites') return <Invitations header={header} />;
  if (view === 'registros') return <Records header={header} onView={show} />;
  return <Feed header={header} onView={show} />;
}

/**
 * Um filtro só em "Tudo", como o extrato do Nubank: a linha mostra o que está valendo e abre as
 * opções. "Mostrar" troca entre a equipe (quem fez o quê) e os registros (o que foi lançado);
 * o segundo grupo é a pessoa ou o tipo de registro.
 */
function FilterBar({
  view,
  onView,
  groupLabel,
  options,
  selected,
  onSelect,
}: {
  view: 'tudo' | 'registros';
  onView: (next: Recorte) => void;
  groupLabel: string;
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === selected)?.label;
  const summary = [view === 'tudo' ? 'Equipe' : 'Registros', current ?? (view === 'tudo' ? 'todas as pessoas' : 'todos os tipos')].join(' · ');
  return (
    <View style={styles.filter}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Filtrar. Mostrando ${summary}`}
        onPress={() => {
          haptics.tap();
          setOpen((v) => !v);
        }}
        style={({ pressed }) => [styles.filterBar, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.8 : 1 }]}>
        <Icon name="tune-variant" size={20} color={p.text} />
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.filterText}>
          {summary}
        </AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={p.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.filterBody}>
          <AppText variant="label" tone="muted">
            Mostrar
          </AppText>
          <ChipRow>
            <Chip label="Equipe" selected={view === 'tudo'} onPress={() => onView('tudo')} />
            <Chip label="Registros" selected={view === 'registros'} onPress={() => onView('registros')} />
          </ChipRow>
          {options.length > 1 ? (
            <>
              <AppText variant="label" tone="muted">
                {groupLabel}
              </AppText>
              <ChipRow>
                <Chip label="Todos" selected={selected === null} onPress={() => onSelect(null)} />
                {options.map((o) => (
                  <Chip key={o.value} label={o.label} selected={selected === o.value} onPress={() => onSelect(o.value)} />
                ))}
              </ChipRow>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Quem fez o quê nas fazendas do contexto, do mais recente para o mais antigo, agrupado por dia. */
function Feed({ header, onView }: { header: ReactNode; onView: (next: Recorte) => void }) {
  const app = useApp();
  const prefs = usePreferences();
  const [actor, setActor] = useState<string | null>(null);
  const { markActivitySeen } = prefs;

  // Ver a linha do tempo marca tudo como visto (o ponto do sino some).
  useEffect(() => {
    void markActivitySeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actors = useMemo(() => {
    const names = new Map<string, string>();
    for (const item of app.activity) {
      if (item.actorName) names.set(item.actorId, item.actorName);
    }
    return [...names.entries()];
  }, [app.activity]);
  const selectedActor = actor !== null && actors.some(([id]) => id === actor) ? actor : null;
  const sections = useMemo(() => {
    const days = new Map<string, ListSection<ActivityItem> & { data: ActivityItem[] }>();
    for (const item of app.activity) {
      if (selectedActor !== null && item.actorId !== selectedActor) continue;
      const day = activityDay(item.at, app.today);
      let section = days.get(day);
      if (!section) {
        section = { key: day, title: day, data: [] };
        days.set(day, section);
      }
      section.data.push(item);
    }
    return [...days.values()];
  }, [app.activity, app.today, selectedActor]);

  return (
    <SectionListScreen
      tab
      resetKey={`tudo:${app.contextFarm?.id ?? 'todas'}:${selectedActor ?? 'todos'}`}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={(item) => <ActivityRow item={item} />}
      empty={
        <EmptyState
          icon="history"
          title="Nenhuma atividade ainda"
          message="Cadastros, mudanças de pasto, pesagens e aprovações aparecem aqui, com quem fez e quando."
        />
      }
      header={<>
        {header}
        <FilterBar
          view="tudo"
          onView={onView}
          groupLabel="Pessoa"
          options={actors.map(([id, name]) => ({ value: id, label: id === app.user.id ? 'Você' : firstName(name) }))}
          selected={selectedActor}
          onSelect={setActor}
        />
      </>}
    />
  );
}

const KINDS: EntryKind[] = ['pesagem', 'manejo', 'despesa', 'nota_fiscal', 'mortalidade', 'venda', 'consumo', 'ajuste_estoque', 'transferencia_estoque', 'receita'];

/** Tudo o que foi registrado, do mais recente para o mais antigo, agrupado por mês. */
function Records({ header, onView }: { header: ReactNode; onView: (next: Recorte) => void }) {
  const app = useApp();
  const [kind, setKind] = useState<EntryKind | null>(null);
  const { scoped, present } = useMemo(() => {
    const farmIds = new Set(app.scopedFarms.map((farm) => farm.id));
    const scoped = app.visibleEntries
      .filter((entry) => farmIds.has(entry.farmId))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt));
    const kinds = new Set(scoped.map((entry) => entry.kind));
    return { scoped, present: KINDS.filter((kind) => kinds.has(kind)) };
  }, [app.scopedFarms, app.visibleEntries]);
  const selectedKind = kind !== null && present.includes(kind) ? kind : null;

  const sections = useMemo(() => {
    const months = new Map<string, ListSection<Entry> & { data: Entry[] }>();
    for (const entry of scoped) {
      if (selectedKind !== null && entry.kind !== selectedKind) continue;
      const key = entry.occurredAt.slice(0, 7);
      let month = months.get(key);
      if (!month) {
        month = { key, title: monthTitle(`${key}-01`), data: [] };
        months.set(key, month);
      }
      month.data.push(entry);
    }
    return [...months.values()];
  }, [scoped, selectedKind]);

  return (
    <SectionListScreen
      tab
      resetKey={`registros:${app.contextFarm?.id ?? 'todas'}:${selectedKind ?? 'todos'}`}
      sections={sections}
      keyExtractor={(entry) => entry.id}
      renderItem={(entry) => <EntryRow entry={entry} />}
      empty={<EmptyState icon="history" title="Nada registrado ainda" message="Pesagens, despesas, vendas e notas aparecem aqui." />}
      header={<>
        {header}
        <FilterBar
          view="registros"
          onView={onView}
          groupLabel="Tipo"
          options={present.map((k) => ({ value: k, label: KIND_META[k].label }))}
          selected={selectedKind}
          onSelect={(value) => setKind(value as EntryKind | null)}
        />
      </>}
    />
  );
}

/**
 * Caixa de entrada do que pede ação: cada grupo só aparece quando tem itens. O que já foi
 * resolvido fica em Registros.
 */
function ForYou({ header, onShowRecords }: { header: ReactNode; onShowRecords: () => void }) {
  const app = useApp();
  const { purchases } = useNotifications();
  const entries = app.visibleEntries;
  const mine = entries.filter((e) => e.authorId === app.user.id);

  const sections: { key: string; title: string; hint?: string; items: Entry[] }[] = [
    {
      key: 'aprovar',
      title: 'Para você aprovar',
      items: entries.filter((e) => e.status === 'aguardando_aprovacao' && !e.pendingDecision && app.blockReason(e) === null),
    },
    {
      key: 'conflitos',
      title: 'Conflitos',
      hint: 'Não couberam no saldo confirmado. Nada foi sobrescrito.',
      items: entries.filter((e) => e.status === 'conflito'),
    },
    { key: 'recusados', title: 'Recusados', hint: 'Corrija e envie de novo.', items: mine.filter((e) => e.status === 'rejeitado') },
    { key: 'rascunhos', title: 'Rascunhos', items: mine.filter((e) => e.status === 'rascunho') },
    {
      key: 'fila',
      title: 'Esperando internet',
      items: entries.filter((e) => e.status === 'aguardando_envio' || e.pendingDecision !== null),
    },
    {
      key: 'outros',
      title: 'Com outra pessoa',
      hint: 'Aguardando a aprovação de quem pode aprovar.',
      items: entries.filter((e) => e.status === 'aguardando_aprovacao' && !e.pendingDecision && app.blockReason(e) !== null),
    },
  ];
  const visible = sections.filter((s) => s.items.length > 0);
  // Aprovar e conflitos vêm antes de tudo: são o que destrava o trabalho da equipe.
  const urgent = visible.filter((s) => s.key === 'aprovar' || s.key === 'conflitos');
  const rest = visible.filter((s) => s.key !== 'aprovar' && s.key !== 'conflitos');
  const renderSection = (section: (typeof visible)[number], i: number) => (
    <FadeIn key={section.key} index={i}>
      <Section title={`${section.title} · ${section.items.length}`}>
        <Group>
          {section.items.map((entry) => (
            <EntryRow key={entry.id} entry={entry} hideStatus />
          ))}
        </Group>
        {section.hint ? (
          <AppText variant="caption" tone="muted">
            {section.hint}
          </AppText>
        ) : null}
      </Section>
    </FadeIn>
  );
  const horizon = Math.max(...ALERT_DAYS);
  const overdue = app.installments.filter((v) => v.openCents > 0 && v.daysToDue < 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const dueSoon = app.installments.filter((v) => v.openCents > 0 && v.daysToDue >= 0 && v.daysToDue <= horizon).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const scopedOps = new Set(app.scopedFarms.map((f) => f.operationId));
  const paymentConflicts = app.payments.filter((x) => x.status === 'conflito' && scopedOps.has(x.operationId));
  const lowStock = app.stock().filter((p) => p.low);
  const queue = app.counts.unsent + app.counts.intents > 0 || !app.online;
  const nothing = visible.length === 0 && overdue.length === 0 && dueSoon.length === 0 && paymentConflicts.length === 0
    && lowStock.length === 0 && purchases.length === 0;
  const sum = (list: typeof overdue) => formatCents(list.reduce((acc, v) => acc + v.openCents, 0));

  return (
    <Screen tab header={header}>
      {queue ? <SyncBar /> : null}
      {urgent.map(renderSection)}
      <PendingPurchases lots={purchases} />
      {nothing ? (
        <FadeIn>
          <EmptyState
            icon="check-all"
            title="Tudo em dia"
            message={
              app.visibleEntries.length > 0
                ? 'Nada esperando por você. O que foi registrado fica em Registros.'
                : 'Rascunhos, conflitos, aprovações e contas a vencer aparecem aqui quando houver.'
            }>
            {app.visibleEntries.length > 0 ? <Button title="Ver registros" variant="secondary" onPress={onShowRecords} /> : null}
          </EmptyState>
        </FadeIn>
      ) : null}
      {overdue.length > 0 ? (
        <FadeIn>
          <Section title={`Contas vencidas · ${sum(overdue)}`} action={{ label: 'Financeiro', onPress: () => router.navigate('/financeiro') }}>
            <Group>
              {overdue.map((v) => (
                <InstallmentRow key={v.id} view={v} />
              ))}
            </Group>
          </Section>
        </FadeIn>
      ) : null}
      {dueSoon.length > 0 ? (
        <FadeIn>
          <Section title={`Vencem em até ${horizon} dias · ${sum(dueSoon)}`}>
            <Group>
              {dueSoon.map((v) => (
                <InstallmentRow key={v.id} view={v} />
              ))}
            </Group>
          </Section>
        </FadeIn>
      ) : null}
      {paymentConflicts.length > 0 ? (
        <FadeIn>
          <Section title={`Baixas em conflito · ${paymentConflicts.length}`}>
            <Group>
              {paymentConflicts.map((x) => (
                <ListRow
                  key={x.id}
                  icon="cash-remove"
                  iconTone="danger"
                  title={`${x.direction === 'pagar' ? 'Pagamento' : 'Recebimento'} de ${formatDate(x.paidAt)}`}
                  subtitle={x.conflictReason ?? undefined}
                  onPress={() => router.push({ pathname: '/financeiro/parcela/[id]', params: { id: installmentId(x.items[0].entryId, x.items[0].index) } })}
                />
              ))}
            </Group>
            <AppText variant="caption" tone="muted">
              Não entraram no caixa. Confira a parcela e descarte ou registre de novo.
            </AppText>
          </Section>
        </FadeIn>
      ) : null}
      {lowStock.length > 0 ? (
        <FadeIn>
          <Section title={`Estoque baixo · ${lowStock.length}`}>
            <Group>
              {lowStock.map((p) => (
                <StockRow key={`${p.supply.id}:${p.farmId}`} position={p} showValue={app.canSeeFinance(p.supply.operationId)} />
              ))}
            </Group>
          </Section>
        </FadeIn>
      ) : null}
      {rest.map(renderSection)}
    </Screen>
  );
}

const ROLE = { socio: 'Sócio', funcionario: 'Funcionário' } as const;

/** Convites recebidos (aceitar ou recusar aqui) e os enviados nas fazendas do contexto, ainda sem aceite. */
function Invitations({ header }: { header: ReactNode }) {
  const app = useApp();
  const { invites: incoming } = useNotifications();
  const incomingIds = new Set(incoming.map((invite) => invite.id));
  const scopedOps = new Set(app.scopedFarms.map((f) => f.operationId));
  const sent = app.invites.filter((invite) => scopedOps.has(invite.operationId) && !incomingIds.has(invite.id));
  const canInvite = app.scopedFarms.length > 0 && (!app.cloudMode || app.scopedFarms.some((farm) => app.canSeeFinance(farm.operationId)));

  return (
    <Screen tab header={header}>
      {incoming.length > 0 ? (
        <FadeIn>
          <Section title={`Para você aceitar · ${incoming.length}`}>
            {incoming.map((invite) => <InviteCard key={invite.id} invite={invite} />)}
          </Section>
        </FadeIn>
      ) : null}
      {sent.length > 0 ? (
        <FadeIn index={1}>
          <Section title={`Enviados, aguardando aceite · ${sent.length}`} action={{ label: 'Pessoas', onPress: () => router.push('/pessoas') }}>
            <Group>
              {sent.map((invite) => (
                <ListRow
                  key={invite.id}
                  leading={<Avatar name={invite.name} size={34} tone="warning" />}
                  title={invite.name}
                  subtitle={`${ROLE[invite.role]} · ${invite.contact}`}
                  onPress={() => router.push({ pathname: '/pessoas/convite/[id]', params: { id: invite.id } })}
                />
              ))}
            </Group>
          </Section>
        </FadeIn>
      ) : null}
      {incoming.length === 0 && sent.length === 0 ? (
        <FadeIn>
          <EmptyState
            icon="email-outline"
            title="Nenhum convite pendente"
            message="Os convites que você recebe para entrar numa fazenda e os que você envia aparecem aqui até serem aceitos.">
            {canInvite ? <Button title="Convidar pessoa" icon="account-plus-outline" onPress={() => router.push('/pessoas/nova')} /> : null}
          </EmptyState>
        </FadeIn>
      ) : null}
    </Screen>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const app = useApp();
  const p = usePalette();
  const text = describeActivity(item);
  const mine = item.actorId === app.user.id;
  const who = mine ? 'Você' : item.actorName ? firstName(item.actorName) : 'Alguém da equipe';
  const time = activityTime(item.at);
  const s = item.subject;
  const target =
    s.entryId && app.entry(s.entryId)
      ? () => router.push({ pathname: '/lancamento/[id]', params: { id: s.entryId! } })
      : s.pastureId && app.pasture(s.pastureId)
        ? () => router.push({ pathname: '/pastos/[id]', params: { id: s.pastureId! } })
        : s.lotId && app.lotSummary(s.lotId)
          ? () => router.push({ pathname: '/lote/[id]', params: { id: s.lotId! } })
          : undefined;

  // Sem selo extra por linha: quem fez e o que fez já dizem tudo; o tipo aparece no texto.
  const body = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: p.fill }]}>
      <Avatar name={item.actorName ?? '?'} size={40} tone={mine ? 'accent' : 'neutral'} />
      <View style={styles.text}>
        <Text style={[styles.sentence, { color: p.textMuted }]}>
          <Text style={[styles.strong, { color: p.text }]}>{who}</Text> {text.action}
          {text.object ? (
            <>
              {' '}
              <Text style={[styles.strong, { color: p.text }]}>{text.object}</Text>
            </>
          ) : null}
        </Text>
        {text.detail ? (
          <AppText variant="caption" tone="faint" numberOfLines={2}>
            {text.detail}
          </AppText>
        ) : null}
      </View>
      {time ? (
        <AppText variant="caption" tone="faint" numeric>
          {time}
        </AppText>
      ) : null}
    </View>
  );
  if (!target) return body(false);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptics.tap();
        target();
      }}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filter: { gap: space.sm },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.md, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  filterText: { flex: 1 },
  filterBody: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  kind: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2, paddingTop: 1 },
  sentence: { fontSize: 15, lineHeight: 21 },
  strong: { fontWeight: '600' },
});
