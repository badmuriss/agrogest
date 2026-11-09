import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/cattle-icon';
import { SatellitePreview } from '@/components/farm-map/satellite-preview';
import { areaLabel } from '@/components/pasture-form';
import { GmdCard, GmdReadingNote, Headline, MoveRow, OccupancyEventRow, StatStrip, StatusBadge, StayRow } from '@/components/pasture-report';
import { Badge, Button, IconButton, Note, Segmented } from '@/components/ui/controls';
import { Card, EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { formatDate, formatDateShort } from '@/domain/dates';
import { formatNumber, plural } from '@/domain/format';
import { formatHectares, ringAreaHa } from '@/domain/geo';
import { NO_FILTER } from '@/domain/pasture';
import { useApp } from '@/state/app-state';
import { radius, space, usePalette } from '@/theme';

type Tab = 'agora' | 'historico' | 'peso';

export default function PastoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const p = usePalette();
  const [tab, setTab] = useState<Tab>('agora');
  const [mapWidth, setMapWidth] = useState(0);
  const pasture = app.pasture(id);

  if (!pasture || !app.farm(pasture.farmId)) {
    return (
      <Screen>
        <EmptyState icon="grass" title="Pasto não encontrado" />
      </Screen>
    );
  }
  const farm = app.farm(pasture.farmId)!;
  const report = app.pastureReport([farm.id], NO_FILTER).reports.find((r) => r.pastureId === pasture.id);
  const manage = app.canManagePastures(pasture.operationId);
  const heads = report?.currentHeads ?? 0;
  const pending = app.visibleEntries.filter(
    (e) =>
      e.kind === 'manejo' &&
      (e.payload.fromPastureId === pasture.id || e.payload.toPastureId === pasture.id) &&
      (e.status === 'aguardando_aprovacao' || e.status === 'aguardando_envio' || e.status === 'conflito'),
  );
  const single = report?.currentLots.length === 1 ? report.currentLots[0].lotId : undefined;
  const canMove = pasture.active && heads > 0;

  return (
    <Screen
      footer={
        canMove ? (
          <Button
            title="Mover animais deste pasto"
            icon="swap-horizontal"
            onPress={() => router.push({ pathname: '/novo/manejo', params: { origem: pasture.id, ...(single ? { lote: single } : {}) } })}
          />
        ) : undefined
      }>
      <Stack.Screen options={{ title: pasture.name }} />
      <FadeIn index={0}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="largeTitle">{pasture.name}</AppText>
            <AppText tone="muted">
              {[pasture.forage.trim() || 'Capim não informado', areaLabel(pasture), farm.name].join(' · ')}
            </AppText>
            <View style={styles.badges}>
              <StatusBadge report={report ?? { currentHeads: 0, stays: [] }} inactive={!pasture.active} />
              {!pasture.areaHa || !pasture.forage.trim() ? <Badge label="Completar cadastro" tone="warning" icon="pencil-outline" /> : null}
            </View>
          </View>
          {manage ? (
            <IconButton icon="pencil-outline" accessibilityLabel="Editar pasto" onPress={() => router.push({ pathname: '/pastos/editar', params: { id: pasture.id } })} />
          ) : null}
        </View>
      </FadeIn>

      <FadeIn index={1}>
        <Headline
          label="Cabeças hoje"
          value={formatNumber(heads)}
          caption={heads > 0 ? plural(report?.currentLots.length ?? 0, 'lote', 'lotes') : 'Pasto vazio'}
          stats={[
            { label: 'lotação (não é UA/ha)', value: report?.headsPerHa != null ? `${formatNumber(report.headsPerHa, 1)} cab./ha` : '—' },
            { label: 'GMD no pasto', value: report?.gmd ? `${report.gmd.estimated ? '≈' : ''}${formatNumber(report.gmd.gmdKg, 2)} kg/dia` : '—' },
          ]}
        />
      </FadeIn>

      {pasture.boundary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver ${pasture.name} no mapa da fazenda`}
          onPress={() => router.push({ pathname: '/fazenda/mapa/[id]', params: { id: farm.id } })}
          onLayout={(e) => setMapWidth(e.nativeEvent.layout.width)}
          style={({ pressed }) => [styles.map, { borderColor: p.border, opacity: pressed ? 0.85 : 1 }]}>
          {mapWidth > 0 ? <SatellitePreview boundary={pasture.boundary} outline={farm.boundary} color={heads > 0 ? '#FACC15' : '#93C5FD'} pins={[]} width={mapWidth} height={160} /> : null}
          <View style={styles.mapLabel}>
            <AppText variant="label" style={styles.mapText}>
              {`${formatHectares(ringAreaHa(pasture.boundary))} desenhados · ver no mapa`}
            </AppText>
          </View>
        </Pressable>
      ) : manage && pasture.active ? (
        <Group>
          <ListRow
            icon="vector-polygon"
            title="Desenhar no mapa"
            subtitle={farm.boundary ? 'Opcional: marque o contorno do pasto no satélite da fazenda' : 'Opcional: primeiro desenhe a área da fazenda, depois o pasto dentro dela'}
            onPress={() => router.push({ pathname: '/fazenda/mapa/[id]', params: { id: farm.id, pasto: pasture.id } })}
          />
        </Group>
      ) : null}

      {pending.length > 0 ? (
        <Note boxed tone="warning" icon="clock-outline" title={plural(pending.length, 'mudança aguardando', 'mudanças aguardando')}>
          Ainda não entram na ocupação. Veja em Agora.
        </Note>
      ) : null}
      {pasture.notes ? <Note icon="note-text-outline">{pasture.notes}</Note> : null}

      <Segmented
        accessibilityLabel="Seções do pasto"
        options={[
          { value: 'agora', label: 'Agora' },
          { value: 'historico', label: 'Histórico' },
          { value: 'peso', label: 'Ganho de peso' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <FadeIn key={tab}>
        <View style={styles.tab}>
          {tab === 'agora' ? (
            <>
              {report && report.currentLots.length > 0 ? (
                <Section title="Lotes no pasto">
                  <Group>
                    {report.currentLots.map(({ lotId, heads: here }) => {
                      const s = app.lotSummary(lotId);
                      if (!s) return null;
                      return (
                        <ListRow
                          key={lotId}
                          leading={
                            <View style={[styles.lotIcon, { backgroundColor: p.fill }]}>
                              <CategoryIcon category={s.lot.category} size={30} />
                            </View>
                          }
                          title={`Origem ${s.lot.code}`}
                          subtitle={`${s.lot.category} · ${s.lastWeighing.method === 'estimado' ? '≈' : ''}${formatNumber(s.lastWeighing.kg)} kg em ${formatDateShort(s.lastWeighing.date)}${s.headsCurrent > here ? `\nlote dividido: ${s.headsCurrent} no total` : ''}`}
                          right={
                            <View style={styles.right}>
                              <AppText variant="title" numeric>
                                {here}
                              </AppText>
                              <AppText variant="caption" tone="faint">
                                {here === 1 ? 'cabeça' : 'cabeças'}
                              </AppText>
                            </View>
                          }
                          onPress={() => router.push({ pathname: '/lote/[id]', params: { id: lotId } })}
                        />
                      );
                    })}
                  </Group>
                </Section>
              ) : (
                <EmptyState
                  icon="grass"
                  title="Pasto vazio"
                  message={report?.stays.length ? 'O tempo de descanso aparece acima. Mova animais para cá pelo pasto de origem.' : 'Nenhum animal passou por aqui ainda.'}
                />
              )}
              {pending.length > 0 ? (
                <Section title="Aguardando aprovação ou envio">
                  <Group>
                    {pending.map((entry) => (
                      <MoveRow key={entry.id} entry={entry} />
                    ))}
                  </Group>
                </Section>
              ) : null}
            </>
          ) : null}

          {tab === 'historico' ? (
            report && report.events.length > 0 ? (
              <>
                <Card>
                  <StatStrip
                    stats={[
                      { label: 'entraram', value: `+${formatNumber(report.headsIn)}` },
                      { label: 'saíram', value: `−${formatNumber(report.headsOut)}` },
                      { label: 'cabeça-dias', value: formatNumber(report.headDays) },
                    ]}
                  />
                  <AppText variant="caption" tone="faint">
                    {`${plural(report.occupiedDays, 'dia', 'dias')} com animais. Saídas incluem mudanças, mortes, vendas e transferências.`}
                  </AppText>
                </Card>
                <Section title="Entradas e saídas">
                  <Group>
                    {report.events.slice(0, 40).map((event, i) => (
                      <OccupancyEventRow key={`${event.entryId ?? 'entrada'}-${event.lotId}-${event.type}-${i}`} event={event} />
                    ))}
                  </Group>
                </Section>
                {report.stays.length > 0 ? (
                  <Section title="Períodos de cada lote">
                    <Group>
                      {report.stays.map((stay) => (
                        <StayRow key={`${stay.lotId}-${stay.start}`} stay={stay} />
                      ))}
                    </Group>
                  </Section>
                ) : null}
              </>
            ) : (
              <EmptyState icon="history" title="Sem histórico" message="Entradas, mudanças, mortes e vendas neste pasto aparecem aqui." />
            )
          ) : null}

          {tab === 'peso' ? (
            <>
              <GmdCard gmd={report?.gmd ?? null} insufficient={report?.insufficient ?? 'Nenhum animal passou por este pasto.'} />
              {report && report.intervals.length > 0 ? (
                <Section title="Intervalos usados no cálculo">
                  <Group>
                    {report.intervals.map((interval) => (
                      <ListRow
                        key={`${interval.lotId}-${interval.from}`}
                        icon={interval.estimated ? 'eye-outline' : 'scale-balance'}
                        title={`Origem ${app.lotSummary(interval.lotId)?.lot.code ?? '—'}`}
                        subtitle={`${formatDate(interval.from)} a ${formatDate(interval.to)} · ${plural(interval.days, 'dia', 'dias')}\n${interval.heads} cab. · ${formatNumber(interval.startKg)} → ${formatNumber(interval.endKg)} kg${interval.sample ? ' · amostra' : ''}`}
                        right={
                          <View style={styles.right}>
                            <AppText variant="heading" numeric tone={interval.gmdKg > 0 ? 'accent' : 'danger'}>
                              {`${interval.estimated ? '≈' : ''}${formatNumber(interval.gmdKg, 2)}`}
                            </AppText>
                            <AppText variant="caption" tone="faint">
                              kg/dia
                            </AppText>
                          </View>
                        }
                      />
                    ))}
                  </Group>
                </Section>
              ) : null}
              <GmdReadingNote />
            </>
          ) : null}
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xs },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  tab: { gap: space.lg },
  map: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, height: 160 },
  mapLabel: { position: 'absolute', left: space.sm, bottom: space.sm, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 3, backgroundColor: 'rgba(16,20,15,0.82)' },
  mapText: { color: '#FFFFFF' },
  right: { alignItems: 'flex-end', minWidth: 48 },
  lotIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
});
