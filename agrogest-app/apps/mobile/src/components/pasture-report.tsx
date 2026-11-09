import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDate, formatDateShort } from '@/domain/dates';
import { formatNumber, plural } from '@/domain/format';
import { pastureStatus, type GmdSummary, type OccupancyEvent, type PastureReport, type PastureStay, type PastureStatus } from '@/domain/pasture';
import type { Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space, usePalette, type Tone } from '@/theme';

import { pastureCaption } from './pasture-form';
import { EntryStatusText } from './status';
import { Badge, Note } from './ui/controls';
import { Card, ListRow } from './ui/layout';
import { haptics } from './ui/motion';
import { AppText, Icon, type IconName } from './ui/text';

/*
 * Hierarquia das telas de pastos, do mais forte ao mais discreto:
 * 1. um número principal por bloco (cabeças hoje, GMD), grande;
 * 2. o estado do pasto (ocupado, em descanso), a única cor da linha;
 * 3. nome e capim/área;
 * 4. a base do cálculo e as explicações, em texto pequeno.
 */

/** "≈ 0,85 kg/dia": o "≈" marca qualquer estimativa visual na base. */
export function formatPastureGmd(gmd: GmdSummary): string {
  return `${gmd.estimated ? '≈' : ''}${formatNumber(gmd.gmdKg, 2)} kg/dia`;
}

/** Base do cálculo sempre visível: sem ela, o número induz a conclusões erradas. */
export function gmdBase(gmd: GmdSummary): string {
  return [
    plural(gmd.intervals, 'intervalo de pesagens', 'intervalos de pesagens'),
    plural(gmd.lots, 'lote', 'lotes'),
    `${formatNumber(gmd.headDays)} cabeça-dias`,
    `${formatDateShort(gmd.from)} a ${formatDate(gmd.to)}`,
  ].join(' · ');
}

// ---------------------------------------------------------------------------
// Números de destaque

/** O número que responde à pergunta da tela, com uma linha de contexto e indicadores menores. */
export function Headline({
  label,
  value,
  unit,
  caption,
  tone,
  stats,
  action,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  tone?: Tone;
  stats?: { label: string; value: string }[];
  /** Atalho discreto no rodapé do bloco. */
  action?: { label: string; icon: IconName; onPress: () => void };
  children?: ReactNode;
}) {
  const p = usePalette();
  return (
    <Card style={styles.headline}>
      <View>
        <AppText variant="label" tone="muted">
          {label}
        </AppText>
        <View style={styles.valueLine}>
          <AppText variant="display" numeric tone={tone}>
            {value}
          </AppText>
          {unit ? (
            <AppText variant="heading" tone="muted">
              {unit}
            </AppText>
          ) : null}
        </View>
        {caption ? (
          <AppText variant="caption" tone="muted">
            {caption}
          </AppText>
        ) : null}
      </View>
      {stats && stats.length > 0 ? <StatStrip stats={stats} /> : null}
      {children}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.tap();
            action.onPress();
          }}
          style={({ pressed }) => [styles.action, { borderTopColor: p.border, opacity: pressed ? 0.6 : 1 }]}>
          <Icon name={action.icon} size={20} color={p.accent} />
          <AppText variant="bodyStrong" style={[styles.flex, { color: p.accent }]}>
            {action.label}
          </AppText>
          <Icon name="chevron-right" size={20} color={p.accent} />
        </Pressable>
      ) : null}
    </Card>
  );
}

/** Indicadores secundários lado a lado, sem fundo: não competem com o número principal. */
export function StatStrip({ stats }: { stats: { label: string; value: string }[] }) {
  const p = usePalette();
  return (
    <View style={[styles.strip, { borderTopColor: p.border }]}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={[styles.stat, i > 0 && { borderLeftColor: p.border, borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: space.md }]}>
          <AppText variant="bodyStrong" numeric numberOfLines={1} adjustsFontSizeToFit>
            {stat.value}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {stat.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Estado e linha de pasto

const STATUS_STYLE: Record<PastureStatus['kind'], { tone: Tone; icon: IconName }> = {
  ocupado: { tone: 'accent', icon: 'cow' },
  descanso: { tone: 'info', icon: 'timer-sand' },
  nunca: { tone: 'neutral', icon: 'circle-outline' },
};

export function statusLabel(status: PastureStatus): string {
  if (status.kind === 'nunca') return 'Nunca usado';
  const days = status.days === 0 ? 'desde hoje' : `há ${plural(status.days, 'dia', 'dias')}`;
  return status.kind === 'ocupado' ? `Ocupado ${days}` : `Em descanso ${days}`;
}

export function StatusBadge({ report, inactive }: { report: Pick<PastureReport, 'currentHeads' | 'stays'>; inactive?: boolean }) {
  const app = useApp();
  if (inactive) return <Badge label="Inativo" icon="archive-outline" />;
  const status = pastureStatus(report, app.today);
  const { tone, icon } = STATUS_STYLE[status.kind];
  return <Badge label={statusLabel(status)} tone={tone} icon={icon} />;
}

/**
 * Um pasto numa lista: nome e estado à esquerda, cabeças de hoje em destaque à direita.
 * `detail` acrescenta uma linha discreta (ex.: números do período no relatório).
 */
export function PastureListItem({ report, detail }: { report: PastureReport; detail?: string }) {
  const app = useApp();
  const { pasture } = report;
  const occupied = report.currentHeads > 0;
  const incomplete = pasture && pasture.active && (!pasture.areaHa || !pasture.forage.trim());
  const caption = [
    pasture ? pastureCaption(pasture) : 'Lotes antigos sem pasto informado',
    occupied && report.headsPerHa !== null ? `${formatNumber(report.headsPerHa, 1)} cab./ha` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      title={pasture?.name ?? app.pastureName(report.pastureId)}
      subtitle={
        <View style={styles.rowSub}>
          <AppText variant="caption" tone="muted">
            {caption}
          </AppText>
          <View style={styles.badges}>
            <StatusBadge report={report} inactive={pasture?.active === false} />
            {incomplete ? <Badge label="Completar cadastro" tone="warning" icon="pencil-outline" /> : null}
          </View>
          {detail ? (
            <AppText variant="caption" tone="faint">
              {detail}
            </AppText>
          ) : null}
        </View>
      }
      right={<HeadCount heads={report.currentHeads} />}
      onPress={pasture ? () => router.push({ pathname: '/pastos/[id]', params: { id: pasture.id } }) : undefined}
    />
  );
}

function HeadCount({ heads }: { heads: number }) {
  return (
    <View style={styles.right}>
      <AppText variant="title" numeric tone={heads > 0 ? 'default' : 'faint'}>
        {heads > 0 ? formatNumber(heads) : '0'}
      </AppText>
      <AppText variant="caption" tone="faint">
        {heads === 1 ? 'cabeça' : 'cabeças'}
      </AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// GMD

/** GMD do pasto em destaque, ou "Dados insuficientes" com o motivo. Nunca inventa desempenho. */
export function GmdCard({ gmd, insufficient, title = 'Ganho médio diário no pasto' }: { gmd: GmdSummary | null; insufficient: string | null; title?: string }) {
  if (!gmd) {
    return (
      <Card style={styles.card}>
        <AppText variant="label" tone="muted">
          {title}
        </AppText>
        <AppText variant="title" tone="faint">
          Dados insuficientes
        </AppText>
        {insufficient ? (
          <AppText variant="caption" tone="muted">
            {insufficient}
          </AppText>
        ) : null}
      </Card>
    );
  }
  return (
    <Headline
      label={title}
      value={`${gmd.estimated ? '≈' : ''}${formatNumber(gmd.gmdKg, 2)}`}
      unit="kg/cabeça/dia"
      tone={gmd.gmdKg > 0 ? 'accent' : 'danger'}
      caption={gmdBase(gmd)}>
      <View style={styles.badges}>
        {gmd.estimated ? <Badge label="Inclui estimativa visual" tone="warning" icon="eye-outline" /> : <Badge label="Só pesagens medidas" tone="success" icon="scale-balance" />}
        {gmd.sample ? <Badge label="Amostra parcial do grupo" /> : null}
        {gmd.categories.map((c) => (
          <Badge key={c} label={c} />
        ))}
      </View>
    </Headline>
  );
}

/** Como ler a comparação: período, animais e manejo pesam tanto quanto o capim. */
export function GmdReadingNote() {
  return (
    <Note icon="information-outline" title="Como o GMD por pasto é calculado">
      Só entram duas pesagens do mesmo grupo de animais, no mesmo pasto e sem mudança de pasto ou de composição entre elas. Compare
      pastos com período, categoria e quantidade de animais parecidos: suplementação e manejo também influenciam o resultado.
    </Note>
  );
}

// ---------------------------------------------------------------------------
// Histórico

const EVENT_LABEL: Record<OccupancyEvent['type'], string> = {
  entrada: 'Entrada do lote',
  chegada: 'Chegou',
  saida: 'Saiu',
  morte: 'Morte',
  venda: 'Venda',
  transferencia: 'Transferência para outra fazenda',
};

export function OccupancyEventRow({ event }: { event: OccupancyEvent }) {
  const app = useApp();
  const lot = app.lotSummary(event.lotId)?.lot;
  const incoming = event.type === 'entrada' || event.type === 'chegada';
  const detail =
    event.type === 'chegada' && event.otherPastureId
      ? `de ${app.pastureName(event.otherPastureId)}`
      : event.type === 'saida' && event.otherPastureId
        ? `para ${app.pastureName(event.otherPastureId)}`
        : null;
  return (
    <ListRow
      icon={incoming ? 'arrow-down-bold-circle-outline' : 'arrow-up-bold-circle-outline'}
      iconTone={incoming ? 'success' : event.type === 'morte' ? 'danger' : 'neutral'}
      title={`${EVENT_LABEL[event.type]}${detail ? ` ${detail}` : ''}`}
      subtitle={`${formatDate(event.date)} · Origem ${lot?.code ?? '—'}${event.apportioned ? ' · baixa apropriada entre pastos' : ''}`}
      right={
        <AppText variant="heading" numeric tone={incoming ? 'success' : 'default'}>
          {incoming ? '+' : '−'}
          {event.heads}
        </AppText>
      }
      onPress={event.entryId ? () => router.push({ pathname: '/lancamento/[id]', params: { id: event.entryId! } }) : undefined}
    />
  );
}

export function StayRow({ stay, showPasture }: { stay: PastureStay; showPasture?: boolean }) {
  const app = useApp();
  const lot = app.lotSummary(stay.lotId)?.lot;
  const title = showPasture ? app.pastureName(stay.pastureId) : `Origem ${lot?.code ?? '—'}`;
  return (
    <ListRow
      icon="calendar-range"
      title={title}
      subtitle={`${formatDate(stay.start)} a ${stay.end ? formatDate(stay.end) : 'hoje'} · até ${plural(stay.maxHeads, 'cabeça', 'cabeças')}`}
      right={
        <View style={styles.right}>
          <AppText variant="heading" numeric>
            {formatNumber(stay.days)}
          </AppText>
          <AppText variant="caption" tone="faint">
            {stay.days === 1 ? 'dia' : 'dias'}
          </AppText>
        </View>
      }
      onPress={lot ? () => router.push({ pathname: '/lote/[id]', params: { id: lot.id } }) : undefined}
    />
  );
}

/** Movimentação registrada, com situação de aprovação: pendente nunca vira saldo definitivo. */
export function MoveRow({ entry }: { entry: Entry }) {
  const app = useApp();
  if (entry.kind !== 'manejo') return null;
  const lot = app.lotSummary(entry.payload.lotId)?.lot;
  return (
    <ListRow
      icon="swap-horizontal"
      title={`${app.pastureName(entry.payload.fromPastureId)} → ${app.pastureName(entry.payload.toPastureId)}`}
      subtitle={
        <View style={styles.rowSub}>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {formatDate(entry.occurredAt)} · Origem {lot?.code ?? '—'} · {app.userName(entry.authorId).split(' ')[0]}
          </AppText>
          {entry.pendingDecision ? <Badge label="Decisão offline" tone="info" /> : <EntryStatusText entry={entry} />}
        </View>
      }
      right={
        <View style={styles.right}>
          <AppText variant="heading" numeric>
            {entry.payload.heads}
          </AppText>
          <AppText variant="caption" tone="faint">
            cab.
          </AppText>
        </View>
      }
      onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: entry.id } })}
    />
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs },
  flex: { flex: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, minHeight: 44 },
  headline: { gap: space.md },
  valueLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: space.sm },
  strip: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, gap: space.md },
  stat: { flex: 1, minWidth: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  right: { alignItems: 'flex-end', minWidth: 48 },
  rowSub: { gap: space.xs, marginTop: 1 },
});
