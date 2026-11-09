import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

/** Overlay curto durante uma troca real de pessoa, fazenda ou dados. */
export interface ContextTransition {
  id: number;
  kind: 'farm' | 'overview' | 'user' | 'data';
  eyebrow: string;
  title: string;
  subtitle: string;
}

/**
 * Estado da sincronização: muda a cada envio e não é dado do workspace. Fica num store fora do
 * `useApp` para que "sincronizando" ligar e desligar renderize só o sino, a barra e as telas que
 * mostram a fila, não o app inteiro.
 */
export interface SyncStatus {
  syncing: boolean;
  syncError: string | null;
  /** Comandos na fila para o servidor (modo conectado). */
  pendingCommands: number;
  /** Última sincronização concluída (vem das preferências gravadas). */
  lastSyncAt: string | null;
  transition: ContextTransition | null;
}

export interface SyncStatusStore {
  get: () => SyncStatus;
  update: (change: Partial<SyncStatus> | ((current: SyncStatus) => Partial<SyncStatus>)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSyncStatusStore(): SyncStatusStore {
  let state: SyncStatus = { syncing: false, syncError: null, pendingCommands: 0, lastSyncAt: null, transition: null };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    update: (change) => {
      const patch = typeof change === 'function' ? change(state) : change;
      const next = { ...state, ...patch };
      if ((Object.keys(next) as (keyof SyncStatus)[]).every((key) => next[key] === state[key])) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const SyncStatusContext = createContext<SyncStatusStore | null>(null);

export function SyncStatusProvider({ store, children }: { store: SyncStatusStore; children: ReactNode }) {
  return <SyncStatusContext.Provider value={store}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatus {
  const store = useContext(SyncStatusContext);
  if (!store) throw new Error('useSyncStatus precisa estar dentro de AppStateProvider');
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
