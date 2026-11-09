import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, ButtonSpinner, ButtonText } from '@/components/gluestack/button';
import { Card } from '@/components/gluestack/card';
import { HStack } from '@/components/gluestack/hstack';
import { Text } from '@/components/gluestack/text';
import { VStack } from '@/components/gluestack/vstack';
import { Note } from '@/components/ui/controls';
import { haptics } from '@/components/ui/motion';
import { IconTile } from '@/components/ui/text';
import { useAuth } from '@/state/auth-state';
import { usePalette } from '@/theme';

/** Segundos até poder reenviar, recalculados do relógio a cada segundo (e ao voltar para o app). */
function useSecondsUntil(at: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [at, now]);
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/**
 * Depois do cadastro com confirmação exigida: para onde o link foi, reenviar, o que fazer com
 * e-mail errado e "Já confirmei", que só segue com sessão verificada no servidor.
 */
export function EmailConfirmationStep({ email }: { email: string }) {
  const auth = useAuth();
  const p = usePalette();
  const { status, retryAt, error } = auth.confirmation;
  const target = auth.confirmation.email ?? email;
  const wait = useSecondsUntil(retryAt);
  const [resent, setResent] = useState(false);
  const [wrongEmail, setWrongEmail] = useState(false);
  const sending = status === 'sending';
  const checking = status === 'checking';
  const busy = sending || checking;

  const resend = async () => {
    haptics.tap();
    setResent(false);
    setResent(await auth.resendConfirmation(target));
  };

  // Com a confirmação verificada no servidor a sessão já existe: a navegação protegida do
  // layout leva ao Início sozinha. Aqui só se confirma o resultado; sem sessão, nada avança.
  const confirm = async () => {
    haptics.tap();
    setResent(false);
    if (await auth.checkConfirmation(target)) haptics.success();
  };

  return (
    <VStack className="gap-4">
      <Card className="gap-3">
        <HStack className="items-center gap-3">
          <IconTile name="email-check-outline" size={44} tone="accent" />
          <VStack className="flex-1 gap-px">
            <Text className="text-muted-foreground">Enviamos um link de confirmação para</Text>
            <Text className="font-semibold" selectable>
              {target}
            </Text>
          </VStack>
        </HStack>
        <Text size="sm" className="text-muted-foreground">
          Abra o e-mail neste aparelho e toque no link. Depois volte aqui e continue. Se não chegar em alguns minutos, confira o spam.
        </Text>
      </Card>

      {status === 'verified' ? (
        <Note boxed tone="success" icon="check-circle-outline" title="E-mail confirmado">
          Abrindo sua conta…
        </Note>
      ) : status === 'needs_sign_in' ? (
        <Note boxed tone="warning" icon="login" title="Entre para continuar">
          {error ?? 'Não encontramos uma sessão confirmada neste aparelho. Se você já abriu o link, entre com seu e-mail e senha.'}
        </Note>
      ) : status === 'error' && error ? (
        <Note boxed tone="danger" icon="alert-circle-outline" title="Não foi possível concluir">
          {error}
        </Note>
      ) : status === 'awaiting' && error ? (
        <Note boxed tone="warning" icon="email-alert-outline" title="Ainda não confirmado">
          {error}
        </Note>
      ) : resent ? (
        <Note boxed tone="success" icon="email-fast-outline" title="Pedido de reenvio feito">
          Se a conta estiver aguardando confirmação, um novo link vai para {target}.
        </Note>
      ) : null}

      {status === 'needs_sign_in' ? (
        <Button size="lg" onPress={() => router.replace({ pathname: '/entrar', params: { email: target } })}>
          <ButtonText>Entrar com {target}</ButtonText>
        </Button>
      ) : (
        <Button size="lg" isDisabled={busy || status === 'verified'} onPress={confirm}>
          {checking ? <ButtonSpinner color={p.onAccent} /> : null}
          <ButtonText>{checking ? 'Verificando…' : 'Já confirmei, continuar'}</ButtonText>
        </Button>
      )}

      <Button
        variant="secondary"
        isDisabled={busy || wait > 0}
        onPress={resend}
        accessibilityLabel={wait > 0 ? `Reenviar e-mail, disponível em ${wait} segundos` : 'Reenviar e-mail'}>
        {sending ? <ButtonSpinner /> : null}
        <ButtonText>{sending ? 'Reenviando…' : wait > 0 ? `Reenviar e-mail em ${wait} s` : 'Reenviar e-mail'}</ButtonText>
      </Button>

      <Button variant="ghost" aria-expanded={wrongEmail} onPress={() => setWrongEmail((v) => !v)}>
        <ButtonText className="text-primary">Digitei o e-mail errado</ButtonText>
      </Button>
      {wrongEmail ? (
        <VStack className="gap-3">
          <Note boxed icon="information-outline" title="O e-mail desta conta não muda por aqui">
            Uma conta que ainda não foi confirmada fica com o endereço {target}, e nada aqui vai trocá-lo. Se você já tem conta no e-mail certo, entre por ela.
          </Note>
          <Button variant="secondary" onPress={() => router.replace('/entrar')}>
            <ButtonText>Entrar com outro e-mail</ButtonText>
          </Button>
        </VStack>
      ) : null}
    </VStack>
  );
}
