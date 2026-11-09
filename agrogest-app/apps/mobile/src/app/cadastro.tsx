import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { AuthLayout } from '@/components/auth';
import { EmailConfirmationStep } from '@/components/email-confirmation-step';
import { FieldInput, FormField, PasswordInput } from '@/components/fields';
import { Alert, AlertText } from '@/components/gluestack/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/gluestack/button';
import { Text } from '@/components/gluestack/text';
import { emailError, nameError, PASSWORD_MIN, passwordError } from '@/domain/account';
import { useApp } from '@/state/app-state';
import { usePalette } from '@/theme';

type FieldName = 'name' | 'email' | 'password';

export default function CadastroScreen() {
  const app = useApp();
  const p = usePalette();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ name: false, email: false, password: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Para onde o link foi pedido; fica separado do campo, que pode mudar depois do envio.
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const errors = { name: nameError(name), email: emailError(email), password: passwordError(password) };
  const shown = (field: FieldName) => (touched[field] ? errors[field] : null);
  const touch = (field: FieldName) => setTouched((t) => ({ ...t, [field]: true }));

  const submit = async () => {
    setTouched({ name: true, email: true, password: true });
    if (errors.name || errors.email || errors.password) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await app.signUp({ name, email, password });
      if (result.confirmationRequired) {
        setPassword('');
        setRequestedEmail(email.trim());
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Não deu para criar a conta.');
    } finally { setBusy(false); }
  };

  if (requestedEmail) {
    return (
      <AuthLayout
        title="Confirme seu e-mail"
        subtitle="Falta um passo para ativar a conta."
        switchPrompt="Já confirmou em outro aparelho?"
        switchLabel="Entrar"
        onSwitch={() => router.replace({ pathname: '/entrar', params: { email: requestedEmail } })}>
        <EmailConfirmationStep email={requestedEmail} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Leva menos de um minuto."
      switchPrompt="Já tem conta?"
      switchLabel="Entrar"
      onSwitch={() => router.replace({ pathname: '/entrar', params: email ? { email } : {} })}>
      <FormField label="Seu nome" error={shown('name')}>
        <FieldInput
          value={name}
          onChangeText={setName}
          onBlur={() => name && touch('name')}
          placeholder="Nome e sobrenome"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
      </FormField>
      <FormField label="E-mail" error={shown('email')}>
        <FieldInput
          ref={emailRef}
          value={email}
          onChangeText={setEmail}
          onBlur={() => email && touch('email')}
          placeholder="voce@exemplo.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </FormField>
      <FormField label="Senha" error={shown('password')} hint={`Pelo menos ${PASSWORD_MIN} caracteres.`}>
        <PasswordInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          onBlur={() => password && touch('password')}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </FormField>
      {formError ? (
        <Alert variant="destructive">
          <AlertText accessibilityLiveRegion="polite">{formError}</AlertText>
        </Alert>
      ) : null}
      <Button size="lg" isDisabled={busy} onPress={submit}>
        {busy ? <ButtonSpinner color={p.onAccent} /> : null}
        <ButtonText>{busy ? 'Criando…' : 'Criar conta'}</ButtonText>
      </Button>
      <Text size="sm" className="text-muted-foreground">
        {app.cloudMode ? 'Sua conta usa uma senha pessoal. Confirme o e-mail para começar.' : 'Protótipo local: a senha não é armazenada.'}
      </Text>
    </AuthLayout>
  );
}
