import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '../global.css';
import { ContextTransition } from '@/components/context-transition';
import { DatabaseBoundary } from '@/components/database-boundary';
import { DueAlertsScheduler } from '@/components/due-alerts-scheduler';
import { GluestackUIProvider } from '@/components/gluestack/gluestack-ui-provider';
import { StartupSplash } from '@/components/startup-splash';
import { KeyboardEnvironment } from '@/components/ui/keyboard';
import { MotionEnvironmentProvider, useMotion } from '@/components/ui/motion';
import { initializeDatabase } from '@/services/database-recovery';
import { cloudEnabled } from '@/services/supabase';
import { AppStateProvider, useApp } from '@/state/app-state';
import { appAccessAllowed } from '@/domain/auth-callback';
import { AuthProvider, useAuth } from '@/state/auth-state';
import { PerfBoundary } from '@/state/perf-probe';
import { BrandPreferenceProvider } from '@/state/brand-preference';
import { ThemePreferenceProvider } from '@/state/theme-preference';
import { font, useIsDark, usePalette } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Tela aberta direto por link ou notificação (lote, parcela, lançamento) ganha as abas por baixo:
 * o voltar aparece e leva ao Início. Sem isso, no iPhone a tela ficava sem saída.
 */
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemePreferenceProvider>
        <BrandPreferenceProvider>
          <MotionEnvironmentProvider>
            <KeyboardEnvironment>
              <AuthProvider><AppShell /></AuthProvider>
            </KeyboardEnvironment>
          </MotionEnvironmentProvider>
        </BrandPreferenceProvider>
      </ThemePreferenceProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const auth = useAuth();
  const dark = useIsDark();
  const p = usePalette();
  // Aguarde as fontes enquanto carregam; uma falha visual não deve impedir o acesso aos dados.
  const [fontsLoaded, fontsError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: p.accent,
      background: p.background,
      card: p.background,
      text: p.text,
      border: p.border,
    },
  };
  const markReady = useCallback(() => setReady(true), []);
  const finishSplash = useCallback(() => setSplashDone(true), []);
  const showDatabaseError = useCallback(() => {
    setReady(true);
    setSplashDone(true);
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  const retryDatabase = useCallback(() => {
    setReady(false);
    setSplashDone(false);
  }, []);

  if (!auth.ready || (!fontsLoaded && !fontsError)) return <StartupSplash ready={false} stage={!auth.ready ? 'session' : 'fonts'} onDone={finishSplash} />;
  const databaseName = cloudEnabled ? `agrogest-worker-local-${auth.session?.user.id ?? 'signed-out'}.db` : 'agrogest-prototipo.db';

  return (
    <GluestackUIProvider mode={dark ? 'dark' : 'light'}>
      <ThemeProvider value={theme}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <DatabaseBoundary key={databaseName} onError={showDatabaseError} onRetry={retryDatabase}>
          <SQLiteProvider databaseName={databaseName} onInit={initializeDatabase}>
            <AppStateProvider onReady={markReady}>
              <PerfBoundary id="app"><RootStack /></PerfBoundary>
              <ContextTransition />
              <DueAlertsScheduler />
            </AppStateProvider>
          </SQLiteProvider>
        </DatabaseBoundary>
        {splashDone ? null : <StartupSplash ready={ready} stage="data" onDone={finishSplash} />}
      </ThemeProvider>
    </GluestackUIProvider>
  );
}

/**
 * Sem sessão, só as telas de entrada; com sessão, o app. A troca acontece sob a transição. Com
 * link de confirmação em verificação ou recusado, o app espera: a sessão PKCE chega antes da
 * conferência final e só o sucesso libera (a tela auth/callback fica fora dos dois grupos).
 */
function RootStack() {
  const { signedIn } = useApp();
  const { recovering, callbackStatus } = useAuth();
  const appOpen = appAccessAllowed({ signedIn, recovering, callbackStatus });
  const p = usePalette();
  const motion = useMotion();
  // Telas de formulário sobem de baixo; o resto entra pela lateral, no sentido do gesto de voltar.
  const modal = { presentation: 'modal', animation: motion ? 'slide_from_bottom' : 'none' } as const;
  return (
    <Stack
      screenOptions={{
        headerTintColor: p.text,
        headerTitleStyle: { color: p.text, fontFamily: font.semibold },
        headerStyle: { backgroundColor: p.background },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: p.background },
        // Mesmo deslize no Android e no iPhone; no iPhone, voltar arrastando de qualquer ponto da tela.
        animation: motion ? 'ios_from_right' : 'none',
        animationDuration: 260,
        fullScreenGestureEnabled: true,
      }}>
      <Stack.Protected guard={!signedIn && !recovering}>
        <Stack.Screen name="boas-vindas" options={{ headerShown: false, animation: motion ? 'fade' : 'none' }} />
        <Stack.Screen name="entrar" options={{ title: '' }} />
        <Stack.Screen name="cadastro" options={{ title: '' }} />
      </Stack.Protected>
      {/* Sem conta, a primeira tela é a de boas-vindas. Sem `redirectTo`, o expo-router 58 manda para a
          primeira rota livre na ordem dos arquivos (/entrar). Com conta e link em verificação, segue o padrão. */}
      <Stack.Protected guard={appOpen} redirectTo={signedIn ? undefined : '/boas-vindas'}>
        <Stack.Screen name="(tabs)" options={{ title: 'Início', headerShown: false, animation: motion ? 'fade' : 'none' }} />
        <Stack.Screen name="comecar" options={{ headerShown: false, gestureEnabled: false, animation: motion ? 'fade' : 'none' }} />
        <Stack.Screen name="contexto"options={{ presentation: 'card', animation: motion ? 'fade' : 'none', animationDuration: 160, title: 'Onde você está' }} />
        <Stack.Screen name="fazenda/index" options={{ title: 'Fazenda' }} />
        <Stack.Screen name="fazenda/nova" options={{ ...modal, title: 'Fazenda' }} />
        <Stack.Screen name="fazenda/mapa/[id]" options={{ title: 'Mapa da fazenda' }} />
        <Stack.Screen name="pastos/[id]" options={{ title: '' }} />
        <Stack.Screen name="pastos/editar" options={{ ...modal, title: 'Pasto' }} />
        <Stack.Screen name="pastos/relatorio" options={{ title: 'Relatório de pastos' }} />
        <Stack.Screen name="pessoas/index" options={{ title: 'Pessoas' }} />
        <Stack.Screen name="pessoas/nova" options={{ ...modal, title: 'Convidar pessoa' }} />
        <Stack.Screen name="pessoas/convite/[id]" options={{ title: 'Convite' }} />
        <Stack.Screen name="pessoas/editar/[id]" options={{ title: 'Editar pessoa' }} />
        <Stack.Screen name="preferencias" options={{ title: 'Preferências' }} />
        <Stack.Screen name="ajuda" options={{ title: 'Ajuda e suporte' }} />
        <Stack.Screen name="prototipo" options={{ title: 'Ferramentas do protótipo' }} />
        <Stack.Screen name="animacoes" options={{ title: 'Ilustrações do aplicativo' }} />
        <Stack.Screen name="sincronizacao" options={{ title: 'Sincronização' }} />
        <Stack.Screen name="lote/novo" options={{ title: 'Novo lote' }} />
        <Stack.Screen name="lote/[id]" options={{ title: '' }} />
        <Stack.Screen name="lote/transferir/[id]" options={{ title: 'Transferir lote' }} />
        <Stack.Screen name="lote/editar/[id]" options={{ title: 'Editar lote' }} />
        <Stack.Screen name="lote/pagamento/[id]" options={{ title: 'Pagamento da compra' }} />
        <Stack.Screen name="documento/[id]" options={{ title: 'Comprovante original' }} />
        <Stack.Screen name="lancamento/[id]" options={{ title: '' }} />
        <Stack.Screen name="novo/pesagem" options={{ title: 'Pesagem' }} />
        <Stack.Screen name="novo/manejo" options={{ title: 'Mudança de pasto' }} />
        <Stack.Screen name="novo/importar-despesa" options={{ title: 'Importar comprovante' }} />
        <Stack.Screen name="novo/despesa" options={{ title: 'Despesa' }} />
        <Stack.Screen name="novo/mortalidade" options={{ title: 'Mortalidade' }} />
        <Stack.Screen name="novo/venda" options={{ title: 'Venda' }} />
        <Stack.Screen name="novo/nota-fiscal" options={{ title: 'Nota fiscal' }} />
        <Stack.Screen name="novo/consumo" options={{ title: 'Consumo de insumo' }} />
        <Stack.Screen name="novo/ajuste-estoque" options={{ title: 'Ajuste de estoque' }} />
        <Stack.Screen name="novo/transferencia-estoque" options={{ title: 'Transferir estoque' }} />
        <Stack.Screen name="novo/receita" options={{ title: 'Receita' }} />
        <Stack.Screen name="financeiro/parcela/[id]" options={{ title: 'Parcela' }} />
        <Stack.Screen name="financeiro/baixa" options={{ ...modal, title: 'Registrar baixa' }} />
        <Stack.Screen name="financeiro/contas" options={{ title: 'Contas e saldos' }} />
        <Stack.Screen name="financeiro/conta/[id]" options={{ title: 'Extrato' }} />
        <Stack.Screen name="financeiro/conta/editar" options={{ ...modal, title: 'Conta' }} />
        <Stack.Screen name="financeiro/cadastros" options={{ title: 'Cadastros' }} />
        <Stack.Screen name="financeiro/centros" options={{ title: 'Centros de custo' }} />
        <Stack.Screen name="financeiro/categorias" options={{ title: 'Plano de contas' }} />
        <Stack.Screen name="financeiro/contatos" options={{ title: 'Fornecedores e clientes' }} />
        <Stack.Screen name="financeiro/contato" options={{ ...modal, title: 'Contato' }} />
        <Stack.Screen name="financeiro/movimentar" options={{ ...modal, title: 'Movimentar' }} />
        <Stack.Screen name="financeiro/movimento/[id]" options={{ title: 'Movimentação' }} />
        <Stack.Screen name="financeiro/renegociar" options={{ ...modal, title: 'Renegociar' }} />
        <Stack.Screen name="financeiro/socios" options={{ title: 'Sócios' }} />
        <Stack.Screen name="financeiro/financiamentos" options={{ title: 'Financiamentos' }} />
        <Stack.Screen name="financeiro/financiamento/novo" options={{ ...modal, title: 'Novo financiamento' }} />
        <Stack.Screen name="financeiro/financiamento/[id]" options={{ title: 'Financiamento' }} />
        <Stack.Screen name="financeiro/recorrencias" options={{ title: 'Despesas recorrentes' }} />
        <Stack.Screen name="financeiro/recorrencia" options={{ ...modal, title: 'Despesa recorrente' }} />
        <Stack.Screen name="financeiro/relatorios" options={{ title: 'Relatórios' }} />
        <Stack.Screen name="financeiro/conciliacao" options={{ title: 'Conciliação bancária' }} />
        <Stack.Screen name="financeiro/importar" options={{ title: 'Importar planilha' }} />
        <Stack.Screen name="estoque/index" options={{ title: 'Estoque de insumos' }} />
        <Stack.Screen name="estoque/[id]" options={{ title: '' }} />
        <Stack.Screen name="estoque/insumo" options={{ ...modal, title: 'Insumo' }} />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" options={{ title: 'Confirmar acesso' }} />
      <Stack.Screen name="recuperar-senha" options={{ title: 'Recuperar senha' }} />
    </Stack>
  );
}
