import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ToggleGroup } from '@/components/fields';
import { Chip, ChipRow, Note } from '@/components/ui/controls';
import { Card, Divider, EmptyState, Group, KV, ListRow, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { addDays, formatDate, formatDateShort, monthTitle } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import { GROUP_LABEL, GROUP_ORDER, presetPeriod, projectedFlow, realizedFlow, type FlowBucket, type Granularity } from '@/domain/reports';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

type Mode = 'projetado' | 'realizado';
type Horizon = 30 | 90 | 180 | 365;

function bucketLabel(b: FlowBucket, granularity: Granularity): string {
  if (granularity === 'mes') return monthTitle(b.from);
  if (granularity === 'semana') return `${formatDateShort(b.from)} a ${formatDateShort(b.to)}`;
  return formatDate(b.from);
}

/**
 * Fluxo de caixa das contas de caixa (o cartão é dívida). Realizado: o que de fato entrou e saiu.
 * Projetado: o saldo de hoje mais as parcelas em aberto (as vencidas contam hoje), as faturas do
 * cartão e as despesas recorrentes previstas, com o alerta de saldo negativo.
 */
export function CashFlowReport() {
  const app = useApp();
  const [mode, setMode] = useState<Mode>('projetado');
  const [granularity, setGranularity] = useState<Granularity>('semana');
  const [horizon, setHorizon] = useState<Horizon>(90);
  const [range, setRange] = useState<'mes' | 'trimestre' | 'ano' | '12m'>('trimestre');
  const book = app.financeBook();
  if (book.operationIds.size === 0) {
    return <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="O fluxo de caixa aparece só para os sócios da operação." />;
  }

  const projected = mode === 'projetado' ? projectedFlow(book, addDays(app.today, horizon), granularity) : null;
  const realized = mode === 'realizado' ? realizedFlow(book, presetPeriod(range, app.today), granularity) : null;
  const buckets = projected?.buckets ?? realized?.buckets ?? [];
  const opening = projected?.opening ?? realized?.opening ?? 0;
  const closing = buckets.length > 0 ? buckets[buckets.length - 1].balanceCents : opening;

  return (
    <>
      <ToggleGroup<Mode>
        accessibilityLabel="Tipo de fluxo"
        options={[
          { value: 'projetado', label: 'Projetado' },
          { value: 'realizado', label: 'Realizado' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <ChipRow>
        {mode === 'projetado'
          ? ([30, 90, 180, 365] as Horizon[]).map((h) => <Chip key={h} label={h === 365 ? '12 meses' : `${h} dias`} selected={horizon === h} onPress={() => setHorizon(h)} />)
          : (
              [
                ['mes', 'Este mês'],
                ['trimestre', 'Trimestre'],
                ['ano', 'Este ano'],
                ['12m', '12 meses'],
              ] as const
            ).map(([value, label]) => <Chip key={value} label={label} selected={range === value} onPress={() => setRange(value)} />)}
      </ChipRow>
      <ChipRow>
        {(
          [
            ['dia', 'Por dia'],
            ['semana', 'Por semana'],
            ['mes', 'Por mês'],
          ] as [Granularity, string][]
        ).map(([value, label]) => (
          <Chip key={value} label={label} selected={granularity === value} onPress={() => setGranularity(value)} />
        ))}
      </ChipRow>

      {projected?.firstNegative ? (
        <Note boxed tone="danger" icon="alert-circle-outline" title="Saldo projetado negativo">
          {`O caixa fica em ${formatCents(projected.firstNegative.balanceCents)} em ${bucketLabel(projected.firstNegative, granularity)}. Antecipe recebimentos, renegocie pagamentos ou programe um aporte.`}
        </Note>
      ) : null}

      <Card>
        <KV label={mode === 'projetado' ? 'Saldo de caixa hoje' : 'Saldo no início'} value={formatCents(opening)} />
        <KV label="Entradas" value={`+ ${formatCents(buckets.reduce((acc, b) => acc + b.inCents, 0))}`} />
        <KV label="Saídas" value={`− ${formatCents(buckets.reduce((acc, b) => acc + b.outCents, 0))}`} />
        <Divider />
        <KV label={mode === 'projetado' ? 'Saldo projetado no fim' : 'Saldo no fim'} value={formatCents(closing)} strong />
      </Card>

      {buckets.length === 0 ? (
        <AppText variant="caption" tone="muted">
          {mode === 'projetado' ? 'Nenhuma conta em aberto neste horizonte.' : 'Nenhuma entrada ou saída no período.'}
        </AppText>
      ) : (
        <Section title={mode === 'projetado' ? 'Previsto' : 'Movimento'}>
          <Group>
            {buckets.map((b) => (
              <ListRow
                key={b.key}
                icon={b.balanceCents < 0 ? 'alert-circle-outline' : 'calendar-blank-outline'}
                iconTone={b.balanceCents < 0 ? 'danger' : 'neutral'}
                title={bucketLabel(b, granularity)}
                subtitle={
                  <View style={styles.row}>
                    <AppText variant="caption" tone="success" numeric>{`+ ${formatCents(b.inCents)}`}</AppText>
                    <AppText variant="caption" tone="muted" numeric>{`− ${formatCents(b.outCents)}`}</AppText>
                  </View>
                }
                right={
                  <AppText variant="bodyStrong" numeric tone={b.balanceCents < 0 ? 'danger' : 'default'}>
                    {formatCents(b.balanceCents)}
                  </AppText>
                }
                chevron={false}
              />
            ))}
          </Group>
        </Section>
      )}

      {realized && realized.byGroup.size > 0 ? (
        <Section title="Por grupo">
          <Card>
            {GROUP_ORDER.filter((g) => realized.byGroup.has(g)).map((g) => (
              <KV key={g} label={GROUP_LABEL[g]} value={formatCents(realized.byGroup.get(g) ?? 0)} />
            ))}
          </Card>
        </Section>
      ) : null}

      {projected && projected.items.length > 0 ? (
        <Section title="Contas do horizonte">
          <Group>
            {projected.items.slice(0, 40).map((item) => (
              <ListRow
                key={item.id}
                icon={item.cents >= 0 ? 'cash-plus' : 'cash-minus'}
                iconTone={item.kind === 'vencida' ? 'danger' : 'neutral'}
                title={item.title}
                subtitle={`${formatDate(item.date)} · ${item.kind === 'vencida' ? 'vencida (conta hoje)' : item.kind === 'prevista' ? 'despesa prevista' : item.kind === 'fatura' ? 'fatura do cartão' : GROUP_LABEL[item.group]}`}
                right={
                  <AppText variant="bodyStrong" numeric tone={item.cents >= 0 ? 'success' : 'default'}>
                    {`${item.cents >= 0 ? '+' : '−'} ${formatCents(Math.abs(item.cents))}`}
                  </AppText>
                }
                onPress={
                  item.kind === 'prevista'
                    ? () => router.push('/financeiro/recorrencias')
                    : () => router.push({ pathname: '/financeiro/parcela/[id]', params: { id: item.id } })
                }
              />
            ))}
          </Group>
        </Section>
      ) : null}
      <AppText variant="caption" tone="faint">
        Só as contas de caixa entram (bancos, caixa em espécie, investimentos). Compras no cartão entram quando a fatura é paga.
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
});
