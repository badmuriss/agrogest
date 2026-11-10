import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { AuthLayout } from '@/components/auth';
import { FieldInput, FormField, PasswordInput } from '@/components/fields';
import { Alert, AlertText } from '@/components/gluestack/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/gluestack/button';
import { Text } from '@/components/gluestack/text';
import { VStack } from '@/components/gluestack/vstack';
import { haptics } from '@/components/ui/motion';
import { Icon } from '@/components/ui/text';
import { emailError } from '@/domain/account';
import { useApp } from '@/state/app-state';
import { usePalette } from '@/theme';

export default function EntrarScreen() {
  const app = useApp();
  const p = usePalette();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const errors = { email: emailError(email), password: password ? null : 'Informe a senha.' };
  const shown = (field: 'email' | 'password') => (touched[field] ? errors[field] : null);

  const submit = async () => {
    setTouched({ email: true, password: true });
    if (errors.email || errors.password) return;
    setBusy(true);
    setFormError(null);
    try {
      await app.signIn({ email, password });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Entre com sua conta para acompanhar a operação."
      switchPrompt="Contas locais de demonstração"
      switchLabel="Ver ajuda"
      onSwitch={() => router.push('/ajuda')}>
      <FormField label="E-mail" error={shown('email')}>
        <FieldInput
          value={email}
          onChangeText={setEmail}
          onBlur={() => email && setTouched((t) => ({ ...t, email: true }))}
          placeholder="voce@exemplo.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </FormField>
      <FormField
        label="Senha"
        error={shown('password')}
        right={
          <Button
            variant="link"
            size="sm"
            className="min-h-0 px-0"
            hitSlop={12}
            onPress={() => {
              haptics.tap();
              if (app.cloudMode) router.push('/recuperar-senha');
              else setForgot((v) => !v);
            }}>
            <ButtonText className="text-[13px]">Esqueci a senha</ButtonText>
          </Button>
        }>
        <PasswordInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </FormField>
      {forgot ? (
        <Alert>
          <Icon name="email-fast-outline" size={20} color={p.accent} />
          <VStack className="flex-1 gap-0.5">
            <Text className="font-semibold">Recuperar senha</Text>
            <Text size="sm" className="text-muted-foreground">
              {email && !errors.email
                ? `Quando o login estiver ativo, enviaremos um link para ${email.trim()}.`
                : 'Quando o login estiver ativo, enviaremos um link para o seu e-mail.'}
            </Text>
          </VStack>
        </Alert>
      ) : null}
      {formError ? <Alert variant="destructive"><AlertText accessibilityLiveRegion="polite">{formError}</AlertText></Alert> : null}
      <Button size="lg" isDisabled={busy} onPress={submit}>
        {busy ? <ButtonSpinner color={p.onAccent} /> : null}
        <ButtonText>{busy ? 'Entrando…' : 'Entrar'}</ButtonText>
      </Button>
      <Text size="sm" className="text-center text-muted-foreground">
        {app.cloudMode ? 'Seus dados ficam disponíveis apenas para as pessoas autorizadas em cada operação.' : 'Protótipo: qualquer e-mail e senha entram, e a conta fica só neste aparelho.'}
      </Text>
    </AuthLayout>
  );
}
