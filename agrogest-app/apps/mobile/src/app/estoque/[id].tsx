import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EntryRow } from '@/components/rows';
import { durationText } from '@/components/stock-ui';
import { Button, StatusText } from '@/components/ui/controls';
import { Card, Divider, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { formatDate } from '@/domain/dates';
import { formatCents } from '@/domain/format';
import { entrySupplyIds, formatQty, stockLedger, SUPPLY_KIND_LABEL, type StockMovementType } from '@/domain/stock';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const MOVE_LABEL: Record<StockMovementType, string> = {
  compra: 'Compra',
  consumo: 'Consumo',
  ajuste: 'Ajuste',
  transferencia_saida: 'Transferência enviada',
  transferencia_entrada: 'Transferência recebida',
};

/** Insumo: saldo por fazenda e o histórico de entradas, consumos, ajustes e transferências. */
export default function InsumoScreen() {
  const app = useApp();
  const { id, fazenda } = useLocalSearchParams<{ id: string; fazenda?: string }>();
  const supply = app.supplies.find((s) => s.id === id);
  if (!supply) {
    return (
      <Screen>
        <EmptyState icon="silo" title="Insumo indisponível" />
      </Screen>
    );
  }
  const farmIds = fazenda ? [fazenda] : app.scopedFarms.filter((f) => f.operationId === supply.operationId).map((f) => f.id);
  const showValue = app.canSeeFinance(supply.operationId);
  const positions = app.stock(farmIds).filter((p) => p.supply.id === supply.id);
  const movements = stockLedger(app.visibleEntries, supply.id, 'confirmado')
    .movements.filter((m) => farmIds.includes(m.farmId))
    .reverse();
  const pending = app.visibleEntries.filter(
    (e) => entrySupplyIds(e).includes(supply.id) && farmIds.includes(e.farmId) && e.status !== 'aprovado' && e.status !== 'rejeitado',
  );

  return (
    <Screen
      footer={
        showValue ? (
          <Button title="Editar insumo" variant="secondary" icon="pencil-outline" onPress={() => router.push({ pathname: '/estoque/insumo', params: { id: supply.id } })} />
        ) : undefined
      }>
      <Stack.Screen options={{ title: supply.name }} />
      {positions.map((p) => (
        <Card key={p.farmId}>
          {farmIds.length > 1 || !fazenda ? <AppText variant="bodyStrong">{app.farm(p.farmId)?.name}</AppText> : null}
          <KV label="Saldo" value={formatQty(p.qty, supply.unit)} strong />
          {showValue ? <KV label="Valor" value={formatCents(p.valueCents)} hint={`custo médio ${formatCents(p.avgCostCents)}/${supply.unit}`} /> : null}
          <KV label="Duração" value={durationText(p)} />
          {supply.minQuantity !== null ? <KV label="Estoque mínimo" value={formatQty(supply.minQuantity, supply.unit)} /> : null}
          {p.low ? <StatusText label="Estoque baixo: hora de comprar" tone="warning" /> : null}
        </Card>
      ))}
      <Card>
        <KV label="Tipo" value={SUPPLY_KIND_LABEL[supply.kind]} />
        <KV label="Unidade de controle" value={formatQty(1, supply.unit).replace(/^1 /, '')} />
        {supply.conversions.map((c) => (
          <KV key={c.unit} label={`1 ${c.unit}`} value={formatQty(c.factor, supply.unit)} />
        ))}
        {!supply.active ? (
          <>
            <Divider />
            <KV label="Situação" value="Inativo" />
          </>
        ) : null}
      </Card>
      {pending.length > 0 ? (
        <Section title="Aguardando">
          <Group>
            {pending.map((e) => (
              <EntryRow key={e.id} entry={e} />
            ))}
          </Group>
        </Section>
      ) : null}
      <Section title="Movimentos">
        {movements.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Nenhum movimento aprovado ainda.
          </AppText>
        ) : (
          <Group>
            {movements.map((m, i) => (
              <ListRow
                key={`${m.entryId}:${m.type}:${i}`}
                icon={m.quantity >= 0 ? 'tray-arrow-down' : 'tray-arrow-up'}
                iconTone={m.quantity >= 0 ? 'success' : 'neutral'}
                title={
                  <View style={styles.row}>
                    <AppText variant="bodyStrong" style={styles.flex}>
                      {MOVE_LABEL[m.type]}
                    </AppText>
                    <AppText variant="bodyStrong" numeric>
                      {`${m.quantity >= 0 ? '+' : '−'} ${formatQty(Math.abs(m.quantity), supply.unit)}`}
                    </AppText>
                  </View>
                }
                subtitle={[formatDate(m.date), showValue ? formatCents(Math.abs(m.cents)) : null, `saldo ${formatQty(m.qtyAfter, supply.unit)}`]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: m.entryId } })}
              />
            ))}
          </Group>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
