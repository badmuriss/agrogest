import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SatellitePreview } from '@/components/farm-map/satellite-preview';
import { Button } from '@/components/ui/controls';
import { EmptyState, Screen } from '@/components/ui/layout';
import { FadeIn, haptics } from '@/components/ui/motion';
import { AppText, Icon } from '@/components/ui/text';
import { formatNumber, plural } from '@/domain/format';
import { formatHectares, ringAreaHa } from '@/domain/geo';
import type { Farm } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { radius, space, usePalette } from '@/theme';

/**
 * Aba Mapa do Rebanho: cada fazenda do contexto como um mapa de verdade. Com a área desenhada, a
 * prévia no satélite com os lotes; sem ela, o convite para desenhar (como o Aegro, que abre a
 * fazenda pelo mapa). Tocar abre o mapa inteiro, onde se vê, desenha e posiciona os lotes.
 */
export function FarmMapsPanel({ header }: { header: ReactNode }) {
  const app = useApp();
  const farms = app.scopedFarms;

  if (farms.length === 0) {
    return (
      <Screen tab header={header}>
        <EmptyState icon="map-outline" title="Nenhuma fazenda ainda" message="O mapa mostra a área da fazenda, os pastos e onde estão os lotes.">
          <Button title="Criar fazenda" icon="plus" onPress={() => router.push('/fazenda/nova')} />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen tab header={header}>
      {farms.map((farm, i) => (
        <FadeIn key={farm.id} index={i}>
          <FarmMapTile farm={farm} />
        </FadeIn>
      ))}
    </Screen>
  );
}

function FarmMapTile({ farm }: { farm: Farm }) {
  const app = useApp();
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const pastures = app.farmPastures(farm.id);
  const drawn = pastures.filter((pasture) => pasture.boundary).length;
  const lots = app.farmLotSummaries(farm.id).filter((s) => s.headsCurrent > 0);
  const heads = lots.reduce((acc, s) => acc + s.headsCurrent, 0);
  const pins = lots.flatMap((s) => (s.lot.location ? [{ position: s.lot.location, category: s.lot.category }] : []));
  const partner = app.canSeeFinance(farm.operationId);
  const open = () => {
    haptics.tap();
    router.push({ pathname: '/fazenda/mapa/[id]', params: { id: farm.id } });
  };
  const pastureText = pastures.length === 0 ? 'sem pastos' : `${drawn} de ${plural(pastures.length, 'pasto desenhado', 'pastos desenhados')}`;

  if (!farm.boundary) {
    return (
      <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        <View style={[styles.canvas, styles.empty, { backgroundColor: p.accentSoft }]}>
          <Icon name="map-marker-plus-outline" size={44} color={p.accent} />
          <AppText variant="caption" tone="accent" style={styles.center}>
            Área ainda não desenhada
          </AppText>
        </View>
        <View style={styles.textBlock}>
          <AppText variant="bodyStrong">{farm.name}</AppText>
          <AppText variant="caption" tone="muted">
            {partner
              ? 'Marque os cantos da fazenda no satélite para ver os hectares, os pastos e onde está cada lote.'
              : 'Um sócio desenha a área da fazenda no satélite. Depois, os lotes aparecem no pasto em que estão.'}
          </AppText>
        </View>
        <Button title={partner ? 'Desenhar a área' : 'Ver o mapa'} icon={partner ? 'pencil-outline' : 'map-outline'} onPress={open} />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir o mapa da ${farm.name}`}
      onPress={open}
      style={({ pressed }) => [styles.card, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.canvas, { backgroundColor: p.fill }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? <SatellitePreview boundary={farm.boundary} pins={pins} width={width} height={220} /> : null}
      </View>
      <View style={styles.row}>
        <View style={styles.text}>
          <AppText variant="bodyStrong">{farm.name}</AppText>
          <AppText variant="caption" tone="muted">
            {formatHectares(ringAreaHa(farm.boundary))} · {pastureText}
            {heads > 0 ? ` · ${formatNumber(heads)} cabeças` : ''}
          </AppText>
        </View>
        <Icon name="chevron-right" size={20} color={p.textFaint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.md },
  canvas: { height: 220, borderRadius: radius.lg, overflow: 'hidden' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
  textBlock: { gap: 2 },
});
