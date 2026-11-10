import { ensure, type Env } from './contracts.ts';

const loopback = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
export function checkEnvironment(url: URL, env: Env) {
  if (env.APP_ENV === 'local') {
    ensure(url.protocol === 'http:' && loopback(url), 'Esta configuração só executa localmente.', 403);
    return;
  }
  ensure(['staging', 'production'].includes(env.APP_ENV), 'Ambiente não configurado.', 503);
  let expected: URL;
  try { expected = new URL(env.FRONTEND_ORIGIN); } catch { throw new Error('Invalid application origin'); }
  ensure(expected.protocol === 'https:' && !loopback(expected) && expected.origin === env.FRONTEND_ORIGIN, 'Configure a origem HTTPS exata do aplicativo.', 503);
  ensure(url.origin === expected.origin, 'Origem não autorizada para este ambiente.', 403);
  ensure(env.INFERENCE_PROVIDER === 'workers-ai', 'Configure Workers AI para o ambiente hospedado.', 503);
}
export function allowedOrigin(origin: string | null, url: URL, env: Env) {
  if (!origin) return false;
  if (origin === url.origin) return true;
  return env.APP_ENV === 'local' && ['http://localhost:8081', 'http://127.0.0.1:8081'].includes(origin);
}
