import { splitCents } from './allocation';
import { saleGrossCents } from './cattle';
import { addDays, daysBetween } from './dates';
import {
  categoryOf,
  indexInstallments,
  installmentId,
  invoiceMonthOf,
  paymentTotal,
  isCashAccount,
  movementSign,
  SETTLING,
  STOCK_CATEGORY_ID,
  type CardInvoice,
  type InstallmentView,
  type ObligationSource,
  type RecurrenceOccurrence,
} from './finance';
import { isStockPurchase, lotAllocations, type LotSummary } from './lot-metrics';
import type {
  Budget,
  CostCenter,
  CostClassification,
  CategoryNature,
  Entry,
  Financing,
  FinancialAccount,
  LedgerCategory,
  Lot,
  Movement,
  Payment,
  PaymentStatus,
  Renegotiation,
} from './types';

/**
 * Tudo o que os relatórios gerenciais leem, já filtrado para as operações em que a pessoa é sócia
 * e para as fazendas do contexto. Os lançamentos já trazem o custo do consumo (`costEntries`).
 */
export interface FinanceBook {
  farmIds: Set<string>;
  operationIds: Set<string>;
  entries: Entry[];
  lots: Lot[];
  lotSummaries: LotSummary[];
  categories: LedgerCategory[];
  costCenters?: CostCenter[];
  costClassifications?: CostClassification[];
  accounts: FinancialAccount[];
  payments: Payment[];
  movements: Movement[];
  /** Parcelas de todas as origens, com a situação de hoje. */
  views: InstallmentView[];
  invoices: CardInvoice[];
  occurrences: RecurrenceOccurrence[];
  financings: Financing[];
  renegotiations: Renegotiation[];
  budgets: Budget[];
  today: string;
  statuses?: PaymentStatus[];
}

export interface Period {
  from: string;
  to: string;
}

const within = (date: string, p: Period) => date >= p.from && date <= p.to;

/** O mesmo intervalo, imediatamente antes (para comparar períodos). */
export function previousPeriod(p: Period): Period {
  const days = daysBetween(p.from, p.to) + 1;
  return { from: addDays(p.from, -days), to: addDays(p.from, -1) };
}

/** Mês corrente, trimestre, ano e últimos 12 meses, terminando hoje. */
export function presetPeriod(kind: 'mes' | 'trimestre' | 'ano' | '12m', today: string): Period {
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (kind === 'mes') return { from: `${y}-${pad(m)}-01`, to: today };
  if (kind === 'trimestre') {
    const q = Math.floor((m - 1) / 3) * 3 + 1;
    return { from: `${y}-${pad(q)}-01`, to: today };
  }
  if (kind === 'ano') return { from: `${y}-01-01`, to: today };
  return { from: addDays(today, -364), to: today };
}

/**
 * Grupos que ligam o resultado ao caixa. Cada linha da DRE e cada entrada ou saída de dinheiro cai em
 * exatamente um grupo, então a soma das diferenças por grupo explica caixa − resultado.
 */
export type FlowGroup =
  | 'vendas'
  | 'outras_receitas'
  | 'animais'
  | 'custos'
  | 'estoque'
  | 'administrativas'
  | 'impostos'
  | 'investimentos'
  | 'financeiro'
  | 'financiamentos'
  | 'socios'
  | 'cartao'
  | 'planilha';

export const GROUP_LABEL: Record<FlowGroup, string> = {
  vendas: 'Vendas de animais',
  outras_receitas: 'Outras receitas',
  animais: 'Compra de animais',
  custos: 'Custos de produção',
  estoque: 'Insumos do estoque',
  administrativas: 'Despesas administrativas',
  impostos: 'Impostos e taxas',
  investimentos: 'Investimentos',
  financeiro: 'Juros, multas e descontos',
  financiamentos: 'Financiamentos (principal)',
  socios: 'Sócios',
  cartao: 'Fatura do cartão',
  planilha: 'Contas da planilha',
};

/** Ordem dos grupos nos relatórios: entradas, custos, depois o que não é resultado. */
export const GROUP_ORDER: FlowGroup[] = [
  'vendas',
  'outras_receitas',
  'animais',
  'custos',
  'estoque',
  'administrativas',
  'impostos',
  'financeiro',
  'investimentos',
  'financiamentos',
  'socios',
  'cartao',
  'planilha',
];

function natureGroup(nature: CategoryNature | undefined, categoryId: string | null): FlowGroup {
  if (categoryId === STOCK_CATEGORY_ID || nature === 'aquisicao_estoque') return 'estoque';
  if (categoryId === 'cat-animais') return 'animais';
  switch (nature) {
    case 'despesa_administrativa':
      return 'administrativas';
    case 'imposto':
      return 'impostos';
    case 'investimento':
      return 'investimentos';
    case 'receita_operacional':
    case 'outra_receita':
      return 'outras_receitas';
    case 'financiamento':
      return 'financiamentos';
    case 'movimentacao_socio':
      return 'socios';
    default:
      return 'custos';
  }
}

/** Grupo do dinheiro que quita uma parcela, pela origem e pela natureza da categoria. */
export function obligationGroup(view: Pick<InstallmentView, 'source' | 'origin' | 'categoryId' | 'direction'>, categories: LedgerCategory[]): FlowGroup {
  const source: ObligationSource = view.source === 'renegociacao' ? (view.origin ?? 'lancamento') : view.source;
  if (source === 'lote') return 'animais';
  if (source === 'financiamento') return 'financiamentos';
  if (source === 'reembolso') return 'socios';
  if (source === 'importacao') return 'planilha';
  if (source === 'fatura') return 'cartao';
  if (view.categoryId === 'cat-venda-animais') return 'vendas';
  return natureGroup(categories.find((c) => c.id === view.categoryId)?.nature, view.categoryId);
}

// ---------------------------------------------------------------------------------------------
// Fluxo de caixa

export interface CashLine {
  id: string;
  date: string;
  group: FlowGroup;
  /** Positivo entra, negativo sai. */
  cents: number;
  description: string;
  accountId: string;
  /** Baixa ou movimentação de origem. */
  paymentId?: string;
  movementId?: string;
}

/**
 * Dinheiro que entrou e saiu das contas de caixa (bancos, caixa em espécie, investimentos). O cartão
 * é dívida: a compra no cartão não sai do caixa; o pagamento da fatura sai. Transferência entre duas
 * contas de caixa não muda o total e fica de fora.
 */
export function cashLines(book: FinanceBook, period?: Period): CashLine[] {
  const statuses = book.statuses ?? SETTLING;
  const cash = new Set(book.accounts.filter(isCashAccount).map((a) => a.id));
  const card = new Set(book.accounts.filter((a) => !isCashAccount(a)).map((a) => a.id));
  const lines: CashLine[] = [];
  const viewsById = indexInstallments(book.views);
  for (const p of book.payments) {
    if (!statuses.includes(p.status) || !p.accountId || !cash.has(p.accountId) || !book.operationIds.has(p.operationId)) continue;
    if (period && !within(p.paidAt, period)) continue;
    const sign = p.direction === 'receber' ? 1 : -1;
    let kept = 0;
    p.items.forEach((item, i) => {
      const view = viewsById.get(installmentId(item.entryId, item.index));
      if (view && !book.farmIds.has(view.farmId)) return;
      kept++;
      const group = view ? obligationGroup(view, book.categories) : 'custos';
      // Financiamento: a parte dos juros da parcela é resultado financeiro; o resto é principal.
      const interest = view?.interestCents && view.originalCents === undefined && view.cents > 0
        ? Math.round((item.cents * view.interestCents) / view.cents)
        : 0;
      if (interest > 0) {
        lines.push({ id: `${p.id}:${i}:juros`, date: p.paidAt, group: 'financeiro', cents: sign * interest, description: `Juros · ${view?.title ?? ''}`, accountId: p.accountId!, paymentId: p.id });
      }
      lines.push({ id: `${p.id}:${i}`, date: p.paidAt, group, cents: sign * (item.cents - interest), description: view?.title ?? 'Parcela', accountId: p.accountId!, paymentId: p.id });
    });
    const extras = p.interestCents + p.fineCents - p.discountCents;
    if (extras !== 0 && kept > 0) {
      lines.push({ id: `${p.id}:extras`, date: p.paidAt, group: 'financeiro', cents: sign * extras, description: extras > 0 ? 'Juros e multa' : 'Desconto', accountId: p.accountId, paymentId: p.id });
    }
  }
  for (const m of book.movements) {
    if (!statuses.includes(m.status) || !book.operationIds.has(m.operationId)) continue;
    if (period && !within(m.occurredAt, period)) continue;
    for (const accountId of [m.fromAccountId, m.toAccountId]) {
      if (!accountId || !cash.has(accountId)) continue;
      const other = accountId === m.fromAccountId ? m.toAccountId : m.fromAccountId;
      if (m.kind === 'transferencia' && other && cash.has(other)) continue;
      const group: FlowGroup =
        m.kind === 'transferencia' ? (other && card.has(other) ? 'cartao' : 'custos')
        : m.kind === 'liberacao' ? 'financiamentos'
        : m.kind === 'adiantamento' ? 'vendas'
        : 'socios';
      lines.push({
        id: `${m.id}:${accountId}`,
        date: m.occurredAt,
        group,
        cents: movementSign(m, accountId) * m.cents,
        description: m.kind === 'adiantamento' ? `Adiantamento · ${m.counterparty}` : m.kind,
        accountId,
        movementId: m.id,
      });
    }
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/**
 * Saldo de caixa (contas que não são cartão) no fim do dia `date`. O saldo inicial de cada conta vale
 * também antes da data de abertura: nada pode ser baixado antes dela, e o saldo anterior é o mesmo
 * que a pessoa informou (senão uma conta aberta no meio do período sumiria do fluxo).
 */
export function cashBalanceOn(book: FinanceBook, date: string): number {
  const opening = book.accounts
    .filter((a) => isCashAccount(a) && book.operationIds.has(a.operationId))
    .reduce((acc, a) => acc + a.openingBalanceCents, 0);
  return opening + cashLines(book, { from: '0000-01-01', to: date }).reduce((acc, l) => acc + l.cents, 0);
}

export type Granularity = 'dia' | 'semana' | 'mes';

export interface FlowBucket {
  key: string;
  from: string;
  to: string;
  inCents: number;
  outCents: number;
  /** Saldo no fim do intervalo. */
  balanceCents: number;
}

function bucketKey(date: string, granularity: Granularity): { key: string; from: string; to: string } {
  if (granularity === 'dia') return { key: date, from: date, to: date };
  if (granularity === 'mes') {
    const [y, m] = date.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { key: date.slice(0, 7), from: `${date.slice(0, 7)}-01`, to: `${date.slice(0, 7)}-${String(last).padStart(2, '0')}` };
  }
  const weekday = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))).getDay();
  const from = addDays(date, -((weekday + 6) % 7));
  return { key: from, from, to: addDays(from, 6) };
}

function bucketize(start: number, items: { date: string; cents: number }[], granularity: Granularity): FlowBucket[] {
  const map = new Map<string, FlowBucket>();
  for (const item of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = bucketKey(item.date, granularity);
    const bucket = map.get(k.key) ?? { ...k, inCents: 0, outCents: 0, balanceCents: 0 };
    if (item.cents >= 0) bucket.inCents += item.cents;
    else bucket.outCents += -item.cents;
    map.set(k.key, bucket);
  }
  let balance = start;
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((b) => {
      balance += b.inCents - b.outCents;
      return { ...b, balanceCents: balance };
    });
}

/** Fluxo realizado: entradas e saídas efetivas por dia, semana ou mês, com o saldo de caixa. */
export function realizedFlow(book: FinanceBook, period: Period, granularity: Granularity): { opening: number; buckets: FlowBucket[]; byGroup: Map<FlowGroup, number> } {
  const opening = cashBalanceOn(book, addDays(period.from, -1));
  const lines = cashLines(book, period);
  const byGroup = new Map<FlowGroup, number>();
  for (const l of lines) byGroup.set(l.group, (byGroup.get(l.group) ?? 0) + l.cents);
  return { opening, buckets: bucketize(opening, lines, granularity), byGroup };
}

export interface ProjectedItem {
  id: string;
  date: string;
  cents: number;
  title: string;
  kind: 'parcela' | 'vencida' | 'fatura' | 'prevista';
  group: FlowGroup;
}

/**
 * Fluxo projetado a partir de hoje: parcelas em aberto (as vencidas contam hoje), faturas do cartão
 * e despesas recorrentes ainda não lançadas, até `until`. Começa do saldo de caixa de hoje.
 */
export function projectedFlow(
  book: FinanceBook,
  until: string,
  granularity: Granularity,
): { opening: number; items: ProjectedItem[]; buckets: FlowBucket[]; firstNegative: FlowBucket | null } {
  const today = book.today;
  const items: ProjectedItem[] = [];
  for (const v of book.views) {
    if (v.openCents <= 0 || v.source === 'fatura' || !book.farmIds.has(v.farmId) || !book.operationIds.has(v.operationId)) continue;
    if (v.dueDate > until) continue;
    const overdue = v.dueDate < today;
    items.push({
      id: v.id,
      date: overdue ? today : v.dueDate,
      cents: (v.direction === 'receber' ? 1 : -1) * v.openCents,
      title: v.title,
      kind: overdue ? 'vencida' : 'parcela',
      group: obligationGroup(v, book.categories),
    });
  }
  for (const invoice of book.invoices) {
    if (invoice.openCents <= 0 || invoice.dueDate > until || !book.operationIds.has(invoice.operationId)) continue;
    const name = book.accounts.find((a) => a.id === invoice.accountId)?.name ?? 'Cartão';
    items.push({
      id: invoice.id,
      date: invoice.dueDate < today ? today : invoice.dueDate,
      cents: -invoice.openCents,
      title: `Fatura ${invoice.month.slice(5, 7)}/${invoice.month.slice(0, 4)} · ${name}`,
      kind: 'fatura',
      group: 'cartao',
    });
  }
  for (const o of book.occurrences) {
    if (o.entryId || o.dueDate > until || o.dueDate < today || !book.farmIds.has(o.farmId)) continue;
    items.push({
      id: o.id,
      date: o.dueDate,
      cents: -o.cents,
      title: o.title,
      kind: 'prevista',
      group: natureGroup(book.categories.find((c) => c.id === o.categoryId)?.nature, o.categoryId),
    });
  }
  const opening = cashBalanceOn(book, today);
  const buckets = bucketize(opening, items, granularity);
  return { opening, items: items.sort((a, b) => a.date.localeCompare(b.date)), buckets, firstNegative: buckets.find((b) => b.balanceCents < 0) ?? null };
}

// ---------------------------------------------------------------------------------------------
// DRE gerencial (competência)

export interface DreLine {
  key: string;
  label: string;
  cents: number;
  group: FlowGroup | null;
  /** Linha de total (subtotal ou resultado). */
  total?: boolean;
  /** Detalhe por categoria. */
  details?: { label: string; cents: number }[];
}

export interface Dre {
  lines: DreLine[];
  grossRevenueCents: number;
  netRevenueCents: number;
  operatingResultCents: number;
  financialResultCents: number;
  realResultCents: number;
  pastureRentCents: number;
  adjustedResultCents: number;
  /** Fora do resultado: o que foi investimento ou compra no período (competência). */
  outsideResult: { label: string; cents: number }[];
  /** Resultado por grupo, para a ponte com o caixa. */
  resultByGroup: Map<FlowGroup, number>;
}

/** Natureza da despesa: pela categoria; despesas antigas sem categoria conhecida são custo. */
function expenseNature(entry: Extract<Entry, { kind: 'despesa' | 'nota_fiscal' }>, categories: LedgerCategory[]): { nature: CategoryNature; name: string; id: string | null } {
  if (isStockPurchase(entry)) return { nature: 'aquisicao_estoque', name: 'Compra para o estoque', id: STOCK_CATEGORY_ID };
  if (entry.kind === 'nota_fiscal') return { nature: 'custo_producao', name: 'Alimentação e insumos', id: 'cat-alimentacao' };
  const category = categoryOf(entry.payload, categories);
  return { nature: category?.nature ?? 'custo_producao', name: category?.name ?? (entry.payload.category || 'Sem categoria'), id: category?.id ?? null };
}

/**
 * DRE gerencial do período, por competência: vendas pelo bruto da arroba menos os descontos;
 * custo de aquisição dos animais vendidos (média por cabeça da compra); custos de produção pela
 * data da despesa, mais o consumo do estoque pelo custo médio (a compra para o estoque não é custo);
 * despesas administrativas e impostos; resultado financeiro (juros das parcelas de financiamento
 * que vencem no período, juros, multas e descontos das baixas e o efeito das renegociações). O
 * resultado ajustado tira o aluguel simbólico da pastagem dos animais vendidos.
 */
export function buildDre(book: FinanceBook, period: Period): Dre {
  const statuses = book.statuses ?? SETTLING;
  const inScope = (e: Pick<Entry, 'farmId' | 'operationId'>) => book.farmIds.has(e.farmId) && book.operationIds.has(e.operationId);
  const approved = book.entries.filter((e) => e.status === 'aprovado' && inScope(e) && within(e.occurredAt, period));
  const viewsById = indexInstallments(book.views);
  const viewsByRenegotiation = new Map<string, InstallmentView[]>();
  for (const view of book.views) {
    if (!view.renegotiatedBy) continue;
    const originals = viewsByRenegotiation.get(view.renegotiatedBy) ?? [];
    originals.push(view);
    viewsByRenegotiation.set(view.renegotiatedBy, originals);
  }
  const byNature = new Map<CategoryNature, Map<string, number>>();
  const addNature = (nature: CategoryNature, name: string, cents: number) => {
    const inner = byNature.get(nature) ?? new Map<string, number>();
    inner.set(name, (inner.get(name) ?? 0) + cents);
    byNature.set(nature, inner);
  };
  let gross = 0;
  let deductions = 0;
  let animalsSold = 0;
  let rent = 0;
  let stockUse = 0;
  for (const entry of approved) {
    if (entry.kind === 'venda') {
      gross += saleGrossCents(entry.payload.carcassKg, entry.payload.pricePerArrobaCents);
      deductions += entry.payload.deductionsCents;
    } else if (entry.kind === 'despesa' || entry.kind === 'nota_fiscal') {
      const n = expenseNature(entry, book.categories);
      addNature(n.nature, n.name, entry.amountCents ?? 0);
    } else if (entry.kind === 'receita') {
      const category = categoryOf(entry.payload, book.categories);
      addNature(category?.nature ?? 'outra_receita', category?.name ?? 'Outras receitas', entry.amountCents ?? 0);
    } else if (entry.kind === 'consumo' || (entry.kind === 'ajuste_estoque' && entry.payload.delta < 0)) {
      stockUse += entry.derivedCents ?? 0;
    }
  }
  // Custo de aquisição dos vendidos e aluguel simbólico, pelas vendas do resumo do lote.
  for (const summary of book.lotSummaries) {
    if (!inScope(summary.lot)) continue;
    const perHead = summary.lot.headsPurchased > 0 ? summary.acquisitionCents / summary.lot.headsPurchased : 0;
    for (const sale of summary.sales) {
      if (!within(sale.date, period)) continue;
      animalsSold += Math.round(perHead * sale.heads);
      rent += sale.pastureRentCents;
    }
  }
  // Resultado financeiro.
  let interestDue = 0;
  for (const v of book.views) {
    if (v.source !== 'financiamento' || !v.interestCents || !inScope(v) || !within(v.dueDate, period)) continue;
    interestDue += v.interestCents;
  }
  let paymentExtras = 0;
  for (const p of book.payments) {
    if (!statuses.includes(p.status) || !book.operationIds.has(p.operationId) || !within(p.paidAt, period)) continue;
    const item = p.items[0];
    const first = item ? viewsById.get(installmentId(item.entryId, item.index)) : undefined;
    if (first && !book.farmIds.has(first.farmId)) continue;
    const extras = p.interestCents + p.fineCents - p.discountCents;
    paymentExtras += p.direction === 'pagar' ? -extras : extras;
  }
  let renegotiation = 0;
  for (const r of book.renegotiations) {
    if (!statuses.includes(r.status) || !book.operationIds.has(r.operationId) || !within(r.createdAt.slice(0, 10), period)) continue;
    const originals = viewsByRenegotiation.get(r.id) ?? [];
    if (originals.length === 0 || !book.farmIds.has(originals[0].farmId)) continue;
    const open = originals.reduce((acc, v) => acc + (v.originalCents ?? v.cents) - v.cents, 0);
    const delta = r.installments.reduce((acc, i) => acc + i.cents, 0) - open;
    renegotiation += r.direction === 'pagar' ? -delta : delta;
  }

  const sumNature = (nature: CategoryNature) => [...(byNature.get(nature)?.values() ?? [])].reduce((a, b) => a + b, 0);
  const details = (nature: CategoryNature) =>
    [...(byNature.get(nature)?.entries() ?? [])].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents);
  const otherOperating = sumNature('receita_operacional');
  const otherRevenue = sumNature('outra_receita');
  const production = sumNature('custo_producao');
  const admin = sumNature('despesa_administrativa');
  const taxes = sumNature('imposto');
  const net = gross - deductions;
  const operating = net + otherOperating - animalsSold - production - stockUse - admin - taxes;
  const financial = -interestDue + paymentExtras + renegotiation;
  const real = operating + otherRevenue + financial;

  // Sem "-R$ 0,00": zero é zero.
  const neg = (n: number) => (n === 0 ? 0 : -n);
  const lines: DreLine[] = [
    { key: 'bruta', label: 'Receita bruta de vendas', cents: gross, group: 'vendas' },
    { key: 'deducoes', label: '(−) Descontos e retenções na venda', cents: neg(deductions), group: 'vendas' },
    { key: 'liquida', label: 'Receita líquida de vendas', cents: net, group: null, total: true },
    { key: 'outras_op', label: 'Outras receitas operacionais', cents: otherOperating, group: 'outras_receitas', details: details('receita_operacional') },
    { key: 'animais', label: '(−) Custo de aquisição dos animais vendidos', cents: neg(animalsSold), group: 'animais' },
    { key: 'producao', label: '(−) Custos de produção', cents: neg(production), group: 'custos', details: details('custo_producao') },
    { key: 'insumos', label: '(−) Consumo de insumos do estoque', cents: neg(stockUse), group: 'estoque' },
    { key: 'adm', label: '(−) Despesas administrativas', cents: neg(admin), group: 'administrativas', details: details('despesa_administrativa') },
    { key: 'impostos', label: '(−) Impostos e taxas', cents: neg(taxes), group: 'impostos', details: details('imposto') },
    { key: 'operacional', label: 'Resultado operacional', cents: operating, group: null, total: true },
    { key: 'outras', label: 'Outras receitas', cents: otherRevenue, group: 'outras_receitas', details: details('outra_receita') },
    {
      key: 'financeiro',
      label: 'Resultado financeiro',
      cents: financial,
      group: 'financeiro',
      details: [
        { label: 'Juros de financiamentos', cents: neg(interestDue) },
        { label: 'Juros, multas e descontos nas baixas', cents: paymentExtras },
        { label: 'Renegociações', cents: renegotiation },
      ].filter((d) => d.cents !== 0),
    },
    { key: 'real', label: 'Resultado real', cents: real, group: null, total: true },
    { key: 'aluguel', label: '(−) Aluguel simbólico da pastagem (vendidos)', cents: neg(rent), group: null },
    { key: 'ajustado', label: 'Resultado ajustado', cents: real - rent, group: null, total: true },
  ];
  const resultByGroup = new Map<FlowGroup, number>();
  for (const line of lines) {
    if (!line.group || line.total) continue;
    resultByGroup.set(line.group, (resultByGroup.get(line.group) ?? 0) + line.cents);
  }
  const acquisitions = book.lots
    .filter((l) => inScope(l) && !l.transfer?.incoming && within(l.purchasedAt, period))
    .reduce((acc, l) => acc + l.purchaseCents + l.commissionCents + l.freightCents, 0);
  return {
    lines,
    grossRevenueCents: gross,
    netRevenueCents: net,
    operatingResultCents: operating,
    financialResultCents: financial,
    realResultCents: real,
    pastureRentCents: rent,
    adjustedResultCents: real - rent,
    outsideResult: [
      { label: 'Compra de animais (lotes)', cents: acquisitions },
      { label: 'Compras para o estoque', cents: sumNature('aquisicao_estoque') },
      { label: 'Investimentos', cents: sumNature('investimento') },
    ].filter((x) => x.cents !== 0),
    resultByGroup,
  };
}

export interface BridgeRow {
  group: FlowGroup;
  resultCents: number;
  cashCents: number;
  /** caixa − resultado. */
  differenceCents: number;
}

/**
 * Ponte entre resultado e caixa do mesmo período: por grupo, o que foi resultado (competência) e o
 * que foi dinheiro (pagamento ou recebimento efetivo). As diferenças somam exatamente caixa − resultado.
 */
export function resultToCashBridge(book: FinanceBook, period: Period): { rows: BridgeRow[]; resultCents: number; cashCents: number } {
  const dre = buildDre(book, period);
  const { byGroup } = realizedFlow(book, period, 'mes');
  const rows = GROUP_ORDER.map((group) => {
    const resultCents = dre.resultByGroup.get(group) ?? 0;
    const cashCents = byGroup.get(group) ?? 0;
    return { group, resultCents, cashCents, differenceCents: cashCents - resultCents };
  }).filter((r) => r.resultCents !== 0 || r.cashCents !== 0);
  return {
    rows,
    resultCents: dre.realResultCents,
    cashCents: [...byGroup.values()].reduce((a, b) => a + b, 0),
  };
}

// ---------------------------------------------------------------------------------------------
// Idade das contas, gastos e orçamento

export type AgingBucket = 'a_vencer' | '1_30' | '31_60' | '60_mais';

export const AGING_LABEL: Record<AgingBucket, string> = {
  a_vencer: 'A vencer',
  '1_30': 'Vencidas há 1–30 dias',
  '31_60': 'Vencidas há 31–60 dias',
  '60_mais': 'Vencidas há mais de 60 dias',
};

export function agingBucket(daysToDue: number): AgingBucket {
  if (daysToDue >= 0) return 'a_vencer';
  if (daysToDue >= -30) return '1_30';
  if (daysToDue >= -60) return '31_60';
  return '60_mais';
}

/** Contas em aberto por idade, para pagar e para receber. */
export function aging(book: FinanceBook): Record<'pagar' | 'receber', Record<AgingBucket, { count: number; cents: number }>> {
  const empty = (): Record<AgingBucket, { count: number; cents: number }> => ({
    a_vencer: { count: 0, cents: 0 },
    '1_30': { count: 0, cents: 0 },
    '31_60': { count: 0, cents: 0 },
    '60_mais': { count: 0, cents: 0 },
  });
  const result = { pagar: empty(), receber: empty() };
  const list: { direction: 'pagar' | 'receber'; openCents: number; daysToDue: number }[] = [
    ...book.views.filter((v) => v.openCents > 0 && book.farmIds.has(v.farmId) && book.operationIds.has(v.operationId)),
    ...book.invoices.filter((i) => i.openCents > 0 && book.operationIds.has(i.operationId)).map((i) => ({ direction: 'pagar' as const, openCents: i.openCents, daysToDue: i.daysToDue })),
  ];
  for (const v of list) {
    const bucket = result[v.direction][agingBucket(v.daysToDue)];
    bucket.count += 1;
    bucket.cents += v.openCents;
  }
  return result;
}

export interface SpendingRow {
  key: string;
  label: string;
  cents: number;
  previousCents: number;
}

export type SpendingDimension = 'categoria' | 'fornecedor' | 'centro' | 'agrupamento' | 'categoria_centro' | 'lote';
export interface SpendingFilter {
  basis?: 'competencia' | 'caixa';
  categoryId?: string | null;
  /** Group IDs include their children; empty string selects unclassified entries. */
  costCenterId?: string | null;
}
export interface SpendingDetail {
  entryId: string;
  date: string;
  title: string;
  cents: number;
  categoryId: string;
  category: string;
  costCenterId: string | null;
  center: string;
  groupId: string | null;
  group: string;
  paymentId?: string;
  movementId?: string;
}

export function entryCostCenter(book: Pick<FinanceBook, 'costClassifications'>, entry: Entry): string | null {
  const override = book.costClassifications?.find((c) => c.id === entry.id && c.operationId === entry.operationId);
  return override ? override.costCenterId : (entry.kind === 'despesa' || entry.kind === 'nota_fiscal') ? entry.payload.costCenterId ?? null : null;
}

/** One fact per expense (competence), or per paid item (cash), never an installment's face value. */
export function spendingDetails(book: FinanceBook, period: Period, filter: SpendingFilter = {}): SpendingDetail[] {
  const expenses = book.entries.filter((e): e is Extract<Entry, { kind: 'despesa' | 'nota_fiscal' }> =>
    e.status === 'aprovado' && (e.kind === 'despesa' || e.kind === 'nota_fiscal') && book.operationIds.has(e.operationId));
  const byId = new Map(expenses.map((e) => [e.id, e]));
  const details: SpendingDetail[] = [];
  const add = (entryId: string, date: string, cents: number, paymentId?: string, movementId?: string) => {
    const entry = byId.get(entryId);
    if (!entry || !book.farmIds.has(entry.farmId) || !within(date, period)) return;
    const n = expenseNature(entry, book.categories);
    const centerId = entryCostCenter(book, entry);
    const center = book.costCenters?.find((c) => c.id === centerId && c.operationId === entry.operationId);
    if (filter.categoryId && filter.categoryId !== (n.id ?? n.name)) return;
    if (filter.costCenterId != null && (filter.costCenterId === '' ? centerId !== null : centerId !== filter.costCenterId && center?.parentId !== filter.costCenterId)) return;
    const group = book.costCenters?.find((c) => c.id === center?.parentId && c.operationId === entry.operationId);
    details.push({ entryId, date, title: entry.title, cents, categoryId: n.id ?? n.name, category: n.name,
      costCenterId: centerId, center: center?.name ?? 'Sem centro de custo', groupId: group?.id ?? null,
      group: group?.name ?? center?.name ?? 'Sem centro de custo', paymentId, movementId });
  };
  if (filter.basis !== 'caixa') {
    for (const e of expenses) add(e.id, e.occurredAt, e.amountCents ?? 0);
  } else {
    // A renegotiated obligation retains its original expense distribution, including chains.
    const origins = (entryId: string, _index: number, seen = new Set<string>()): { entryId: string | null; weight: number }[] => {
      if (byId.has(entryId)) return [{ entryId, weight: 1 }];
      if (seen.has(entryId)) return [{ entryId: null, weight: 1 }];
      const r = book.renegotiations.find((r) => r.id === entryId && book.operationIds.has(r.operationId));
      if (!r) return [{ entryId: null, weight: 1 }];
      const next = new Set([...seen, entryId]);
      return r.items.flatMap((item) => {
        const view = book.views.find((v) => v.entryId === item.entryId && v.index === item.index);
        const original = view?.originalCents ?? view?.cents ?? 0;
        const remaining = Math.max(0, original - item.settledCents);
        const source = origins(item.entryId, item.index, next);
        const total = source.reduce((a, s) => a + s.weight, 0);
        return source.map((s) => ({ entryId: s.entryId, weight: total > 0 ? remaining * s.weight / total : 0 }));
      });
    };
    const statuses = book.statuses ?? SETTLING;
    const payments = book.payments.filter((p) => p.direction === 'pagar' && statuses.includes(p.status) && book.operationIds.has(p.operationId));
    const cards = new Map((book.accounts ?? []).filter((a) => a.kind === 'cartao').map((a) => [a.id, a]));
    const settlements: { payment: Payment; date: string; cents: number; beforeCents?: number; movementId?: string }[] = payments
      .filter((p) => !p.accountId || !cards.has(p.accountId))
      .map((payment) => ({ payment, date: payment.paidAt, cents: paymentTotal(payment) }));
    // A charge on a credit card is debt, not cash. Attribute actual invoice transfers to
    // their original charges, retaining opening debt and unrelated charges in the denominator.
    for (const card of cards.values()) {
      const invoicePayments = payments.filter((p) => p.accountId === card.id && p.operationId === card.operationId);
      const transfers = (book.movements ?? []).filter((m) => m.kind === 'transferencia' && m.toAccountId === card.id &&
        m.operationId === card.operationId && statuses.includes(m.status) &&
        (book.accounts ?? []).some((a) => a.id === m.fromAccountId && isCashAccount(a)))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      const paidByMonth = new Map<string, number>();
      for (const m of transfers) {
        const month = m.invoiceMonth ?? invoiceMonthOf(m.occurredAt, card.closingDay!);
        const charges = invoicePayments.filter((p) => invoiceMonthOf(p.paidAt, card.closingDay!) === month);
        const weights = charges.map(paymentTotal);
        const totalCharges = weights.reduce((a, n) => a + n, 0);
        const invoice = book.invoices?.find((i) => i.accountId === card.id && i.month === month);
        const denominator = Math.max(totalCharges, invoice?.chargesCents ?? 0);
        weights.push(denominator - totalCharges);
        const prior = paidByMonth.get(month) ?? 0;
        paidByMonth.set(month, prior + m.cents);
        if (!within(m.occurredAt, period) || denominator <= 0) continue;
        const before = splitCents(Math.min(prior, denominator), weights).shares;
        const after = splitCents(Math.min(prior + m.cents, denominator), weights).shares;
        charges.forEach((payment, i) => {
          const cents = after[i] - before[i];
          if (cents > 0) settlements.push({ payment, date: m.occurredAt, cents, beforeCents: before[i], movementId: m.id });
        });
      }
    }
    for (const event of settlements) {
      const { payment, date } = event;
      if (!within(date, period)) continue;
      // Own-money payments count on the date paid to the supplier; reimbursement is
      // a different obligation and never repeats that expense.
      const extras = payment.interestCents + payment.fineCents - payment.discountCents;
      const extrasShares = splitCents(Math.abs(extras), payment.items.map((i) => i.cents)).shares;
      const itemAmounts = payment.items.map((item, i) => item.cents + (extras < 0 ? -1 : 1) * extrasShares[i]);
      const beforeItems = splitCents(event.beforeCents ?? 0, itemAmounts).shares;
      const afterItems = splitCents((event.beforeCents ?? 0) + event.cents, itemAmounts).shares;
      payment.items.forEach((item, i) => {
        const sources = origins(item.entryId, item.index);
        // Unrelated obligations stay in the denominator, including inside renegotiation chains.
        const before = splitCents(beforeItems[i], sources.map((s) => s.weight)).shares;
        const after = splitCents(afterItems[i], sources.map((s) => s.weight)).shares;
        const shares = after.map((cents, j) => cents - before[j]);
        sources.forEach((s, j) => { if (s.entryId) add(s.entryId, date, shares[j], payment.id, event.movementId); });
      });
    }
  }
  return details.sort((a, b) => b.date.localeCompare(a.date) || a.entryId.localeCompare(b.entryId));
}

/** Independent views of the same expenses. Parent and child are never added as separate facts. */
export function spending(book: FinanceBook, period: Period, dimension: SpendingDimension, filter: SpendingFilter = {}): SpendingRow[] {
  const rows = new Map<string, SpendingRow>();
  const add = (key: string, label: string, cents: number, current: boolean) => {
    const row = rows.get(key) ?? { key, label, cents: 0, previousCents: 0 };
    if (current) row.cents += cents; else row.previousCents += cents;
    rows.set(key, row);
  };
  for (const [range, current] of [[period, true], [previousPeriod(period), false]] as const) {
    for (const d of spendingDetails(book, range, filter)) {
      const e = book.entries.find((e) => e.id === d.entryId)!;
      if (dimension === 'categoria') add(d.categoryId, d.category, d.cents, current);
      else if (dimension === 'centro') add(d.costCenterId ?? 'sem-centro', d.center, d.cents, current);
      else if (dimension === 'agrupamento') add(d.groupId ?? d.costCenterId ?? 'sem-centro', d.group, d.cents, current);
      else if (dimension === 'categoria_centro') add(JSON.stringify([d.categoryId, d.costCenterId]), `${d.category} · ${d.center}`, d.cents, current);
      else if (dimension === 'fornecedor') {
        const name = (e.kind === 'despesa' ? e.payload.supplier : e.kind === 'nota_fiscal' ? e.payload.extraction?.supplier ?? '' : '').trim() || 'Sem fornecedor';
        add(name.toLowerCase(), name, d.cents, current);
      } else {
        const allocations = lotAllocations(e);
        const total = e.amountCents ?? 0;
        const rest = Math.max(0, total - allocations.reduce((a, x) => a + x.cents, 0));
        const shares = splitCents(d.cents, [...allocations.map((x) => x.cents), rest || (allocations.length === 0 ? 1 : 0)]).shares;
        allocations.forEach((a, i) => add(`lote:${a.lotId}`, `Origem ${book.lots.find((l) => l.id === a.lotId)?.code ?? '?'}`, shares[i], current));
        if (shares[allocations.length]) add(`geral:${e.farmId}`, 'Geral da fazenda', shares[allocations.length], current);
      }
    }
  }
  return [...rows.values()].sort((a, b) => b.cents - a.cents || b.previousCents - a.previousCents || a.label.localeCompare(b.label));
}

export interface BudgetRow {
  categoryId: string;
  name: string;
  budgetCents: number;
  actualCents: number;
  /** realizado − orçado (positivo = gastou mais). */
  varianceCents: number;
}

/** Orçado × realizado (competência) do mês, por categoria de despesa. */
export function budgetReport(book: FinanceBook, month: string): BudgetRow[] {
  const actual = new Map<string, number>();
  for (const entry of book.entries) {
    if (entry.status !== 'aprovado' || (entry.kind !== 'despesa' && entry.kind !== 'nota_fiscal')) continue;
    if (!book.farmIds.has(entry.farmId) || !book.operationIds.has(entry.operationId) || !entry.occurredAt.startsWith(month)) continue;
    const n = expenseNature(entry, book.categories);
    const key = n.id ?? n.name;
    actual.set(key, (actual.get(key) ?? 0) + (entry.amountCents ?? 0));
  }
  const budgets = book.budgets.filter((b) => b.month === month && book.operationIds.has(b.operationId));
  const ids = new Set([...budgets.map((b) => b.categoryId), ...actual.keys()]);
  return [...ids]
    .map((categoryId) => {
      const budgetCents = budgets.filter((b) => b.categoryId === categoryId).reduce((acc, b) => acc + b.cents, 0);
      const actualCents = actual.get(categoryId) ?? 0;
      return {
        categoryId,
        name: book.categories.find((c) => c.id === categoryId)?.name ?? categoryId,
        budgetCents,
        actualCents,
        varianceCents: actualCents - budgetCents,
      };
    })
    .sort((a, b) => b.budgetCents - a.budgetCents || b.actualCents - a.actualCents);
}

// ---------------------------------------------------------------------------------------------
// Indicadores do modo Analítico com os dados financeiros reais

export interface ProductionIndicators {
  /** Arrobas produzidas: ganho de peso dos animais (vivo ÷ 30), vendidos e em estoque. */
  arrobasProduced: number;
  /** Custos de produção apropriados aos lotes (despesas e consumo), sem a compra dos animais. */
  productionCostCents: number;
  costPerArrobaCents: number | null;
  /** Custos de produção por cabeça por mês (cabeça-dia ÷ 30). */
  costPerHeadMonthCents: number | null;
}

const LIVE_KG_PER_ARROBA = 30;

export function productionIndicators(summaries: LotSummary[]): ProductionIndicators {
  let arrobas = 0;
  let cost = 0;
  let headDays = 0;
  for (const s of summaries) {
    cost += s.expensesCents;
    headDays += s.headDays;
    const entry = s.lot.entryWeightKg;
    for (const sale of s.sales) arrobas += sale.arrobas - (entry * sale.heads) / LIVE_KG_PER_ARROBA;
    arrobas += (s.headsCurrent * (s.lastWeighing.kg - entry)) / LIVE_KG_PER_ARROBA;
  }
  return {
    arrobasProduced: arrobas,
    productionCostCents: cost,
    costPerArrobaCents: arrobas > 0 ? Math.round(cost / arrobas) : null,
    costPerHeadMonthCents: headDays > 0 ? Math.round((cost * 30) / headDays) : null,
  };
}
