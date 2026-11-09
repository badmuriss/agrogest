/** Uma arroba de carcaça = 15 kg. */
export const KG_PER_ARROBA = 15;

export function carcassArrobas(carcassKg: number): number {
  return carcassKg / KG_PER_ARROBA;
}

/** Receita bruta pelo preço negociado por @ de carcaça (RN-11). */
export function saleGrossCents(carcassKg: number, pricePerArrobaCents: number): number {
  return Math.round((carcassKg * pricePerArrobaCents) / KG_PER_ARROBA);
}

/**
 * Rendimento de carcaça usado só para estimar a arroba de um lote ainda não vendido (o abate real
 * vem na venda, em kg de carcaça). 50% é a referência de mercado para gado de corte em pasto; a
 * tela sempre diz que é estimativa.
 */
export const ESTIMATED_CARCASS_YIELD = 0.5;

/** Arrobas de carcaça estimadas a partir do peso vivo (com o rendimento de referência). */
export function estimatedArrobas(liveKg: number, carcassYield = ESTIMATED_CARCASS_YIELD): number {
  return (liveKg * carcassYield) / KG_PER_ARROBA;
}

/**
 * Preço da @ de carcaça que empata o custo do lote se ele fosse vendido hoje: custo que fica com os
 * animais ÷ arrobas estimadas. Sem cabeça ou sem peso, não há o que dividir (null).
 */
export function breakEvenPerArrobaCents(costCents: number, heads: number, avgLiveKg: number, carcassYield = ESTIMATED_CARCASS_YIELD): number | null {
  const arrobas = estimatedArrobas(heads * avgLiveKg, carcassYield);
  if (!(arrobas > 0) || costCents <= 0) return null;
  return Math.round(costCents / arrobas);
}
