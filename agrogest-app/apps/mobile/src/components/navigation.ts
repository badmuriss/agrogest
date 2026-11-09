import { router } from 'expo-router';

import { useApp } from '@/state/app-state';

/**
 * O quarto lugar do menu depende só da permissão: Financeiro para quem é sócio de alguma operação
 * visível; Atividade para quem não tem acesso ao financeiro (funcionário, campo). A Atividade
 * continua a um toque para todos pelo sino do topo.
 */
export function useMenuTabs() {
  const app = useApp();
  const financeTab = app.visibleFarms.some((farm) => app.canSeeFinance(farm.operationId));
  return { financeTab, activityTab: !financeTab };
}

/** Volta para onde a pessoa estava; aberto direto por link, volta para o Início. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.navigate('/');
}
