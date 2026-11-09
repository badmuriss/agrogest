import Storage from 'expo-sqlite/kv-store';

/** Leitura síncrona no celular: o tema certo já vale no primeiro quadro. */
export function loadThemeValue(key: string): string | null {
  try {
    return Storage.getItemSync(key);
  } catch {
    return null;
  }
}

export function saveThemeValue(key: string, value: string): void {
  try {
    Storage.setItemSync(key, value);
  } catch {
    // Sem armazenamento, a escolha vale só nesta sessão.
  }
}
