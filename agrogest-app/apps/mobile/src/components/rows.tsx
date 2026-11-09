import { router } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { daysBetween, formatDateShort } from '@/domain/dates';
import { formatCents, formatNumber } from '@/domain/format';
import type { LotSummary } from '@/domain/lot-metrics';
import type { Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { usePalette } from '@/theme';

import { CategoryIcon } from './cattle-icon';
import { EntryStatusText, KIND_META } from './status';
import { Badge, StatusText } from './ui/controls';
import { ListRow } from './ui/layout';
import { AppText } from './ui/text';

export function formatGmd(summary: LotSummary): string {
  if (summary.gmdKg === null) return '—';
  return `${summary.gmdEstimated ? '≈' : ''}${formatNumber(summary.gmdKg, 2)} kg/dia`;
}

/** Onde os animais do lote estão hoje: "Pasto 01" ou "Pasto 01 (25) · Pasto 02 (15)". */
export function pastureLabel(app: Pick<ReturnType<typeof useApp>, 'lotGroups' | 'pastureName'>, summary: LotSummary): string {
  const groups = app.lotGroups(summary.lot.id);
  if (groups.length === 0) return summary.headsCurrent > 0 ? summary.lot.managementGroup : 'Sem animais';
  if (groups.length === 1) return app.pastureName(groups[0].pastureId);
  return groups.map((g) => `${app.pastureName(g.pastureId)} (${g.heads})`).join(' · ');
}

export function weightLabel(summary: LotSummary): string {
  const w = summary.lastWeighing;
  return `${w.method === 'estimado' ? '≈' : ''}${formatNumber(w.kg)} kg ${w.method === 'estimado' ? 'estimado' : 'medido'}`;
}

/** Lançamento em lista. `hideStatus` quando o título da seção já diz o status (ex.: Pendências). */
export function EntryRow({ entry, hideStatus = false }: { entry: Entry; hideStatus?: boolean }) {
  const app = useApp();
  // O consumo não tem valor gravado: o custo vem do custo médio do estoque (só para sócio).
  const derived = entry.kind === 'consumo' && app.canSeeFinance(entry.operationId) ? (entry.derivedCents ?? null) : null;
  const amountCents = entry.amountCents ?? derived;
  const showAmount =
    amountCents !== null && (app.canSeeFinance(entry.operationId) || entry.authorId === app.user.id);
  return (
    <ListRow
      icon={KIND_META[entry.kind].icon}
      accessibilityLabel={`${KIND_META[entry.kind].label}: ${entry.title}`}
      title={
        <View style={styles.titleRow}>
          {/* Duas linhas: títulos como "Manutenção de cerca" não somem atrás do valor. */}
          <AppText variant="bodyStrong" numberOfLines={2} style={styles.flex}>
            {entry.title}
          </AppText>
          {showAmount ? (
            <AppText variant="bodyStrong" numeric>
              {formatCents(amountCents ?? 0)}
            </AppText>
          ) : null}
        </View>
      }
      subtitle={
        <View style={styles.sub}>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {app.userName(entry.authorId).split(' ')[0]} · {formatDateShort(entry.occurredAt)}
          </AppText>
          {entry.pendingDecision ? (
            <StatusText label="Decisão offline" tone="info" />
          ) : hideStatus ? null : (
            <EntryStatusText entry={entry} />
          )}
        </View>
      }
      onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: entry.id } })}
    />
  );
}

/** Dias sem pesagem a partir dos quais o lote pede uma nova. */
export const STALE_WEIGHING_DAYS = 30;

/**
 * Lote em lista: categoria e pasto, peso e ganho numa linha curta, cabeças à direita e o
 * aviso de pesagem atrasada quando passa de 30 dias.
 */
export function LotRow({ summary }: { summary: LotSummary }) {
  const app = useApp();
  const p = usePalette();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 480 || fontScale > 1.2;
  const { lot } = summary;
  const active = summary.headsCurrent > 0;
  const idle = daysBetween(summary.lastWeighing.date, app.today);
  const stale = active && idle >= STALE_WEIGHING_DAYS;
  const weight = `${summary.lastWeighing.method === 'estimado' ? '≈' : ''}${formatNumber(summary.lastWeighing.kg)} kg`;
  return (
    <ListRow
      leading={
        <View style={[styles.lotIcon, { backgroundColor: p.fill }]}>
          <CategoryIcon category={lot.category} size={32} />
        </View>
      }
      accessibilityLabel={`Origem ${lot.code}, ${lot.category.toLowerCase()}, ${summary.headsCurrent} cabeças${stale ? ', pesagem atrasada' : ''}`}
      title={
        <View style={[styles.titleRow, compact && styles.lotTitleCompact]}>
          <AppText variant="bodyStrong" style={styles.shrink}>
            Origem {lot.code}
          </AppText>
          {stale ? <Badge label={`Sem pesar há ${idle} dias`} tone="warning" /> : null}
          {!active ? <Badge label="Encerrado" /> : null}
        </View>
      }
      subtitle={
        <View style={styles.sub}>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {lot.category} · {pastureLabel(app, summary)}
          </AppText>
          {active ? (
            <AppText variant="caption" tone="muted" numeric numberOfLines={1}>
              {summary.gmdKg !== null ? `${weight} · ${formatGmd(summary)}` : `${weight} na entrada · sem pesagem`}
            </AppText>
          ) : null}
        </View>
      }
      right={
        <View style={styles.right}>
          <AppText variant="heading" numeric>
            {summary.headsCurrent}
          </AppText>
          <AppText variant="caption" tone="faint">
            cab.
          </AppText>
        </View>
      }
      onPress={() => router.push({ pathname: '/lote/[id]', params: { id: lot.id } })}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lotTitleCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  sub: { gap: 3, marginTop: 1 },
  right: { alignItems: 'flex-end' },
  lotIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
});
