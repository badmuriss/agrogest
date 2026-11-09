export const today = '2026-10-22';

export function entry(id, kind, payload, extra = {}) {
  return {
    id, kind, payload, operationId: 'o1', farmId: 'f1', authorId: 'partner',
    title: id, amountCents: null, status: 'aprovado', occurredAt: '2026-10-10',
    createdAt: `2026-10-10T12:00:00.000Z`, decidedBy: 'sistema', decidedAt: null,
    decisionNote: null, pendingDecision: null, pendingDecisionBy: null,
    pendingDecisionNote: null, conflictReason: null, history: [], ...extra,
  };
}

export function workspaceFixture(lotCount = 4, supplyCount = 3) {
  const snapshot = {
    users: [
      { id: 'partner', name: 'Sócio', email: 'partner@example.com' },
      { id: 'employee', name: 'Funcionário', email: 'employee@example.com' },
    ],
    operations: [{ id: 'o1', name: 'Operação 1', ownerId: 'partner' }, { id: 'o2', name: 'Operação 2', ownerId: 'other' }],
    memberships: [
      { userId: 'partner', operationId: 'o1', role: 'socio', sharePct: 100 },
      { userId: 'partner', operationId: 'o2', role: 'funcionario', sharePct: null },
      { userId: 'employee', operationId: 'o1', role: 'funcionario', sharePct: null },
    ],
    farms: [
      { id: 'f1', operationId: 'o1', name: 'Fazenda 1', pastureRentCents: 1000, city: '' },
      { id: 'f2', operationId: 'o1', name: 'Fazenda 2', pastureRentCents: 2000, city: '' },
      { id: 'f3', operationId: 'o2', name: 'Fazenda 3', pastureRentCents: 0, city: '' },
    ],
    pastures: [], lots: [], entries: [], invites: [], activity: [], accounts: [], categories: [],
    counterparties: [], payments: [], supplies: [], movements: [], financings: [],
    renegotiations: [], recurrences: [], budgets: [], titles: [],
    settings: { accountId: 'partner', currentUserId: 'partner' },
  };
  for (let i = 0; i < lotCount; i++) {
    const farmId = i % 2 === 0 ? 'f1' : 'f2';
    const id = `l${i}`;
    snapshot.lots.push({
      id, farmId, operationId: 'o1', code: String(i + 1), managementGroup: 'Recria',
      category: 'Garrotes', breed: 'Nelore', pasture: '', pastureId: null, purchasedAt: '2026-10-01',
      headsPurchased: 100, entryWeightKg: 300, purchaseCents: 10_000_000,
      commissionCents: 0, freightCents: 0, purchasePlan: null,
      supplier: 'Fornecedor', gtaNumbers: [], invoiceNumbers: [], location: null, transfer: {},
    });
    snapshot.entries.push(
      entry(`w${i}`, 'pesagem', { lotId: id, avgWeightKg: 310, headsWeighed: 50, method: 'medido', pastureId: null }, { farmId }),
      entry(`d${i}`, 'despesa', {
        category: 'Alimentação e insumos', categoryId: 'cat-alimentacao', description: 'Ração', supplier: 'Loja', document: '',
        installments: [{ dueDate: '2026-10-20', cents: 600 }, { dueDate: '2026-11-20', cents: 400 }],
        criterion: 'cabeca', allocations: [{ lotId: id, basis: 100, cents: 1000 }],
      }, { farmId, amountCents: 1000 }),
    );
    snapshot.payments.push({
      id: `p${i}`, operationId: 'o1', direction: 'pagar', accountId: 'a1', paidAt: '2026-10-15',
      items: [{ entryId: `d${i}`, index: 0, cents: 200 }], interestCents: 0, fineCents: 0,
      discountCents: 0, method: 'pix', proof: '', notes: '', status: 'efetivado', conflictReason: null,
      authorId: 'partner', createdAt: '2026-10-15T12:00:00Z', reversedBy: null, reversedAt: null, reverseReason: null,
    });
  }
  for (let i = 0; i < supplyCount; i++) {
    const id = `s${i}`;
    snapshot.supplies.push({ id, operationId: 'o1', name: `Insumo ${i}`, kind: 'sal', unit: 'kg', conversions: [], minQuantity: 10, active: true, createdAt: today });
    snapshot.entries.push(
      entry(`buy${i}`, 'despesa', {
        destination: 'estoque', stockItems: [{ supplyId: id, quantity: 100, cents: 10000 }],
        supplier: 'Loja', installments: [{ dueDate: today, cents: 10000 }], allocations: [], criterion: 'cabeca',
      }, { amountCents: 10000, occurredAt: '2026-10-01' }),
      entry(`use${i}`, 'consumo', { supplyId: id, quantity: 5, criterion: 'cabeca', targets: [{ lotId: 'l0', basis: 1 }] }),
    );
  }
  snapshot.accounts.push({ id: 'a1', operationId: 'o1', name: 'Banco', kind: 'corrente', bank: '', agency: '', number: '', openingBalanceCents: 100000, openingDate: '2026-10-01', active: true, createdAt: today });
  return snapshot;
}
