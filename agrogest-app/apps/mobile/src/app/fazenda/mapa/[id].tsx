import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIcon, categoryKind } from '@/components/cattle-icon';
import { FarmMap } from '@/components/farm-map/farm-map';
import { PlaceSearch } from '@/components/farm-map/place-search';
import type { FarmMapHandle, MapArea, MapMode, MapPin } from '@/components/farm-map/types';
import { statusLabel } from '@/components/pasture-report';
import { formatGmd, pastureLabel, weightLabel } from '@/components/rows';
import { Button, Chip, ChipRow, IconButton, Note } from '@/components/ui/controls';
import { EmptyState, Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { AppText, Icon } from '@/components/ui/text';
import { plural } from '@/domain/format';
import { closeRing, formatHectares, isSimpleRing, outsideRing, ringAreaHa, ringPerimeterM, type Position } from '@/domain/geo';
import { NO_FILTER, pastureStatus } from '@/domain/pasture';
import { searchPlaces } from '@/services/geocoding';
import { useApp } from '@/state/app-state';
import { radius, space, usePalette } from '@/theme';

/**
 * Cores fixas sobre o satélite, iguais nos dois temas (o verde-escuro da marca some na imagem):
 * fazenda em verde, pastos em amarelo (com animais) ou azul (em descanso), rascunho em laranja.
 */
const FARM_COLOR = '#4ADE80';
const AREA_COLOR = { ocupado: '#FACC15', descanso: '#93C5FD', nunca: '#E5E7EB' } as const;
/** Pasto em desenho: laranja, para não se confundir com a área da fazenda (verde). */
const PASTURE_DRAFT = '#FF7A2E';

/**
 * Mapa da fazenda no satélite: ver a área, desenhar o contorno da fazenda e (opcional) o de cada
 * pasto, e posicionar os lotes. `pasto` abre direto o desenho daquele pasto.
 */
export default function FarmMapScreen() {
  const { id, pasto } = useLocalSearchParams<{ id: string; pasto?: string }>();
  const app = useApp();
  const p = usePalette();
  const map = useRef<FarmMapHandle>(null);
  // `pasto` sem a área da fazenda abre o desenho da fazenda: o pasto é desenhado dentro dela.
  const farmDrawn = !!app.farm(id)?.boundary;
  const [mode, setMode] = useState<MapMode>(pasto ? 'draw' : 'view');
  // Pasto em desenho (null = contorno da fazenda) e pasto tocado no mapa.
  const [drawing, setDrawing] = useState<string | null>(pasto && farmDrawn ? pasto : null);
  const [selectedPasture, setSelectedPasture] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [draft, setDraft] = useState<{ points: Position[]; closed: boolean }>({ points: [], closed: false });
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const farm = app.farm(id);
  const lots = app.farmLotSummaries(id).filter((s) => s.headsCurrent > 0);
  const partner = farm ? app.canSeeFinance(farm.operationId) : false;
  const boundary = farm?.boundary ?? null;
  const pastures = farm ? app.farmPastures(farm.id) : [];
  const reports = farm ? app.pastureReport([farm.id], NO_FILTER).reports : [];
  const manage = farm ? app.canManagePastures(farm.operationId) : false;
  const target = drawing ? pastures.find((pp) => pp.id === drawing) : undefined;
  const drawingPasture = mode === 'draw' && !!target;

  const areas: MapArea[] = pastures
    .filter((pp) => pp.boundary && !(drawingPasture && pp.id === target?.id))
    .map((pp) => {
      const report = reports.find((r) => r.pastureId === pp.id);
      const status = pastureStatus(report ?? { currentHeads: 0, stays: [] }, app.today);
      return {
        id: pp.id,
        ring: pp.boundary!,
        label: pp.name,
        detail: report && report.currentHeads > 0 ? plural(report.currentHeads, 'cabeça', 'cabeças') : 'vazio',
        color: AREA_COLOR[status.kind],
        selected: pp.id === selectedPasture,
      };
    });

  const pins = useMemo<MapPin[]>(
    () =>
      lots
        .filter((s) => s.lot.location)
        .map((s) => ({
          id: s.lot.id,
          position: s.lot.location!,
          kind: categoryKind(s.lot.category),
          label: s.lot.code,
          selected: s.lot.id === selectedLot,
        })),
    [lots, selectedLot],
  );

  // Sem área nem pinos: começa perto da cidade da fazenda.
  const city = farm?.city;
  const empty = !boundary && pins.length === 0 && areas.length === 0;
  useEffect(() => {
    if (!city || !empty) return;
    let alive = true;
    searchPlaces(city)
      .then(([place]) => {
        if (alive && place) map.current?.center(place.position, 13);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [city, empty]);

  if (!farm) {
    return (
      <Screen>
        <EmptyState icon="barn" title="Fazenda não encontrada" />
      </Screen>
    );
  }

  const ring = draft.closed ? closeRing(draft.points) : null;
  const valid = ring ? isSimpleRing(ring) : false;
  const areaHa = mode === 'draw' ? (draft.points.length >= 3 ? ringAreaHa(draft.points) : 0) : boundary ? ringAreaHa(boundary) : 0;
  // O pasto não precisa estar dentro da fazenda desenhada, mas o produtor é avisado.
  const outside = drawingPasture && !!boundary && draft.points.some((pt) => outsideRing(pt, boundary));
  const selected = lots.find((s) => s.lot.id === selectedLot);
  const pastureSelected = selectedPasture ? pastures.find((pp) => pp.id === selectedPasture) : undefined;
  const pastureReport = pastureSelected ? reports.find((r) => r.pastureId === pastureSelected.id) : undefined;
  const drawn = pastures.filter((pp) => pp.boundary).length;
  const placed = lots.filter((s) => s.lot.location).length;

  const locate = async () => {
    setMessage(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setMessage('Sem permissão de localização. Você pode navegar pelo mapa com os dedos.');
      return;
    }
    try {
      const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      map.current?.center([here.coords.longitude, here.coords.latitude], 16);
    } catch {
      setMessage('Não foi possível achar sua localização agora.');
    }
  };

  const startDrawing = (pastureId: string | null) => {
    setSelectedLot(null);
    setSelectedPasture(null);
    setChoosing(false);
    setDrawing(pastureId);
    setMode('draw');
  };

  const stopDrawing = () => {
    if (drawing) setSelectedPasture(drawing);
    setDrawing(null);
    setMode('view');
  };

  const saveBoundary = async (next: Position[] | null) => {
    setBusy(true);
    setMessage(null);
    try {
      if (target) await app.updatePastureBoundary(target.id, next);
      else await app.updateFarmBoundary(farm.id, next);
      haptics.success();
      // Veio do pasto e precisou desenhar a fazenda antes: segue para o pasto.
      if (!target && pasto && next && pastures.some((pp) => pp.id === pasto)) startDrawing(pasto);
      else stopDrawing();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a área.');
    } finally {
      setBusy(false);
    }
  };

  const placeSelected = async (position: Position | null) => {
    if (!selectedLot) {
      setMessage('Escolha o lote acima antes de tocar no mapa.');
      return;
    }
    setMessage(null);
    try {
      await app.placeLot(selectedLot, position);
      haptics.success();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível posicionar o lote.');
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: p.background }]}>
      <View style={styles.flex}>
        <FarmMap
          ref={map}
          boundary={drawingPasture ? (target?.boundary ?? null) : boundary}
          outline={drawingPasture ? boundary : null}
          outlineColor={FARM_COLOR}
          drawKey={drawing ?? 'farm'}
          areas={areas}
          pins={drawingPasture ? NO_PINS : pins}
          mode={mode}
          accent={drawingPasture ? PASTURE_DRAFT : FARM_COLOR}
          onDraft={(points, closed) => setDraft({ points, closed })}
          onTap={(position) => void placeSelected(position)}
          onPinPress={(lotId) => {
            haptics.tap();
            setSelectedPasture(null);
            setSelectedLot(lotId);
          }}
          onAreaPress={(pastureId) => {
            haptics.tap();
            setSelectedLot(null);
            setSelectedPasture(pastureId);
          }}
          onError={() => setMapFailed(true)}
        />
        <View style={styles.search}>
          <PlaceSearch onPick={(place) => map.current?.focus(place.position, place.bounds)} />
        </View>
        <View style={styles.tools}>
          <IconButton icon="crosshairs-gps" accessibilityLabel="Minha localização" onPress={() => void locate()} />
          <IconButton icon="fit-to-screen-outline" accessibilityLabel="Enquadrar a fazenda" onPress={() => map.current?.fit()} />
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.border }]}>
        {mapFailed ? <Note tone="warning" icon="wifi-off">O mapa precisa de internet para carregar. A área e os pinos ficam salvos.</Note> : null}

        {mode === 'draw' ? (
          <>
            <AppText variant="heading">
              {target ? `${target.name} · ${draft.closed ? 'contorno fechado' : 'desenhe o contorno'}` : draft.closed ? 'Área fechada' : 'Desenhe o contorno'}
            </AppText>
            <AppText tone="muted">
              {draft.closed
                ? 'Arraste os pontos para ajustar. Desfazer reabre o contorno.'
                : draft.points.length < 3
                  ? target
                    ? boundary
                      ? 'Toque no mapa em cada canto do pasto, dentro da área da fazenda.'
                      : 'Toque no mapa em cada canto do pasto.'
                    : 'Toque no mapa em cada canto da fazenda.'
                  : 'Toque no primeiro ponto (o maior) para fechar a área.'}
            </AppText>
            {draft.points.length >= 3 ? (
              <AppText variant="bodyStrong" numeric>
                {formatHectares(areaHa)} · {(ringPerimeterM(draft.points) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km de perímetro
              </AppText>
            ) : null}
            {target && draft.points.length >= 3 ? (
              <AppText variant="caption" tone="muted">
                {target.areaHa
                  ? `Área útil cadastrada: ${formatHectares(target.areaHa)}. O desenho não muda o cadastro.`
                  : 'Sem área útil cadastrada: use o desenho como referência ao editar o pasto.'}
              </AppText>
            ) : null}
            {draft.closed && !valid ? <Note tone="danger" icon="alert-outline">As linhas se cruzam. Ajuste os pontos.</Note> : null}
            {outside ? <Note tone="warning" icon="alert-outline">Parte do pasto fica fora da área da fazenda.</Note> : null}
            <View style={styles.row}>
              <Button title="Desfazer" variant="secondary" icon="undo" disabled={draft.points.length === 0} onPress={() => map.current?.undo()} />
              <Button title="Limpar" variant="ghost" disabled={draft.points.length === 0} onPress={() => map.current?.clear()} />
            </View>
            <View style={styles.row}>
              <Button title="Cancelar" variant="secondary" onPress={stopDrawing} />
              <Button title={target ? 'Salvar pasto' : 'Salvar área'} icon="check" disabled={!valid || busy} onPress={() => void saveBoundary(ring)} />
            </View>
            {target?.boundary ? (
              <Button title="Tirar o pasto do mapa" variant="ghost" icon="delete-outline" disabled={busy} onPress={() => void saveBoundary(null)} />
            ) : null}
          </>
        ) : choosing ? (
          <>
            <AppText variant="heading">Qual pasto desenhar?</AppText>
            <AppText tone="muted">Opcional: o contorno mostra cada pasto no satélite, com a ocupação de hoje.</AppText>
            <ChipRow>
              {pastures.map((pp) => (
                <Chip key={pp.id} label={`${pp.name}${pp.boundary ? ' ✓' : ''}`} onPress={() => startDrawing(pp.id)} />
              ))}
            </ChipRow>
            <View style={styles.row}>
              <Button title="Voltar" variant="secondary" onPress={() => setChoosing(false)} />
            </View>
          </>
        ) : pastureSelected ? (
          <>
            <View style={styles.lotHeader}>
              <View style={[styles.lotIcon, styles.pastureIcon, { backgroundColor: p.fill }]}>
                <Icon name="grass" size={26} color={p.accent} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading">{pastureSelected.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {plural(pastureReport?.currentHeads ?? 0, 'cabeça', 'cabeças')} ·{' '}
                  {statusLabel(pastureStatus(pastureReport ?? { currentHeads: 0, stays: [] }, app.today)).toLowerCase()}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {[pastureSelected.forage || 'Capim não informado', pastureSelected.boundary ? `${formatHectares(ringAreaHa(pastureSelected.boundary))} desenhados` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <IconButton icon="close" accessibilityLabel="Fechar" onPress={() => setSelectedPasture(null)} />
            </View>
            <View style={styles.row}>
              {manage ? <Button title="Editar contorno" variant="secondary" icon="vector-polygon" onPress={() => startDrawing(pastureSelected.id)} /> : null}
              <Button title="Abrir pasto" icon="arrow-right" onPress={() => router.push({ pathname: '/pastos/[id]', params: { id: pastureSelected.id } })} />
            </View>
          </>
        ) : mode === 'place' ? (
          <>
            <AppText variant="heading">Onde está cada lote?</AppText>
            <AppText tone="muted">Escolha o lote e toque no mapa no lugar dele.</AppText>
            <ChipRow>
              {lots.map((s) => (
                <Chip
                  key={s.lot.id}
                  label={`${s.lot.code}${s.lot.location ? ' ✓' : ''}`}
                  selected={s.lot.id === selectedLot}
                  onPress={() => setSelectedLot(s.lot.id)}
                />
              ))}
            </ChipRow>
            <View style={styles.row}>
              {selected?.lot.location ? (
                <Button title="Tirar do mapa" variant="ghost" onPress={() => void placeSelected(null)} />
              ) : null}
              <Button title="Concluir" icon="check" onPress={() => setMode('view')} />
            </View>
          </>
        ) : selected ? (
          <>
            <View style={styles.lotHeader}>
              <View style={[styles.lotIcon, { backgroundColor: p.fill }]}>
                <CategoryIcon category={selected.lot.category} size={40} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading">Origem {selected.lot.code}</AppText>
                <AppText variant="caption" tone="muted">
                  {plural(selected.headsCurrent, 'cabeça', 'cabeças')} · {selected.lot.category.toLowerCase()} · {pastureLabel(app, selected)}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {weightLabel(selected)} · {formatGmd(selected)}
                </AppText>
              </View>
              <IconButton icon="close" accessibilityLabel="Fechar" onPress={() => setSelectedLot(null)} />
            </View>
            <View style={styles.row}>
              <Button title="Mover" variant="secondary" icon="cursor-move" onPress={() => setMode('place')} />
              <Button
                title="Abrir lote"
                icon="arrow-right"
                onPress={() => router.push({ pathname: '/lote/[id]', params: { id: selected.lot.id } })}
              />
            </View>
          </>
        ) : (
          <>
            <AppText variant="heading">{farm.name}</AppText>
            <AppText tone="muted">
              {boundary
                ? `${formatHectares(areaHa)} · ${placed} de ${plural(lots.length, 'lote', 'lotes')} no mapa${pastures.length > 0 ? ` · ${drawn} de ${plural(pastures.length, 'pasto desenhado', 'pastos desenhados')}` : ''}`
                : partner
                  ? 'Desenhe o contorno da fazenda no satélite para ver a área em hectares.'
                  : 'Um sócio ainda não desenhou a área da fazenda.'}
            </AppText>
            {/* Sem área desenhada, desenhar a fazenda é o passo principal; depois, posicionar os lotes. */}
            {partner && !boundary ? <Button title="Desenhar área da fazenda" icon="vector-polygon" onPress={() => startDrawing(null)} /> : null}
            {lots.length > 0 ? (
              <Button
                title="Posicionar lotes"
                variant={boundary ? 'primary' : 'secondary'}
                icon="map-marker-plus-outline"
                onPress={() => {
                  setSelectedLot(lots.find((s) => !s.lot.location)?.lot.id ?? lots[0].lot.id);
                  setMode('place');
                }}
              />
            ) : null}
            {boundary && (partner || (manage && pastures.length > 0)) ? (
              <View style={styles.row}>
                {partner ? (
                  <Button title="Editar área" variant="secondary" icon="vector-polygon" style={styles.flex} onPress={() => startDrawing(null)} />
                ) : null}
                {manage && pastures.length > 0 ? (
                  <Button title="Desenhar pastos" variant="secondary" icon="grass" style={styles.flex} onPress={() => setChoosing(true)} />
                ) : null}
              </View>
            ) : null}
          </>
        )}
        {message ? <Note tone="warning" icon="alert-outline">{message}</Note> : null}
      </View>
    </SafeAreaView>
  );
}

const NO_PINS: MapPin[] = [];

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { position: 'absolute', left: space.md, right: space.md, top: space.md },
  tools: { position: 'absolute', right: space.md, top: space.md + 64, gap: space.sm },
  panel: {
    gap: space.sm + 2,
    padding: space.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: -radius.xl,
  },
  row: { flexDirection: 'row', gap: space.sm },
  lotHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pastureIcon: { justifyContent: 'center', paddingBottom: 0 },
  lotIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
});
