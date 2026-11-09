import { router } from 'expo-router';
import { useState } from 'react';

import { FieldInput, FormField, PasswordInput } from '@/components/fields';
import { Alert, AlertText } from '@/components/gluestack/alert';
import { Button, ButtonText } from '@/components/gluestack/button';
import { Text } from '@/components/gluestack/text';
import { Screen } from '@/components/ui/layout';
import { emailError, passwordError } from '@/domain/account';
import { authError, requireSupabase } from '@/services/supabase';
import { authRedirect, useAuth } from '@/state/auth-state';

export default function RecuperarSenhaScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (busy) return;
    const invalid = auth.recovering ? passwordError(password) : emailError(email);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      if (auth.recovering) {
        const { error: updateError } = await requireSupabase().auth.updateUser({ password });
        if (updateError) throw authError(updateError);
        auth.finishRecovery();
        router.replace('/');
      } else {
        const { error: resetError } = await requireSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authRedirect() });
        if (resetError) throw authError(resetError);
        setMessage('Se existir uma conta com esse e-mail, você receberá um link. Abra neste mesmo aparelho para escolher uma nova senha.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <Text size="xl" className="font-semibold">{auth.recovering ? 'Escolha uma nova senha' : 'Vamos recuperar seu acesso'}</Text>
      {auth.recovering ? <FormField label="Nova senha" hint="Pelo menos 8 caracteres."><PasswordInput value={password} onChangeText={setPassword} autoComplete="new-password" /></FormField>
        : <FormField label="E-mail"><FieldInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" /></FormField>}
      {error ? <Alert variant="destructive"><AlertText accessibilityLiveRegion="polite">{error}</AlertText></Alert> : null}
      {message ? <Alert><AlertText accessibilityLiveRegion="polite">{message}</AlertText></Alert> : null}
      <Button size="lg" isDisabled={busy} onPress={save}><ButtonText>{busy ? 'Aguarde…' : auth.recovering ? 'Salvar nova senha' : 'Enviar link'}</ButtonText></Button>
    </Screen>
  );
}
