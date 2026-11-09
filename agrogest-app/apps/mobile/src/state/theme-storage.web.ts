// Na web, o SQLite (OPFS) tem poucos arquivos abertos por origem; o tema vai para o localStorage.
export function loadThemeValue(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function saveThemeValue(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Sem armazenamento, a escolha vale só nesta sessão.
  }
}
