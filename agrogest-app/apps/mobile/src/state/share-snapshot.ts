/**
 * Releitura do banco com compartilhamento estrutural: cada tabela que voltou igual mantém a
 * referência anterior e, se nada mudou, a leitura inteira é a anterior. Assim uma sincronização
 * sem novidade não refaz projeções nem renderiza quem lê `useApp`.
 */

/** Igualdade estrutural de dados lidos do SQLite (primitivos, listas e objetos simples). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!sameValue(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(right, key) || !sameValue(left[key], right[key])) return false;
  }
  return true;
}

/**
 * Preferências que mudam a cada envio e já têm outro dono (o store da sincronização): uma diferença
 * só nelas não conta como dado novo.
 */
const VOLATILE_SETTINGS = ['lastSyncAt'];

function sameSettings(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return sameValue(a, b);
  const strip = (value: object) => Object.fromEntries(Object.entries(value).filter(([key]) => !VOLATILE_SETTINGS.includes(key)));
  return sameValue(strip(a), strip(b));
}

export function shareSnapshot<T extends object>(prev: T | null, next: T): T {
  if (!prev) return next;
  const before = prev as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  let changed = Object.keys(before).length !== Object.keys(after).length;
  const shared: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const same = key === 'settings' ? sameSettings(before[key], after[key]) : sameValue(before[key], after[key]);
    shared[key] = same ? before[key] : after[key];
    if (!same) changed = true;
  }
  return changed ? (shared as T) : prev;
}
