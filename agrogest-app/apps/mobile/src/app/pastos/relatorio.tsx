import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { formatPastureGmd, gmdBase, GmdCard, GmdReadingNote, Headline, MoveRow, PastureListItem } from '@/components/pasture-report';
import { Chip, ChipRow, Note, Segmented } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { Card, EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { addDays, addMonths, formatDate } from '@/domain/dates';
import { formatNumber, plural } from '@/domain/format';
import type { PastureFilter } from '@/domain/pasture';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

type Tab = 'gmd' | 'ocupacao' | 'movimentacoes';
type Period = '30' | '90' | '365' | 'tudo' | 'outro';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '365', label: '12 meses' },
  { value: 'outro', label: 'Escolher' },
];

/**
 * GMD por pasto e capim, ocupação e movimentações. O período fica sempre à mão; os demais
 * filtros ficam recolhidos num resumo, para o resultado aparecer sem rolar a tela.
 */
export default function RelatorioPastosScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ fazenda?: string }>();
  const [tab, setTab] = useState<Tab>('gmd');
  const [farmId, setFarmId] = useState<string | null>(params.fazenda ?? app.contextFarm?.id ?? null);
  const [pastureId, setPastureId] = useState<string | null>(null);
  const [lotId, setLotId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [measuredOnly, setMeasuredOnly] = useState(false);
  const [period, setPeriod] = useState<Period>('tudo');
  const [customFrom, setCustomFrom] = useState(() => addMonths(app.today, -3));
  const [customTo, setCustomTo] = useState(app.today);
  const [showFilters, setShowFilters] = useState(false);

  const farms = farmId ? app.visibleFarms.filter((f) => f.id === farmId) : app.visibleFarms;
  const farmIds = farms.map((f) => f.id);
  if (farms.length === 0) {
    return (
      <Screen>
        <EmptyState icon="barn" title="Nenhuma fazenda" message="Crie uma fazenda e cadastre os pastos para ver o relatório." />
      </Screen>
    );
  }

  const from = period === 'tudo' ? null : period === 'outro' ? customFrom : addDays(app.today, -Number(period));
  const to = period === 'outro' ? customTo : null;
  const filter: PastureFilter = { from, to, lotId, category, measuredOnly };
  const result = app.pastureReport(farmIds, filter);
  const reports = result.reports.filter((r) => !pastureId || r.pastureId === pastureId).filter((r) => r.pasture || r.headDays > 0);
  const lots = app.visibleFarms.filter((f) => farmIds.includes(f.id)).flatMap((f) => app.farmLotSummaries(f.id));
  const categories = [...new Set(lots.map((s) => s.lot.category))].sort();
  const pastures = app.pastures.filter((p) => farmIds.includes(p.farmId)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const inPeriod = (date: string) => (!from || date >= from) && (!to || date <= to);
  const moves = app.visibleEntries
    .filter((e) => e.kind === 'manejo' && farmIds.includes(e.farmId) && e.status !== 'rascunho' && inPeriod(e.occurredAt))
    .filter((e) => e.kind === 'manejo' && (!lotId || e.payload.lotId === lotId) && (!pastureId || e.payload.fromPastureId === pastureId || e.payload.toPastureId === pastureId))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt));
  const ranked = reports.filter((r) => r.gmd).sort((a, b) => b.gmd!.gmdKg - a.gmd!.gmdKg);
  const missing = reports.filter((r) => !r.gmd && r.pasture);
  const headDays = reports.reduce((acc, r) => acc + r.headDays, 0);
  const heads = reports.reduce((acc, r) => acc + r.currentHeads, 0);
  const periodLabel = from || to ? `${from ? formatDate(from) : 'início'} a ${to ? formatDate(to) : 'hoje'}` : 'todo o histórico';

  const lotLabel = lotId ? `Origem ${lots.find((s) => s.lot.id === lotId)?.lot.code ?? '—'}` : null;
  const summary = [
    app.visibleFarms.length > 1 ? (farms.length === 1 ? farms[0].name : 'Todas as fazendas') : null,
    pastureId ? app.pastureName(pastureId) : 'Todos os pastos',
    lotLabel,
    category,
    measuredOnly ? 'só balança' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const activeFilters = [farmId !== null && app.visibleFarms.length > 1, pastureId, lotId, category, measuredOnly].filter(Boolean).length;
  const best = ranked[0];

  return (
    <Screen>
      <View style={styles.filters}>
        <ChipRow>
          {PERIODS.map((option) => (
            <Chip key={option.value} label={option.label} selected={period === option.value} onPress={() => setPeriod(option.value)} />
          ))}
        </ChipRow>
        {period === 'outro' ? (
          <View style={styles.dates}>
            <DateField label="De" value={customFrom} onChange={setCustomFrom} error={customFrom > customTo ? 'A data inicial é depois da final.' : null} />
            <DateField label="Até" value={customTo} onChange={setCustomTo} />
          </View>
        ) : null}
        <Group>
          <ListRow
            icon="filter-variant"
            iconTone={activeFilters > 0 ? 'accent' : 'neutral'}
            title={activeFilters > 0 ? plural(activeFilters, 'filtro ativo', 'filtros ativos') : 'Filtrar'}
            subtitle={summary}
            right={<AppText variant="label" tone="accent">{showFilters ? 'Fechar' : 'Alterar'}</AppText>}
            chevron={false}
            onPress={() => setShowFilters((v) => !v)}
          />
        </Group>
        {showFilters ? (
          <Card style={styles.panel}>
            {app.visibleFarms.length > 1 ? (
              <FilterGroup label="Fazenda">
                <Chip label="Todas" selected={farmId === null} onPress={() => { setFarmId(null); setPastureId(null); setLotId(null); }} />
                {app.visibleFarms.map((f) => (
                  <Chip key={f.id} label={f.name} selected={farmId === f.id} onPress={() => { setFarmId(f.id); setPastureId(null); setLotId(null); }} />
                ))}
              </FilterGroup>
            ) : null}
            {pastures.length > 1 ? (
              <FilterGroup label="Pasto">
                <Chip label="Todos" selected={pastureId === null} onPress={() => setPastureId(null)} />
                {pastures.map((p) => (
                  <Chip key={p.id} label={p.name} selected={pastureId === p.id} onPress={() => setPastureId(p.id)} />
                ))}
              </FilterGroup>
            ) : null}
            {lots.length > 1 ? (
              <FilterGroup label="Lote">
                <Chip label="Todos" selected={lotId === null} onPress={() => setLotId(null)} />
                {lots.map((s) => (
                  <Chip key={s.lot.id} label={`Origem ${s.lot.code}`} selected={lotId === s.lot.id} onPress={() => setLotId(s.lot.id)} />
                ))}
              </FilterGroup>
            ) : null}
            {categories.length > 1 ? (
              <FilterGroup label="Categoria">
                <Chip label="Todas" selected={category === null} onPress={() => setCategory(null)} />
                {categories.map((c) => (
                  <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
                ))}
              </FilterGroup>
            ) : null}
            <FilterGroup label="Pesagens no GMD">
              <Chip label="Todas" selected={!measuredOnly} onPress={() => setMeasuredOnly(false)} />
              <Chip label="Só balança" selected={measuredOnly} onPress={() => setMeasuredOnly(true)} />
            </FilterGroup>
          </Card>
        ) : null}
      </View>

      <Segmented
        accessibilityLabel="Visão do relatório"
        options={[
          { value: 'gmd', label: 'Ganho (GMD)' },
          { value: 'ocupacao', label: 'Ocupação' },
          { value: 'movimentacoes', label: 'Mudanças' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <FadeIn key={tab}>
        <View style={styles.tab}>
          {tab === 'gmd' ? (
            <>
              {best ? (
                <Headline
                  label="Melhor ganho no período"
                  value={`${best.gmd!.estimated ? '≈' : ''}${formatNumber(best.gmd!.gmdKg, 2)}`}
                  unit="kg/cabeça/dia"
                  tone="accent"
                  caption={`${best.pasture?.name ?? app.pastureName(best.pastureId)}${best.pasture?.forage ? ` · ${best.pasture.forage}` : ''} · ${periodLabel}`}
                />
              ) : (
                <GmdCard gmd={null} insufficient="Nenhum pasto tem duas pesagens comparáveis do mesmo grupo dentro dos filtros." title="GMD por pasto" />
              )}

              {ranked.length >= 2 && ranked.every((r) => r.gmd!.gmdKg > 0) ? (
                <Card>
                  <BarChart
                    accessibilityLabel={`GMD por pasto: ${ranked.map((r) => `${r.pasture?.name} ${formatNumber(r.gmd!.gmdKg, 2)} kg por dia`).join(', ')}`}
                    data={ranked.slice(0, 6).map((r) => ({ key: r.pastureId, label: r.pasture?.name ?? '', value: r.gmd!.gmdKg, estimated: r.gmd!.estimated }))}
                    formatValue={(v) => formatNumber(v, 2)}
                  />
                  <AppText variant="caption" tone="faint">
                    kg por cabeça por dia. Barras vazadas com ≈ incluem estimativa visual.
                  </AppText>
                </Card>
              ) : null}

              {ranked.length > 0 ? (
                <Section title="Ranking por pasto">
                  <Group>
                    {ranked.map((r, i) => (
                      <ListRow
                        key={r.pastureId}
                        leading={<Rank position={i + 1} />}
                        title={r.pasture?.name ?? app.pastureName(r.pastureId)}
                        subtitle={`${r.pasture?.forage || 'Capim não informado'} · ${plural(r.gmd!.lots, 'lote', 'lotes')} · ${formatNumber(r.gmd!.headDays)} cab.-dia${r.gmd!.sample ? ' · amostra' : ''}`}
                        right={
                          <View style={styles.right}>
                            <AppText variant="heading" numeric tone={r.gmd!.gmdKg > 0 ? 'accent' : 'danger'}>
                              {`${r.gmd!.estimated ? '≈' : ''}${formatNumber(r.gmd!.gmdKg, 2)}`}
                            </AppText>
                            <AppText variant="caption" tone="faint">
                              kg/dia
                            </AppText>
                          </View>
                        }
                        onPress={r.pasture ? () => router.push({ pathname: '/pastos/[id]', params: { id: r.pastureId } }) : undefined}
                      />
                    ))}
                  </Group>
                </Section>
              ) : null}

              <Section title="Por tipo de capim">
                {result.byForage.length >= 2 ? (
                  <Group>
                    {result.byForage.map((f) => (
                      <ListRow
                        key={f.key}
                        icon="sprout-outline"
                        title={f.label}
                        subtitle={`${plural(f.pastureIds.length, 'pasto', 'pastos')} · ${gmdBase(f.gmd)}`}
                        right={
                          <AppText variant="bodyStrong" numeric tone="accent">
                            {formatPastureGmd(f.gmd)}
                          </AppText>
                        }
                      />
                    ))}
                  </Group>
                ) : (
                  <Note icon="sprout-outline">
                    {result.byForage.length === 1
                      ? `Só ${result.byForage[0].label} tem pesagens comparáveis. A comparação aparece com dois tipos de capim com dados.`
                      : 'Nenhum tipo de capim tem pesagens comparáveis ainda.'}
                  </Note>
                )}
              </Section>

              {missing.length > 0 ? (
                <Note icon="help-circle-outline" title={plural(missing.length, 'pasto sem dados suficientes', 'pastos sem dados suficientes')}>
                  {`${missing.map((r) => r.pasture!.name).join(', ')}. Toque no pasto, na aba Ocupação, para ver o que falta em cada um.`}
                </Note>
              ) : null}
              {result.unattributed > 0 ? (
                <Note icon="scale-unbalanced" title={plural(result.unattributed, 'pesagem fora da comparação', 'pesagens fora da comparação')}>
                  Pesagens do lote inteiro feitas enquanto ele estava em mais de um pasto não pertencem a um pasto só.
                </Note>
              ) : null}
              <GmdReadingNote />
            </>
          ) : null}

          {tab === 'ocupacao' ? (
            <>
              <Headline
                label="Cabeças nos pastos hoje"
                value={formatNumber(heads)}
                caption={plural(reports.filter((r) => r.currentHeads > 0).length, 'pasto ocupado', 'pastos ocupados')}
                stats={[{ label: `cabeça-dias · ${periodLabel}`, value: formatNumber(headDays) }]}
              />
              {reports.length === 0 ? (
                <Note icon="grass">Nenhum pasto cadastrado nas fazendas escolhidas.</Note>
              ) : (
                <Group>
                  {reports.map((r) => (
                    <PastureListItem
                      key={r.pastureId || 'unknown'}
                      report={r}
                      detail={`No período: ${formatNumber(r.headDays)} cab.-dia · ${plural(r.occupiedDays, 'dia ocupado', 'dias ocupados')} · +${r.headsIn} / −${r.headsOut}`}
                    />
                  ))}
                </Group>
              )}
              <AppText variant="caption" tone="faint">
                Ocupação confirmada: mudanças aguardando aprovação ou envio não entram nos números.
              </AppText>
            </>
          ) : null}

          {tab === 'movimentacoes' ? (
            moves.length === 0 ? (
              <EmptyState icon="swap-horizontal" title="Nenhuma mudança de pasto" message={`Sem mudanças em ${periodLabel} com estes filtros.`} />
            ) : (
              <Section title={`${plural(moves.length, 'mudança', 'mudanças')} · ${periodLabel}`}>
                <Group>
                  {moves.map((entry) => (
                    <MoveRow key={entry.id} entry={entry} />
                  ))}
                </Group>
              </Section>
            )
          ) : null}
        </View>
      </FadeIn>
    </Screen>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <ChipRow>{children}</ChipRow>
    </View>
  );
}

/** Posição no ranking: o primeiro em destaque, os demais neutros. */
function Rank({ position }: { position: number }) {
  return (
    <View style={styles.rank}>
      <AppText variant="heading" numeric tone={position === 1 ? 'accent' : 'faint'}>
        {position}º
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.sm },
  dates: { gap: space.md },
  panel: { gap: space.lg },
  filterGroup: { gap: space.xs },
  tab: { gap: space.lg },
  right: { alignItems: 'flex-end', minWidth: 48 },
  rank: { width: 34, alignItems: 'center' },
});
