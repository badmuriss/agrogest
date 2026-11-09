import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { ColorSchemeContext, palettes, type ThemePreference } from '@/theme';

import { loadThemeValue, saveThemeValue } from './theme-storage';

const STORAGE_KEY = 'agrogest.theme';

function readPreference(): ThemePreference {
  const value = loadThemeValue(STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

const ThemePreferenceContext = createContext<{
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
} | null>(null);

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);
  if (!value) throw new Error('useThemePreference precisa estar dentro de ThemePreferenceProvider');
  return value;
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const system = useColorScheme();
  const resolved = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  // Teclado, alertas e barra de status nativos acompanham a escolha.
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  // Fundo raiz da janela: sem isso, transições de tela mostram um flash branco no tema escuro.
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.style.colorScheme = resolved;
    SystemUI.setBackgroundColorAsync(palettes[resolved].background).catch(() => {});
  }, [resolved]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    saveThemeValue(STORAGE_KEY, next);
  };

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      <ColorSchemeContext.Provider value={resolved}>{children}</ColorSchemeContext.Provider>
    </ThemePreferenceContext.Provider>
  );
}
