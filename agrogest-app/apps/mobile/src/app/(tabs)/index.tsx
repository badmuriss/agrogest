import { Redirect } from 'expo-router';

import { HomeHeader } from '@/components/header';
import { AnalyticHome } from '@/components/home/analytic-home';
import { EssentialHome } from '@/components/home/essential-home';
import { FirstLotNext, FirstSteps, StartWithFarm, useFirstSteps } from '@/components/home/getting-started';
import { ManagerHome } from '@/components/home/manager-home';
import { Screen } from '@/components/ui/layout';
import { useApp } from '@/state/app-state';
import { usePreferences } from '@/state/preferences';

/**
 * Início em três momentos: sem fazenda (convite recebido ou criar fazenda), primeiros passos e o
 * dia a dia (por modo). Logo após o primeiro lote, o resumo dele e o próximo passo vêm antes.
 * As compras por informar pagamento entram no "Precisa de você", como o resto do que o sino conta.
 */
export default function HomeScreen() {
  const app = useApp();
  const prefs = usePreferences();
  const firstSteps = useFirstSteps();
  const hasFarm = app.visibleFarms.length > 0;

  // Conta nova (sem fazenda e sem modo escolhido) passa antes pelo primeiro acesso.
  if (!hasFarm && !prefs.modeChosen) return <Redirect href="/comecar" />;

  return (
    <Screen tab hero header={<HomeHeader />}>
      {!hasFarm ? <StartWithFarm /> : null}
      {hasFarm && firstSteps.visible ? <FirstSteps /> : null}
      {hasFarm && firstSteps.hasLots ? <FirstLotNext /> : null}
      {hasFarm && firstSteps.hasLots ? (
        prefs.mode === 'essencial' ? (
          <EssentialHome />
        ) : prefs.mode === 'gerencial' ? (
          <ManagerHome />
        ) : (
          <AnalyticHome />
        )
      ) : null}
    </Screen>
  );
}
