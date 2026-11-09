import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { formatNumber, plural } from '@/domain/format';
import { formatHectares, ringAreaHa } from '@/domain/geo';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

/**
 * Hub dos recursos da operação: as fazendas (com mapa e edição), as pessoas que trabalham nelas e o
 * estoque de insumos. Rebanho, pastos e dinheiro têm hubs próprios no menu.
 */
export default function FazendaScreen() {
  const app = useApp();
  const scopedOps = new Set(app.scopedFarms.map((f) => f.operationId));
  const others = new Set(
    app.scopedFarms.flatMap((f) => app.peopleIn(f.operationId).map((m) => m.user.id)).filter((id) => id !== app.user.id),
  ).size;
  const scopedInvites = app.invites.filter((inv) => scopedOps.has(inv.operationId));
  const peopleSubtitle =
    others > 0
      ? `${others + 1} pessoas com acesso${app.contextFarm ? ` a ${app.contextFarm.name}` : ''}`
      : scopedInvites.length > 0
        ? plural(scopedInvites.length, 'convite pendente', 'convites pendentes')
        : app.contextFarm
          ? `Só você em ${app.contextFarm.name}`
          : 'Convide um sócio ou funcionário';
  const stockSubtitle =
    app.supplies.length === 0
      ? 'Sal, proteinado, ração: compra, consumo e saldo'
      : app.stock().some((s) => s.low)
        ? 'Há insumo com estoque baixo'
        : `${plural(app.supplies.filter((s) => s.active).length, 'insumo', 'insumos')} · saldo e duração`;

  return (
    <Screen footer={<Button title="Nova fazenda" icon="plus" onPress={() => router.push('/fazenda/nova')} />}>
      {app.visibleFarms.length === 0 ? (
        <EmptyState icon="barn" illustration="farm" title="Nenhuma fazenda" message="Crie a primeira para cadastrar lotes e registrar o dia a dia." />
      ) : (
        <>
          <FadeIn>
            <Section title="Fazendas e mapas">
              <Group>
                {app.visibleFarms.map((farm) => {
                  const lots = app.farmLotSummaries(farm.id).filter((s) => s.headsCurrent > 0);
                  const heads = lots.reduce((acc, s) => acc + s.headsCurrent, 0);
                  const editable = !app.cloudMode || app.canSeeFinance(farm.operationId);
                  // O lápis fica ao lado da linha, não dentro dela: botão dentro de botão não é válido.
                  return (
                    <View key={farm.id} style={styles.farm}>
                      <View style={styles.flex}>
                        <ListRow
                          icon="barn"
                          title={farm.name}
                          subtitle={`${app.farmCaption(farm)}\n${[
                            farm.boundary ? formatHectares(ringAreaHa(farm.boundary)) : 'Toque para desenhar a área',
                            lots.length > 0 ? `${plural(lots.length, 'lote', 'lotes')} · ${formatNumber(heads)} cabeças` : 'Sem lotes',
                          ].join(' · ')}`}
                          chevron={!editable}
                          accessibilityLabel={`Mapa da ${farm.name}`}
                          onPress={() => router.push({ pathname: '/fazenda/mapa/[id]', params: { id: farm.id } })}
                        />
                      </View>
                      {editable ? (
                        <View style={styles.edit}>
                          <IconButton
                            icon="pencil-outline"
                            accessibilityLabel={`Editar ${farm.name}`}
                            onPress={() => router.push({ pathname: '/fazenda/nova', params: { id: farm.id } })}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </Group>
            </Section>
          </FadeIn>
          <FadeIn index={1}>
            <Section title="Equipe e insumos">
              <Group>
                <ListRow icon="account-multiple-outline" title="Pessoas" subtitle={peopleSubtitle} onPress={() => router.push('/pessoas')} />
                <ListRow icon="silo" title="Estoque de insumos" subtitle={stockSubtitle} onPress={() => router.push('/estoque')} />
              </Group>
            </Section>
          </FadeIn>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  farm: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  edit: { paddingRight: space.md },
});
