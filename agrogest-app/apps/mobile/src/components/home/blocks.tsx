import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CategoryIcon } from '@/components/cattle-icon';
import { SatellitePreview } from '@/components/farm-map/satellite-preview';
import { LotRow, STALE_WEIGHING_DAYS } from '@/components/rows';
import { Chip, ChipRow } from '@/components/ui/controls';
import { Card, Group, ListRow, Section, TitledSection } from '@/components/ui/layout';
import { BadgeDollarSign, HandCoins, Map as MapIcon, Scale } from '@/components/ui/lucide';
import { haptics } from '@/components/ui/motion';
import { QuickActions } from '@/components/ui/quick-actions';
import { AppText, Icon, type IconName } from '@/components/ui/text';
import { monthTitle } from '@/domain/dates';
import { formatCents, formatCentsCompact, formatNumber, plural } from '@/domain/format';
import { formatHectares, ringAreaHa } from '@/domain/geo';
import { monthSummary, staleLots, summarizeHerd, type LotSummary } from '@/domain/lot-metrics';
import type { Farm } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { radius, space, usePalette, type Tone } from '@/theme';

/**
 * "Pro dia a dia" do Início nos modos Gerencial e Analítico: os quatro registros mais comuns,
 * como no Financeiro. Pesagem é a ação principal; Venda só para quem vê o financeiro.
 */
export function DailyShortcuts() {
  const app = useApp();
  const sells = app.scopedFarms.some((f) => app.canSeeFinance(f.operationId));
  return (
    <TitledSection title="Pro dia a dia">
      <QuickActions
        actions={[
          { key: 'pesagem', label: 'Pesagem', icon: Scale, primary: true, onPress: () => router.push('/novo/pesagem') },
          { key: 'despesa', label: 'Despesa', icon: BadgeDollarSign, onPress: () => router.push('/novo/despesa') },
          { key: 'pasto', label: 'Mudança de pasto', icon: MapIcon, onPress: () => router.push('/novo/manejo') },
          ...(sells ? [{ key: 'venda', label: 'Venda', icon: HandCoins, onPress: () => router.push('/novo/venda') }] : []),
        ]}
      />
    </TitledSection>
  );
}

/** Indicador em bloco: rótulo, número e contexto curto. */
export function Metric({ label, value, hint, tone, wide }: { label: string; value: string; hint?: string; tone?: Tone; wide?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.metric, wide && styles.metricWide, { backgroundColor: p.fill }]}>
      {/* Rótulo e dica quebram em até duas linhas; o número encolhe a fonte em vez de cortar com reticências. */}
      <AppText variant="caption" tone="muted" numberOfLines={2}>
        {label}
      </AppText>
      <AppText variant="heading" numeric numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} tone={tone}>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="faint" numberOfLines={2}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** Rebanho de hoje: cabeças, lotes, peso e ganho médios. Sem dinheiro. */
export function HerdToday() {
  const app = useApp();
  const herd = summarizeHerd(app.lotSummaries);
  const approx = herd.estimated ? '≈' : '';
  return (
    <Section title="Rebanho hoje" action={{ label: 'Ver lotes', onPress: () => router.navigate('/rebanho') }}>
      <MetricGrid>
        <Metric label="Cabeças" value={formatNumber(herd.heads)} hint={plural(herd.activeLots, 'lote', 'lotes')} />
        <Metric
          label="Peso médio"
          value={herd.avgWeightKg === null ? '—' : `${approx}${formatNumber(herd.avgWeightKg)} kg`}
          hint="por cabeça"
        />
        <Metric
          label="Ganho/dia"
          value={herd.avgGmdKg === null ? '—' : `${approx}${formatNumber(herd.avgGmdKg, 2)} kg`}
          hint={herd.avgGmdKg === null ? 'sem pesagem' : 'média'}
        />
      </MetricGrid>
    </Section>
  );
}

/** O mês corrente: vendas e custos, comparando os custos com o mês anterior. */
export function MonthCard() {
  const app = useApp();
  const p = usePalette();
  const financeOps = new Set(app.scopedFarms.map((f) => f.operationId).filter((id) => app.canSeeFinance(id)));
  if (financeOps.size === 0) return null;
  const farmIds = new Set(app.scopedFarms.map((f) => f.id));
  const lots = app.lotSummaries.filter((s) => financeOps.has(s.lot.operationId));
  const month = monthSummary(lots, app.visibleEntries, financeOps, farmIds, app.today);
  // Mês sem venda e sem custo não tem o que mostrar: o cartão só ocuparia espaço para dizer "nada".
  if (month.headsSold === 0 && month.costsCents === 0) return null;
  return (
    <Section title={monthTitle(app.today).split(' de ')[0]}>
      <Card>
        {month.headsSold > 0 ? (
          <>
            <View style={styles.between}>
              <AppText tone="muted">Vendas</AppText>
              <AppText variant="bodyStrong" numeric>
                {plural(month.headsSold, 'cabeça', 'cabeças')} · {formatNumber(month.arrobasSold, 1)} @
              </AppText>
            </View>
            <View style={styles.between}>
              <AppText tone="muted">Receita</AppText>
              <AppText variant="bodyStrong" numeric>
                {formatCents(month.revenueCents)}
              </AppText>
            </View>
            <View style={styles.between}>
              <AppText tone="muted">Resultado real</AppText>
              <AppText variant="bodyStrong" numeric tone={month.realResultCents >= 0 ? 'success' : 'danger'}>
                {formatCents(month.realResultCents)}
              </AppText>
            </View>
          </>
        ) : (
          <AppText tone="muted">Nenhuma venda aprovada neste mês.</AppText>
        )}
        <View style={[styles.divider, { backgroundColor: p.border }]} />
        <View style={styles.between}>
          <AppText tone="muted">Custos do mês</AppText>
          <View style={styles.right}>
            <AppText variant="bodyStrong" numeric>
              {formatCents(month.costsCents)}
            </AppText>
            {month.previousCostsCents > 0 ? (
              <AppText variant="caption" tone="faint" numeric>
                mês anterior: {formatCents(month.previousCostsCents)}
              </AppText>
            ) : null}
          </View>
        </View>
      </Card>
    </Section>
  );
}

/** Lotes ativos em linhas curtas, com aviso de pesagem atrasada. */
export function LotPulse({ limit = 5 }: { limit?: number }) {
  const app = useApp();
  const active = app.lotSummaries.filter((s) => s.headsCurrent > 0);
  if (active.length === 0) return null;
  const stale = new Set(staleLots(active, app.today, STALE_WEIGHING_DAYS).map((s) => s.lot.id));
  // Atrasados primeiro: é o que pede ação.
  const ordered = [...active].sort((a, b) => Number(stale.has(b.lot.id)) - Number(stale.has(a.lot.id)));
  return (
    <Section title="Lotes" action={active.length > limit ? { label: 'Ver todos', onPress: () => router.navigate('/rebanho') } : undefined}>
      <Group>
        {ordered.slice(0, limit).map((s) => (
          <LotRow key={s.lot.id} summary={s} />
        ))}
      </Group>
    </Section>
  );
}

/** Mapa da fazenda na home: contorno, hectares e lotes posicionados. Toque abre o satélite. */
export function FarmMapCard() {
  const app = useApp();
  const p = usePalette();
  // Largura estimada pela tela até o onLayout medir de verdade (a animação de entrada pode atrasá-lo).
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setWidth] = useState(0);
  const width = measured || Math.min(windowWidth, 640) - 2 * (space.lg + 4) - 2 * space.md;
  const farm: Farm | undefined = app.contextFarm ?? app.scopedFarms.find((f) => f.boundary) ?? app.scopedFarms[0];
  if (!farm) return null;
  const lots = app.farmLotSummaries(farm.id).filter((s) => s.headsCurrent > 0);
  const pins = lots.flatMap((s) => (s.lot.location ? [{ position: s.lot.location, category: s.lot.category }] : []));
  const partner = app.canSeeFinance(farm.operationId);
  const open = () => {
    haptics.tap();
    router.push({ pathname: '/fazenda/mapa/[id]', params: { id: farm.id } });
  };

  if (!farm.boundary) {
    return (
      <Section title="Mapa da fazenda">
        <Group>
          <ListRow
            icon="map-outline"
            iconTone="accent"
            title={partner ? 'Desenhe a área no satélite' : 'Ver o mapa da fazenda'}
            subtitle={partner ? 'Marque os cantos da fazenda e veja os hectares e onde está cada lote.' : farm.name}
            onPress={open}
          />
        </Group>
      </Section>
    );
  }

  return (
    <Section title="Mapa da fazenda">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir o mapa da ${farm.name}`}
        onPress={open}
        style={({ pressed }) => [styles.mapCard, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.85 : 1 }]}>
        <View style={[styles.mapCanvas, { backgroundColor: p.fill }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? <SatellitePreview boundary={farm.boundary} pins={pins} width={width} height={170} /> : null}
        </View>
        <View style={styles.between}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{farm.name}</AppText>
            <AppText variant="caption" tone="muted">
              {formatHectares(ringAreaHa(farm.boundary))} · {pins.length} de {plural(lots.length, 'lote', 'lotes')} no mapa
            </AppText>
          </View>
          <Icon name="chevron-right" size={20} color={p.textFaint} />
        </View>
      </Pressable>
    </Section>
  );
}

type Compare = 'gmd' | 'custo' | 'resultado';

const COMPARE: { value: Compare; label: string; icon: IconName }[] = [
  { value: 'gmd', label: 'Ganho diário', icon: 'trending-up' },
  { value: 'custo', label: 'Custo/cab.', icon: 'cash' },
  { value: 'resultado', label: 'Resultado', icon: 'chart-line' },
];

/** Ranking de lotes por um indicador, com barras horizontais. Sem rolar para o lado. */
export function CompareLots() {
  const app = useApp();
  const p = usePalette();
  const [metric, setMetric] = useState<Compare>('gmd');
  const finance = (s: LotSummary) => app.canSeeFinance(s.lot.operationId);
  const options = COMPARE.filter((c) => c.value === 'gmd' || app.lotSummaries.some(finance));
  const value = (s: LotSummary): number | null => {
    if (metric === 'gmd') return s.gmdKg;
    if (!finance(s)) return null;
    if (metric === 'custo') return s.headsCurrent > 0 ? s.costPerHeadCents : null;
    return s.sales.length > 0 ? s.realResultCents : null;
  };
  const format = (v: number) => (metric === 'gmd' ? `${formatNumber(v, 2)} kg` : formatCentsCompact(v));
  const rows = app.lotSummaries
    .map((s) => ({ s, v: value(s) }))
    .filter((r) => metric === 'resultado' || r.s.headsCurrent > 0)
    .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
  const max = Math.max(...rows.map((r) => Math.abs(r.v ?? 0)), 1e-9);
  const empty =
    metric === 'gmd' ? 'O ganho aparece depois da primeira pesagem.' : metric === 'resultado' ? 'Ainda não há vendas.' : 'Sem custos lançados.';

  return (
    <Section title="Comparar lotes">
      <ChipRow>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={metric === o.value} onPress={() => setMetric(o.value)} />
        ))}
      </ChipRow>
      <Card>
        {rows.every((r) => r.v === null) ? (
          <AppText tone="muted">{empty}</AppText>
        ) : (
          rows.map(({ s, v }) => (
            <Pressable
              key={s.lot.id}
              accessibilityRole="button"
              accessibilityLabel={`Origem ${s.lot.code}: ${v === null ? 'sem dado' : format(v)}`}
              onPress={() => router.push({ pathname: '/lote/[id]', params: { id: s.lot.id } })}
              style={({ pressed }) => [styles.barRow, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={styles.barLabel}>
                <CategoryIcon category={s.lot.category} size={22} />
                <AppText variant="label" numberOfLines={1}>
                  {s.lot.code}
                </AppText>
              </View>
              <View style={[styles.barTrack, { backgroundColor: p.fill }]}>
                {v !== null ? (
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(4, (Math.abs(v) / max) * 100)}%`,
                        backgroundColor: v < 0 ? p.danger : metric === 'custo' ? p.textFaint : p.accent,
                      },
                    ]}
                  />
                ) : null}
              </View>
              <AppText variant="label" numeric style={styles.barValue} tone={v === null ? 'faint' : v < 0 ? 'danger' : undefined}>
                {v === null ? '—' : `${metric === 'gmd' && s.gmdEstimated ? '≈' : ''}${format(v)}`}
              </AppText>
            </Pressable>
          ))
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: { flexGrow: 1, flexBasis: '30%', minWidth: 96, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm + 2, gap: 2 },
  metricWide: { flexBasis: '45%' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  right: { alignItems: 'flex-end' },
  divider: { height: StyleSheet.hairlineWidth },
  lotIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
  mapCard: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.md },
  mapCanvas: { height: 170, borderRadius: radius.lg, overflow: 'hidden' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 },
  barLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 68 },
  barTrack: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barValue: { width: 84, textAlign: 'right' },
});
