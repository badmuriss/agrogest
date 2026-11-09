import { router } from 'expo-router';

import { Text } from '@/components/gluestack/text';
import { Group, ListRow, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { CRITERION_LABEL } from '@/domain/allocation';
import { formatDateShort } from '@/domain/dates';
import { formatCents, formatCentsCompact, formatNumber, plural } from '@/domain/format';
import { byOccurrence, lotAllocations, summarizeHerd, summarizePortfolio } from '@/domain/lot-metrics';
import { productionIndicators } from '@/domain/reports';
import { HeroCard } from '@/components/ui/hero-card';
import { useApp } from '@/state/app-state';

import { CompareLots, DailyShortcuts, FarmMapCard, Metric, MetricGrid, MonthCard } from './blocks';

/**
 * Home Analítica: indicadores do rebanho e do dinheiro, comparação entre lotes em barras e os
 * rateios recentes. Nada de tabela que rola para o lado; o detalhe fica no lote e no histórico.
 */
export function AnalyticHome() {
  const app = useApp();
  const farmIds = new Set(app.scopedFarms.map((f) => f.id));
  const herd = summarizeHerd(app.lotSummaries);
  const financeLots = app.lotSummaries.filter((s) => app.canSeeFinance(s.lot.operationId));
  const finance = summarizePortfolio(financeLots);
  // Custo de produção (despesas e consumo rateados) sobre o que o rebanho de fato produziu.
  const production = productionIndicators(financeLots);
  const hasFinance = financeLots.length > 0;
  const approx = herd.estimated ? '≈' : '';
  const allocationsRecent = app.visibleEntries
    .filter((e) => farmIds.has(e.farmId) && e.status === 'aprovado' && lotAllocations(e).length > 0)
    .sort(byOccurrence)
    .reverse()
    .slice(0, 3);

  return (
    <>
      {/* O número que mais importa vem primeiro: o resultado real quando já há vendas; senão, o rebanho. */}
      <FadeIn index={0}>
        {hasFinance && finance.arrobasSold > 0 ? (
          <HeroCard
            money
            caption="Resultado das vendas até hoje"
            value={formatCents(finance.realResultCents)}
            detail={`Descontando o aluguel de pastagem: ${formatCents(finance.adjustedResultCents)}`}
            onPress={() => router.push('/financeiro/relatorios')}
            pressLabel="Abrir os relatórios"
          />
        ) : (
          <HeroCard
            caption="Cabeças no rebanho"
            value={formatNumber(herd.heads)}
            detail={plural(herd.activeLots, 'lote ativo', 'lotes ativos')}
            onPress={() => router.push('/rebanho')}
            pressLabel="Ver os lotes"
          />
        )}
      </FadeIn>

      <FadeIn index={1}>
        <DailyShortcuts />
      </FadeIn>

      <FadeIn index={1}>
        <Section title="Indicadores">
          <MetricGrid>
            <Metric wide label="Cabeças" value={formatNumber(herd.heads)} hint={`${herd.activeLots} lotes ativos`} />
            <Metric
              wide
              label="Ganho diário"
              value={herd.avgGmdKg === null ? '—' : `${approx}${formatNumber(herd.avgGmdKg, 2)} kg`}
              hint="média ponderada"
            />
            <Metric
              wide
              label="Peso médio"
              value={herd.avgWeightKg === null ? '—' : `${approx}${formatNumber(herd.avgWeightKg)} kg`}
              hint={herd.avgWeightKg === null ? undefined : `${formatNumber(herd.avgWeightKg / 30, 1)} @ vivas`}
            />
            {hasFinance ? (
              <>
                <Metric wide label="Custo/cabeça" value={formatCentsCompact(finance.avgCostPerHeadCents)} hint="dos animais no lote" />
                <Metric
                  wide
                  label="Resultado real"
                  value={finance.arrobasSold > 0 ? formatCentsCompact(finance.realResultCents) : '—'}
                  tone={finance.arrobasSold > 0 ? (finance.realResultCents >= 0 ? 'success' : 'danger') : undefined}
                  hint={finance.arrobasSold > 0 ? `${formatCentsCompact(finance.adjustedResultCents)} c/ pastagem` : 'sem vendas ainda'}
                />
                <Metric
                  wide
                  label="Custo/@ produzida"
                  value={production.costPerArrobaCents === null ? '—' : formatCentsCompact(production.costPerArrobaCents)}
                  hint={production.arrobasProduced > 0 ? `${approx}${formatNumber(production.arrobasProduced, 0)} @ de ganho` : 'sem ganho de peso ainda'}
                />
                <Metric
                  wide
                  label="Custo/cabeça/mês"
                  value={production.costPerHeadMonthCents === null ? '—' : formatCentsCompact(production.costPerHeadMonthCents)}
                  hint="custos de produção"
                />
                <Metric
                  wide
                  label="Preço médio"
                  value={finance.arrobasSold > 0 ? `${formatCentsCompact(Math.round(finance.revenueCents / finance.arrobasSold))}/@` : '—'}
                  hint={finance.arrobasSold > 0 ? `${formatNumber(finance.arrobasSold, 0)} @ vendidas` : 'por arroba vendida'}
                />
              </>
            ) : null}
          </MetricGrid>
        </Section>
      </FadeIn>

      <FadeIn index={2}>
        <CompareLots />
      </FadeIn>

      <FadeIn index={3}>
        <MonthCard />
      </FadeIn>

      <FadeIn index={4}>
        <FarmMapCard />
      </FadeIn>

      {allocationsRecent.length > 0 ? (
        <FadeIn index={5}>
          <Section title="Rateios recentes" action={{ label: 'Histórico', onPress: () => router.navigate({ pathname: '/atividade', params: { filtro: 'registros' } }) }}>
            <Group>
              {allocationsRecent.map((entry) => (
                <ListRow
                  key={entry.id}
                  title={
                    <Text numberOfLines={1} className="font-semibold">
                      {entry.title}
                    </Text>
                  }
                  subtitle={`${'criterion' in entry.payload ? CRITERION_LABEL[entry.payload.criterion] : ''} · ${lotAllocations(entry)
                    .map((a) => app.lotSummary(a.lotId)?.lot.code)
                    .join(', ')} · ${formatDateShort(entry.occurredAt)}`}
                  right={
                    app.canSeeFinance(entry.operationId) ? (
                      <Text className="font-semibold tabular-nums">
                        {formatCents(lotAllocations(entry).reduce((acc, a) => acc + a.cents, 0))}
                      </Text>
                    ) : undefined
                  }
                  onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: entry.id } })}
                />
              ))}
            </Group>
          </Section>
        </FadeIn>
      ) : null}
    </>
  );
}
