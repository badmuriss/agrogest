import type { Entry, EntryKind, Membership, User } from './types';

/**
 * Exigem outro sócio. O ajuste de estoque muda o valor do estoque. Consumo e transferência
 * de estoque são de campo: qualquer outra pessoa habilitada aprova a quantidade, e o custo vem
 * das compras já aprovadas por sócios.
 */
const FINANCIAL_KINDS: EntryKind[] = ['despesa', 'venda', 'nota_fiscal', 'ajuste_estoque', 'receita'];

type EntryRef = Pick<Entry, 'authorId' | 'operationId' | 'kind'>;

export function isFinancial(kind: EntryKind): boolean {
  return FINANCIAL_KINDS.includes(kind);
}

/**
 * Motivo pelo qual `userId` não pode aprovar o lançamento, ou null se pode.
 * RN-01: ninguém aprova o próprio lançamento. RN-02: financeiro só por outro sócio da operação.
 * O modo de experiência não entra aqui (RN-16).
 */
export function approvalBlockReason(userId: string, entry: EntryRef, memberships: Membership[]): string | null {
  if (entry.authorId === userId) {
    return 'Você criou este lançamento. Outra pessoa precisa aprová-lo.';
  }
  const membership = memberships.find((m) => m.operationId === entry.operationId && m.userId === userId);
  if (!membership) return 'Você não tem vínculo com esta operação.';
  if (isFinancial(entry.kind) && membership.role !== 'socio') {
    return 'Lançamentos financeiros só podem ser aprovados por outro sócio da operação.';
  }
  return null;
}

/** Quem pode aprovar, entre os vínculos ativos da operação (convites pendentes não contam). */
export function eligibleApproverIds(entry: EntryRef, memberships: Membership[]): string[] {
  return memberships
    .filter((m) => m.operationId === entry.operationId)
    .map((m) => m.userId)
    .filter((userId) => approvalBlockReason(userId, entry, memberships) === null);
}

export function eligibleApprovers(entry: EntryRef, memberships: Membership[], users: User[]): User[] {
  const ids = new Set(eligibleApproverIds(entry, memberships));
  return users.filter((u) => ids.has(u.id));
}

/**
 * Política vigente RF-16: a segunda aprovação só é exigida quando existe outra pessoa habilitada
 * a aprovar. Sem ninguém (ex.: o produtor sozinho na operação), o lançamento é efetivado
 * direto ao ser recebido, ainda passando pela validação de saldo.
 * A exceção para produtor sozinho está documentada no RF-16 vigente.
 */
export function requiresApproval(entry: EntryRef, memberships: Membership[]): boolean {
  return eligibleApproverIds(entry, memberships).length > 0;
}
