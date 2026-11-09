import type { Farm, Lot, Pasture } from './types';
import type { LotSummary } from './lot-metrics';

export interface TransferLotInput {
  destinationFarmId: string;
  code: string;
  /** Nome do pasto de destino, guardado também em texto para clientes antigos. */
  managementGroup: string;
  /** Pasto da fazenda de destino onde os animais chegam. */
  pastureId: string;
  commandId: string;
  destinationLotId: string;
  expectedHeads: number;
  expectedCostCents: number;
  expectedWeightKg: number;
  date: string;
}

/** The connected server computes the same carry value from approved history. */
export function prepareLotTransfer(summary: LotSummary, source: Farm, destination: Farm, input: TransferLotInput, pasture?: Pasture) {
  if (source.id === destination.id) throw new Error('Escolha uma fazenda diferente da origem.');
  if (summary.lot.transfer?.outgoing) throw new Error('Este lote já foi transferido.');
  if (summary.headsCurrent <= 0) throw new Error('O lote não tem animais para transferir.');
  if (summary.pendingCount > 0) throw new Error('Resolva os lançamentos pendentes do lote antes de transferir.');
  if (!input.code.trim() || !input.pastureId) throw new Error('Informe o código e o pasto de destino.');
  if (!pasture || pasture.farmId !== destination.id || !pasture.active) throw new Error('Escolha um pasto ativo da fazenda de destino.');
  if (summary.headsCurrent !== input.expectedHeads || summary.remainingCostCents !== input.expectedCostCents || summary.lastWeighing.kg !== input.expectedWeightKg) {
    throw new Error('O saldo, custo ou peso mudou. Revise a transferência.');
  }
  const lot: Lot = {
    ...summary.lot, id: input.destinationLotId, operationId: destination.operationId, farmId: destination.id,
    code: input.code.trim(), managementGroup: pasture.name, pastureId: pasture.id, purchasedAt: input.date,
    headsPurchased: summary.headsCurrent, entryWeightKg: summary.lastWeighing.kg,
    purchaseCents: summary.remainingCostCents, commissionCents: 0, freightCents: 0, location: null,
    transfer: { incoming: { sourceLotId: summary.lot.id, farmId: source.id, farmName: source.name, at: input.date, weightMethod: summary.lastWeighing.method } },
  };
  const sourceTransfer: Lot['transfer'] = { ...summary.lot.transfer, outgoing: {
    destinationLotId: lot.id, farmId: destination.id, farmName: destination.name, at: input.date, heads: summary.headsCurrent,
  } };
  return { lot, sourceTransfer };
}
