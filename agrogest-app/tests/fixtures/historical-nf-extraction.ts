/** Historical mock kept only as a test reference. Never imported by the application. */
import { termInstallments } from '@/domain/allocation';
import type { Installment, NfExtraction } from '@/domain/types';

/**
 * Simulação da leitura de nota fiscal por IA. No produto, o arquivo sobe para a API e a
 * extração roda no backend (via OpenRouter), nunca com chave de modelo no aplicativo.
 * Esta interface é o ponto de troca pela integração real.
 */
export const SAMPLE_EXTRACTION: NfExtraction = {
  supplier: 'Casa do Criador Insumos Agropecuários Ltda',
  supplierDoc: '12.345.678/0001-90',
  number: '004.517',
  series: '1',
  issuedAt: '2026-10-10',
  items: [
    {
      description: 'Proteinado 40% (saco 30 kg)',
      quantity: 50,
      unit: 'sc',
      unitPriceCents: 12_500,
      totalCents: 625_000,
    },
    {
      description: 'Sal mineral 80 P (saco 25 kg)',
      quantity: 20,
      unit: 'sc',
      unitPriceCents: 11_500,
      totalCents: 230_000,
    },
  ],
  totalCents: 855_000,
  paymentHint: '30/60 dias',
  confidence: {
    supplier: 'alta',
    number: 'alta',
    issuedAt: 'alta',
    items: 'alta',
    total: 'alta',
    installments: 'baixa',
    farm: 'ausente',
  },
  evidence: {
    installments: 'Texto encontrado na nota: "Cond. pagto: 30/60 dias". Os vencimentos foram calculados a partir da emissão.',
    farm: 'A nota não identifica a fazenda nem a operação de destino.',
  },
};

export async function extractInvoice(_fileName: string): Promise<NfExtraction> {
  await new Promise((resolve) => setTimeout(resolve, 1800));
  return SAMPLE_EXTRACTION;
}

/** Converte a condição de pagamento lida ("30/60 dias") em parcelas sugeridas. */
export function suggestedInstallments(extraction: NfExtraction): Installment[] {
  const terms = (extraction.paymentHint?.match(/\d+/g) ?? []).map(Number).filter((d) => d > 0);
  if (terms.length === 0) return [{ dueDate: extraction.issuedAt, cents: extraction.totalCents }];
  return termInstallments(extraction.totalCents, extraction.issuedAt, terms);
}
