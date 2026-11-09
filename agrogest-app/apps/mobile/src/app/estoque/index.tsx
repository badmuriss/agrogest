import { router } from 'expo-router';

import { StockRow } from '@/components/stock-ui';
import { Button, Note } from '@/components/ui/controls';
import { Card, EmptyState, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { formatCents, plural } from '@/domain/format';
import { useApp } from '@/state/app-state';

/**
 * Estoque de insumos por fazenda: saldo, duração no ritmo de consumo dos últimos 30 dias e
 * alerta de estoque baixo. Valor e custo médio só para sócios.
 */
export default function EstoqueScreen() {
  const app = useApp();
  const farms = app.scopedFarms;
  if (farms.length === 0) {
    return (
      <Screen>
        <EmptyState icon="barn" title="Crie uma fazenda primeiro" message="O estoque é controlado por fazenda." />
      </Screen>
    );
  }
  const partner = farms.some((f) => app.canSeeFinance(f.operationId));
  const hasSupplies = app.supplies.length > 0;

  return (
    <Screen
      footer={
        hasSupplies ? (
          <Button title="Apontar consumo" icon="silo" size="lg" onPress={() => router.push('/novo/consumo')} />
        ) : partner ? (
          <Button title="Cadastrar insumo" icon="plus" size="lg" onPress={() => router.push('/estoque/insumo')} />
        ) : undefined
      }>
      {!hasSupplies ? (
        <EmptyState
          icon="silo"
          title="Controle o estoque de insumos"
          message="Cadastre o sal, o proteinado ou o medicamento. A compra entra no estoque e vira conta a pagar; o custo só vai para os lotes quando você aponta o consumo."
        />
      ) : (
        farms.map((farm, i) => {
          const positions = app.stock([farm.id]);
          const showValue = app.canSeeFinance(farm.operationId);
          const low = positions.filter((p) => p.low);
          const value = positions.reduce((acc, p) => acc + p.valueCents, 0);
          return (
            <FadeIn key={farm.id} index={i}>
              <Section title={farms.length > 1 ? farm.name : undefined}>
                {low.length > 0 ? (
                  <Note boxed tone="warning" icon="alert-outline" title={`${plural(low.length, 'insumo', 'insumos')} com estoque baixo`}>
                    {low.map((p) => p.supply.name).join(', ')}
                  </Note>
                ) : null}
                {showValue && value > 0 ? (
                  <Card>
                    <KV label="Valor em estoque" value={formatCents(value)} strong hint="pelo custo médio" />
                  </Card>
                ) : null}
                {positions.length > 0 ? (
                  <Group>
                    {positions.map((p) => (
                      <StockRow key={p.supply.id} position={p} showValue={showValue} />
                    ))}
                  </Group>
                ) : null}
              </Section>
            </FadeIn>
          );
        })
      )}
      <Section title="Movimentar">
        <Group>
          <ListRow
            icon="truck-delivery-outline"
            title="Compra para o estoque"
            subtitle="Entra no estoque e vira conta a pagar"
            onPress={() => router.push({ pathname: '/novo/despesa', params: { destino: 'estoque' } })}
          />
          {hasSupplies ? (
            <ListRow icon="clipboard-check-outline" title="Ajuste de estoque" subtitle="Contagem, perda ou quebra, com o motivo" onPress={() => router.push('/novo/ajuste-estoque')} />
          ) : null}
          {hasSupplies && app.visibleFarms.some((f) => app.visibleFarms.some((o) => o.id !== f.id && o.operationId === f.operationId)) ? (
            <ListRow icon="warehouse" title="Transferir para outra fazenda" subtitle="Da mesma operação, pelo custo médio" onPress={() => router.push('/novo/transferencia-estoque')} />
          ) : null}
          {partner ? <ListRow icon="plus" iconTone="accent" title="Cadastrar insumo" onPress={() => router.push('/estoque/insumo')} /> : null}
        </Group>
      </Section>
    </Screen>
  );
}
