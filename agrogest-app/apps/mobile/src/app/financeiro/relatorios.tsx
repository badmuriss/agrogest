import { router, useLocalSearchParams } from 'expo-router';

import { BudgetReport } from '@/components/finance-reports/budget';
import { CashFlowReport } from '@/components/finance-reports/cash-flow';
import { ResultsReport } from '@/components/finance-reports/results';
import { EmptyState, Screen } from '@/components/ui/layout';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { useApp } from '@/state/app-state';

type Tab = 'fluxo' | 'orcamento' | 'resultados';

const TABS: { value: Tab; label: string }[] = [
  { value: 'fluxo', label: 'Fluxo' },
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'resultados', label: 'Resultados' },
];

function parseTab(value: string | undefined): Tab {
  return TABS.some((t) => t.value === value) ? (value as Tab) : 'resultados';
}

/**
 * Relatórios financeiros numa tela só: fluxo de caixa (projetado e realizado), orçamento × real e
 * resultados (DRE, contas por idade e gastos, com exportação). `aba` abre direto em um deles.
 */
export default function RelatoriosScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ aba?: string }>();
  const tab = parseTab(params.aba);
  if (!app.scopedFarms.some((f) => app.canSeeFinance(f.operationId))) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Financeiro dos sócios" message="Os relatórios financeiros aparecem só para os sócios da operação." />
      </Screen>
    );
  }

  return (
    <Screen>
      <SegmentedTabs<Tab>
        accessibilityLabel="Relatório financeiro"
        options={TABS}
        value={tab}
        onChange={(next) => router.setParams({ aba: next })}
      />
      {tab === 'fluxo' ? <CashFlowReport /> : tab === 'orcamento' ? <BudgetReport /> : <ResultsReport />}
    </Screen>
  );
}
