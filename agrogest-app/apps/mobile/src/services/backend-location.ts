/** Public endpoints; changing inference never changes the account database namespace. */
export function backendLocation(configured?: string, browserOrigin?: string) {
  const page = browserOrigin ? new URL(browserOrigin) : null;
  const metro = page && ['localhost', '127.0.0.1', '[::1]'].includes(page.hostname) && page.port === '8081';
  const api = new URL(configured?.trim() || (page && !metro ? page.origin : 'http://127.0.0.1:8787'));
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password || api.pathname !== '/' || api.search || api.hash || api.origin.length > 180) throw new Error('EXPO_PUBLIC_API_URL deve ser uma origem HTTP(S), sem caminho ou credenciais.');
  const legacyLocal = api.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(api.hostname) && api.port === '8787';
  // Preserve existing local sessions and databases; hosted backends have distinct caches/outboxes.
  // SecureStore keys only accept letters, numbers, dots, hyphens and underscores.
  const scope = legacyLocal ? 'local' : `server-${encodeURIComponent(api.origin).replace(/_/g, '%5F').replace(/%/g, '_')}`;
  return { url: api.origin, scope, sessionKey: `agrogest-worker-${scope}-session-v1`, async database(userId: string, digest: (value: string) => Promise<string>) {
    if (legacyLocal) return `agrogest-worker-local-${userId}.db`;
    // Expo's web VFS has mxPathname=64, including SQLite's journal suffix. Hash
    // the complete origin/account pair (160 bits) to keep every new path short.
    return `ag-${(await digest(JSON.stringify([api.origin, userId]))).slice(0, 40)}.db`;
  } };
}
