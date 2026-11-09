import type { Position } from './geo';

export type Mode = 'essencial' | 'gerencial' | 'analitico';
export type MemberRole = 'socio' | 'funcionario';
export type EntryKind =
  | 'pesagem'
  | 'despesa'
  | 'mortalidade'
  | 'venda'
  | 'nota_fiscal'
  | 'manejo'
  | 'consumo'
  | 'ajuste_estoque'
  | 'transferencia_estoque'
  | 'receita';
export type EntryStatus =
  | 'rascunho'
  | 'aguardando_envio'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'rejeitado'
  | 'conflito';
export type WeightMethod = 'medido' | 'estimado';
export type AllocationCriterion = 'cabeca' | 'peso' | 'manual';
export type Decision = 'aprovar' | 'recusar';

export interface User {
  id: string;
  name: string;
  /** Conta de acesso; pessoas só simuladas (dados de exemplo) não têm e-mail. */
  email: string | null;
}

export interface Operation {
  id: string;
  name: string;
  ownerId?: string | null;
}

export interface Membership {
  operationId: string;
  userId: string;
  role: MemberRole;
  sharePct: number | null;
}

export interface Farm {
  id: string;
  name: string;
  /** Operação padrão da fazenda (na prática, uma sociedade fixa por fazenda). */
  operationId: string;
  /** Aluguel simbólico da pastagem, em centavos por cabeça/mês. */
  pastureRentCents: number;
  city: string | null;
  /** Contorno da área desenhado no mapa: anel GeoJSON fechado de [lng, lat]. */
  boundary?: Position[] | null;
}

/**
 * Pasto (pastagem) da fazenda: área física de manejo, independente de lotes e compras.
 * Nunca é apagado depois de usado; inativar preserva o histórico de ocupação.
 */
export interface Pasture {
  id: string;
  operationId: string;
  farmId: string;
  name: string;
  /** Área útil em hectares; null só nos pastos convertidos do texto antigo do lote. */
  areaHa: number | null;
  /** Tipo(s) de capim/forrageira, como o produtor descreve. */
  forage: string;
  notes: string;
  active: boolean;
  /** Criado a partir do nome de pasto em texto livre dos lotes antigos. */
  legacy?: boolean;
  createdAt: string;
  /** Contorno opcional desenhado no satélite (anel fechado de [lng, lat]). */
  boundary?: Position[] | null;
}

/** Convite para entrar numa operação. Só vira vínculo (e passa a aprovar) quando aceito. */
export interface Invite {
  context?: { inviterName: string; operationName: string; farmNames: string[] };
  id: string;
  operationId: string;
  name: string;
  contact: string;
  role: MemberRole;
  sharePct: number | null;
  createdAt: string;
  createdBy: string;
}

/** Lote de origem: grupo comprado de um fornecedor, que preserva o custo de entrada. */
export interface LotTransfer {
  incoming?: { sourceLotId: string; farmId: string; farmName: string; at: string; weightMethod: WeightMethod };
  outgoing?: { destinationLotId: string; farmId: string; farmName: string; at: string; heads: number };
}

export interface Lot {
  transfer?: LotTransfer;
  id: string;
  code: string;
  operationId: string;
  farmId: string;
  /**
   * Nome do pasto de entrada, em texto. Mantido por compatibilidade com lotes antigos;
   * a referência estruturada é `pastureId` e a ocupação atual vem das movimentações.
   */
  managementGroup: string;
  /** Pasto onde os animais entraram (data de entrada do lote). */
  pastureId?: string | null;
  supplier: string;
  category: string;
  purchasedAt: string;
  headsPurchased: number;
  entryWeightKg: number;
  purchaseCents: number;
  commissionCents: number;
  freightCents: number;
  /** Documentos da compra, opcionais. Strings preservam zeros e séries. */
  gtaNumbers?: string[];
  invoiceNumbers?: string[];
  /** Onde o lote está no mapa da fazenda, [lng, lat]. */
  location?: Position | null;
  /**
   * Como a compra é paga: parcelas de cada parte (animais, comissão, frete), que viram contas a
   * pagar. Lotes antigos não têm: a compra só vira conta quando alguém informa o pagamento.
   */
  purchasePlan?: PurchasePlan | null;
}

export type PurchasePartKind = 'animais' | 'comissao' | 'frete';

/** Uma parte da compra do lote, paga a quem a vendeu ou prestou o serviço. */
export interface PurchasePart {
  kind: PurchasePartKind;
  counterparty: string;
  counterpartyId: string | null;
  installments: Installment[];
}

export interface PurchasePlan {
  parts: PurchasePart[];
}

/** Parte de um custo apropriada a um lote. `basis` guarda a base usada: cabeças, kg ou %. */
export interface Allocation {
  lotId: string;
  cents: number;
  basis: number;
}

export interface Installment {
  dueDate: string;
  cents: number;
}

/** Conta financeira da operação (banco, caixa em espécie, investimento, cartão de crédito). */
export type AccountKind = 'corrente' | 'poupanca' | 'caixa' | 'investimento' | 'cartao';

export interface FinancialAccount {
  id: string;
  operationId: string;
  name: string;
  kind: AccountKind;
  bank: string;
  agency: string;
  number: string;
  /** Saldo na data de abertura, em centavos; pode ser negativo (cheque especial, fatura em aberto). */
  openingBalanceCents: number;
  openingDate: string;
  active: boolean;
  createdAt: string;
  /** Cartão de crédito: dia do fechamento e do vencimento da fatura (1 a 28). */
  closingDay?: number | null;
  dueDay?: number | null;
}

/** Natureza gerencial: separa custo, investimento, estoque e o que não é resultado. */
export type CategoryNature =
  | 'custo_producao'
  | 'despesa_administrativa'
  | 'investimento'
  | 'aquisicao_estoque'
  | 'receita_operacional'
  | 'outra_receita'
  | 'financiamento'
  | 'movimentacao_socio'
  | 'transferencia'
  | 'imposto';

/** Categoria do plano de contas. As padrão têm `operationId` nulo e servem a todas as operações. */
export interface CostCenter {
  version: number;
  id: string;
  operationId: string;
  name: string;
  /** One level: groups contain centers. Membership is immutable to preserve history. */
  parentId: string | null;
  isGroup: boolean;
  active: boolean;
  createdAt: string;
}

export interface CostClassification {
  version: number;
  /** Same ID as the expense; a separate managerial record, never a financial rewrite. */
  id: string;
  operationId: string;
  costCenterId: string | null;
  history: { at: string; by: string; from: string | null; to: string | null; reason: string }[];
}

export interface LedgerCategory {
  id: string;
  operationId: string | null;
  name: string;
  nature: CategoryNature;
  active: boolean;
}

export type CounterpartyKind = 'fornecedor' | 'cliente' | 'ambos';

/** Fornecedor ou cliente (frigorífico, revenda, transportadora, diarista). */
export interface Counterparty {
  id: string;
  operationId: string;
  name: string;
  kind: CounterpartyKind;
  /** CPF ou CNPJ, opcional, como digitado. */
  document: string;
  contact: string;
  pixKey: string;
  notes: string;
  active: boolean;
  createdAt: string;
}

export type SupplyKind = 'sal' | 'sal_mineral' | 'proteinado' | 'racao' | 'medicamento' | 'outros';

/** 1 `unit` de compra = `factor` unidades de controle do insumo (ex.: 1 t = 40 sacos). */
export interface SupplyConversion {
  unit: string;
  factor: number;
}

/** Insumo controlado em estoque. O saldo e o custo médio vêm dos lançamentos. */
export interface Supply {
  id: string;
  operationId: string;
  name: string;
  kind: SupplyKind;
  /** Unidade de controle do saldo (saco, kg, t, l, dose, un). */
  unit: string;
  conversions: SupplyConversion[];
  /** Estoque mínimo por fazenda, na unidade de controle; null sem alerta. */
  minQuantity: number | null;
  active: boolean;
  createdAt: string;
}

/** Item de compra para o estoque: quantidade já convertida para a unidade de controle. */
export interface StockItem {
  supplyId: string;
  quantity: number;
  cents: number;
  /** Como veio na compra (ex.: 1 t), para conferência. */
  purchaseQuantity: number;
  purchaseUnit: string;
}

export type PaymentDirection = 'pagar' | 'receber';
/**
 * `aguardando_envio` só existe no aparelho. Baixa em conflito não conta; estornada deixou de contar;
 * descartada era um conflito que a pessoa dispensou.
 */
export type PaymentStatus = 'aguardando_envio' | 'efetivado' | 'conflito' | 'estornado' | 'descartado';
export type PaymentMethod = 'pix' | 'boleto' | 'transferencia' | 'dinheiro' | 'cheque' | 'cartao' | 'outro';

/** Parte de uma baixa: o principal quitado de uma parcela (`entryId` + índice). */
export interface PaymentItem {
  entryId: string;
  index: number;
  cents: number;
}

/**
 * Despesa paga por um sócio com dinheiro próprio: vira reembolso a pagar a ele ou aporte dele na
 * operação, à escolha de quem registra.
 */
export type PartnerMode = 'reembolso' | 'aporte';

/** Pagamento ou recebimento efetivo. Muda o caixa, nunca o custo (RN-04). */
export interface Payment {
  id: string;
  operationId: string;
  direction: PaymentDirection;
  /**
   * Conta de onde saiu ou para onde entrou o dinheiro. Nula quando um sócio pagou do próprio bolso
   * (`partnerId`) ou quando o recebimento compensa um adiantamento do cliente (`advanceId`).
   */
  accountId: string | null;
  partnerId?: string | null;
  partnerMode?: PartnerMode | null;
  advanceId?: string | null;
  paidAt: string;
  items: PaymentItem[];
  interestCents: number;
  fineCents: number;
  discountCents: number;
  method: PaymentMethod;
  /** Referência do comprovante (autenticação, nº do Pix). O arquivo ainda não é enviado. */
  proof: string;
  notes: string;
  status: PaymentStatus;
  conflictReason: string | null;
  authorId: string;
  createdAt: string;
  reversedBy: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
}

/**
 * Dinheiro que muda de lugar sem ser resultado: transferência entre contas (inclusive o pagamento
 * da fatura do cartão), aporte, retirada e distribuição de lucro de sócio, liberação de
 * financiamento e adiantamento recebido de cliente.
 */
export type MovementKind = 'transferencia' | 'aporte' | 'retirada' | 'distribuicao' | 'liberacao' | 'adiantamento';

export interface Movement {
  id: string;
  operationId: string;
  kind: MovementKind;
  /** Conta de saída (transferência, retirada, distribuição). */
  fromAccountId: string | null;
  /** Conta de entrada (transferência, aporte, liberação, adiantamento). */
  toAccountId: string | null;
  /** Sócio do aporte, da retirada ou da distribuição. */
  partnerId: string | null;
  financingId: string | null;
  /** Cliente que adiantou (adiantamento). */
  counterparty: string;
  counterpartyId: string | null;
  /** Transferência para um cartão: fatura (AAAA-MM do fechamento) que ela paga. */
  invoiceMonth: string | null;
  cents: number;
  occurredAt: string;
  method: PaymentMethod;
  proof: string;
  notes: string;
  /** Mesmas situações da baixa: conflito não conta; estornada deixou de contar. */
  status: PaymentStatus;
  conflictReason: string | null;
  authorId: string;
  createdAt: string;
  reversedBy: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
}

export type FinancingLine = 'custeio' | 'investimento' | 'comercializacao' | 'pronamp' | 'pronaf' | 'outro';

/** Parcela do financiamento: a amortização sai do caixa sem ser custo; os juros são despesa financeira. */
export interface FinancingInstallment {
  dueDate: string;
  principalCents: number;
  interestCents: number;
}

/** Contrato de financiamento ou empréstimo rural. A liberação é uma movimentação. */
export interface Financing {
  id: string;
  operationId: string;
  /** Fazenda que o contrato financia (centro de custo dos juros e das parcelas). */
  farmId: string;
  bank: string;
  line: FinancingLine;
  contract: string;
  /** Valor contratado a liberar. */
  releasedCents: number;
  /** Taxa em % ao ano, como no contrato (informativa). */
  ratePct: number | null;
  graceMonths: number;
  guarantees: string;
  notes: string;
  schedule: FinancingInstallment[];
  authorId: string;
  createdAt: string;
}

/** Uma parcela a pagar ou a receber, de qualquer origem (lançamento, lote, financiamento...). */
export interface ObligationRef {
  entryId: string;
  index: number;
}

/**
 * Renegociação: as parcelas originais ficam encerradas no que já foi quitado e o restante vira as
 * parcelas novas (mudar vencimento ou valor, dividir, agrupar). Sem parcelas novas, cancela.
 * Nada é apagado: desfazer volta as originais. `settledCents` congela o que já estava quitado.
 */
export interface Renegotiation {
  id: string;
  operationId: string;
  direction: PaymentDirection;
  items: (ObligationRef & { settledCents: number })[];
  installments: Installment[];
  reason: string;
  /** `estornado` = desfeita. */
  status: PaymentStatus;
  conflictReason: string | null;
  authorId: string;
  createdAt: string;
  reversedBy: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
}

/** Despesa recorrente (salário, energia, aluguel de pasto): gera as parcelas previstas de cada mês. */
export interface Recurrence {
  costCenterId?: string | null;
  id: string;
  operationId: string;
  farmId: string;
  title: string;
  categoryId: string;
  counterparty: string;
  counterpartyId: string | null;
  cents: number;
  /** Dia do vencimento (1 a 28). */
  dayOfMonth: number;
  /** Primeiro e último mês (AAAA-MM); sem fim, continua. */
  startMonth: string;
  endMonth: string | null;
  active: boolean;
  createdAt: string;
}

/** Orçamento do mês para uma categoria do plano de contas. */
export interface Budget {
  id: string;
  operationId: string;
  categoryId: string;
  month: string;
  cents: number;
}

/**
 * Conta a pagar ou a receber trazida da planilha: um saldo de abertura, sem custo nem receita no
 * app (o fato aconteceu antes). `importKey` impede importar a mesma linha duas vezes.
 */
export interface ImportedTitle {
  id: string;
  operationId: string;
  farmId: string;
  direction: PaymentDirection;
  title: string;
  counterparty: string;
  categoryId: string | null;
  occurredAt: string;
  installments: Installment[];
  importKey: string;
  authorId: string;
  createdAt: string;
}

export interface PesagemPayload {
  lotId: string;
  method: WeightMethod;
  avgWeightKg: number;
  headsWeighed: number;
  notes: string;
  /** Pasto do grupo pesado. Obrigatório quando o lote está dividido em mais de um pasto. */
  pastureId?: string | null;
}

export interface DespesaPayload {
  /** R2/D1 document that was actually extracted and reviewed. */
  sourceDocumentId?: string | null;
  costCenterId?: string | null;
  category: string;
  description: string;
  supplier: string;
  document: string;
  installments: Installment[];
  criterion: AllocationCriterion;
  allocations: Allocation[];
  /** 'estoque': compra de insumos; o custo vai para os lotes só no consumo. Ausente = despesa. */
  destination?: NfDestination;
  stockItems?: StockItem[];
  categoryId?: string | null;
  counterpartyId?: string | null;
  /** Lançada a partir de uma despesa recorrente: o mês (AAAA-MM) que ela cobre. */
  recurrence?: { id: string; month: string } | null;
}

/** Receita fora da venda de animais (couro, arrendamento recebido, serviços). Só sócio registra. */
export interface ReceitaPayload {
  categoryId: string;
  category: string;
  description: string;
  counterparty: string;
  counterpartyId?: string | null;
  document: string;
  installments: Installment[];
}

export interface MortalidadePayload {
  lotId: string;
  heads: number;
  cause: string;
  notes: string;
  /** Pasto de onde saíram os animais, quando o lote está em mais de um. */
  pastureId?: string | null;
}

export interface VendaPayload {
  lotId: string;
  buyer: string;
  heads: number;
  carcassKg: number;
  pricePerArrobaCents: number;
  deductionsCents: number;
  /** Pasto de onde saíram os animais, quando o lote está em mais de um. */
  pastureId?: string | null;
  /** Recebimento. Ausente: uma parcela na data da venda, pelo valor líquido. */
  installments?: Installment[];
  counterpartyId?: string | null;
}

/**
 * Consumo de insumo do estoque da fazenda. O custo não é guardado: vem do custo médio na data
 * (`domain/stock.ts`) e é rateado pelos `basis` (cabeças, cabeça-dia, kg ou %).
 */
export interface ConsumoPayload {
  supplyId: string;
  quantity: number;
  /** Início do período consumido (inclusive); a ocorrência é o fim. Null = consumo do dia. */
  periodStart: string | null;
  criterion: AllocationCriterion;
  targets: { lotId: string; basis: number }[];
  notes: string;
}

/** Ajuste de inventário (contagem, perda, quebra). `delta` positivo entra, negativo sai. */
export interface AjusteEstoquePayload {
  supplyId: string;
  delta: number;
  reason: string;
}

/** Transferência de estoque para outra fazenda da mesma operação, pelo custo médio. */
export interface TransferenciaEstoquePayload {
  supplyId: string;
  quantity: number;
  toFarmId: string;
  notes: string;
}

/** Movimentação de animais entre pastos da mesma fazenda. Não é compra, venda nem transferência. */
export interface ManejoPayload {
  lotId: string;
  fromPastureId: string;
  toPastureId: string;
  heads: number;
  notes: string;
}

export type FieldConfidence = 'alta' | 'baixa' | 'ausente';
export type NfField = 'supplier' | 'number' | 'issuedAt' | 'items' | 'total' | 'installments' | 'farm';

export interface NfItem {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
}

export interface NfExtraction {
  supplier: string;
  supplierDoc: string;
  number: string;
  series: string;
  issuedAt: string;
  items: NfItem[];
  totalCents: number;
  paymentHint: string | null;
  confidence: Record<NfField, FieldConfidence>;
  /** Trecho da nota que sustenta o campo, para conferência. */
  evidence: Partial<Record<NfField, string>>;
}

export type NfDestination = 'estoque' | 'despesa';

export interface NotaFiscalPayload {
  costCenterId?: string | null;
  stage: 'aguardando_conexao' | 'pronta_para_revisao' | 'revisada';
  fileName: string;
  fileKind: 'imagem' | 'pdf' | 'exemplo';
  extraction: NfExtraction | null;
  edited: NfField[];
  destination: NfDestination;
  installments: Installment[];
  criterion: AllocationCriterion;
  allocations: Allocation[];
  /** Itens da nota que entram no estoque, já ligados aos insumos (destino 'estoque'). */
  stockItems?: StockItem[];
}

export type HistoryAction =
  | 'criado'
  | 'enviado'
  | 'recebido'
  | 'ia_extraiu'
  | 'revisado'
  | 'intencao_aprovar'
  | 'intencao_recusar'
  | 'intencao_descartada'
  | 'aprovado'
  | 'recusado'
  | 'efetivado'
  | 'conflito';

export interface HistoryItem {
  at: string;
  by: string;
  action: HistoryAction;
  note?: string;
}

interface EntryBase {
  /** Server revision, used to reject stale offline edits/approvals. */
  version?: number;
  id: string;
  status: EntryStatus;
  operationId: string;
  farmId: string;
  authorId: string;
  title: string;
  amountCents: number | null;
  /** Data da ocorrência (competência), diferente da captura e da aprovação. */
  occurredAt: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Decisão tomada offline: só vale depois de validada na sincronização. */
  pendingDecision: Decision | null;
  pendingDecisionBy: string | null;
  pendingDecisionNote: string | null;
  conflictReason: string | null;
  history: HistoryItem[];
  /**
   * Derivados no app e nunca gravados: custo do consumo rateado entre os lotes e o valor que o
   * consumo ou ajuste tirou do estoque. Preenchidos por `costEntries` (`domain/stock.ts`).
   */
  derivedAllocations?: Allocation[];
  derivedCents?: number;
}

export type EntryContent =
  | { kind: 'pesagem'; payload: PesagemPayload }
  | { kind: 'despesa'; payload: DespesaPayload }
  | { kind: 'mortalidade'; payload: MortalidadePayload }
  | { kind: 'venda'; payload: VendaPayload }
  | { kind: 'nota_fiscal'; payload: NotaFiscalPayload }
  | { kind: 'manejo'; payload: ManejoPayload }
  | { kind: 'consumo'; payload: ConsumoPayload }
  | { kind: 'ajuste_estoque'; payload: AjusteEstoquePayload }
  | { kind: 'transferencia_estoque'; payload: TransferenciaEstoquePayload }
  | { kind: 'receita'; payload: ReceitaPayload };

/** Lançamento: fato de negócio sujeito a aprovação por segunda pessoa, quando houver quem aprove. */
export type Entry = EntryBase & EntryContent;
