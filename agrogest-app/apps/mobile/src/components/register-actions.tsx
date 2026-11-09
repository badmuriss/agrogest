import { router, type Href } from 'expo-router';
import { useState } from 'react';

import { Button, Chip, ChipRow } from '@/components/ui/controls';
import { BadgeDollarSign, Map, Scale, TriangleAlert } from '@/components/ui/lucide';
import { EmptyState, Group, ListRow } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { QuickActions, type QuickAction } from '@/components/ui/quick-actions';
import type { IconName } from '@/components/ui/text';
import { useApp } from '@/state/app-state';

/**
 * O que dá para registrar agora. A folha do "+" mostra o essencial do dia a dia em blocos (até 4);
 * o resto fica em "Ver mais", para não empilhar oito linhas de cara. Usado na folha e em `/registrar`;
 * `onNavigate` fecha a folha antes de abrir o formulário.
 */
export function RegisterActions({ onNavigate }: { onNavigate?: () => void }) {
  const app = useApp();
  const [more, setMore] = useState(false);
  const hasLots = app.visibleFarms.some((f) => app.farmLotSummaries(f.id).some((s) => s.headsCurrent > 0));
  const finance = app.scopedFarms.some((farm) => app.canSeeFinance(farm.operationId));
  const canSell = !app.cloudMode || finance;
  const go = (href: Href) => {
    onNavigate?.();
    router.push(href);
  };

  if (app.visibleFarms.length === 0) {
    return (
      <EmptyState icon="barn" illustration="farm" title="Crie uma fazenda primeiro" message="Todo registro pertence a uma fazenda.">
        <Button title="Criar fazenda" icon="plus" onPress={() => go('/fazenda/nova')} />
      </EmptyState>
    );
  }

  // Essencial: o que se faz no campo, em blocos. A pesagem é a principal quando há lote com animais.
  const essentials: QuickAction[] = [
    ...(hasLots ? [{ key: 'pesagem', label: 'Pesagem', icon: Scale, primary: true, onPress: () => go('/novo/pesagem') }] : []),
    { key: 'despesa', label: 'Despesa', icon: BadgeDollarSign, onPress: () => go('/novo/despesa') },
    ...(hasLots ? [{ key: 'pasto', label: 'Mudança de pasto', icon: Map, onPress: () => go('/novo/manejo') }] : []),
    ...(hasLots ? [{ key: 'morte', label: 'Mortalidade', icon: TriangleAlert, onPress: () => go('/novo/mortalidade') }] : []),
  ];

  // Resto: compra e venda e o que é menos frequente. Só aparece ao tocar em "Ver mais".
  const rest: { key: string; title: string; subtitle: string; icon: IconName; href: Href; show: boolean }[] = [
    { key: 'consumo', title: 'Consumo de insumo', subtitle: 'Sal, proteinado ou ração que saiu do estoque', icon: 'silo', href: '/novo/consumo', show: hasLots && app.supplies.some((s) => s.active) },
    { key: 'estoque', title: 'Compra para o estoque', subtitle: 'Vira conta a pagar', icon: 'truck-delivery-outline', href: { pathname: '/novo/despesa', params: { destino: 'estoque' } }, show: true },
    { key: 'lote', title: 'Novo lote', subtitle: 'Entrada ou compra de animais', icon: 'cow', href: { pathname: '/lote/novo', params: app.contextFarm ? { fazenda: app.contextFarm.id } : {} }, show: true },
    { key: 'venda', title: 'Venda', subtitle: 'Por arroba de carcaça', icon: 'cash-multiple', href: '/novo/venda', show: hasLots && canSell },
    { key: 'receita', title: 'Outra receita', subtitle: 'Couro, arrendamento, serviços: vira conta a receber', icon: 'cash-plus', href: '/novo/receita', show: finance },
  ];
  const restShown = rest.filter((item) => item.show);

  return (
    <>
      {!app.cloudMode ? (
        <FadeIn index={0}>
          <Group>
            <ListRow
              icon="file-document-outline"
              title="Importar nota fiscal"
              subtitle="Fotografe ou escolha o PDF. A IA preenche e você só confere."
              onPress={() => go('/novo/nota-fiscal')}
            />
          </Group>
        </FadeIn>
      ) : null}

      <FadeIn index={1}>
        <QuickActions actions={essentials} />
      </FadeIn>

      {restShown.length > 0 ? (
        <FadeIn index={2}>
          <ChipRow>
            <Chip label={more ? 'Ver menos' : 'Ver mais'} selected={more} onPress={() => setMore(!more)} />
          </ChipRow>
          {more ? (
            <Group>
              {restShown.map((item) => (
                <ListRow
                  key={item.key}
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  onPress={() => go(item.href)}
                />
              ))}
            </Group>
          ) : null}
        </FadeIn>
      ) : null}
    </>
  );
}
