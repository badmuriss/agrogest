import { authStorage } from './auth-storage';
import { API_URL } from './local-config';

export interface AuthUser { id: string; email: string; email_confirmed_at?: string; user_metadata: { name?: string } }
export interface Session { access_token: string; token_type: string; expires_at: number; expires_in: number; user: AuthUser }
export interface ServiceError { message: string; code?: string }
export interface Result<T> { data: T; error: ServiceError | null }
// Only this public address belongs in the bundle. Inference credentials stay in the Worker.
export { API_URL } from './local-config';
export const cloudEnabled = true;
const SESSION_KEY = 'agrogest-worker-local-session-v1';
let session: Session | null | undefined;
const listeners = new Set<(event: string, value: Session | null) => void>();
async function storedSession() {
  if (session === undefined) {
    try { session = JSON.parse(await authStorage.getItem(SESSION_KEY) ?? 'null') as Session | null; }
    catch { session = null; }
  }
  return session;
}
async function remember(next: Session | null, event: string) {
  if (next) await authStorage.setItem(SESSION_KEY, JSON.stringify(next)); else await authStorage.removeItem(SESSION_KEY);
  session = next;
  listeners.forEach((fn) => fn(event, next));
}
export async function apiFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers = new Headers(init.headers);
  const active = token ?? (await storedSession())?.access_token;
  if (active) headers.set('Authorization', `Bearer ${active}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), path.endsWith('/extract') ? 65000 : 15000);
  try { return await fetch(`${API_URL}${path}`, { ...init, headers, signal: init.signal ?? controller.signal }); }
  finally { clearTimeout(timer); }
}
async function request<T>(path: string, input?: unknown): Promise<Result<T | null>> {
  try {
    const response = await apiFetch(path, { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    const result = await response.json();
    return result;
  } catch { return { data: null, error: { message: 'O serviço local está indisponível. Seus dados no aparelho foram preservados.', code: 'network_error' } }; }
}
class RpcRequest implements PromiseLike<Result<any>> {
  private headers = new Headers({ 'Content-Type': 'application/json' });
  private name: string;
  private input?: unknown;
  constructor(name: string, input?: unknown) { this.name = name; this.input = input; }
  setHeader(name: string, value: string) { this.headers.set(name, value); return this; }
  private async send(): Promise<Result<any>> {
    try {
      const response = await apiFetch(`/api/rpc/${this.name}`, { method: 'POST', headers: this.headers, body: JSON.stringify(this.input ?? {}) }, this.headers.get('Authorization')?.replace(/^Bearer /, ''));
      return await response.json();
    } catch { return { data: null, error: { message: 'Não foi possível conectar ao serviço local.', code: 'network_error' } }; }
  }
  then<TResult1 = Result<any>, TResult2 = never>(onfulfilled?: ((value: Result<any>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> { return this.send().then(onfulfilled, onrejected); }
}
const unavailable = async (..._args: unknown[]): Promise<Result<{ session: Session | null }>> => ({ data: { session: null }, error: { message: 'Use uma das contas locais configuradas. Cadastro e recuperação por e-mail aguardam implementação.', code: 'local_auth_only' } });
export const backend = {
  rpc: (name: string, input?: unknown) => new RpcRequest(name, input),
  auth: {
    async getSession() { return { data: { session: await storedSession() }, error: null }; },
    async getUser() {
      const result = await request<{ user: AuthUser }>('/api/auth/user');
      return { data: result.data ?? { user: null as unknown as AuthUser }, error: result.error };
    },
    async signInWithPassword(input: { email: string; password: string }) {
      const result = await request<{ session: Session }>('/api/auth/login', input);
      if (result.data?.session && !result.error) await remember(result.data.session, 'SIGNED_IN');
      return { data: result.data ?? { session: null }, error: result.error };
    },
    signUp: unavailable,
    async signOut(_options?: { scope?: string }) {
      // Best effort server revocation; offline sign-out still isolates this device's account.
      await request('/api/auth/logout', {});
      await remember(null, 'SIGNED_OUT');
      return { error: null };
    },
    onAuthStateChange(callback: (event: string, next: Session | null) => void) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    exchangeCodeForSession: unavailable,
    resend: unavailable,
    resetPasswordForEmail: unavailable,
    updateUser: unavailable,
    startAutoRefresh() {},
    stopAutoRefresh() {},
  },
};
export function requireBackend() { return backend; }
export async function cloudToken(expectedUserId: string) {
  const active = await storedSession();
  if (!active || active.user.id !== expectedUserId) throw new Error('A conta mudou. A fila foi preservada para a conta de origem.');
  return active.access_token;
}
export function authError(error: ServiceError) {
  return new Error(error.message || 'Não foi possível acessar o serviço local.');
}
