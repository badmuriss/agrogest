import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from '@/db/schema';

/** SQLiteProvider has not retained the opened connection yet when onInit fails. */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    await migrate(db);
  } catch (error) {
    try { await db.closeAsync(); } catch { /* Preserve the initialization error. */ }
    throw error;
  }
}

export function databaseFailureMessage(error: unknown, web: boolean) {
  const details = typeof error === 'object' && error !== null
    ? `${'name' in error ? String(error.name) : ''} ${'message' in error ? String(error.message) : ''}`
    : String(error);
  const locked = web && /NoModificationAllowedError|createSyncAccessHandle|access handles cannot be created/i.test(details);
  return locked ? {
    title: 'Os dados estão em uso',
    message: 'O navegador ainda pode estar usando os dados de uma abertura anterior. Feche outras abas do AgroGest, se houver, e tente novamente.',
    help: 'Se continuar, feche esta aba e abra o AgroGest de novo. Tentar novamente não apaga seus registros.',
  } : {
    title: 'Não foi possível abrir os dados',
    message: 'Não conseguimos iniciar os dados deste aparelho. Tente novamente para abrir o AgroGest.',
    help: 'Se continuar, feche e abra o AgroGest. Tentar novamente não apaga seus registros.',
  };
}

/** A previous page's OPFS worker can take a moment to release its access handle. */
export function retryTransientWebLock(error: unknown, lastAttempt: number, now: number): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /NoModificationAllowedError|createSyncAccessHandle|access handles cannot be created/i.test(message) && (!lastAttempt || now - lastAttempt > 10_000);
}
