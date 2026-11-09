import type { SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useMemo, useState, type ReactNode, type RefObject } from 'react';

import { ReduceMotionContext } from '@/components/ui/motion';
import * as repo from '@/db/repo';
import type { ActivityItem } from '@/domain/activity';
import { nowISO } from '@/domain/dates';
import type { Mode } from '@/domain/types';

/**
 * Preferências de interface da pessoa: modo do Início, valores escondidos, reduzir animações e
 * atividade vista. Ficam fora do `useApp` para que trocar uma delas renderize só quem as lê: este
 * provedor muda sozinho e o React reaproveita o resto da árvore (o `children` não muda).
 */
export interface Preferences {
  mode: Mode;
  modeChosen: boolean;
  setMode: (mode: Mode) => Promise<void>;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => Promise<void>;
  /** Valores em reais escondidos (o olho do Início e do Financeiro), por pessoa. */
  hideValues: boolean;
  setHideValues: (value: boolean) => Promise<void>;
  /** Ações de outras pessoas desde a última vez que a atividade foi aberta. */
  unseenActivity: number;
  markActivitySeen: () => Promise<void>;
}

const PreferencesContext = createContext<Preferences | null>(null);

export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences precisa estar dentro de AppStateProvider');
  return value;
}

export function PreferencesProvider({
  db, userId, saved, activity, writesRef, loadedSince, children,
}: {
  db: SQLiteDatabase;
  userId: string;
  /** Preferências da última leitura do banco. */
  saved: Record<string, string>;
  activity: ActivityItem[];
  /** Contador de gravações compartilhado com o `AppStateProvider`. */
  writesRef: RefObject<number>;
  /** Gravações até aqui já estão em `saved`: uma leitura nova (ou um banco recriado) prevalece. */
  loadedSince: number;
  children: ReactNode;
}) {
  const [patch, setPatch] = useState<Record<string, { value: string; write: number }>>({});
  const read = (key: string): string | undefined => {
    const local = patch[key];
    return local && local.write > loadedSince ? local.value : saved[key];
  };
  const mode = read(`mode:${userId}`);
  const reduceMotion = read('reduceMotion') === '1';
  const hideValues = read(`hideValues:${userId}`) === '1';
  const seenAt = read(`activitySeenAt:${userId}`) ?? '';
  const unseenActivity = useMemo(
    () => activity.filter((a) => a.actorId !== userId && a.at > seenAt).length,
    [activity, userId, seenAt],
  );

  const value = useMemo<Preferences>(() => {
    const write = async (key: string, next: string) => {
      await repo.setSetting(db, key, next);
      writesRef.current += 1;
      const order = writesRef.current;
      setPatch((current) => ({ ...current, [key]: { value: next, write: order } }));
    };
    return {
      mode: (mode as Mode | undefined) ?? 'essencial',
      modeChosen: mode !== undefined,
      setMode: (next) => write(`mode:${userId}`, next),
      reduceMotion,
      setReduceMotion: (next) => write('reduceMotion', next ? '1' : '0'),
      hideValues,
      setHideValues: (next) => write(`hideValues:${userId}`, next ? '1' : '0'),
      unseenActivity,
      markActivitySeen: () => write(`activitySeenAt:${userId}`, nowISO()),
    };
  }, [db, writesRef, userId, mode, reduceMotion, hideValues, unseenActivity]);

  return (
    <ReduceMotionContext.Provider value={reduceMotion}>
      <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
    </ReduceMotionContext.Provider>
  );
}
