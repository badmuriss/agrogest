import { router } from 'expo-router';

import { formatNumber, plural } from '@/domain/format';
import { summarizeHerd } from '@/domain/lot-metrics';
import { useApp } from '@/state/app-state';
import { BadgeDollarSign, Map, Sprout, TriangleAlert } from '@/components/ui/lucide';
import { HeroCard } from '@/components/ui/hero-card';
import { FadeIn } from '@/components/ui/motion';
import { QuickActions } from '@/components/ui/quick-actions';

import { AttentionRows, RecentEntries } from './attention';
import { FarmMapCard, HerdToday, LotPulse } from './blocks';

/**
 * Home Essencial (quem está no campo): o número do rebanho com a ação principal, os atalhos do dia a dia,
 * o que pede ação, o mapa e os lotes. Sem dinheiro e sem gráficos; o histórico fica na Atividade.
 */
export function EssentialHome() {
  const app = useApp();
  const herd = summarizeHerd(app.lotSummaries);
  return (
    <>
      <FadeIn index={1}>
        <HeroCard
          caption="Cabeças no rebanho"
          value={formatNumber(herd.heads)}
          detail={plural(herd.activeLots, 'lote', 'lotes')}
          action={{ title: 'Registrar pesagem', onPress: () => router.push('/novo/pesagem') }}
        />
      </FadeIn>
      <FadeIn index={2}>
        <QuickActions
          actions={[
            { key: 'despesa', label: 'Despesa', icon: BadgeDollarSign, onPress: () => router.push('/novo/despesa') },
            { key: 'consumo', label: 'Consumo de insumo', icon: Sprout, onPress: () => router.push('/novo/consumo') },
            { key: 'morte', label: 'Mortalidade', icon: TriangleAlert, onPress: () => router.push('/novo/mortalidade') },
            { key: 'pasto', label: 'Mudança de pasto', icon: Map, onPress: () => router.push('/novo/manejo') },
          ]}
        />
      </FadeIn>
      <FadeIn index={3}>
        <AttentionRows />
      </FadeIn>
      <FadeIn index={4}>
        <HerdToday />
      </FadeIn>
      <FadeIn index={5}>
        <FarmMapCard />
      </FadeIn>
      <FadeIn index={6}>
        <LotPulse />
      </FadeIn>
      <FadeIn index={7}>
        <RecentEntries />
      </FadeIn>
    </>
  );
}
