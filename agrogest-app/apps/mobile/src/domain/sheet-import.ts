import { detectSeparator, parseAmount, splitCsvLine } from './bank-import';
import { parseBRDate } from './dates';
import type { LedgerCategory, PaymentDirection } from './types';

/**
 * Modelo da planilha de importação (CSV com `;`). Uma linha por parcela em aberto, ou por saldo
 * inicial de conta (tipo "saldo": descrição = nome da conta, valor = saldo, data = data do saldo).
 */
export const SHEET_TEMPLATE = [
  'tipo;descricao;fornecedor_ou_cliente;vencimento;valor;categoria;competencia',
  'pagar;Ração de setembro;Casa do Campo;15/11/2026;3.500,00;Alimentação e insumos;20/09/2026',
  'receber;Venda do lote 07 (2ª parcela);Frigorífico Boi Bom;30/11/2026;48.200,00;;',
  'saldo;Banco do Brasil;;01/10/2026;12.345,67;;',
].join('\n');

export interface SheetTitleRow {
  kind: 'titulo';
  line: number;
  direction: PaymentDirection;
  title: string;
  counterparty: string;
  dueDate: string;
  cents: number;
  categoryId: string | null;
  occurredAt: string;
  /** Mesma linha importada de novo tem a mesma chave e não duplica. */
  importKey: string;
}

export interface SheetBalanceRow {
  kind: 'saldo';
  line: number;
  name: string;
  date: string;
  cents: number;
}

export type SheetRow = SheetTitleRow | SheetBalanceRow;

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function date(text: string): string | null {
  const t = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return parseBRDate(t);
}

/** Lê a planilha; cada linha inválida vira um erro com o número da linha, as outras seguem. */
export function parseSheet(text: string, categories: LedgerCategory[]): { rows: SheetRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const nonEmpty = lines.map((l, i) => ({ l, i: i + 1 })).filter((x) => x.l.trim() !== '');
  if (nonEmpty.length < 2) return { rows: [], errors: ['A planilha não tem linhas além do cabeçalho.'] };
  const separator = detectSeparator(nonEmpty[0].l);
  const header = splitCsvLine(nonEmpty[0].l, separator).map(normalize);
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.startsWith(n)));
  const c = {
    kind: col('tipo'),
    title: col('descri'),
    counterparty: col('fornecedor', 'cliente', 'contato'),
    due: col('vencimento', 'data'),
    value: col('valor'),
    category: col('categoria'),
    occurred: col('competencia'),
  };
  if (c.kind < 0 || c.title < 0 || c.due < 0 || c.value < 0) {
    return { rows: [], errors: ['Use o cabeçalho do modelo: tipo, descricao, fornecedor_ou_cliente, vencimento, valor, categoria, competencia.'] };
  }
  const rows: SheetRow[] = [];
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const { l, i } of nonEmpty.slice(1)) {
    const cells = splitCsvLine(l, separator);
    const get = (index: number) => (index >= 0 ? (cells[index] ?? '').trim() : '');
    const kind = normalize(get(c.kind));
    const cents = parseAmount(get(c.value));
    const due = date(get(c.due));
    const title = get(c.title).slice(0, 150);
    if (!title) {
      errors.push(`Linha ${i}: falta a descrição.`);
      continue;
    }
    if (!due) {
      errors.push(`Linha ${i}: data inválida (use dd/mm/aaaa).`);
      continue;
    }
    if (cents === null) {
      errors.push(`Linha ${i}: valor inválido.`);
      continue;
    }
    if (kind === 'saldo') {
      rows.push({ kind: 'saldo', line: i, name: title.slice(0, 100), date: due, cents });
      continue;
    }
    const direction: PaymentDirection | null = kind.startsWith('pag') ? 'pagar' : kind.startsWith('rec') ? 'receber' : null;
    if (!direction) {
      errors.push(`Linha ${i}: tipo deve ser pagar, receber ou saldo.`);
      continue;
    }
    if (cents <= 0) {
      errors.push(`Linha ${i}: o valor da parcela precisa ser maior que zero.`);
      continue;
    }
    const categoryName = normalize(get(c.category));
    const category = categoryName ? categories.find((x) => normalize(x.name) === categoryName) : undefined;
    if (categoryName && !category) {
      errors.push(`Linha ${i}: categoria "${get(c.category)}" não existe no plano de contas; a linha entra sem categoria.`);
    }
    const occurredAt = date(get(c.occurred)) ?? due;
    const counterparty = get(c.counterparty).slice(0, 150);
    const importKey = [direction, normalize(title), normalize(counterparty), due, cents].join('|').slice(0, 300);
    if (keys.has(importKey)) {
      errors.push(`Linha ${i}: repetida na planilha; entra uma vez só.`);
      continue;
    }
    keys.add(importKey);
    rows.push({ kind: 'titulo', line: i, direction, title, counterparty, dueDate: due, cents, categoryId: category?.id ?? null, occurredAt, importKey });
  }
  return { rows, errors };
}
