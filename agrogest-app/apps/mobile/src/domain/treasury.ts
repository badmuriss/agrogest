import { addMonths, daysBetween, formatDate, shiftMonth } from './dates';
import {
  EXPENSE_NATURES,
  FINANCING_LINE_LABEL,
  installmentState,
  paymentTotal,
  SETTLING,
  STOCK_CATEGORY_ID,
  type CardInvoice,
  type InstallmentView,
  type RecurrenceOccurrence,
} from './finance';
import { formatCents } from './format';
import type {
  Entry,
  Financing,
  FinancingInstallment,
  FinancialAccount,
  Installment,
  LedgerCategory,
  Movement,
  MovementKind,
  ObligationRef,
  Payment,
  PaymentStatus,
  Recurrence,
  Renegotiation,
} from './types';

const isCents = (n: number) => Number.isInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const pad2 = (n: number) => String(n).padStart(2, '0');
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export { shiftMonth } from './dates';

/** Fatura do cartão na lista de contas a pagar e nos avisos. Paga por transferência, não por baixa. */
export function invoiceView(invoice: CardInvoice, account: FinancialAccount, farmId: string, today: string): InstallmentView {
  return {
    id: invoice.id,
    entryId: account.id,
    index: Number(invoice.month.replace('-', '')),
    source: 'fatura',
    position: 1,
    count: 1,
    direction: 'pagar',
    operationId: account.operationId,
    farmId,
    title: `Fatura ${invoice.month.slice(5, 7)}/${invoice.month.slice(0, 4)} · ${account.name}`,
    counterparty: account.bank,
    counterpartyId: null,
    categoryId: null,
    categoryName: 'Cartão de crédito',
    occurredAt: invoice.closingDate,
    dueDate: invoice.dueDate,
    cents: invoice.chargesCents,
    paidCents: Math.min(invoice.chargesCents, invoice.paidCents),
    openCents: invoice.openCents,
    state: installmentState(invoice.chargesCents, invoice.paidCents, invoice.dueDate, today),
    daysToDue: invoice.daysToDue,
    payments: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Despesas recorrentes

export function recurrenceDueDate(recurrence: Pick<Recurrence, 'dayOfMonth'>, month: string): string {
  return `${month}-${pad2(recurrence.dayOfMonth)}`;
}

/**
 * Meses previstos de cada recorrência até `untilMonth`. Os já lançados apontam a despesa; os outros
 * são parcelas previstas: entram no fluxo projetado e nos avisos, mas só viram conta a pagar quando
 * alguém lança a despesa do mês (que passa pela aprovação como qualquer despesa).
 */
export function recurrenceOccurrences(recurrences: Recurrence[], entries: Entry[], untilMonth: string, today: string): RecurrenceOccurrence[] {
  const launched = new Map<string, string>();
  for (const e of entries) {
    if (e.kind !== 'despesa' || !e.payload.recurrence || e.status === 'rejeitado') continue;
    launched.set(`${e.payload.recurrence.id}:${e.payload.recurrence.month}`, e.id);
  }
  const result: RecurrenceOccurrence[] = [];
  for (const r of recurrences) {
    const last = r.endMonth && r.endMonth < untilMonth ? r.endMonth : untilMonth;
    for (let month = r.startMonth, guard = 0; month <= last && guard < 240; month = shiftMonth(month, 1), guard++) {
      const entryId = launched.get(`${r.id}:${month}`) ?? null;
      if (!r.active && !entryId) continue;
      const dueDate = recurrenceDueDate(r, month);
      result.push({
        id: `recorrente:${r.id}:${month}`,
        recurrenceId: r.id,
        operationId: r.operationId,
        farmId: r.farmId,
        month,
        title: r.title,
        counterparty: r.counterparty,
        categoryId: r.categoryId,
        dueDate,
        cents: r.cents,
        entryId,
        daysToDue: daysBetween(today, dueDate),
      });
    }
  }
  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
}

export type RecurrenceInput = Pick<
  Recurrence,
  'costCenterId' | 'farmId' | 'title' | 'categoryId' | 'counterparty' | 'counterpartyId' | 'cents' | 'dayOfMonth' | 'startMonth' | 'endMonth' | 'active'
>;

export function recurrenceErrors(input: RecurrenceInput, categories: LedgerCategory[]): string | null {
  const title = input.title.trim();
  if (!title || title.length > 120) return 'Dê um nome à despesa (até 120 caracteres).';
  const category = categories.find((c) => c.id === input.categoryId);
  if (!category || !EXPENSE_NATURES.includes(category.nature) || category.id === STOCK_CATEGORY_ID) return 'Escolha a categoria da despesa.';
  if (!isCents(input.cents) || input.cents === 0) return 'Informe o valor de cada mês.';
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 28) return 'O vencimento vai do dia 1 ao 28.';
  if (!MONTH_RE.test(input.startMonth)) return 'Informe o primeiro mês.';
  if (input.endMonth !== null && (!MONTH_RE.test(input.endMonth) || input.endMonth < input.startMonth)) return 'O último mês precisa vir depois do primeiro.';
  if (input.counterparty.length > 150) return 'Use até 150 caracteres no fornecedor.';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Movimentações

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  transferencia: 'Transferência entre contas',
  aporte: 'Aporte de sócio',
  retirada: 'Retirada de sócio',
  distribuicao: 'Distribuição de lucro',
  liberacao: 'Liberação de financiamento',
  adiantamento: 'Adiantamento de cliente',
};

/** Quais contas cada movimentação usa: de onde sai e para onde vai. */
export const MOVEMENT_ACCOUNTS: Record<MovementKind, { from: boolean; to: boolean }> = {
  transferencia: { from: true, to: true },
  aporte: { from: false, to: true },
  retirada: { from: true, to: false },
  distribuicao: { from: true, to: false },
  liberacao: { from: false, to: true },
  adiantamento: { from: false, to: true },
};

export const PARTNER_MOVEMENTS: MovementKind[] = ['aporte', 'retirada', 'distribuicao'];

export type MovementInput = Pick<
  Movement,
  | 'operationId'
  | 'kind'
  | 'fromAccountId'
  | 'toAccountId'
  | 'partnerId'
  | 'financingId'
  | 'counterparty'
  | 'counterpartyId'
  | 'invoiceMonth'
  | 'cents'
  | 'occurredAt'
  | 'method'
  | 'proof'
  | 'notes'
>;

/** Erros do formulário de movimentação, como o servidor confere. */
export function movementErrors(
  input: MovementInput,
  accounts: FinancialAccount[],
  today: string,
  ctx: { partners?: string[]; financings?: Financing[]; movements?: Movement[] } = {},
): string | null {
  const shape = MOVEMENT_ACCOUNTS[input.kind];
  if (!shape) return 'Movimentação inválida.';
  if (!isCents(input.cents) || input.cents === 0) return 'Informe o valor.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredAt)) return 'Informe a data.';
  if (input.occurredAt > today) return 'A data não pode ser futura.';
  if (input.proof.length > 200 || input.notes.length > 500 || input.counterparty.length > 150) {
    return 'Comprovante até 200, nome até 150 e observação até 500 caracteres.';
  }
  for (const [side, id] of [['from', input.fromAccountId], ['to', input.toAccountId]] as const) {
    if (!shape[side]) {
      if (id) return 'Movimentação inválida.';
      continue;
    }
    const account = accounts.find((a) => a.id === id && a.operationId === input.operationId);
    if (!account) return side === 'from' ? 'Escolha a conta de onde sai o dinheiro.' : 'Escolha a conta para onde vai o dinheiro.';
    if (!account.active) return `${account.name} está inativa. Escolha outra conta.`;
    if (input.occurredAt < account.openingDate) return `A conta ${account.name} começa em ${formatDate(account.openingDate)}.`;
  }
  if (input.kind === 'transferencia' && input.fromAccountId === input.toAccountId) return 'Escolha contas diferentes.';
  const to = accounts.find((a) => a.id === input.toAccountId);
  if (input.invoiceMonth !== null && (input.kind !== 'transferencia' || to?.kind !== 'cartao' || !MONTH_RE.test(input.invoiceMonth))) {
    return 'Fatura inválida.';
  }
  if (input.kind !== 'transferencia' && to?.kind === 'cartao') return 'Escolha uma conta que não seja cartão.';
  const needsPartner = PARTNER_MOVEMENTS.includes(input.kind);
  if (needsPartner !== Boolean(input.partnerId)) return needsPartner ? 'Escolha o sócio.' : 'Movimentação inválida.';
  if (needsPartner && ctx.partners && !ctx.partners.includes(input.partnerId!)) return 'Escolha um sócio desta operação.';
  if ((input.kind === 'liberacao') !== Boolean(input.financingId)) return input.kind === 'liberacao' ? 'Escolha o financiamento.' : 'Movimentação inválida.';
  if (input.kind === 'liberacao' && ctx.financings) {
    const financing = ctx.financings.find((f) => f.id === input.financingId && f.operationId === input.operationId);
    if (!financing) return 'Financiamento não encontrado.';
    const released = releasedCents(financing.id, ctx.movements ?? []);
    if (released + input.cents > financing.releasedCents) return `O contrato tem ${formatCents(financing.releasedCents - released)} a liberar.`;
  }
  if (input.kind === 'adiantamento' && !input.counterparty.trim()) return 'Informe quem adiantou.';
  return null;
}

export function releasedCents(financingId: string, movements: Movement[], statuses: PaymentStatus[] = SETTLING): number {
  return movements
    .filter((m) => m.financingId === financingId && m.kind === 'liberacao' && statuses.includes(m.status))
    .reduce((acc, m) => acc + m.cents, 0);
}

// ---------------------------------------------------------------------------------------------
// Sócios

/** Conta corrente do sócio na operação: o que ele pôs, tirou e o que a operação deve a ele. */
export interface PartnerPosition {
  partnerId: string;
  name: string;
  sharePct: number | null;
  /** Aportes em dinheiro e despesas pagas do próprio bolso tratadas como aporte. */
  contributedCents: number;
  withdrawnCents: number;
  distributedCents: number;
  /** Reembolsos que a operação ainda deve ao sócio. */
  reimbursementOpenCents: number;
  /** Capital líquido do sócio: aportado − retirado − distribuído. */
  balanceCents: number;
}

export function partnerPositions(
  operationId: string,
  partners: { id: string; name: string; sharePct: number | null }[],
  payments: Payment[],
  movements: Movement[],
  views: InstallmentView[],
  range: { from?: string; to?: string } = {},
  statuses: PaymentStatus[] = SETTLING,
): PartnerPosition[] {
  const inRange = (date: string) => (!range.from || date >= range.from) && (!range.to || date <= range.to);
  return partners.map((partner) => {
    const sum = (kind: MovementKind) =>
      movements
        .filter((m) => m.operationId === operationId && m.kind === kind && m.partnerId === partner.id && statuses.includes(m.status) && inRange(m.occurredAt))
        .reduce((acc, m) => acc + m.cents, 0);
    const ownMoney = payments
      .filter((p) => p.operationId === operationId && p.partnerId === partner.id && p.partnerMode === 'aporte' && statuses.includes(p.status) && inRange(p.paidAt))
      .reduce((acc, p) => acc + paymentTotal(p), 0);
    const contributedCents = sum('aporte') + ownMoney;
    const withdrawnCents = sum('retirada');
    const distributedCents = sum('distribuicao');
    return {
      partnerId: partner.id,
      name: partner.name,
      sharePct: partner.sharePct,
      contributedCents,
      withdrawnCents,
      distributedCents,
      reimbursementOpenCents: views
        .filter((v) => v.operationId === operationId && v.source === 'reembolso' && v.partnerId === partner.id)
        .reduce((acc, v) => acc + v.openCents, 0),
      balanceCents: contributedCents - withdrawnCents - distributedCents,
    };
  });
}

/**
 * Distribuição de um valor pela participação de cada sócio. Os centavos fecham exatamente o total
 * (o resto vai para as maiores frações). Sem participação informada para todos, divide igual.
 */
export function distributeByShare(totalCents: number, partners: { id: string; sharePct: number | null }[]): Map<string, number> {
  const result = new Map<string, number>();
  if (partners.length === 0 || totalCents <= 0) return result;
  const informed = partners.every((p) => p.sharePct !== null && p.sharePct > 0);
  const weights = partners.map((p) => (informed ? p.sharePct! : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = partners.map((p, i) => ({ id: p.id, exact: (totalCents * weights[i]) / weightSum }));
  let assigned = 0;
  for (const r of raw) {
    const cents = Math.floor(r.exact);
    result.set(r.id, cents);
    assigned += cents;
  }
  const order = [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || b.exact - a.exact);
  for (let i = 0; assigned < totalCents; i = (i + 1) % order.length) {
    result.set(order[i].id, result.get(order[i].id)! + 1);
    assigned++;
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Financiamentos

export interface FinancingSummary {
  financing: Financing;
  releasedCents: number;
  toReleaseCents: number;
  principalCents: number;
  interestCents: number;
  /** Pago das parcelas: primeiro os juros, depois a amortização. */
  principalPaidCents: number;
  interestPaidCents: number;
  /** Saldo devedor de principal: liberado − amortizado. */
  outstandingCents: number;
  nextDue: InstallmentView | null;
}

export function financingSummary(financing: Financing, movements: Movement[], views: InstallmentView[], statuses: PaymentStatus[] = SETTLING): FinancingSummary {
  const released = releasedCents(financing.id, movements, statuses);
  const own = views.filter((v) => v.entryId === financing.id && v.source === 'financiamento');
  let principalPaidCents = 0;
  let interestPaidCents = 0;
  financing.schedule.forEach((item, index) => {
    const paid = own.find((v) => v.index === index)?.paidCents ?? 0;
    const interest = Math.min(paid, item.interestCents);
    interestPaidCents += interest;
    principalPaidCents += Math.min(paid - interest, item.principalCents);
  });
  const renegotiated = new Set(own.map((o) => o.renegotiatedBy).filter(Boolean));
  return {
    financing,
    releasedCents: released,
    toReleaseCents: Math.max(0, financing.releasedCents - released),
    principalCents: financing.schedule.reduce((acc, i) => acc + i.principalCents, 0),
    interestCents: financing.schedule.reduce((acc, i) => acc + i.interestCents, 0),
    principalPaidCents,
    interestPaidCents,
    outstandingCents: released - principalPaidCents,
    nextDue:
      views
        .filter((v) => v.openCents > 0 && (v.entryId === financing.id || renegotiated.has(v.entryId)))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null,
  };
}

export type FinancingInput = Omit<Financing, 'id' | 'operationId' | 'authorId' | 'createdAt'>;

export function financingErrors(input: FinancingInput): string | null {
  if (!input.bank.trim() || input.bank.length > 100) return 'Informe o banco ou a instituição (até 100 caracteres).';
  if (!FINANCING_LINE_LABEL[input.line]) return 'Escolha a linha de crédito.';
  if (input.contract.length > 60 || input.guarantees.length > 500 || input.notes.length > 500) {
    return 'Contrato até 60, garantias e observações até 500 caracteres.';
  }
  if (!isCents(input.releasedCents) || input.releasedCents === 0) return 'Informe o valor contratado.';
  if (input.ratePct !== null && (!Number.isFinite(input.ratePct) || input.ratePct < 0 || input.ratePct > 100)) return 'Taxa inválida.';
  if (!Number.isInteger(input.graceMonths) || input.graceMonths < 0 || input.graceMonths > 120) return 'Carência de 0 a 120 meses.';
  if (input.schedule.length === 0 || input.schedule.length > 240) return 'Informe de 1 a 240 parcelas.';
  if (
    input.schedule.some(
      (i) => !/^\d{4}-\d{2}-\d{2}$/.test(i.dueDate) || !isCents(i.principalCents) || !isCents(i.interestCents) || i.principalCents + i.interestCents === 0,
    )
  ) {
    return 'Confira o vencimento e os valores de cada parcela.';
  }
  if (input.schedule.reduce((acc, i) => acc + i.principalCents, 0) !== input.releasedCents) return 'A amortização das parcelas precisa somar o valor contratado.';
  return null;
}

/**
 * Cronograma sugerido: carência só de juros e depois amortização constante (SAC), com juros
 * compostos convertidos da taxa anual para o período. É um ponto de partida; o produtor ajusta
 * conforme o contrato.
 */
export function sacSchedule(
  releasedCents: number,
  ratePct: number,
  firstDue: string,
  count: number,
  graceMonths = 0,
  monthsBetween = 1,
): FinancingInstallment[] {
  if (count <= 0 || releasedCents <= 0) return [];
  const rate = Math.pow(1 + ratePct / 100, monthsBetween / 12) - 1;
  const schedule: FinancingInstallment[] = [];
  let balance = releasedCents;
  for (let g = 0; g < graceMonths; g += monthsBetween) {
    schedule.push({ dueDate: addMonths(firstDue, g), principalCents: 0, interestCents: Math.round(balance * rate) });
  }
  const principal = Math.floor(releasedCents / count);
  for (let i = 0; i < count; i++) {
    const amort = i === count - 1 ? balance : principal;
    schedule.push({ dueDate: addMonths(firstDue, graceMonths + i * monthsBetween), principalCents: amort, interestCents: Math.round(balance * rate) });
    balance -= amort;
  }
  return schedule.filter((i) => i.principalCents + i.interestCents > 0);
}

// ---------------------------------------------------------------------------------------------
// Renegociação

export interface RenegotiationInput {
  operationId: string;
  items: ObligationRef[];
  installments: Installment[];
  reason: string;
}

/** As parcelas escolhidas podem ser renegociadas juntas? Mesma operação e direção, em aberto. */
export function renegotiationErrors(input: RenegotiationInput, views: InstallmentView[]): string | null {
  if (input.items.length === 0 || input.items.length > 60) return 'Escolha de 1 a 60 parcelas.';
  const chosen = input.items.map((i) => views.find((v) => v.entryId === i.entryId && v.index === i.index));
  if (chosen.some((v) => !v || v.operationId !== input.operationId || v.source === 'fatura')) return 'Parcela não encontrada.';
  const list = chosen as InstallmentView[];
  if (new Set(list.map((v) => v.id)).size !== list.length) return 'A mesma parcela aparece duas vezes.';
  if (new Set(list.map((v) => v.direction)).size > 1) return 'Renegocie contas a pagar e a receber separadas.';
  if (list.some((v) => v.renegotiatedBy)) return 'Uma das parcelas já foi renegociada.';
  if (list.some((v) => v.openCents <= 0)) return 'Uma das parcelas já está quitada.';
  if (!input.reason.trim() || input.reason.length > 500) return 'Informe o motivo (até 500 caracteres).';
  if (input.installments.length > 60) return 'Use até 60 parcelas novas.';
  if (input.installments.some((i) => !/^\d{4}-\d{2}-\d{2}$/.test(i.dueDate) || !isCents(i.cents) || i.cents === 0)) {
    return 'Confira o vencimento e o valor de cada parcela nova.';
  }
  return null;
}

/** Diferença entre o novo total e o que estava em aberto: positiva é acréscimo (juros), negativa é desconto ou perdão. */
export function renegotiationDelta(installments: Installment[], openCents: number): number {
  return installments.reduce((acc, i) => acc + i.cents, 0) - openCents;
}

/** Quanto cada renegociação mudou o devido: novo total − o que estava em aberto nas originais. */
export function renegotiationOpenCents(reneg: Renegotiation, originals: InstallmentView[]): number {
  return reneg.items.reduce((acc, item) => {
    const view = originals.find((v) => v.entryId === item.entryId && v.index === item.index);
    return acc + Math.max(0, (view?.originalCents ?? view?.cents ?? 0) - item.settledCents);
  }, 0);
}

/** A renegociação pode ser desfeita? Só antes de alguma parcela nova ser paga ou renegociada de novo. */
export function undoRenegotiationBlock(reneg: Renegotiation, views: InstallmentView[]): string | null {
  if (reneg.status === 'conflito') return null;
  if (reneg.status !== 'efetivado') return 'Esta renegociação não pode mais ser desfeita.';
  const own = views.filter((v) => v.entryId === reneg.id);
  if (own.some((v) => v.payments.some((p) => SETTLING.includes(p.status)))) return 'Já há pagamento nas parcelas novas. Estorne-o antes de desfazer.';
  if (own.some((v) => v.renegotiatedBy)) return 'As parcelas novas foram renegociadas de novo. Desfaça a mais recente primeiro.';
  return null;
}
