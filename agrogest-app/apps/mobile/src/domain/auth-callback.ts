/**
 * Estado do link de confirmação, como `useAuth().callbackStatus` entrega. `error`: o código virou
 * sessão, mas a conta não passou na conferência do servidor. `rejected`: o link foi recusado antes
 * de criar sessão (expirado, já usado, sem código), então a sessão que já existia continua valendo.
 */
export type CallbackStatus = 'idle' | 'checking' | 'success' | 'error' | 'rejected';

/** O que a tela do link mostra, a partir só do que o provider de auth já verificou. */
export type CallbackStage = 'recovery' | 'done' | 'checking' | 'error' | 'idle';

export function callbackStage(input: { recovering: boolean; callbackStatus: CallbackStatus; hasSession: boolean }): CallbackStage {
  if (input.recovering) return 'recovery';
  if (input.callbackStatus === 'error' || input.callbackStatus === 'rejected') return 'error';
  if (input.callbackStatus === 'checking') return 'checking';
  // Sessão sozinha não conclui o link: só o sucesso verificado no servidor.
  if (input.callbackStatus === 'success' && input.hasSession) return 'done';
  return 'idle';
}

/**
 * O app (abas e telas internas) só abre com conta, fora da recuperação de senha e sem link de
 * confirmação em verificação ou com sessão não conferida: a sessão PKCE existe antes da verificação
 * final. Um link recusado não fecha o app de quem já estava dentro.
 */
export function appAccessAllowed(input: { signedIn: boolean; recovering: boolean; callbackStatus: CallbackStatus }): boolean {
  return input.signedIn && !input.recovering && input.callbackStatus !== 'checking' && input.callbackStatus !== 'error';
}
