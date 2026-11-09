import { daysBetween, parseBRDate } from './dates';
import type { InstallmentView } from './finance';
import { parseDecimal } from './format';
import type { Payment } from './types';

/** Uma linha do extrato do banco: positiva entrou, negativa saiu. */
export interface BankLine {
  /** FITID do OFX ou uma chave da linha do CSV: vira o comprovante da baixa e evita duplicar. */
  id: string;
  date: string;
  cents: number;
  description: string;
}

function ofxTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i').exec(block);
  return match ? match[1].trim() : null;
}

/** Valor "1.234,56", "-1234.56" ou "1234,5" em centavos. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[R$\s]/g, '');
  if (!cleaned) return null;
  // "1234.56" (OFX) usa ponto decimal; "1.234,56" (planilha brasileira) usa vírgula.
  const value = /,\d{1,2}$/.test(cleaned) || cleaned.includes(',') ? parseDecimal(cleaned) : Number(cleaned);
  return value === null || !Number.isFinite(value) ? null : Math.round(value * 100);
}

/** Lê os lançamentos (STMTTRN) de um arquivo OFX (SGML ou XML), como os bancos exportam. */
export function parseOfx(text: string): BankLine[] {
  const lines: BankLine[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const posted = ofxTag(block, 'DTPOSTED');
    const amount = ofxTag(block, 'TRNAMT');
    if (!posted || !amount || !/^\d{8}/.test(posted)) continue;
    const cents = parseAmount(amount.replace(',', '.'));
    if (cents === null || cents === 0) continue;
    const date = `${posted.slice(0, 4)}-${posted.slice(4, 6)}-${posted.slice(6, 8)}`;
    const description = [ofxTag(block, 'NAME'), ofxTag(block, 'MEMO')].filter(Boolean).join(' · ') || 'Lançamento do banco';
    const id = ofxTag(block, 'FITID') || `${date}:${cents}:${description}`;
    lines.push({ id: id.slice(0, 200), date, cents, description: description.slice(0, 200) });
  }
  return lines;
}

/** Divide uma linha de CSV em `;` ou `,`, respeitando aspas. */
export function splitCsvLine(line: string, separator: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (c === separator && !quoted) {
      out.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  out.push(current.trim());
  return out;
}

export function detectSeparator(header: string): string {
  return (header.match(/;/g)?.length ?? 0) >= (header.match(/,/g)?.length ?? 0) ? ';' : ',';
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

function parseAnyDate(text: string): string | null {
  const t = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return parseBRDate(t);
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(t)) return parseBRDate(`${t.slice(0, 6)}20${t.slice(6)}`);
  return null;
}

/**
 * Lê um extrato em CSV: cabeçalho com data, descrição e valor (ou crédito e débito separados).
 * Aceita `;` ou `,` e datas dd/mm/aaaa ou aaaa-mm-dd.
 */
export function parseBankCsv(text: string): { lines: BankLine[]; error: string | null } {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter((r) => r.trim() !== '');
  if (rows.length < 2) return { lines: [], error: 'O arquivo não tem lançamentos.' };
  const separator = detectSeparator(rows[0]);
  const header = splitCsvLine(rows[0], separator).map(normalize);
  const find = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const date = find('data');
  const description = find('descri', 'historico', 'lancamento', 'memo');
  const value = find('valor', 'quantia', 'montante');
  const credit = find('credito', 'entrada');
  const debit = find('debito', 'saida');
  if (date < 0 || (value < 0 && credit < 0 && debit < 0)) {
    return { lines: [], error: 'Não achei as colunas de data e valor. Use um cabeçalho com "Data", "Descrição" e "Valor".' };
  }
  const lines: BankLine[] = [];
  rows.slice(1).forEach((row, i) => {
    const cells = splitCsvLine(row, separator);
    const iso = parseAnyDate(cells[date] ?? '');
    let cents: number | null = null;
    if (value >= 0) cents = parseAmount(cells[value] ?? '');
    else {
      const c = credit >= 0 ? parseAmount(cells[credit] ?? '') ?? 0 : 0;
      const d = debit >= 0 ? parseAmount(cells[debit] ?? '') ?? 0 : 0;
      cents = Math.abs(c) - Math.abs(d);
    }
    if (!iso || cents === null || cents === 0) return;
    const desc = (description >= 0 ? cells[description] : '') || 'Lançamento do banco';
    lines.push({ id: `csv:${iso}:${cents}:${normalize(desc).slice(0, 40)}:${i}`, date: iso, cents, description: desc.slice(0, 200) });
  });
  return { lines, error: lines.length === 0 ? 'Nenhuma linha com data e valor válidos.' : null };
}

export function parseStatement(fileName: string, text: string): { lines: BankLine[]; error: string | null } {
  if (/\.ofx$/i.test(fileName) || /<OFX>/i.test(text)) {
    const lines = parseOfx(text);
    return { lines, error: lines.length === 0 ? 'Nenhum lançamento encontrado no OFX.' : null };
  }
  return parseBankCsv(text);
}

export interface MatchSuggestion {
  line: BankLine;
  /** Parcelas sugeridas, a melhor primeiro. Vazio = a classificar. */
  candidates: InstallmentView[];
  /** A linha já foi importada antes (o comprovante já existe numa baixa). */
  imported: boolean;
}

/**
 * Sugere o vínculo de cada linha do extrato com parcelas em aberto da mesma direção: valor em aberto
 * igual e vencimento próximo (até 10 dias), o mais próximo primeiro. Linhas já usadas como
 * comprovante de uma baixa aparecem como importadas.
 */
export function suggestMatches(lines: BankLine[], views: InstallmentView[], payments: Payment[]): MatchSuggestion[] {
  const proofs = new Set(payments.filter((p) => p.status !== 'descartado').map((p) => p.proof));
  const byAmount = new Map<string, InstallmentView[]>();
  for (const view of views) {
    if (view.source === 'fatura' || Number.isNaN(view.openCents)) continue;
    const key = `${view.direction}:${view.openCents}`;
    const candidates = byAmount.get(key) ?? [];
    candidates.push(view);
    byAmount.set(key, candidates);
  }
  return lines.map((line) => {
    const direction = line.cents > 0 ? 'receber' : 'pagar';
    const cents = Math.abs(line.cents);
    const candidates = (byAmount.get(`${direction}:${cents}`) ?? [])
      .map((v) => ({ v, distance: Math.abs(daysBetween(v.dueDate, line.date)) }))
      .filter((x) => x.distance <= 10)
      .sort((a, b) => a.distance - b.distance)
      .map((x) => x.v);
    return { line, candidates, imported: proofs.has(line.id) };
  });
}
