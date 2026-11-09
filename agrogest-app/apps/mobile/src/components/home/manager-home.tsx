import { router } from 'expo-router';

import { Alert } from '@/components/gluestack/alert';
import { Text } from '@/components/gluestack/text';
import { VStack } from '@/components/gluestack/vstack';
import { HeroCard } from '@/components/ui/hero-card';
import { FadeIn } from '@/components/ui/motion';
import { Icon } from '@/components/ui/text';
import { formatCents } from '@/domain/format';
import { summarizePortfolio } from '@/domain/lot-metrics';
import { useApp } from '@/state/app-state';
import { usePalette } from '@/theme';

import { AttentionRows } from './attention';
import { DailyShortcuts, FarmMapCard, HerdToday, MonthCard } from './blocks';

/**
 * Home Gerencial: o número que importa (toque abre os relatórios), os registros do dia a dia, o que
 * pede ação, o rebanho, o mês (só com venda ou custo) e o mapa. Contas e custos por mês ficam no
 * Financeiro, que é a aba ao lado.
 */
export function ManagerHome() {
  const app = useApp();
  const p = usePalette();
  const financeLots = app.lotSummaries.filter((s) => app.canSeeFinance(s.lot.operationId));
  const hasFinance = financeLots.length > 0;
  const finance = summarizePortfolio(financeLots);
  const sold = financeLots.some((s) => s.sales.length > 0);

  return (
    <>
      {hasFinance ? (
        <FadeIn index={1}>
          <HeroCard
            money
            caption={sold ? 'Resultado das vendas até hoje' : 'Investido no rebanho'}
            value={formatCents(sold ? finance.realResultCents : finance.remainingCostCents)}
            detail={
              sold
                ? `Descontando o aluguel de pastagem: ${formatCents(finance.adjustedResultCents)}`
                : `${formatCents(finance.avgCostPerHeadCents)} por cabeça · o resultado aparece com a primeira venda`
            }
            onPress={() => router.push('/financeiro/relatorios')}
            pressLabel="Abrir os relatórios"
          />
        </FadeIn>
      ) : (
        <FadeIn index={1}>
          <Alert>
            <Icon name="lock-outline" size={20} color={p.textMuted} />
            <VStack className="flex-1 gap-0.5">
              <Text className="font-semibold">Sem acesso a valores</Text>
              <Text size="sm" className="text-muted-foreground">
                O modo muda a apresentação, não o acesso. Seu vínculo não inclui finanças.
              </Text>
            </VStack>
          </Alert>
        </FadeIn>
      )}

      <FadeIn index={2}>
        <DailyShortcuts />
      </FadeIn>

      <FadeIn index={3}>
        <AttentionRows />
      </FadeIn>

      <FadeIn index={4}>
        <HerdToday />
      </FadeIn>

      <FadeIn index={5}>
        <MonthCard />
      </FadeIn>

      <FadeIn index={6}>
        <FarmMapCard />
      </FadeIn>
    </>
  );
}
