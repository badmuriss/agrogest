import { ApiError, ensure, type Env } from './contracts.ts';
export const digest = async (bytes: BufferSource) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((b) => b.toString(16).padStart(2, '0')).join('');
export const hashToken = (token: string) => digest(new TextEncoder().encode(token));
export interface Actor { id: string; email: string; name: string; tokenHash: string }
const isDemo = (user: { id: string; email: string }) => user.id.startsWith('gs-') || user.email.endsWith('@agrogest.local');
export async function authenticate(request: Request, env: Env): Promise<Actor> {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-zA-Z0-9_-]{40,128})$/)?.[1];
  ensure(token, 'Entre com sua conta para continuar.', 401, 'session_not_found');
  const tokenHash = await hashToken(token);
  const user = await env.DB.prepare('SELECT i.id,i.email,i.name FROM sessions s JOIN identities i ON i.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND i.confirmed=1').bind(tokenHash, Date.now()).first<{ id: string; email: string; name: string }>();
  ensure(user, 'Sua sessão expirou. Entre novamente.', 401, 'session_not_found');
  ensure(env.APP_ENV === 'local' || !isDemo(user), 'Contas de demonstração são exclusivas do ambiente local.', 403);
  return { ...user, tokenHash };
}
export const publicUser = (a: { id: string; email: string; name: string }) => ({ id: a.id, email: a.email, email_confirmed_at: '2026-11-06T00:00:00.000Z', user_metadata: { name: a.name } });
const attempts = new Map<string, { count: number; until: number }>();
export async function login(env: Env, input: any) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  ensure(email.length < 255 && typeof input.password === 'string' && input.password.length >= 8 && input.password.length <= 128, 'E-mail ou senha incorretos.', 401, 'invalid_credentials');
  const key = await hashToken(email), old = attempts.get(key);
  const attempt = old && old.until > Date.now() ? old : { count: 0, until: Date.now() + 60_000 };
  attempts.set(key, attempt);
  ensure(++attempt.count <= 20, 'Aguarde um minuto antes de tentar novamente.', 429, 'over_request_rate_limit');
  if (attempts.size > 1000) for (const [k, v] of attempts) if (v.until < Date.now()) attempts.delete(k);
  const row = await env.DB.prepare('SELECT * FROM identities WHERE email=?').bind(email).first<{ id: string; email: string; name: string; password_hash: string; password_salt: string; confirmed: number }>();
  const salt = new TextEncoder().encode(row?.password_salt ?? 'unknown-local-identity');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.password), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, material, 256);
  const hex = Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const expected = row?.password_hash ?? '0'.repeat(64);
  let difference = 0; for (let i = 0; i < 64; i++) difference |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  if (!row || difference) throw new ApiError('E-mail ou senha incorretos.', 401, 'invalid_credentials');
  ensure(env.APP_ENV === 'local' || !isDemo(row) && input.password !== 'AgroGest2026!', 'Contas e senhas públicas de demonstração são exclusivas do ambiente local.', 403);
  ensure(row.confirmed, 'Confirme seu e-mail.', 403, 'email_not_confirmed');
  attempts.delete(key);
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(48)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const expires = Date.now() + 7 * 24 * 3600_000;
  await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()), env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hashToken(token), row.id, expires)]);
  return { access_token: token, token_type: 'bearer', expires_in: 604800, expires_at: Math.floor(expires / 1000), user: publicUser(row) };
}
