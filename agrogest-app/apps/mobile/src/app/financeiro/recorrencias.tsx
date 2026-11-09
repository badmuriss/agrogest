import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, StatusText } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { formatDate, monthTitle } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

/**
 * Despesas recorrentes (salário, energia, aluguel de pasto, internet). Cada mês aparece como
 * despesa prevista no fluxo projetado e nos avisos; vira conta a pagar quando alguém lança a
 * despesa do mês, que passa pela aprovação de outro sócio como qualquer despesa.
 */
export default function RecorrenciasScreen() {
  const app = useApp();
  const farmIds = new Set(app.scopedFarms.map((f) => f.id));
  const list = app.recurrences.filter((r) => farmIds.has(r.farmId));
  const until = app.today.slice(0, 7);
  const upcoming = app.occurrences.filter((o) => !o.entryId && o.month <= nextMonth(until)).slice(0, 12);
  const operationId = app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId;

  const launch = (recurrenceId: string, month: string) => router.push({ pathname: '/novo/despesa', params: { recorrencia: recurrenceId, mes: month } });

  return (
    <Screen
      footer={operationId ? <Button title="Nova despesa recorrente" icon="plus" size="lg" onPress={() => router.push({ pathname: '/financeiro/recorrencia', params: { operacao: operationId } })} /> : undefined}>
      {upcoming.length > 0 ? (
        <Section title="Previstas para lançar">
          <Group>
            {upcoming.map((o) => (
              <ListRow
                key={o.id}
                icon="calendar-clock"
                iconTone={o.daysToDue < 0 ? 'danger' : o.daysToDue <= 7 ? 'warning' : 'neutral'}
                title={
                  <View style={styles.row}>
                    <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                      {o.title}
                    </AppText>
                    <AppText variant="bodyStrong" numeric>
                      {formatCents(o.cents)}
                    </AppText>
                  </View>
                }
                subtitle={
                  <View style={styles.row}>
                    <AppText variant="caption" tone="muted" style={styles.flex}>
                      {`${monthTitle(`${o.month}-01`)} · vence ${formatDate(o.dueDate)}`}
                    </AppText>
                    <StatusText label="Prevista" tone="info" />
                  </View>
                }
                onPress={() => launch(o.recurrenceId, o.month)}
              />
            ))}
          </Group>
          <AppText variant="caption" tone="faint">Toque para lançar a despesa do mês. Ela vai para a aprovação e então vira conta a pagar.</AppText>
        </Section>
      ) : null}

      {list.length === 0 ? (
        <EmptyState icon="calendar-sync" title="Nenhuma despesa recorrente" message="Cadastre salário, energia, aluguel de pasto e internet uma vez; o app lembra todo mês." />
      ) : (
        <Section title="Modelos">
          <Group>
            {list.map((r) => (
              <ListRow
                key={r.id}
                icon="calendar-sync"
                title={r.title}
                subtitle={`${formatCents(r.cents)} todo dia ${r.dayOfMonth} · desde ${r.startMonth.slice(5, 7)}/${r.startMonth.slice(0, 4)}${r.endMonth ? ` até ${r.endMonth.slice(5, 7)}/${r.endMonth.slice(0, 4)}` : ''}${r.active ? '' : ' · pausada'}`}
                onPress={() => router.push({ pathname: '/financeiro/recorrencia', params: { id: r.id } })}
              />
            ))}
          </Group>
        </Section>
      )}
    </Screen>
  );
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
