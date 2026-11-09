import type { Entry, EntryStatus } from './types';

/** Lançamentos que já contam (ou vão contar) contra o saldo do lote. O servidor aplica a mesma regra. */
const BINDING: EntryStatus[] = ['aprovado', 'aguardando_aprovacao', 'aguardando_envio'];

export interface LotEditLimits {
  /** Cabeças já vendidas, mortas ou aguardando: a compra não pode ficar abaixo disso. */
  minHeads: number;
  /** Data do primeiro lançamento do lote: a entrada não pode ser depois dela. */
  latestPurchasedAt: string | null;
}

export function lotEditLimits(lotId: string, entries: Entry[]): LotEditLimits {
  let minHeads = 0;
  let latestPurchasedAt: string | null = null;
  for (const entry of entries) {
    if (!BINDING.includes(entry.status)) continue;
    if (entry.kind !== 'pesagem' && entry.kind !== 'mortalidade' && entry.kind !== 'venda' && entry.kind !== 'manejo') continue;
    if (entry.payload.lotId !== lotId) continue;
    // Movimentação entre pastos não tira cabeças do lote, mas fixa a data mínima.
    if (entry.kind === 'mortalidade' || entry.kind === 'venda') minHeads += entry.payload.heads;
    if (latestPurchasedAt === null || entry.occurredAt < latestPurchasedAt) latestPurchasedAt = entry.occurredAt;
  }
  return { minHeads, latestPurchasedAt };
}
