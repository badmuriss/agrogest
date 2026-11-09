const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numberFormats = new Map<number, Intl.NumberFormat>();

export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

/** Formato curto para indicadores: "R$ 48,5 mil". */
export function formatCentsCompact(cents: number): string {
  const reais = cents / 100;
  const abs = Math.abs(reais);
  if (abs >= 1_000_000) return `R$ ${formatNumber(reais / 1_000_000, 1)} mi`;
  if (abs >= 10_000) return `R$ ${formatNumber(reais / 1_000, 1)} mil`;
  return formatCents(cents);
}

/** Sem "R$", para rótulos curtos de gráfico: "2,4 mil", "10 mil", "850". */
export function formatCentsShort(cents: number): string {
  const reais = cents / 100;
  const abs = Math.abs(reais);
  if (abs >= 1_000_000) return `${formatNumber(reais / 1_000_000, 1)} mi`;
  if (abs >= 1_000) return `${formatNumber(reais / 1_000, abs >= 10_000 ? 0 : 1)} mil`;
  return formatNumber(reais);
}

export function formatNumber(value: number, maxDecimals = 0): string {
  let formatter = numberFormats.get(maxDecimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    });
    numberFormats.set(maxDecimals, formatter);
  }
  return formatter.format(value);
}

/** Lê "1.234,5" ou "1234.5"; retorna null se não for número. */
export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '');
  if (!cleaned) return null;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseInteger(text: string): number | null {
  const value = parseDecimal(text);
  return value !== null && Number.isInteger(value) ? value : null;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}
