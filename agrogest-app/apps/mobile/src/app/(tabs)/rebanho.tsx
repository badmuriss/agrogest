import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FarmMapsPanel } from '@/components/farm-maps-panel';
import { AppHeader } from '@/components/header';
import { PasturesPanel } from '@/components/pastures-panel';
import { LotRow, STALE_WEIGHING_DAYS } from '@/components/rows';
import { Button } from '@/components/ui/controls';
import { EmptyState, Screen, SectionListScreen, type ListSection } from '@/components/ui/layout';
import { FadeIn, haptics } from '@/components/ui/motion';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { FirstVisit, TabSkeleton } from '@/components/ui/skeletons';
import { AppText, Icon } from '@/components/ui/text';
import { formatNumber, plural } from '@/domain/format';
import { staleLots, summarizeHerd, type LotSummary } from '@/domain/lot-metrics';
import { useApp } from '@/state/app-state';
import { elevation, radius, space, usePalette } from '@/theme';

type Area = 'lotes' | 'pastos' | 'mapa';

function parseArea(value: string | undefined): Area | null {
  return value === 'lotes' || value === 'pastos' || value === 'mapa' ? value : null;
}

/**
 * Hub do rebanho: **Lotes**, **Pastos** (ocupação por pasto, descanso e GMD) e **Mapa** (área da
 * fazenda, pastos e lotes no satélite). `aba` e `fazenda` abrem direto em um deles.
 */
/** Primeira visita: o esqueleto responde ao toque e a tela monta no quadro seguinte. */
export default function RebanhoTab() {
  return (
    <FirstVisit skeleton={<TabSkeleton variant="list" />}>
      <RebanhoScreen />
    </FirstVisit>
  );
}

function RebanhoScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ aba?: string; fazenda?: string }>();
  // A aba vive no endereço: links antigos de pastos e a volta da edição abrem direto nela.
  const area = parseArea(params.aba) ?? 'lotes';
  const lots = app.lotSummaries;
  const hasFarm = app.visibleFarms.length > 0;
  const newLot = () => router.push({ pathname: '/lote/novo', params: app.contextFarm ? { fazenda: app.contextFarm.id } : {} });

  const header = (
    <>
      <AppHeader
        title="Rebanho"
        context
        action={area === 'lotes' && lots.length > 0 ? <NewLotButton onPress={newLot} /> : null}
      />
      {hasFarm ? (
        <SegmentedTabs<Area>
          accessibilityLabel="Área do rebanho"
          options={[
            { value: 'lotes', label: 'Lotes' },
            { value: 'pastos', label: 'Pastos' },
            { value: 'mapa', label: 'Mapa' },
          ]}
          value={area}
          onChange={(next) => router.setParams({ aba: next })}
        />
      ) : null}
    </>
  );

  if (!hasFarm) {
    return (
      <Screen tab header={header}>
        <EmptyState icon="barn" illustration="farm" title="Nenhuma fazenda ainda" message="Os lotes ficam dentro de uma fazenda.">
          <Button title="Criar fazenda" icon="plus" onPress={() => router.push('/fazenda/nova')} />
        </EmptyState>
      </Screen>
    );
  }
  if (area === 'pastos') return <PasturesPanel header={header} initialFarmId={params.fazenda} />;
  if (area === 'mapa') return <FarmMapsPanel header={header} />;
  return <Lots header={header} onNewLot={newLot} />;
}

/**
 * "+" escrito: o do menu registra lançamentos; este cadastra um lote. Com o nome, um não se
 * confunde com o outro.
 */
function NewLotButton({ onPress }: { onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cadastrar novo lote"
      hitSlop={4}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.newLot, { backgroundColor: p.fill, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="plus" size={18} color={p.text} />
      <AppText variant="label">Novo lote</AppText>
    </Pressable>
  );
}

/**
 * Aba Lotes: os ativos e os encerrados. A visão por pasto fica na aba Pastos, que já mostra a
 * ocupação de cada um.
 */
function Lots({ header, onNewLot }: { header: ReactNode; onNewLot: () => void }) {
  const app = useApp();
  const lots = app.lotSummaries;
  const { active, closed } = useMemo(() => {
    const active: LotSummary[] = [];
    const closed: LotSummary[] = [];
    for (const summary of lots) {
      if (summary.headsCurrent > 0) active.push(summary);
      else if (summary.headsCurrent === 0) closed.push(summary);
    }
    return { active, closed };
  }, [lots]);

  const sections: ListSection<LotSummary>[] = [
    ...(active.length > 0 ? [{ key: 'ativos', title: plural(active.length, 'lote ativo', 'lotes ativos'), data: active }] : []),
    ...(closed.length > 0 ? [{ key: 'encerrados', title: 'Encerrados', data: closed }] : []),
  ];

  return (
    <SectionListScreen
      resetKey={app.contextFarm?.id ?? 'todas'}
      tab
      sections={sections}
      keyExtractor={(summary) => summary.lot.id}
      renderItem={(summary) => <LotRow summary={summary} />}
      header={<>
        {header}
        {lots.length > 0 ? (
          <FadeIn index={0}>
            <HerdSummary lots={active} />
          </FadeIn>
        ) : null}
      </>}
      empty={
        <EmptyState
          icon="cow"
          illustration="herd"
          tone="accent"
          title="Nenhum lote aqui"
          message="Um lote reúne os animais que entraram juntos, para acompanhar peso, custos e venda.">
          <Button title="Cadastrar primeiro lote" icon="plus" size="lg" onPress={onNewLot} />
        </EmptyState>
      }
    />
  );
}

/** Topo do rebanho: o total e o que pede atenção, numa linha só. */
function HerdSummary({ lots }: { lots: LotSummary[] }) {
  const app = useApp();
  const p = usePalette();
  const herd = summarizeHerd(lots);
  const stale = staleLots(lots, app.today, STALE_WEIGHING_DAYS).length;
  // Um número grande (cabeças) e uma linha de apoio: peso médio e, se houver, o que pede pesagem.
  return (
    <View style={[styles.summary, { backgroundColor: p.surface }, elevation(p)]}>
      <AppText variant="label" tone="muted">
        Cabeças no rebanho
      </AppText>
      <AppText variant="display" numeric>
        {formatNumber(herd.heads)}
      </AppText>
      <View style={styles.summaryDetail}>
        <AppText variant="caption" tone="muted" numeric>
          {herd.avgWeightKg === null ? 'Sem pesagem ainda' : `${herd.estimated ? '≈' : ''}${formatNumber(herd.avgWeightKg)} kg em média`}
        </AppText>
        {stale > 0 ? (
          <AppText variant="label" tone="warning">
            {plural(stale, 'lote para pesar', 'lotes para pesar')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  newLot: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill },
  summary: { padding: space.lg + 4, borderRadius: radius.xxl, gap: space.xs },
  summaryDetail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
});
