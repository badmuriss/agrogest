import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Note } from '@/components/ui/controls';
import { Screen } from '@/components/ui/layout';
import { BoneLines } from '@/components/ui/skeletons';
import { AppText } from '@/components/ui/text';
import { callbackStage } from '@/domain/auth-callback';
import { useApp } from '@/state/app-state';
import { useAuth } from '@/state/auth-state';

/**
 * Volta do link do e-mail. O provider troca o código e confere a conta no servidor; esta tela só
 * espera, mostra o resultado e segue para o Início quando a verificação dá certo.
 */
export default function AuthCallbackScreen() {
  const auth = useAuth();
  const app = useApp();
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const stage = callbackStage({ recovering: auth.recovering, callbackStatus: auth.callbackStatus, hasSession: !!auth.session });

  useEffect(() => {
    if (stage === 'recovery') router.replace('/recuperar-senha');
    else if (stage === 'done') router.replace('/');
  }, [stage]);

  // Com erro, a sessão deste aparelho pode ser a do link não verificado: sair antes de entrar de novo.
  const signInAgain = async () => {
    setLeaveError(null);
    if (auth.session) {
      setLeaving(true);
      try {
        await app.signOut();
      } catch {
        setLeaveError('Não foi possível sair desta sessão. Confira a conexão e tente de novo.');
        setLeaving(false);
        return;
      }
      setLeaving(false);
    }
    router.replace('/entrar');
  };

  if (stage === 'checking' || stage === 'recovery' || stage === 'done') {
    return (
      <Screen>
        <AppText variant="heading" accessibilityRole="header">Confirmando seu acesso…</AppText>
        <View accessible accessibilityLabel="Verificando o link" accessibilityState={{ busy: true }}>
          <BoneLines lines={3} />
        </View>
        <AppText tone="muted" accessibilityLiveRegion="polite">Estamos conferindo o link com o servidor. Leva só alguns segundos.</AppText>
      </Screen>
    );
  }

  // Link recusado sem trocar a sessão (ex.: tocou de novo num link já usado): quem já estava
  // dentro continua com a própria conta e não precisa sair.
  if (stage === 'error' && auth.callbackStatus === 'rejected' && app.signedIn) {
    return (
      <Screen>
        <AppText variant="heading" accessibilityRole="header">Link não aceito</AppText>
        <Note boxed tone="warning" icon="link-variant-off" title="Este link não vale mais">
          {auth.error ?? 'O link expirou, já foi usado ou foi aberto em outro aparelho.'}
        </Note>
        <AppText tone="muted">Sua conta continua conectada neste aparelho.</AppText>
        <Button title="Ir para o Início" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (stage === 'error') {
    return (
      <Screen>
        <AppText variant="heading" accessibilityRole="header">Não foi possível confirmar</AppText>
        <Note boxed tone="danger" icon="link-variant-off" title="O link não foi aceito">
          {auth.error ?? 'O link expirou, já foi usado ou foi aberto em outro aparelho.'}
        </Note>
        <AppText tone="muted">
          Se você já confirmou o e-mail, entre com seu e-mail e senha. Se não, peça um novo link na tela de cadastro, neste mesmo aparelho.
        </AppText>
        {leaveError ? <Note tone="danger" icon="alert-circle-outline">{leaveError}</Note> : null}
        <Button title={leaving ? 'Saindo…' : 'Entrar com e-mail e senha'} icon="login" disabled={leaving} onPress={signInAgain} />
      </Screen>
    );
  }

  // Sem link em verificação (aberto sem código, ou antes do provider começar): nada avança sozinho.
  return (
    <Screen>
      <AppText variant="heading" accessibilityRole="header">Confirmar acesso</AppText>
      <AppText tone="muted">
        Abra o link do e-mail neste aparelho para confirmar a conta. Se já confirmou, siga por aqui.
      </AppText>
      {auth.session && app.signedIn ? (
        <Button title="Ir para o Início" onPress={() => router.replace('/')} />
      ) : (
        <Button title="Entrar com e-mail e senha" icon="login" variant="secondary" onPress={() => router.replace('/entrar')} />
      )}
    </Screen>
  );
}
