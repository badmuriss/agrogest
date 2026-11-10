import { formatDate } from './dates';
import { METHOD_LABEL, NATURE_LABEL, paymentTotal, STATE_LABEL, categoryOf, indexInstallments, installmentId } from './finance';
import { formatCents } from './format';
import { GROUP_LABEL, buildDre, cashLines, resultToCashBridge, type FinanceBook, type Period } from './reports';
import { MOVEMENT_LABEL } from './treasury';
import type { Entry } from './types';

/** Uma célula: texto, número, ou valor em centavos (vira reais com duas casas). */
export type Cell = string | number | { cents: number } | null;

export interface Sheet {
  name: string;
  rows: Cell[][];
}

const money = (cents: number): Cell => ({ cents });

function csvCell(cell: Cell): string {
  if (cell === null) return '';
  if (typeof cell === 'object') return (cell.cents / 100).toFixed(2).replace('.', ',');
  if (typeof cell === 'number') return String(cell).replace('.', ',');
  return /[;"\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** CSV com `;` e vírgula decimal (abre direto no Excel em português), com BOM para os acentos. */
export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Planilha do Excel (XML Spreadsheet 2003, .xls) com várias abas, sem biblioteca. Excel, LibreOffice
 * e Google Planilhas abrem; valores saem como números.
 */
export function toSpreadsheet(sheets: Sheet[]): string {
  const cell = (c: Cell) => {
    if (c === null) return '<Cell/>';
    if (typeof c === 'object') return `<Cell ss:StyleID="money"><Data ss:Type="Number">${(c.cents / 100).toFixed(2)}</Data></Cell>`;
    if (typeof c === 'number') return `<Cell><Data ss:Type="Number">${c}</Data></Cell>`;
    return `<Cell><Data ss:Type="String">${xml(c)}</Data></Cell>`;
  };
  const body = sheets
    .map((s) => `<Worksheet ss:Name="${xml(s.name.slice(0, 31))}"><Table>${s.rows
      .map((r, i) => `<Row${i === 0 ? ' ss:StyleID="head"' : ''}>${r.map(cell).join('')}</Row>`)
      .join('')}</Table></Worksheet>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="head"><Font ss:Bold="1"/></Style><Style ss:ID="money"><NumberFormat ss:Format="#,##0.00"/></Style></Styles>
${body}
</Workbook>`;
}

export interface ExportNames {
  user: (id: string) => string;
  account: (id: string | null) => string;
  farm: (id: string) => string;
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  aguardando_envio: 'Esperando internet',
  efetivado: 'Efetivada',
  conflito: 'Conflito',
  estornado: 'Estornada',
  descartado: 'Descartada',
};

/** DRE em linhas de planilha. */
export function dreSheet(book: FinanceBook, period: Period): Sheet {
  const dre = buildDre(book, period);
  const rows: Cell[][] = [[`DRE gerencial · ${formatDate(period.from)} a ${formatDate(period.to)}`, 'Valor (R$)']];
  for (const line of dre.lines) {
    rows.push([line.label, money(line.cents)]);
    for (const d of line.details ?? []) rows.push([`   ${d.label}`, money(line.key === 'financeiro' ? d.cents : d.cents * (line.cents < 0 ? -1 : 1))]);
  }
  if (dre.outsideResult.length > 0) {
    rows.push([null, null], ['Fora do resultado (competência)', null]);
    for (const x of dre.outsideResult) rows.push([`   ${x.label}`, money(x.cents)]);
  }
  const bridge = resultToCashBridge(book, period);
  rows.push([null, null], ['Do resultado ao caixa', 'Resultado', 'Caixa', 'Diferença']);
  for (const r of bridge.rows) rows.push([GROUP_LABEL[r.group], money(r.resultCents), money(r.cashCents), money(r.differenceCents)]);
  rows.push(['Total', money(bridge.resultCents), money(bridge.cashCents), money(bridge.cashCents - bridge.resultCents)]);
  return { name: 'DRE', rows };
}

/**
 * Pacote para o contador do período: lançamentos financeiros, parcelas, baixas (com o comprovante),
 * movimentações, fluxo de caixa realizado e DRE, cada um numa aba.
 */
export function accountantPackage(book: FinanceBook, period: Period, names: ExportNames): Sheet[] {
  const inPeriod = (d: string) => d >= period.from && d <= period.to;
  const viewsById = indexInstallments(book.views);
  const entries = book.entries.filter(
    (e): e is Extract<Entry, { kind: 'despesa' | 'venda' | 'receita' | 'nota_fiscal' }> =>
      (e.kind === 'despesa' || e.kind === 'venda' || e.kind === 'receita' || e.kind === 'nota_fiscal') && book.farmIds.has(e.farmId) && inPeriod(e.occurredAt),
  );
  const lancamentos: Cell[][] = [['Competência', 'Tipo', 'Descrição', 'Categoria', 'Natureza', 'Fornecedor/cliente', 'Documento', 'Valor', 'Situação', 'Fazenda', 'Autor']];
  for (const e of entries) {
    const category =
      e.kind === 'despesa' || e.kind === 'receita' ? categoryOf(e.payload, book.categories) : undefined;
    const counterparty = e.kind === 'despesa' ? e.payload.supplier : e.kind === 'venda' ? e.payload.buyer : e.kind === 'receita' ? e.payload.counterparty : e.payload.extraction?.supplier ?? '';
    const document = e.kind === 'despesa' || e.kind === 'receita' ? e.payload.document : e.kind === 'nota_fiscal' ? e.payload.extraction?.number ?? '' : '';
    lancamentos.push([
      formatDate(e.occurredAt),
      e.kind === 'venda' ? 'Venda de animais' : e.kind === 'receita' ? 'Receita' : e.kind === 'nota_fiscal' ? 'Nota fiscal' : 'Despesa',
      e.title,
      category?.name ?? (e.kind === 'despesa' ? e.payload.category : e.kind === 'venda' ? 'Venda de animais' : ''),
      category ? NATURE_LABEL[category.nature] : e.kind === 'venda' ? NATURE_LABEL.receita_operacional : '',
      counterparty,
      document,
      money(e.amountCents ?? 0),
      e.status,
      names.farm(e.farmId),
      names.user(e.authorId),
    ]);
  }
  const parcelas: Cell[][] = [['Vencimento', 'Direção', 'Origem', 'Descrição', 'Parcela', 'Fornecedor/cliente', 'Categoria', 'Competência', 'Valor', 'Pago', 'Em aberto', 'Situação']];
  for (const v of book.views.filter((x) => book.farmIds.has(x.farmId) && (inPeriod(x.dueDate) || x.openCents > 0)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    parcelas.push([
      formatDate(v.dueDate),
      v.direction === 'pagar' ? 'A pagar' : 'A receber',
      v.source,
      v.title,
      `${v.position}/${v.count}`,
      v.counterparty,
      v.categoryName,
      formatDate(v.occurredAt),
      money(v.originalCents ?? v.cents),
      money(v.paidCents),
      money(v.openCents),
      STATE_LABEL[v.state],
    ]);
  }
  const baixas: Cell[][] = [['Data', 'Direção', 'Conta', 'Forma', 'Parcelas', 'Principal', 'Juros', 'Multa', 'Desconto', 'Total', 'Comprovante', 'Observação', 'Situação', 'Registrada por', 'Motivo do estorno']];
  for (const p of book.payments.filter((x) => book.operationIds.has(x.operationId) && inPeriod(x.paidAt)).sort((a, b) => a.paidAt.localeCompare(b.paidAt))) {
    const source = p.partnerId ? `Pago por ${names.user(p.partnerId)} (${p.partnerMode})` : p.advanceId ? 'Compensação de adiantamento' : names.account(p.accountId);
    baixas.push([
      formatDate(p.paidAt),
      p.direction === 'pagar' ? 'Pagamento' : 'Recebimento',
      source,
      METHOD_LABEL[p.method],
      p.items.map((i) => viewsById.get(installmentId(i.entryId, i.index))?.title ?? i.entryId).join(' | '),
      money(p.items.reduce((acc, i) => acc + i.cents, 0)),
      money(p.interestCents),
      money(p.fineCents),
      money(p.discountCents),
      money(paymentTotal(p)),
      p.proof,
      p.notes,
      PAYMENT_STATUS_LABEL[p.status] ?? p.status,
      names.user(p.authorId),
      p.reverseReason ?? '',
    ]);
  }
  const movimentos: Cell[][] = [['Data', 'Tipo', 'De', 'Para', 'Sócio', 'Cliente', 'Valor', 'Forma', 'Comprovante', 'Observação', 'Situação', 'Registrada por']];
  for (const m of book.movements.filter((x) => book.operationIds.has(x.operationId) && inPeriod(x.occurredAt)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    movimentos.push([
      formatDate(m.occurredAt),
      MOVEMENT_LABEL[m.kind],
      m.fromAccountId ? names.account(m.fromAccountId) : '',
      m.toAccountId ? names.account(m.toAccountId) : '',
      m.partnerId ? names.user(m.partnerId) : '',
      m.counterparty,
      money(m.cents),
      METHOD_LABEL[m.method],
      m.proof,
      m.notes,
      PAYMENT_STATUS_LABEL[m.status] ?? m.status,
      names.user(m.authorId),
    ]);
  }
  const fluxo: Cell[][] = [['Data', 'Grupo', 'Descrição', 'Conta', 'Entrada', 'Saída']];
  for (const l of cashLines(book, period)) {
    fluxo.push([formatDate(l.date), GROUP_LABEL[l.group], l.description, names.account(l.accountId), l.cents > 0 ? money(l.cents) : null, l.cents < 0 ? money(-l.cents) : null]);
  }
  return [
    { name: 'Lançamentos', rows: lancamentos },
    { name: 'Parcelas', rows: parcelas },
    { name: 'Baixas', rows: baixas },
    { name: 'Movimentações', rows: movimentos },
    { name: 'Fluxo de caixa', rows: fluxo },
    dreSheet(book, period),
  ];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Relatório em HTML simples para virar PDF: título, período e as tabelas das abas pedidas. */
export function reportHtml(title: string, subtitle: string, sheets: Sheet[]): string {
  const cell = (c: Cell, head: boolean) => {
    const tag = head ? 'th' : 'td';
    if (c === null) return `<${tag}></${tag}>`;
    if (typeof c === 'object') return `<${tag} class="n${c.cents < 0 ? ' neg' : ''}">${esc(formatCents(c.cents))}</${tag}>`;
    return `<${tag}${typeof c === 'number' ? ' class="n"' : ''}>${esc(String(c))}</${tag}>`;
  };
  const tables = sheets
    .map((s) => `<h2>${esc(s.name)}</h2><table>${s.rows.map((r, i) => `<tr>${r.map((c) => cell(c, i === 0)).join('')}</tr>`).join('')}</table>`)
    .join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#1d2a22;margin:24px;font-size:11px}
h1{font-size:20px;margin:0 0 4px}p.sub{color:#5b6b61;margin:0 0 16px}
h2{font-size:14px;margin:20px 0 6px;color:#A63D00}
table{border-collapse:collapse;width:100%;margin-bottom:8px}
th,td{border-bottom:1px solid #dfe5e1;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#f1f4f2;font-weight:600}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.neg{color:#9b2c2c}
</style></head><body><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>${tables}</body></html>`;
}
