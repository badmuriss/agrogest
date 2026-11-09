import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react';
import { Platform } from 'react-native';

/**
 * Contadores de desenvolvimento na web para medir renderizações (docs/PERFORMANCE.md). Leia e
 * zere em `globalThis.__agrogestPerf` pelo console. Fora do desenvolvimento web, não existe.
 */
export interface PerfProbe {
  /** Chamadas de `useApp`: cada uma é um componente que renderizou lendo o estado do app. */
  useApp: number;
  commits: number;
  /** Soma do tempo de renderização (actualDuration) dos commits medidos, em ms. */
  renderMs: number;
  /** Momento do primeiro commit das abas, em ms desde o início da página. */
  firstScreenMs: number | null;
  reset: () => void;
}

const enabled = __DEV__ && Platform.OS === 'web';

function createProbe(): PerfProbe {
  const probe: PerfProbe = {
    useApp: 0, commits: 0, renderMs: 0, firstScreenMs: null,
    reset: () => { probe.useApp = 0; probe.commits = 0; probe.renderMs = 0; },
  };
  return probe;
}

const perfProbe: PerfProbe | null = enabled
  ? ((globalThis as { __agrogestPerf?: PerfProbe }).__agrogestPerf ??= createProbe())
  : null;

/** Conta uma leitura de `useApp` (um componente renderizando com o estado do app). */
export function countAppRead() {
  if (perfProbe) perfProbe.useApp += 1;
}

const onProfilerRender: ProfilerOnRenderCallback = (id, phase, actualDuration, _base, _start, commitTime) => {
  if (!perfProbe) return;
  perfProbe.commits += 1;
  perfProbe.renderMs += actualDuration;
  if (id === 'tabs' && phase === 'mount' && perfProbe.firstScreenMs === null) perfProbe.firstScreenMs = commitTime;
};

/** Mede a árvore abaixo só no desenvolvimento web; no app instalado devolve os filhos direto. */
export function PerfBoundary({ id, children }: { id: string; children: ReactNode }) {
  return perfProbe ? <Profiler id={id} onRender={onProfilerRender}>{children}</Profiler> : children;
}
