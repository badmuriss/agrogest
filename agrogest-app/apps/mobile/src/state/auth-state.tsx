import type { Session } from '@/services/backend';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { CallbackStatus } from '@/domain/auth-callback';
import { supabase } from '@/services/supabase';
import { confirmationFailure, createEmailConfirmation, parseAuthCallback, type EmailConfirmationState } from '@/services/email-confirmation';

interface AuthState {
  ready: boolean;
  session: Session | null;
  recovering: boolean;
  finishRecovery: () => void;
  error: string | null;
  clearError: () => void;
  callbackStatus: CallbackStatus;
  confirmation: EmailConfirmationState;
  beginConfirmation: (email: string) => void;
  resendConfirmation: (email?: string) => Promise<boolean>;
  checkConfirmation: (email?: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);
export const authRedirect = () => Linking.createURL('/auth/callback');

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callbackStatus, setCallbackStatus] = useState<AuthState['callbackStatus']>('idle');
  const [confirmationFlow] = useState(() => createEmailConfirmation(supabase?.auth ?? null, authRedirect));
  const confirmation = useSyncExternalStore(confirmationFlow.subscribe, confirmationFlow.getSnapshot, confirmationFlow.getSnapshot);
  const checkConfirmation = useCallback(async (email?: string) => {
    const verified = await confirmationFlow.check(email);
    if (!verified) return false;
    setSession(verified);
    setError(null);
    setCallbackStatus('success');
    return true;
  }, [confirmationFlow]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let sessionRevision = 0;
    let callbackInFlight = false;
    const { data: listener } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      sessionRevision++;
      setSession(next);
      setReady(true);
      if (event === 'SIGNED_IN') {
        setError(null);
        if (!callbackInFlight) setCallbackStatus('idle');
      }
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') {
        setRecovering(false);
        confirmationFlow.reset();
      }
    });
    const initialRevision = sessionRevision;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || sessionRevision !== initialRevision) return;
      if (sessionError) setError('Não foi possível recuperar sua sessão. Entre novamente.');
      setSession(data.session);
      setReady(true);
    }).catch(() => {
      if (active && sessionRevision === initialRevision) { setError('Não foi possível recuperar sua sessão. Tente entrar novamente.'); setReady(true); }
    });

    // PKCE callbacks are consumed once. Never accept arbitrary tokens from a URL.
    let lastExchange: { code: string; userId: string } | null = null;
    let verifiedCode = '';
    const handleURL = async (url: string) => {
      const callback = parseAuthCallback(url, authRedirect());
      if (!active || callback.kind === 'ignore') return;
      if (callback.kind === 'error') {
        setCallbackStatus('rejected');
        setError(callback.error);
        return;
      }
      if (callback.code === verifiedCode || callbackInFlight) return;
      callbackInFlight = true;
      setCallbackStatus('checking');
      setError(null);
      try {
        if (lastExchange?.code !== callback.code) {
          const { data: exchanged, error: callbackError } = await client.auth.exchangeCodeForSession(callback.code,
            callback.flowId === undefined ? undefined : { flowId: callback.flowId });
          if (!active) return;
          if (callbackError) throw callbackError;
          if (!exchanged.session) throw new Error('Missing session');
          // Retrying a failed getUser must not consume an already exchanged PKCE code again.
          lastExchange = { code: callback.code, userId: exchanged.session.user.id };
        }
        // PKCE creates a session, but only the server-verified user completes confirmation.
        const verified = await confirmationFlow.check(null);
        if (!active) return;
        if (!verified || verified.user.id !== lastExchange.userId) {
          setCallbackStatus('error');
          setError(confirmationFlow.getSnapshot().error ?? 'Não há uma sessão confirmada. Entre com seu e-mail e senha.');
          return;
        }
        verifiedCode = callback.code;
        setSession(verified);
        setCallbackStatus('success');
        setError(null);
      } catch (cause) {
        // Só a troca do código lança aqui: falhou antes de criar sessão, a anterior segue válida.
        if (active) { setCallbackStatus('rejected'); setError(confirmationFailure(cause).error); }
      } finally { callbackInFlight = false; }
    };
    void Linking.getInitialURL().then((url) => { if (url) void handleURL(url); }).catch(() => {});
    const links = Linking.addEventListener('url', ({ url }) => { void handleURL(url); });
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    const lifecycle = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        client.auth.startAutoRefresh();
        const pending = confirmationFlow.getSnapshot();
        if (!callbackInFlight && pending.email && pending.status !== 'verified') void checkConfirmation();
      }
      else client.auth.stopAutoRefresh();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      links.remove();
      lifecycle.remove();
      client.auth.stopAutoRefresh();
    };
  }, [checkConfirmation, confirmationFlow]);

  return <AuthContext.Provider value={{
    ready, session, recovering, finishRecovery: () => setRecovering(false), error, clearError: () => setError(null),
    callbackStatus, confirmation, beginConfirmation: confirmationFlow.begin,
    resendConfirmation: confirmationFlow.resend, checkConfirmation,
  }}>{children}</AuthContext.Provider>;
}
