import { createContext, useContext, useState, type ReactNode } from 'react';

import { loadThemeValue, saveThemeValue } from './theme-storage';

export type BrandVersion = 'v1' | 'v2';
const STORAGE_KEY = 'agrogest.brand-version';

const BrandPreferenceContext = createContext<{
  version: BrandVersion;
  setVersion: (version: BrandVersion) => void;
} | null>(null);

export function useBrandPreference() {
  const value = useContext(BrandPreferenceContext);
  if (!value) throw new Error('useBrandPreference precisa estar dentro de BrandPreferenceProvider');
  return value;
}

export function BrandPreferenceProvider({ children }: { children: ReactNode }) {
  const [version, setVersionState] = useState<BrandVersion>(() =>
    loadThemeValue(STORAGE_KEY) === 'v1' ? 'v1' : 'v2',
  );
  const setVersion = (next: BrandVersion) => {
    setVersionState(next);
    saveThemeValue(STORAGE_KEY, next);
  };
  return <BrandPreferenceContext.Provider value={{ version, setVersion }}>{children}</BrandPreferenceContext.Provider>;
}
