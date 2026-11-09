import type { Session, backend } from './backend';

import { emailError } from '@/domain/account';

type ConfirmationAuth = Pick<typeof backend.auth, 'resend' | 'getSession' | 'getUser'>;
export type ConfirmationStatus = 'idle' | 'awaiting' | 'sending' | 'checking' | 'needs_sign_in' | 'verified' | 'error';
export interface EmailConfirmationState {
  email: string | null;
  status: ConfirmationStatus;
  retryAt: number;
  reason: string | null;
  error: string | null;
}

export const CONFIRMATION_COOLDOWN_MS = 60_000;
const normalize = (email: string) => email.trim().toLowerCase();

export function confirmationFailure(error: unknown): { reason: string; error: string } {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return { reason: 'rate_limited', error: 'Aguarde alguns minutos antes de pedir outro e-mail.' };
  }
  if (code === 'otp_expired' || code === 'flow_state_expired' || code === 'flow_state_not_found' || code === 'bad_code_verifier' || code === 'pkce_code_verifier_not_found' || code === 'validation_failed' || code === 'access_denied') {
    return { reason: 'link_expired', error: 'Este link expirou, já foi usado ou foi aberto em outro aparelho. Peça um novo link ou entre com sua senha.' };
  }
  if (code === 'session_not_found' || code === 'refresh_token_not_found' || code === 'refresh_token_already_used') {
    return { reason: 'session_expired', error: 'Sua sessão expirou. Entre novamente com seu e-mail e senha.' };
  }
  return { reason: 'connection', error: 'Não foi possível concluir. Confira a conexão e tente novamente.' };
}

/** Owns only the pending address and request state; never retains passwords or tokens. */
export function createEmailConfirmation(auth: ConfirmationAuth | null, redirect: () => string) {
  let state: EmailConfirmationState = { email: null, status: 'idle', retryAt: 0, reason: null, error: null };
  let busy = false;
  let pending: Promise<void> = Promise.resolve();
  let finish = () => {};
  const start = () => { busy = true; pending = new Promise<void>((resolve) => { finish = resolve; }); };
  let generation = 0;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<EmailConfirmationState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const failure = (reason: string, error: string) => update({ status: 'error', reason, error });
  const address = (email?: string | null) => email === null ? null : normalize(email ?? state.email ?? '');

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    begin(email: string) {
      generation++;
      update({ email: normalize(email), status: 'awaiting', retryAt: Math.max(state.retryAt, Date.now() + CONFIRMATION_COOLDOWN_MS), reason: null, error: null });
    },
    reset() {
      generation++;
      update({ email: null, status: 'idle', reason: null, error: null });
    },
    async resend(email?: string): Promise<boolean> {
      if (busy) return false;
      const target = address(email)!;
      const invalid = emailError(target);
      if (invalid) { failure('invalid_email', invalid); return false; }
      if (!auth) { failure('unavailable', 'A confirmação por e-mail não está disponível no protótipo local.'); return false; }
      if (Date.now() < state.retryAt) { failure('rate_limited', 'Aguarde antes de pedir outro e-mail.'); return false; }
      start();
      const current = generation;
      // Reserve before delivery, including network failures and concurrent button presses.
      update({ email: target, status: 'sending', retryAt: Date.now() + CONFIRMATION_COOLDOWN_MS, reason: null, error: null });
      try {
        const { error } = await auth.resend({ type: 'signup', email: target, options: { emailRedirectTo: redirect() } });
        if (current !== generation) return false;
        if (error) throw error;
        update({ status: 'awaiting', reason: null, error: null });
        return true;
      } catch (error) {
        if (current === generation) update({ status: 'error', ...confirmationFailure(error) });
        return false;
      } finally { busy = false; finish(); }
    },
    async check(email?: string | null): Promise<Session | null> {
      // A link can return while its resend or a foreground check is still completing.
      while (busy) await pending;
      if (!auth) { failure('unavailable', 'A confirmação por e-mail não está disponível no protótipo local.'); return null; }
      const expected = address(email);
      if (expected) {
        const invalid = emailError(expected);
        if (invalid) { failure('invalid_email', invalid); return null; }
      }
      start();
      const current = generation;
      update({ status: 'checking', reason: null, error: null });
      try {
        const { data, error } = await auth.getSession();
        if (current !== generation) return null;
        if (error) throw error;
        if (!data.session) {
          update({ status: 'needs_sign_in', reason: 'no_session', error: null });
          return null;
        }
        const verified = await auth.getUser();
        if (current !== generation) return null;
        if (verified.error) throw verified.error;
        const latest = await auth.getSession();
        if (current !== generation) return null;
        if (latest.error) throw latest.error;
        const user = verified.data.user;
        if (!latest.data.session || latest.data.session.user.id !== data.session.user.id || user.id !== data.session.user.id) {
          failure('session_changed', 'A conta mudou durante a verificação. Confira o e-mail e entre novamente.');
          return null;
        }
        if (expected && normalize(user.email ?? '') !== expected) {
          failure('email_mismatch', 'A sessão atual pertence a outro e-mail. Entre com o e-mail do cadastro.');
          return null;
        }
        if (!user.email_confirmed_at) {
          failure('not_confirmed', 'Seu e-mail ainda não foi confirmado. Abra o link recebido ou peça outro.');
          return null;
        }
        update({ email: normalize(user.email ?? ''), status: 'verified', reason: null, error: null });
        return { ...latest.data.session, user };
      } catch (error) {
        if (current === generation) update({ status: 'error', ...confirmationFailure(error) });
        return null;
      } finally { busy = false; finish(); }
    },
  };
}

export type AuthCallback = { kind: 'ignore' } | { kind: 'code'; code: string; flowId?: string } | { kind: 'error'; error: string };

/** Only accept this app's exact callback locations, never suffixes or arbitrary token URLs. */
export function parseAuthCallback(url: string, redirect: string): AuthCallback {
  const base = url.split(/[?#]/)[0].replace(/\/$/, '');
  const allowed = [redirect, 'agrogest://auth/callback', 'agrogest:///auth/callback'].map((value) => value.split(/[?#]/)[0].replace(/\/$/, ''));
  if (!allowed.includes(base)) return { kind: 'ignore' };
  const query = new URLSearchParams(url.split('?')[1]?.split('#')[0] ?? '');
  const fragment = new URLSearchParams(url.split('#')[1] ?? '');
  const error = query.get('error_code') ?? fragment.get('error_code') ?? query.get('error') ?? fragment.get('error');
  if (error) return { kind: 'error', error: confirmationFailure({ code: error }).error };
  const code = query.get('code');
  return code ? { kind: 'code', code, flowId: query.get('sb_flow_id') ?? undefined }
    : { kind: 'error', error: 'Este link não contém um código de acesso válido. Peça outro link ou entre com sua senha.' };
}
