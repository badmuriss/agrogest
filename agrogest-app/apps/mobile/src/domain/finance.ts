import { saleGrossCents } from './cattle';
import { addDays, daysBetween, formatDate, shiftMonth } from './dates';
import { formatCents } from './format';
import type {
  AccountKind,
  CategoryNature,
  CounterpartyKind,
  Entry,
  Financing,
  FinancialAccount,
  ImportedTitle,
  Installment,
  LedgerCategory,
  Lot,
  Movement,
  Payment,
  PaymentDirection,
  PaymentMethod,
  PaymentStatus,
  PurchasePartKind,
  PurchasePlan,
  Renegotiation,
  User,
} from './types';

/**
 * Plano de contas padrão. IDs fixos: o servidor tem a mesma lista em
 * `private.default_categories()` e um teste confere as duas. Os nomes das despesas antigas
 * (texto livre em `category`) continuam valendo e são ligados pelo nome.
 */
export const DEFAULT_CATEGORIES: LedgerCategory[] = [
  { id: 'cat-alimentacao', name: 'Alimentação e insumos', nature: 'custo_producao' },
  { id: 'cat-mao-de-obra', name: 'Mão de obra', nature: 'custo_producao' },
  { id: 'cat-medicamentos', name: 'Medicamentos e vacinas', nature: 'custo_producao' },
  { id: 'cat-cercas', name: 'Manutenção de cercas', nature: 'custo_producao' },
  { id: 'cat-pastagem', name: 'Pastagem', nature: 'custo_producao' },
  { id: 'cat-combustivel', name: 'Combustível', nature: 'custo_producao' },
  { id: 'cat-frete', name: 'Frete', nature: 'custo_producao' },
  { id: 'cat-estoque', name: 'Compra de insumos para estoque', nature: 'aquisicao_estoque' },
  { id: 'cat-animais', name: 'Compra de animais', nature: 'investimento' },
  { id: 'cat-administrativas', name: 'Despesas administrativas', nature: 'despesa_administrativa' },
  { id: 'cat-impostos', name: 'Impostos e taxas', nature: 'imposto' },
  { id: 'cat-investimentos', name: 'Máquinas, benfeitorias e equipamentos', nature: 'investimento' },
  { id: 'cat-outros', name: 'Outros', nature: 'despesa_administrativa' },
  { id: 'cat-venda-animais', name: 'Venda de animais', nature: 'receita_operacional' },
  { id: 'cat-outras-receitas', name: 'Outras receitas', nature: 'outra_receita' },
].map((c) => ({ ...c, operationId: null, active: true }) as LedgerCategory);

export const STOCK_CATEGORY_ID = 'cat-estoque';
export const SALE_CATEGORY_ID = 'cat-venda-animais';
export const LIVESTOCK_CATEGORY_ID = 'cat-animais';
export const OTHER_REVENUE_CATEGORY_ID = 'cat-outras-receitas';

/** Naturezas aceitas numa receita fora da venda de animais. */
export const REVENUE_NATURES: CategoryNature[] = ['receita_operacional', 'outra_receita'];

export const PART_LABEL: Record<PurchasePartKind, string> = {
  animais: 'Animais',
  comissao: 'Comissão',
  frete: 'Frete',
};

const PART_TITLE: Record<PurchasePartKind, string> = {
  animais: 'Compra de animais',
  comissao: 'Comissão da compra',
  frete: 'Frete da compra',
};

export const PURCHASE_PARTS: PurchasePartKind[] = ['animais', 'comissao', 'frete'];

/** Compras ainda sem plano, incluindo a origem de animais transferidos para o contexto. */
export function pendingLotPurchases(lots: Lot[], farmIds: ReadonlySet<string>, financeOperationIds: ReadonlySet<string>): Lot[] {
  const byId = new Map(lots.map((lot) => [lot.id, lot]));
  const relevant = new Set<string>();
  for (const lot of lots) {
    if (!farmIds.has(lot.farmId)) continue;
    let current: Lot | undefined = lot;
    while (current && !relevant.has(current.id)) {
      relevant.add(current.id);
      const sourceId: string | undefined = current.transfer?.incoming?.sourceLotId;
      current = sourceId ? byId.get(sourceId) : undefined;
    }
  }
  return lots.filter((lot) => relevant.has(lot.id) && financeOperationIds.has(lot.operationId)
    && !lot.transfer?.incoming && !lot.purchasePlan
    && lot.purchaseCents + lot.commissionCents + lot.freightCents > 0);
}

/** Valor de cada parte da compra do lote, em centavos. */
export function purchasePartCents(lot: Pick<Lot, 'purchaseCents' | 'commissionCents' | 'freightCents'>, kind: PurchasePartKind): number {
  return kind === 'animais' ? lot.purchaseCents : kind === 'comissao' ? lot.commissionCents : lot.freightCents;
}

/**
 * Parcelas do plano em ordem fixa (animais, comissão, frete; e as parcelas de cada um). O índice
 * nessa ordem identifica a conta a pagar (`lote:índice`), como as parcelas de uma despesa.
 */
export function planInstallments(plan: PurchasePlan): { kind: PurchasePartKind; counterparty: string; counterpartyId: string | null; installment: Installment }[] {
  return PURCHASE_PARTS.flatMap((kind) => {
    const part = plan.parts.find((p) => p.kind === kind);
    return part ? part.installments.map((installment) => ({ kind, counterparty: part.counterparty, counterpartyId: part.counterpartyId, installment })) : [];
  });
}

/** O plano fecha cada parte da compra do lote? Sem parte para valor zero, até 60 parcelas cada. */
export function purchasePlanError(lot: Pick<Lot, 'purchaseCents' | 'commissionCents' | 'freightCents'>, plan: PurchasePlan): string | null {
  const kinds = plan.parts.map((p) => p.kind);
  if (new Set(kinds).size !== kinds.length) return 'Cada parte da compra aparece uma vez só.';
  for (const kind of PURCHASE_PARTS) {
    const cents = purchasePartCents(lot, kind);
    const part = plan.parts.find((p) => p.kind === kind);
    if (cents > 0 && !part) return `Informe o pagamento ${kind === 'animais' ? 'dos animais' : kind === 'comissao' ? 'da comissão' : 'do frete'}.`;
    if (cents === 0 && part) return `${PART_LABEL[kind]} não tem valor no lote.`;
    if (!part) continue;
    if (part.installments.length === 0 || part.installments.length > 60) return `${PART_LABEL[kind]}: de 1 a 60 parcelas.`;
    if (part.installments.some((i) => !/^\d{4}-\d{2}-\d{2}$/.test(i.dueDate) || !Number.isInteger(i.cents) || i.cents <= 0)) {
      return `${PART_LABEL[kind]}: confira as datas e os valores das parcelas.`;
    }
    if (part.installments.reduce((acc, i) => acc + i.cents, 0) !== cents) {
      return `${PART_LABEL[kind]}: as parcelas precisam somar ${formatCents(cents)}.`;
    }
    if (part.counterparty.length > 150) return 'Use até 150 caracteres no nome.';
  }
  return null;
}

export const NATURE_LABEL: Record<CategoryNature, string> = {
  custo_producao: 'Custo de produção',
  despesa_administrativa: 'Despesa administrativa',
  investimento: 'Investimento',
  aquisicao_estoque: 'Compra para estoque',
  receita_operacional: 'Receita operacional',
  outra_receita: 'Outra receita',
  financiamento: 'Financiamento',
  movimentacao_socio: 'Movimentação de sócio',
  transferencia: 'Transferência',
  imposto: 'Imposto',
};

/** Naturezas de saída usadas em despesas (as de receita ficam para as vendas e outras receitas). */
export const EXPENSE_NATURES: CategoryNature[] = [
  'custo_producao',
  'despesa_administrativa',
  'investimento',
  'aquisicao_estoque',
  'imposto',
];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  caixa: 'Caixa (dinheiro)',
  investimento: 'Investimento',
  cartao: 'Cartão de crédito',
};

export const COUNTERPARTY_KIND_LABEL: Record<CounterpartyKind, string> = {
  fornecedor: 'Fornecedor',
  cliente: 'Cliente',
  ambos: 'Fornecedor e cliente',
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  transferencia: 'TED/transferência',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  cartao: 'Cartão',
  outro: 'Outro',
};

/** Categoria de uma despesa: pelo ID ou, nas antigas, pelo nome. */
export function categoryOf(
  payload: { categoryId?: string | null; category?: string },
  categories: LedgerCategory[],
): LedgerCategory | undefined {
  return (
    categories.find((c) => c.id === payload.categoryId) ??
    categories.find((c) => c.name.toLowerCase() === (payload.category ?? '').toLowerCase())
  );
}

/**
 * De onde vem a parcela: lançamento aprovado (despesa, nota, venda, receita), compra do lote,
 * financiamento, reembolso a um sócio, renegociação, conta trazida da planilha ou fatura do cartão
 * (esta se paga por transferência para o cartão, não pela baixa).
 */
export type ObligationSource = 'lancamento' | 'lote' | 'financiamento' | 'reembolso' | 'renegociacao' | 'importacao' | 'fatura';

/** Uma parcela a pagar ou a receber. Existe só para obrigações aprovadas. */
export interface Obligation {
  /** `origem:índice`: estável, porque a origem aprovada não é editada. */
  id: string;
  entryId: string;
  index: number;
  source: ObligationSource;
  /** Posição dentro do grupo de parcelas (1 de 3), para exibir. */
  position: number;
  count: number;
  direction: PaymentDirection;
  operationId: string;
  farmId: string;
  title: string;
  counterparty: string;
  counterpartyId: string | null;
  categoryId: string | null;
  categoryName: string;
  /** Competência do fato que gerou a parcela (a renegociação mantém a original). */
  occurredAt: string;
  dueDate: string;
  /** Valor devido. Numa parcela renegociada, só o que já estava quitado. */
  cents: number;
  /** Financiamento: quanto da parcela é juros (despesa financeira); o resto é amortização. */
  interestCents?: number;
  /** Encerrada por uma renegociação: o valor antes dela e quem a renegociou. */
  originalCents?: number;
  renegotiatedBy?: string;
  /** Sócio credor do reembolso. */
  partnerId?: string;
  /** Parcela de renegociação: a origem das parcelas que ela substituiu. */
  origin?: ObligationSource;
}

/** O que, além dos lançamentos e lotes, gera parcelas. */
export interface ObligationExtras {
  financings?: Financing[];
  renegotiations?: Renegotiation[];
  /** As baixas pagas por um sócio com dinheiro próprio viram reembolso a pagar. */
  payments?: Payment[];
  titles?: ImportedTitle[];
  users?: Pick<User, 'id' | 'name'>[];
}

/** Renegociações em vigor: efetivadas ou na fila deste aparelho. */
export const ACTIVE_RENEGOTIATION: PaymentStatus[] = ['efetivado', 'aguardando_envio'];

export const FINANCING_LINE_LABEL: Record<Financing['line'], string> = {
  custeio: 'Custeio',
  investimento: 'Investimento',
  comercializacao: 'Comercialização',
  pronamp: 'Pronamp',
  pronaf: 'Pronaf',
  outro: 'Outra linha',
};

export function installmentId(entryId: string, index: number): string {
  return `${entryId}:${index}`;
}

/** Índice de leitura por origem/parcela, preservando a primeira ocorrência como `find`. */
export function indexInstallments<T extends Pick<Obligation, 'entryId' | 'index'>>(rows: readonly T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const id = installmentId(row.entryId, row.index);
    if (!result.has(id)) result.set(id, row);
  }
  return result;
}

/** Valor a receber de uma venda: bruto pela arroba menos os descontos. */
export function saleNetCents(payload: { carcassKg: number; pricePerArrobaCents: number; deductionsCents: number }): number {
  return saleGrossCents(payload.carcassKg, payload.pricePerArrobaCents) - payload.deductionsCents;
}

/** Parcelas de recebimento da venda; as antigas, sem parcelas, vencem na data da venda. */
export function saleInstallments(entry: Extract<Entry, { kind: 'venda' }>): Installment[] {
  if (entry.payload.installments && entry.payload.installments.length > 0) return entry.payload.installments;
  const net = saleNetCents(entry.payload);
  return net > 0 ? [{ dueDate: entry.occurredAt, cents: net }] : [];
}

/**
 * Contas a pagar e a receber derivadas dos lançamentos aprovados: despesas (inclusive compras
 * para o estoque), notas fiscais revisadas, vendas e outras receitas; das compras de lote com o
 * pagamento informado; dos financiamentos; dos reembolsos a sócios; das contas importadas da
 * planilha. Uma obrigação por fato (RN-05); despesas antigas com parcelas entram aqui sem cópia nem
 * migração de dados. Por fim, as renegociações encerram as parcelas originais e criam as novas.
 */
export function obligations(
  entries: Entry[],
  categories: LedgerCategory[] = DEFAULT_CATEGORIES,
  lots: Lot[] = [],
  extras: ObligationExtras = {},
): Obligation[] {
  const result = baseObligations(entries, categories, lots, extras);
  for (const payment of extras.payments ?? []) {
    if (payment.partnerMode !== 'reembolso' || !payment.partnerId || !SETTLING.includes(payment.status)) continue;
    const first = result.find((o) => o.entryId === payment.items[0]?.entryId && o.index === payment.items[0]?.index);
    const name = extras.users?.find((u) => u.id === payment.partnerId)?.name ?? 'Sócio';
    result.push({
      id: installmentId(payment.id, 0),
      entryId: payment.id,
      index: 0,
      source: 'reembolso',
      position: 1,
      count: 1,
      direction: 'pagar',
      operationId: payment.operationId,
      farmId: first?.farmId ?? '',
      title: `Reembolso a ${name}${first ? ` · ${first.title}` : ''}`,
      counterparty: name,
      counterpartyId: null,
      categoryId: null,
      categoryName: 'Reembolso a sócio',
      occurredAt: payment.paidAt,
      dueDate: payment.paidAt,
      cents: paymentTotal(payment),
      partnerId: payment.partnerId,
    });
  }
  const renegotiations = [...(extras.renegotiations ?? [])]
    .filter((r) => ACTIVE_RENEGOTIATION.includes(r.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const reneg of renegotiations) {
    const originals = reneg.items
      .map((item) => ({ item, obligation: result.find((o) => o.entryId === item.entryId && o.index === item.index) }))
      .filter((x): x is { item: Renegotiation['items'][number]; obligation: Obligation } => x.obligation !== undefined);
    if (originals.length === 0) continue;
    for (const { item, obligation } of originals) {
      obligation.originalCents = obligation.originalCents ?? obligation.cents;
      obligation.cents = Math.min(obligation.cents, item.settledCents);
      obligation.renegotiatedBy = reneg.id;
    }
    const base = originals[0].obligation;
    const sameCounterparty = originals.every((x) => x.obligation.counterparty === base.counterparty);
    reneg.installments.forEach((installment, index) => {
      result.push({
        ...base,
        id: installmentId(reneg.id, index),
        entryId: reneg.id,
        index,
        source: 'renegociacao',
        origin: base.origin ?? base.source,
        position: index + 1,
        count: reneg.installments.length,
        title: originals.length > 1 ? `Renegociação de ${originals.length} parcelas · ${base.title}` : `${base.title} (renegociada)`,
        counterparty: sameCounterparty ? base.counterparty : '',
        dueDate: installment.dueDate,
        cents: installment.cents,
        interestCents: undefined,
        originalCents: undefined,
        renegotiatedBy: undefined,
      });
    });
  }
  return result;
}

function baseObligations(entries: Entry[], categories: LedgerCategory[], lots: Lot[], extras: ObligationExtras): Obligation[] {
  const result: Obligation[] = [];
  for (const financing of extras.financings ?? []) {
    financing.schedule.forEach((item, index) => {
      result.push({
        id: installmentId(financing.id, index),
        entryId: financing.id,
        index,
        source: 'financiamento',
        position: index + 1,
        count: financing.schedule.length,
        direction: 'pagar',
        operationId: financing.operationId,
        farmId: financing.farmId,
        title: `Financiamento ${FINANCING_LINE_LABEL[financing.line].toLowerCase()} · ${financing.bank}`,
        counterparty: financing.bank,
        counterpartyId: null,
        categoryId: null,
        categoryName: 'Financiamento',
        occurredAt: item.dueDate,
        dueDate: item.dueDate,
        cents: item.principalCents + item.interestCents,
        interestCents: item.interestCents,
      });
    });
  }
  for (const title of extras.titles ?? []) {
    const category = categories.find((c) => c.id === title.categoryId);
    title.installments.forEach((item, index) => {
      result.push({
        id: installmentId(title.id, index),
        entryId: title.id,
        index,
        source: 'importacao',
        position: index + 1,
        count: title.installments.length,
        direction: title.direction,
        operationId: title.operationId,
        farmId: title.farmId,
        title: title.title,
        counterparty: title.counterparty,
        counterpartyId: null,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? 'Saldo da planilha',
        occurredAt: title.occurredAt,
        dueDate: item.dueDate,
        cents: item.cents,
      });
    });
  }
  // Compra do lote com o pagamento informado. Lote antigo, sem plano, não vira conta sozinho.
  const livestock = categories.find((c) => c.id === LIVESTOCK_CATEGORY_ID);
  for (const lot of lots) {
    if (!lot.purchasePlan) continue;
    const list = planInstallments(lot.purchasePlan);
    const counts = new Map<PurchasePartKind, number>();
    const positions = new Map<PurchasePartKind, number>();
    for (const item of list) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    list.forEach((item, index) => {
      const position = (positions.get(item.kind) ?? 0) + 1;
      positions.set(item.kind, position);
      result.push({
        id: installmentId(lot.id, index),
        entryId: lot.id,
        index,
        source: 'lote',
        position,
        count: counts.get(item.kind)!,
        direction: 'pagar',
        operationId: lot.operationId,
        farmId: lot.farmId,
        title: `${PART_TITLE[item.kind]} · Origem ${lot.code}`,
        counterparty: item.counterparty,
        counterpartyId: item.counterpartyId,
        categoryId: livestock?.id ?? null,
        categoryName: livestock?.name ?? 'Compra de animais',
        occurredAt: lot.purchasedAt,
        dueDate: item.installment.dueDate,
        cents: item.installment.cents,
      });
    });
  }
  for (const entry of entries) {
    if (entry.status !== 'aprovado') continue;
    let direction: PaymentDirection;
    let installments: Installment[];
    let counterparty = '';
    let counterpartyId: string | null = null;
    let category: LedgerCategory | undefined;
    if (entry.kind === 'despesa') {
      direction = 'pagar';
      installments = entry.payload.installments;
      counterparty = entry.payload.supplier;
      counterpartyId = entry.payload.counterpartyId ?? null;
      category =
        entry.payload.destination === 'estoque'
          ? categories.find((c) => c.id === STOCK_CATEGORY_ID)
          : categoryOf(entry.payload, categories);
    } else if (entry.kind === 'nota_fiscal') {
      if (entry.payload.stage !== 'revisada') continue;
      direction = 'pagar';
      installments = entry.payload.installments;
      counterparty = entry.payload.extraction?.supplier ?? '';
      category = categories.find((c) => c.id === (entry.payload.destination === 'estoque' ? STOCK_CATEGORY_ID : 'cat-alimentacao'));
    } else if (entry.kind === 'venda') {
      direction = 'receber';
      installments = saleInstallments(entry);
      counterparty = entry.payload.buyer;
      counterpartyId = entry.payload.counterpartyId ?? null;
      category = categories.find((c) => c.id === SALE_CATEGORY_ID);
    } else if (entry.kind === 'receita') {
      direction = 'receber';
      installments = entry.payload.installments;
      counterparty = entry.payload.counterparty;
      counterpartyId = entry.payload.counterpartyId ?? null;
      category = categoryOf(entry.payload, categories) ?? categories.find((c) => c.id === OTHER_REVENUE_CATEGORY_ID);
    } else {
      continue;
    }
    installments.forEach((item, index) => {
      result.push({
        id: installmentId(entry.id, index),
        entryId: entry.id,
        index,
        source: 'lancamento',
        position: index + 1,
        count: installments.length,
        direction,
        operationId: entry.operationId,
        farmId: entry.farmId,
        title: entry.title,
        counterparty,
        counterpartyId,
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? (entry.kind === 'despesa' ? entry.payload.category : ''),
        occurredAt: entry.occurredAt,
        dueDate: item.dueDate,
        cents: item.cents,
      });
    });
  }
  return result;
}

/** Baixas que quitam parcelas. No aparelho, as ainda não enviadas também reservam o saldo. */
export const SETTLING: PaymentStatus[] = ['efetivado', 'aguardando_envio'];
export const CONFIRMED_PAYMENTS: PaymentStatus[] = ['efetivado'];

export type InstallmentState = 'paga' | 'parcial' | 'vencida' | 'vence_hoje' | 'em_aberto' | 'renegociada' | 'cancelada';

export interface InstallmentView extends Obligation {
  paidCents: number;
  openCents: number;
  state: InstallmentState;
  /** Dias até o vencimento (negativo quando vencida). */
  daysToDue: number;
  payments: Payment[];
}

export const STATE_LABEL: Record<InstallmentState, string> = {
  paga: 'Paga',
  parcial: 'Paga em parte',
  vencida: 'Vencida',
  vence_hoje: 'Vence hoje',
  em_aberto: 'Em aberto',
  renegociada: 'Renegociada',
  cancelada: 'Cancelada',
};

export function settledByInstallment(payments: Payment[], statuses: PaymentStatus[] = SETTLING): Map<string, number> {
  const settled = new Map<string, number>();
  for (const payment of payments) {
    if (!statuses.includes(payment.status)) continue;
    for (const item of payment.items) {
      const id = installmentId(item.entryId, item.index);
      settled.set(id, (settled.get(id) ?? 0) + item.cents);
    }
  }
  return settled;
}

export function installmentState(cents: number, paidCents: number, dueDate: string, today: string): InstallmentState {
  if (paidCents >= cents) return 'paga';
  if (dueDate < today) return 'vencida';
  if (paidCents > 0) return 'parcial';
  if (dueDate === today) return 'vence_hoje';
  return 'em_aberto';
}

/** Situação de cada parcela com o que já foi quitado e as baixas que a citam. */
export function installmentViews(
  entries: Entry[],
  payments: Payment[],
  today: string,
  categories: LedgerCategory[] = DEFAULT_CATEGORIES,
  lots: Lot[] = [],
  extras: ObligationExtras = {},
): InstallmentView[] {
  const settled = settledByInstallment(payments);
  const renegotiations = extras.renegotiations ?? [];
  // O histórico inclui estornos e conflitos; só o total quitado filtra por situação.
  const paymentsByInstallment = new Map<string, Payment[]>();
  for (const payment of payments) {
    const ids = new Set(payment.items.map((item) => installmentId(item.entryId, item.index)));
    for (const id of ids) {
      const history = paymentsByInstallment.get(id) ?? [];
      history.push(payment);
      paymentsByInstallment.set(id, history);
    }
  }
  return obligations(entries, categories, lots, { ...extras, payments: extras.payments ?? payments }).map((o) => {
    const paidCents = Math.min(o.cents, settled.get(o.id) ?? 0);
    const closedBy = o.renegotiatedBy ? renegotiations.find((r) => r.id === o.renegotiatedBy) : undefined;
    return {
      ...o,
      paidCents,
      openCents: o.cents - paidCents,
      state: closedBy
        ? closedBy.installments.length === 0
          ? 'cancelada'
          : 'renegociada'
        : installmentState(o.cents, paidCents, o.dueDate, today),
      daysToDue: daysBetween(today, o.dueDate),
      payments: paymentsByInstallment.get(o.id) ?? [],
    };
  });
}

/** Quanto saiu (ou entrou) da conta: principal + juros + multa − desconto. */
export function paymentTotal(p: Pick<Payment, 'items' | 'interestCents' | 'fineCents' | 'discountCents'>): number {
  return p.items.reduce((acc, i) => acc + i.cents, 0) + p.interestCents + p.fineCents - p.discountCents;
}

export type PaymentInput = Omit<
  Payment,
  'id' | 'status' | 'conflictReason' | 'authorId' | 'createdAt' | 'reversedBy' | 'reversedAt' | 'reverseReason'
>;

const isCents = (n: number) => Number.isInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;

/** O que a baixa precisa saber além das contas: sócios da operação e adiantamentos de clientes. */
export interface PaymentContext {
  /** Sócios (IDs) da operação que podem ter pago com dinheiro próprio. */
  partners?: string[];
  movements?: Movement[];
  payments?: Payment[];
}

/** Erros do formulário de baixa, antes de qualquer saldo. */
export function paymentErrors(input: PaymentInput, accounts: FinancialAccount[], today: string, ctx: PaymentContext = {}): string | null {
  const sources = [input.accountId, input.partnerId, input.advanceId].filter(Boolean).length;
  if (sources !== 1) return 'Escolha a conta de onde saiu ou entrou o dinheiro.';
  if (input.items.length === 0) return 'Escolha ao menos uma parcela.';
  if (input.items.some((i) => !isCents(i.cents) || i.cents === 0)) return 'Informe o valor de cada parcela.';
  const keys = input.items.map((i) => installmentId(i.entryId, i.index));
  if (new Set(keys).size !== keys.length) return 'A mesma parcela aparece duas vezes.';
  if (![input.interestCents, input.fineCents, input.discountCents].every(isCents)) return 'Juros, multa e desconto precisam ser valores válidos.';
  if (paymentTotal(input) < 0) return 'O desconto não pode passar do valor pago.';
  if (input.paidAt > today) return 'A data do pagamento não pode ser futura.';
  if (input.proof.length > 200 || input.notes.length > 500) return 'Comprovante até 200 e observação até 500 caracteres.';
  if (input.partnerId) {
    if (input.direction !== 'pagar') return 'Só pagamentos podem ser feitos por um sócio com dinheiro próprio.';
    if (input.partnerMode !== 'reembolso' && input.partnerMode !== 'aporte') return 'Escolha se o sócio recebe o reembolso ou se fica como aporte.';
    if (ctx.partners && !ctx.partners.includes(input.partnerId)) return 'Escolha um sócio desta operação.';
    return null;
  }
  if (input.advanceId) {
    if (input.direction !== 'receber') return 'Adiantamento só compensa recebimentos.';
    const advance = (ctx.movements ?? []).find((m) => m.id === input.advanceId && m.kind === 'adiantamento' && m.operationId === input.operationId);
    if (!advance || !SETTLING.includes(advance.status)) return 'Adiantamento não encontrado.';
    const left = advanceBalance(advance, ctx.payments ?? []);
    if (paymentTotal(input) > left) return `O adiantamento tem ${formatCents(left)} para compensar.`;
    return null;
  }
  const account = accounts.find((a) => a.id === input.accountId && a.operationId === input.operationId);
  if (!account) return 'Escolha a conta de onde saiu ou entrou o dinheiro.';
  if (!account.active) return `${account.name} está inativa. Escolha outra conta.`;
  if (input.paidAt < account.openingDate) return `A conta começa em ${formatDate(account.openingDate)}. Use uma data a partir dela.`;
  return null;
}

/**
 * A baixa cabe nas parcelas? Só sobre obrigação aprovada, da mesma operação e direção, sem passar
 * do valor em aberto (somando as outras baixas que quitam). Igual ao servidor, que decide sob o
 * bloqueio da operação; lá, o excesso vira baixa em conflito em vez de travar a fila.
 */
export function paymentConflict(
  payment: Pick<Payment, 'id' | 'operationId' | 'direction' | 'items'>,
  entries: Entry[],
  payments: Payment[],
  statuses: PaymentStatus[] = SETTLING,
  lots: Lot[] = [],
  extras: ObligationExtras = {},
): string | null {
  const settled = settledByInstallment(payments.filter((p) => p.id !== payment.id), statuses);
  const all = obligations(entries, DEFAULT_CATEGORIES, lots, {
    ...extras,
    payments: (extras.payments ?? payments).filter((p) => p.id !== payment.id && statuses.includes(p.status)),
    renegotiations: (extras.renegotiations ?? []).filter((r) => statuses.includes(r.status)),
  });
  for (const item of payment.items) {
    const owner = entries.find((e) => e.id === item.entryId) ?? lots.find((l) => l.id === item.entryId);
    if (owner && owner.operationId !== payment.operationId) return 'A conta não pertence a esta operação.';
    if (owner && 'status' in owner && owner.status !== 'aprovado') return `"${owner.title}" ainda não foi aprovada. A baixa só vale para conta aprovada.`;
    const obligation = all.find((o) => o.entryId === item.entryId && o.index === item.index);
    if (!obligation) return owner ? 'Parcela não encontrada.' : 'A conta não pertence a esta operação.';
    if (obligation.operationId !== payment.operationId) return 'A conta não pertence a esta operação.';
    if (obligation.direction !== payment.direction) return 'Parcela não encontrada.';
    const title = obligation.title;
    const open = obligation.cents - (settled.get(obligation.id) ?? 0);
    if (item.cents > open) {
      if (obligation.renegotiatedBy) return `A parcela ${obligation.position} de "${title}" foi renegociada. Pague as parcelas novas.`;
      return open <= 0
        ? `A parcela ${obligation.position} de "${title}" já foi quitada, talvez em outro aparelho.`
        : `A parcela ${obligation.position} de "${title}" tem ${formatCents(open)} em aberto; a baixa pede ${formatCents(item.cents)}.`;
    }
  }
  return null;
}

/**
 * Por que esta baixa não pode ser estornada? Uma parcela renegociada congelou o que estava pago, e
 * um reembolso a sócio já pago depende da baixa que o criou.
 */
export function reversalBlock(payment: Payment, payments: Payment[], renegotiations: Renegotiation[]): string | null {
  if (payment.status !== 'efetivado') return null;
  const frozen = renegotiations.some((r) => ACTIVE_RENEGOTIATION.includes(r.status)
    && r.items.some((i) => payment.items.some((p) => p.entryId === i.entryId && p.index === i.index)));
  if (frozen) return 'Esta baixa quita uma parcela que foi renegociada. Desfaça a renegociação antes de estornar.';
  if (payment.partnerMode === 'reembolso' && payments.some((p) => p.id !== payment.id && SETTLING.includes(p.status) && p.items.some((i) => i.entryId === payment.id))) {
    return 'O reembolso desta baixa já foi pago ao sócio. Estorne o reembolso antes.';
  }
  return null;
}

/** Quanto do adiantamento do cliente ainda pode ser compensado nos recebimentos. */
export function advanceBalance(advance: Movement, payments: Payment[]): number {
  const used = payments
    .filter((p) => p.advanceId === advance.id && SETTLING.includes(p.status))
    .reduce((acc, p) => acc + paymentTotal(p), 0);
  return advance.cents - used;
}

/** Baixas que já quitam alguma parcela da compra do lote (efetivadas ou na fila). */
export function lotHasPayments(lotId: string, payments: Payment[]): boolean {
  return payments.some((p) => SETTLING.includes(p.status) && p.items.some((i) => i.entryId === lotId));
}

/** Sinal da baixa no caixa: recebimento entra, pagamento sai. */
export function paymentSign(direction: PaymentDirection): 1 | -1 {
  return direction === 'receber' ? 1 : -1;
}

/** Sinal da movimentação na conta: sai da conta de origem e entra na de destino. */
export function movementSign(movement: Pick<Movement, 'fromAccountId' | 'toAccountId'>, accountId: string): 1 | -1 | 0 {
  if (movement.toAccountId === accountId) return 1;
  if (movement.fromAccountId === accountId) return -1;
  return 0;
}

export interface StatementLine {
  id: string;
  /** Uma das duas: a baixa ou a movimentação que mexeu no saldo. */
  payment?: Payment;
  movement?: Movement;
  date: string;
  cents: number;
  balanceCents: number;
}

/** Extrato da conta: saldo inicial, cada baixa e cada movimentação que contam, em ordem de data. */
export function statement(
  account: FinancialAccount,
  payments: Payment[],
  statuses: PaymentStatus[] = SETTLING,
  movements: Movement[] = [],
): StatementLine[] {
  let balance = account.openingBalanceCents;
  const lines: (Omit<StatementLine, 'balanceCents'> & { createdAt: string })[] = [
    ...payments
      .filter((p) => p.accountId === account.id && statuses.includes(p.status))
      .map((payment) => ({ id: payment.id, payment, date: payment.paidAt, createdAt: payment.createdAt, cents: paymentSign(payment.direction) * paymentTotal(payment) })),
    ...movements
      .filter((m) => statuses.includes(m.status) && movementSign(m, account.id) !== 0)
      .map((movement) => ({ id: movement.id, movement, date: movement.occurredAt, createdAt: movement.createdAt, cents: movementSign(movement, account.id) * movement.cents })),
  ];
  return lines
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map(({ createdAt: _createdAt, ...line }) => {
      balance += line.cents;
      return { ...line, balanceCents: balance };
    });
}

export function accountBalance(
  account: FinancialAccount,
  payments: Payment[],
  statuses: PaymentStatus[] = SETTLING,
  movements: Movement[] = [],
): number {
  const lines = statement(account, payments, statuses, movements);
  return lines.length > 0 ? lines[lines.length - 1].balanceCents : account.openingBalanceCents;
}

export interface AccountInput {
  name: string;
  kind: AccountKind;
  bank: string;
  agency: string;
  number: string;
  openingBalanceCents: number;
  openingDate: string;
  active: boolean;
  closingDay?: number | null;
  dueDay?: number | null;
}

const validDay = (day: number | null | undefined) => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 28;

export function accountErrors(input: AccountInput, others: Pick<FinancialAccount, 'name'>[]): string | null {
  const name = input.name.trim();
  if (!name || name.length > 100) return 'Dê um nome à conta (até 100 caracteres).';
  if (others.some((o) => o.name.trim().toLowerCase() === name.toLowerCase())) return 'Já existe uma conta com este nome.';
  if (!Number.isInteger(input.openingBalanceCents) || Math.abs(input.openingBalanceCents) > Number.MAX_SAFE_INTEGER) return 'Saldo inicial inválido.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.openingDate)) return 'Informe a data do saldo inicial.';
  if ([input.bank, input.agency, input.number].some((v) => v.length > 60)) return 'Use até 60 caracteres nos dados bancários.';
  if (input.kind === 'cartao' && (!validDay(input.closingDay) || !validDay(input.dueDay))) return 'Informe os dias de fechamento e de vencimento da fatura (1 a 28).';
  return null;
}

/** Dinheiro disponível: o cartão de crédito é dívida, não caixa. */
export function isCashAccount(account: Pick<FinancialAccount, 'kind'>): boolean {
  return account.kind !== 'cartao';
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const monthOf = (iso: string) => iso.slice(0, 7);
/** Fatura em que cai uma compra no cartão: a do mês do fechamento seguinte (inclusive o do dia). */
export function invoiceMonthOf(date: string, closingDay: number): string {
  return Number(date.slice(8, 10)) <= closingDay ? monthOf(date) : shiftMonth(monthOf(date), 1);
}

/** Vencimento da fatura: no mês do fechamento, se o dia vier depois dele; senão no mês seguinte. */
export function invoiceDueDate(month: string, closingDay: number, dueDay: number): string {
  return `${dueDay > closingDay ? month : shiftMonth(month, 1)}-${pad2(dueDay)}`;
}

export interface CardInvoice {
  /** `fatura:conta:AAAA-MM`. */
  id: string;
  accountId: string;
  operationId: string;
  month: string;
  closingDate: string;
  dueDate: string;
  /** Compras menos estornos lançados no cartão no ciclo. */
  chargesCents: number;
  paidCents: number;
  openCents: number;
  daysToDue: number;
  closed: boolean;
}

/**
 * Faturas do cartão: as compras (baixas feitas com o cartão) entram na fatura do ciclo; a fatura é a
 * conta a pagar, quitada por uma transferência de outra conta para o cartão. A competência da
 * despesa continua na data da compra.
 */
export function cardInvoices(
  account: FinancialAccount,
  payments: Payment[],
  movements: Movement[],
  today: string,
  statuses: PaymentStatus[] = SETTLING,
): CardInvoice[] {
  if (account.kind !== 'cartao' || !validDay(account.closingDay) || !validDay(account.dueDay)) return [];
  const closing = account.closingDay!;
  const due = account.dueDay!;
  const byMonth = new Map<string, { charges: number; paid: number }>();
  const at = (month: string) => byMonth.get(month) ?? byMonth.set(month, { charges: 0, paid: 0 }).get(month)!;
  if (account.openingBalanceCents < 0) at(invoiceMonthOf(account.openingDate, closing)).charges += -account.openingBalanceCents;
  for (const p of payments) {
    if (p.accountId !== account.id || !statuses.includes(p.status)) continue;
    at(invoiceMonthOf(p.paidAt, closing)).charges += -paymentSign(p.direction) * paymentTotal(p);
  }
  for (const m of movements) {
    if (!statuses.includes(m.status)) continue;
    const sign = movementSign(m, account.id);
    if (sign === 0) continue;
    if (sign > 0) at(m.invoiceMonth ?? invoiceMonthOf(m.occurredAt, closing)).paid += m.cents;
    else at(invoiceMonthOf(m.occurredAt, closing)).charges += m.cents;
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => {
      const dueDate = invoiceDueDate(month, closing, due);
      const closingDate = `${month}-${pad2(closing)}`;
      return {
        id: `fatura:${account.id}:${month}`,
        accountId: account.id,
        operationId: account.operationId,
        month,
        closingDate,
        dueDate,
        chargesCents: v.charges,
        paidCents: v.paid,
        openCents: Math.max(0, v.charges - v.paid),
        daysToDue: daysBetween(today, dueDate),
        closed: closingDate < today,
      };
    });
}

/** Quantos dias antes do vencimento o aparelho avisa (0 = no dia). */
export const ALERT_DAYS = [3, 0];
/** Hora local dos avisos. */
export const ALERT_HOUR = 8;

export type DueAlertTarget =
  | { kind: 'installment'; id: string; operationId: string }
  | { kind: 'recurrence'; id: string; operationId: string }
  | { kind: 'finance' };

export interface DueAlert {
  id: string;
  target?: DueAlertTarget;
  /** Dia do aviso (AAAA-MM-DD), às `ALERT_HOUR`. */
  date: string;
  title: string;
  body: string;
}

/** Antecedências que a pessoa pode escolher para os avisos (0 = no dia). */
export const ALERT_DAY_OPTIONS = [0, 1, 3, 5, 7, 15];

/** "3,0" (preferência salva) → [3, 0]; inválido volta ao padrão. */
export function parseAlertDays(value: string | undefined): number[] {
  if (value === undefined) return ALERT_DAYS;
  if (value === '') return [];
  const days = [...new Set(value.split(',').map(Number).filter((d) => ALERT_DAY_OPTIONS.includes(d)))].sort((a, b) => b - a);
  return days.length > 0 ? days : ALERT_DAYS;
}

/** Mês previsto de uma despesa recorrente (`domain/treasury.ts`) e a despesa lançada para ele. */
export interface RecurrenceOccurrence {
  /** `recorrente:id:AAAA-MM`. */
  id: string;
  recurrenceId: string;
  operationId: string;
  farmId: string;
  month: string;
  title: string;
  counterparty: string;
  categoryId: string;
  dueDate: string;
  cents: number;
  /** Despesa já lançada (não recusada) para este mês: a prevista deixa de valer. */
  entryId: string | null;
  daysToDue: number;
}

export interface AlertOptions {
  /** Dias de antecedência; padrão `ALERT_DAYS`. */
  days?: number[];
  /** Um lembrete diário das vencidas, nos próximos dias. */
  overdueReminder?: boolean;
  invoices?: CardInvoice[];
  occurrences?: RecurrenceOccurrence[];
}

/** Avisos de vencimento das parcelas em aberto, a partir de hoje e mais próximos primeiro. */
export function dueAlerts(views: InstallmentView[], today: string, limit = 60, options: AlertOptions = {}): DueAlert[] {
  const alertDays = options.days ?? ALERT_DAYS;
  const alerts: DueAlert[] = [];
  for (const invoice of options.invoices ?? []) {
    if (invoice.openCents <= 0) continue;
    for (const days of alertDays) {
      const date = addDays(invoice.dueDate, -days);
      if (date < today) continue;
      alerts.push({
        id: `${invoice.id}:${days}`,
        target: { kind: 'installment', id: invoice.id, operationId: invoice.operationId },
        date,
        title: days === 0 ? `Fatura vence hoje: ${formatCents(invoice.openCents)}` : `Fatura vence em ${days} dias: ${formatCents(invoice.openCents)}`,
        body: `Cartão · fatura de ${invoice.month.slice(5, 7)}/${invoice.month.slice(0, 4)} · vence ${formatDate(invoice.dueDate)}`,
      });
    }
  }
  for (const o of options.occurrences ?? []) {
    if (o.entryId) continue;
    for (const days of alertDays) {
      const date = addDays(o.dueDate, -days);
      if (date < today) continue;
      alerts.push({
        id: `recorrente:${o.recurrenceId}:${o.month}:${days}`,
        target: { kind: 'recurrence', id: o.recurrenceId, operationId: o.operationId },
        date,
        title: `Despesa prevista: ${formatCents(o.cents)}`,
        body: `${o.title} · vence ${formatDate(o.dueDate)} · lance para virar conta a pagar`,
      });
    }
  }
  if (options.overdueReminder) {
    const overdue = views.filter((v) => v.openCents > 0 && v.daysToDue < 0 && v.direction === 'pagar');
    if (overdue.length > 0) {
      const cents = overdue.reduce((acc, v) => acc + v.openCents, 0);
      for (let d = 1; d <= 7; d++) {
        alerts.push({
          id: `vencidas:${addDays(today, d)}`,
          target: { kind: 'finance' },
          date: addDays(today, d),
          title: `${overdue.length === 1 ? '1 conta vencida' : `${overdue.length} contas vencidas`}: ${formatCents(cents)}`,
          body: 'Pague ou renegocie para manter o financeiro em dia.',
        });
      }
    }
  }
  for (const v of views) {
    if (v.openCents <= 0) continue;
    for (const days of alertDays) {
      const date = addDays(v.dueDate, -days);
      if (date < today) continue;
      const verb = v.direction === 'pagar' ? 'Pagar' : 'Receber';
      alerts.push({
        id: `${v.id}:${days}`,
        target: { kind: 'installment', id: v.id, operationId: v.operationId },
        date,
        title: days === 0 ? `${verb} hoje: ${formatCents(v.openCents)}` : `${verb} em ${days} dias: ${formatCents(v.openCents)}`,
        body: `${v.title}${v.count > 1 ? ` · parcela ${v.position}/${v.count}` : ''}${v.counterparty ? ` · ${v.counterparty}` : ''} · vence ${formatDate(v.dueDate)}`,
      });
    }
  }
  return alerts.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(0, limit);
}

export interface DueSummary {
  overdueCents: number;
  overdueCount: number;
  next7Cents: number;
  next7Count: number;
  openCents: number;
}

export function dueSummary(views: InstallmentView[], direction: PaymentDirection): DueSummary {
  const open = views.filter((v) => v.direction === direction && v.openCents > 0);
  const overdue = open.filter((v) => v.daysToDue < 0);
  const next7 = open.filter((v) => v.daysToDue >= 0 && v.daysToDue <= 7);
  const sum = (list: InstallmentView[]) => list.reduce((acc, v) => acc + v.openCents, 0);
  return {
    overdueCents: sum(overdue),
    overdueCount: overdue.length,
    next7Cents: sum(next7),
    next7Count: next7.length,
    openCents: sum(open),
  };
}
