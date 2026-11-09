import type { Entry, Lot, Payment } from '../../mobile/src/domain/types.ts';
import { parseISODate } from '../../mobile/src/domain/dates.ts';
import { receive, decide } from '../../mobile/src/domain/workflow.ts';
import { DEFAULT_CATEGORIES, EXPENSE_NATURES, REVENUE_NATURES, accountErrors, paymentErrors, paymentConflict, reversalBlock, purchasePlanError, saleNetCents, installmentViews } from '../../mobile/src/domain/finance.ts';
import { assertCostCenter, validateCostCenter } from '../../mobile/src/domain/cost-centers.ts';
import { pastureErrors, pastureConflict, pastureInUse, lotTimelines } from '../../mobile/src/domain/pasture.ts';
import { lotEditLimits } from '../../mobile/src/domain/lot-edit.ts';
import { supplyErrors, purchaseItems, costEntries } from '../../mobile/src/domain/stock.ts';
import { summarizeLot } from '../../mobile/src/domain/lot-metrics.ts';
import { prepareLotTransfer } from '../../mobile/src/domain/lot-transfer.ts';
import { isSimpleRing, isValidPosition } from '../../mobile/src/domain/geo.ts';
import { approvalBlockReason } from '../../mobile/src/domain/approval.ts';
import { movementErrors, financingErrors, recurrenceErrors, renegotiationErrors, undoRenegotiationBlock } from '../../mobile/src/domain/treasury.ts';
import { cents, ensure, idString, saoPauloDay, textField } from './contracts.ts';
import { member, type State, type Tables } from './store.ts';

const pick = (o: any, keys: string[]) => Object.fromEntries(keys.map((k) => [k, o[k]]).filter(([, v]) => v !== undefined));
const list = (x: unknown): x is any[] => Array.isArray(x) && x.length <= 500;
const positive = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;
const day = (x: unknown) => typeof x === 'string' && parseISODate(x);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function previous(current: any, supplied: any) {
  ensure(supplied && typeof supplied === 'object' && Object.keys(supplied).length > 0, 'A revisão anterior é obrigatória.');
  ensure(Object.entries(supplied).every(([k, v]) => same(current[k] ?? null, v ?? null)), 'O registro mudou em outro aparelho. Sincronize antes de editar.', 409);
}
function put<K extends keyof Tables>(s: State, c: K, row: Tables[K]) {
  const rows = s[c] as any[], id = (row as any).id;
  const index = rows.findIndex((r) => r.id === id);
  if (index < 0) rows.push(row); else rows[index] = row;
  return row;
}
function installments(items: any, total: number) {
  ensure(list(items) && items.length > 0 && items.every((i) => day(i.dueDate) && cents(i.cents) && i.cents > 0) && items.reduce((sum, i) => sum + i.cents, 0) === total, 'As parcelas precisam somar o valor total, em centavos.');
}
function allocations(s: State, p: any, e: any, total: number) {
  ensure(['cabeca', 'peso', 'manual'].includes(p.criterion) && list(p.allocations), 'Rateio inválido.');
  const ids = new Set();
  for (const a of p.allocations) {
    ensure(!ids.has(a.lotId) && cents(a.cents) && typeof a.basis === 'number' && a.basis >= 0 && Number.isFinite(a.basis), 'Rateio inválido ou duplicado.'); ids.add(a.lotId);
    ensure(s.lots.some((l) => l.id === a.lotId && l.farmId === e.farmId && l.operationId === e.operationId), 'O lote do rateio não pertence à fazenda.');
  }
  ensure(p.allocations.length === 0 || p.allocations.reduce((sum: number, a: any) => sum + a.cents, 0) === total, 'O rateio precisa fechar o valor da despesa.');
}
function validateEntry(s: State, actor: string, e: any, today: string) {
  ensure(['despesa', 'receita', 'pesagem', 'mortalidade', 'venda', 'manejo', 'consumo', 'ajuste_estoque', 'transferencia_estoque'].includes(e.kind), 'Tipo de lançamento indisponível. Use Importar comprovante para OCR.');
  ensure(textField(e.title) && day(e.occurredAt) && e.occurredAt <= today, 'Confira o título e a data da ocorrência.');
  const p = e.payload;
  ensure(p && typeof p === 'object' && !Array.isArray(p), 'Dados do lançamento inválidos.');
  if (e.kind === 'venda' || e.kind === 'receita') member(s, actor, e.operationId, true);
  if (e.kind === 'despesa' || e.kind === 'receita') {
    ensure(cents(e.amountCents) && e.amountCents > 0 && textField(p.description), 'Informe descrição e valor em centavos.');
    const category = [...DEFAULT_CATEGORIES, ...s.categories].find((c) => c.id === p.categoryId && c.active && (c.operationId === null || c.operationId === e.operationId));
    ensure(category && (e.kind === 'receita' ? REVENUE_NATURES : EXPENSE_NATURES).includes(category.nature), 'Escolha uma categoria válida desta operação.');
    installments(p.installments, e.amountCents);
    if (p.counterpartyId) ensure(s.counterparties.some((c) => c.id === p.counterpartyId && c.operationId === e.operationId), 'Fornecedor fora da operação.');
    if (e.kind === 'despesa') {
      assertCostCenter(s.costCenters, e.operationId, p.costCenterId);
      if (p.destination === 'estoque') {
        ensure(list(p.stockItems) && p.stockItems.length > 0, 'Informe os itens do estoque.');
        ensure(p.stockItems.every((i: any) => s.supplies.some((x) => x.id === i.supplyId && x.operationId === e.operationId && x.active) && positive(i.quantity) && cents(i.cents)), 'Itens de estoque inválidos.');
        ensure(p.stockItems.reduce((sum: number, i: any) => sum + i.cents, 0) === e.amountCents, 'Os itens precisam somar a compra.');
      } else allocations(s, p, e, e.amountCents);
      if (p.sourceDocumentId) ensure(idString(p.sourceDocumentId), 'Documento inválido.');
      if (p.recurrence) {
        ensure(s.recurrences.some((r) => r.id === p.recurrence.id && r.operationId === e.operationId), 'Recorrência fora da operação.');
        ensure(!s.entries.some((r) => r.id !== e.id && r.kind === 'despesa' && r.status !== 'rejeitado' && r.payload.recurrence?.id === p.recurrence.id && r.payload.recurrence?.month === p.recurrence.month), 'A despesa deste mês já foi lançada.');
      }
    }
  }
  if (['pesagem', 'mortalidade', 'venda', 'manejo'].includes(e.kind)) {
    const lot = s.lots.find((l) => l.id === p.lotId && l.farmId === e.farmId && l.operationId === e.operationId);
    ensure(lot && !lot.transfer?.outgoing && e.occurredAt >= (lot.transfer?.incoming?.at ?? lot.purchasedAt), 'Lote indisponível nesta fazenda/data.');
    ensure(Number.isInteger(e.kind === 'pesagem' ? p.headsWeighed : p.heads) && (e.kind === 'pesagem' ? p.headsWeighed : p.heads) > 0, 'Informe a quantidade de cabeças.');
    for (const pastureId of [p.pastureId, p.fromPastureId, p.toPastureId].filter(Boolean)) ensure(s.pastures.some((x) => x.id === pastureId && x.farmId === e.farmId), 'Pasto fora da fazenda.');
    if (e.kind === 'manejo') ensure(p.fromPastureId !== p.toPastureId && s.pastures.some((x) => x.id === p.toPastureId && x.active), 'Escolha outro pasto ativo.');
    if (e.kind === 'pesagem') ensure(positive(p.avgWeightKg) && ['medido', 'estimado'].includes(p.method), 'Peso ou método inválido.');
    if (e.kind === 'mortalidade') ensure(textField(p.cause, 500), 'Informe o motivo da mortalidade.');
    if (e.kind === 'venda') {
      ensure(positive(p.carcassKg) && cents(p.pricePerArrobaCents) && cents(p.deductionsCents) && saleNetCents(p) === e.amountCents && e.amountCents > 0, 'Valores da venda inconsistentes.');
      if (p.installments) installments(p.installments, e.amountCents);
    }
  }
  if (['consumo', 'ajuste_estoque', 'transferencia_estoque'].includes(e.kind)) {
    ensure(s.supplies.some((x) => x.id === p.supplyId && x.operationId === e.operationId), 'Insumo fora da operação.');
    if (e.kind === 'ajuste_estoque') ensure(typeof p.delta === 'number' && Number.isFinite(p.delta) && p.delta !== 0 && textField(p.reason, 500), 'Ajuste inválido.');
    else ensure(positive(p.quantity), 'Informe a quantidade.');
    if (e.kind === 'consumo') ensure(list(p.targets) && p.targets.length > 0 && new Set(p.targets.map((t: any) => t.lotId)).size === p.targets.length && p.targets.every((t: any) => positive(t.basis) && s.lots.some((l) => l.id === t.lotId && l.farmId === e.farmId)), 'Escolha lotes desta fazenda.');
    if (e.kind === 'transferencia_estoque') ensure(p.toFarmId !== e.farmId && s.farms.some((f) => f.id === p.toFarmId && f.operationId === e.operationId), 'Escolha outra fazenda desta operação.');
  }
}

/** Pure transition. All writes are committed later under one D1 revision guard. */
export function transition(s: State, actor: string, kind: string, p: any, now: string): { result: any; operationId: string } {
  ensure(p && typeof p === 'object' && !Array.isArray(p) && idString(p.id), 'Comando inválido.');
  const today = saoPauloDay(now);
  if (kind === 'create_farm') {
    ensure(idString(p.operationId) && !s.operations.some((o) => o.id === p.operationId) && !s.farms.some((f) => f.id === p.id) && textField(p.name, 120) && cents(p.pastureRentCents), 'Fazenda inválida ou já existente.');
    s.operations.push({ id: p.operationId, name: p.name.trim(), ownerId: actor });
    s.memberships.push({ operationId: p.operationId, userId: actor, role: 'socio', sharePct: 100 });
    const farm = { id: p.id, operationId: p.operationId, name: p.name.trim(), city: typeof p.city === 'string' ? p.city.slice(0, 120) : null, pastureRentCents: p.pastureRentCents };
    return { result: put(s, 'farms', farm), operationId: p.operationId };
  }
  if (kind === 'accept_invite') {
    const invite = s.invites.find((i) => i.id === p.id);
    ensure(invite && invite.contact.toLowerCase() === s.users.find((u) => u.id === actor)?.email?.toLowerCase(), 'Convite indisponível para esta conta.', 403, '42501');
    ensure(!s.memberships.some((m) => m.operationId === invite.operationId && m.userId === actor), 'Você já participa desta operação.');
    s.memberships.push({ operationId: invite.operationId, userId: actor, role: invite.role, sharePct: invite.sharePct });
    s.invites = s.invites.filter((i) => i.id !== p.id);
    return { result: { id: p.id }, operationId: invite.operationId };
  }
  ensure(idString(p.operationId), 'Operação inválida.');
  member(s, actor, p.operationId);
  // Global IDs cannot be reused to overwrite another operation's entity.
  for (const rows of Object.values(s)) for (const row of rows as any[]) if (row.id === p.id && row.operationId) ensure(row.operationId === p.operationId, 'Registro fora da operação.', 403, '42501');
  const ctx = { ...s, today, now };
  const done = (result: any) => ({ result, operationId: p.operationId });
  if (kind === 'save_entry') {
    const old = s.entries.find((e) => e.id === p.id);
    ensure(old ? old.version === p.expectedVersion : p.expectedVersion === null, 'O lançamento mudou. Sincronize antes de editar.', 409);
    ensure(!old || (old.authorId === actor && ['rascunho', 'rejeitado', 'conflito'].includes(old.status)), 'Apenas o autor pode revisar um rascunho, rejeição ou conflito.', 403, '42501');
    const input = p.entry;
    ensure(input && input.operationId === p.operationId && input.farmId === p.farmId && s.farms.some((f) => f.id === p.farmId && f.operationId === p.operationId), 'Fazenda fora da operação.');
    const e: Entry = { ...pick(input, ['kind', 'payload', 'title', 'amountCents', 'occurredAt']), id: p.id, operationId: p.operationId, farmId: p.farmId, authorId: actor, version: (old?.version ?? 0) + 1, status: 'rascunho', createdAt: old?.createdAt ?? now, decidedBy: null, decidedAt: null, decisionNote: null, pendingDecision: null, pendingDecisionBy: null, pendingDecisionNote: null, conflictReason: null, history: [...(old?.history ?? []), { at: now, by: actor, action: old ? 'revisado' : 'criado' }] } as Entry;
    validateEntry(s, actor, e, today);
    ensure(typeof p.submit === 'boolean', 'Confirme se deseja enviar ou salvar rascunho.');
    if (p.submit) e.history.push({ at: now, by: actor, action: 'enviado' });
    return done(put(s, 'entries', p.submit ? receive(ctx, e) : e));
  }
  if (kind === 'decide_entry' || kind === 'discard_entry') {
    const old = s.entries.find((e) => e.id === p.id);
    ensure(old, 'Lançamento não encontrado.');
    if (kind === 'discard_entry') {
      ensure(old.authorId === actor && ['rascunho', 'rejeitado', 'conflito'].includes(old.status), 'Não é possível excluir um lançamento enviado/aprovado.', 403, '42501');
      s.entries = s.entries.filter((e) => e.id !== p.id); return done({ id: p.id });
    }
    ensure(old.version === p.expectedVersion && old.status === 'aguardando_aprovacao', 'O lançamento mudou de situação ou revisão.', 409);
    ensure(['aprovar', 'recusar'].includes(p.decision) && typeof p.note === 'string' && p.note.length <= 500 && (p.decision !== 'recusar' || p.note.trim()), 'Informe uma decisão e, ao recusar, o motivo.');
    const blocked = approvalBlockReason(actor, old, s.memberships); ensure(!blocked, blocked ?? 'Sem permissão para aprovar.', 403, '42501');
    return done(put(s, 'entries', { ...decide(ctx, old, actor, p.decision, p.note.trim(), true), version: old.version! + 1 }));
  }
  if (kind === 'place_lot') {
    const lot = s.lots.find((l) => l.id === p.id); ensure(lot && (p.location === null || isValidPosition(p.location)), 'Lote ou posição inválida.');
    return done(put(s, 'lots', { ...lot, location: p.location }));
  }
  member(s, actor, p.operationId, true);
  if (kind === 'update_farm') {
    const old = s.farms.find((f) => f.id === p.id); ensure(old, 'Fazenda não encontrada.'); previous(old, p.previous);
    ensure(textField(p.name, 120) && cents(p.pastureRentCents), 'Nome ou aluguel inválido.');
    return done(put(s, 'farms', { ...old, ...pick(p, ['name', 'city', 'pastureRentCents']) } as typeof old));
  }
  if (kind === 'create_pasture' || kind === 'update_pasture') {
    const old = s.pastures.find((r) => r.id === p.id);
    ensure(kind === 'create_pasture' ? !old && s.farms.some((f) => f.id === p.farmId && f.operationId === p.operationId) : old, 'Pasto/fazenda indisponível.');
    if (old) previous(old, p.previous);
    const farmId = old?.farmId ?? p.farmId;
    const failure = Object.values(pastureErrors(p, s.pastures.filter((x) => x.farmId === farmId && x.id !== p.id)))[0]; ensure(!failure, failure ?? 'Pasto inválido.');
    if (old && !p.active) {
      const occupied = [...lotTimelines(s.lots, s.entries, (id) => s.pastures.find((x) => x.id === id)?.name ?? 'Pasto').values()].some((t) => (t.heads.get(old.id) ?? 0) > 0);
      const arriving = s.entries.some((e) => e.kind === 'manejo' && e.payload.toPastureId === old.id && e.status === 'aguardando_aprovacao');
      ensure(!occupied && !arriving, 'Mova os animais e resolva chegadas pendentes antes de inativar.');
    }
    return done(put(s, 'pastures', { id: p.id, operationId: p.operationId, farmId, ...pick(p, ['name', 'areaHa', 'forage', 'notes']), active: old ? !!p.active : true, createdAt: old?.createdAt ?? now } as Tables['pastures']));
  }
  if (kind === 'create_lot' || kind === 'update_lot') {
    const old = s.lots.find((r) => r.id === p.id);
    ensure(kind === 'create_lot' ? !old : old, 'Lote indisponível.');
    if (old) { previous(old, p.previous); ensure(!old.transfer, 'A entrada da transferência deve ser preservada.'); }
    ensure(s.farms.some((f) => f.id === p.farmId && f.operationId === p.operationId) && s.pastures.some((x) => x.id === p.pastureId && x.farmId === p.farmId && (x.active || old?.pastureId === x.id)), 'Escolha um pasto desta fazenda.');
    ensure(textField(p.code, 60) && !s.lots.some((l) => l.id !== p.id && l.operationId === p.operationId && l.code.toLowerCase().trim() === p.code.toLowerCase().trim()), 'Código de lote inválido ou duplicado.');
    ensure(day(p.purchasedAt) && p.purchasedAt <= today && Number.isInteger(p.headsPurchased) && p.headsPurchased > 0 && positive(p.entryWeightKg) && [p.purchaseCents, p.commissionCents, p.freightCents].every(cents), 'Confira data, cabeças, peso e valores do lote.');
    const limits = lotEditLimits(p.id, s.entries);
    ensure(p.headsPurchased >= limits.minHeads && (!limits.latestPurchasedAt || p.purchasedAt <= limits.latestPurchasedAt), 'A entrada contradiz lançamentos existentes.');
    const row = { ...pick(p, ['id', 'operationId', 'farmId', 'code', 'managementGroup', 'pastureId', 'supplier', 'category', 'purchasedAt', 'headsPurchased', 'entryWeightKg', 'purchaseCents', 'commissionCents', 'freightCents', 'gtaNumbers', 'invoiceNumbers']), purchasePlan: old?.purchasePlan ?? null } as Lot;
    if (old && [row.purchaseCents !== old.purchaseCents, row.commissionCents !== old.commissionCents, row.freightCents !== old.freightCents].some(Boolean)) { ensure(!s.payments.some((x) => x.status === 'efetivado' && x.items.some((i) => i.entryId === old.id)), 'Estorne os pagamentos antes de mudar valores.'); row.purchasePlan = null; }
    const conflict = pastureConflict(row, s.entries, null, ['aprovado', 'aguardando_aprovacao'], (id) => s.pastures.find((x) => x.id === id)?.name ?? 'Pasto'); ensure(!conflict, conflict ?? 'Ocupação inválida.');
    return done(put(s, 'lots', row));
  }
  if (kind === 'create_account' || kind === 'update_account') {
    const old = s.financialAccounts.find((a) => a.id === p.id);
    ensure(kind === 'create_account' ? !old : old, 'Conta indisponível.'); if (old) previous(old, p.previous);
    const failure = accountErrors(p, s.financialAccounts.filter((a) => a.operationId === p.operationId && a.id !== p.id)); ensure(!failure, failure ?? 'Conta inválida.');
    if (old && s.payments.some((x) => x.accountId === old.id)) ensure(old.kind === p.kind && old.openingDate === p.openingDate, 'Conta com pagamentos: preserve tipo e data de abertura.');
    return done(put(s, 'financialAccounts', { ...pick(p, ['id', 'operationId', 'name', 'kind', 'bank', 'agency', 'number', 'openingBalanceCents', 'openingDate', 'active', 'closingDay', 'dueDay']), createdAt: old?.createdAt ?? now } as Tables['financialAccounts']));
  }
  if (kind === 'register_payment') {
    ensure(!s.payments.some((x) => x.id === p.id) && list(p.items) && ['pagar', 'receber'].includes(p.direction) && day(p.paidAt), 'Baixa inválida.');
    const failure = paymentErrors(p, s.financialAccounts, today, { partners: s.memberships.filter((m) => m.operationId === p.operationId && m.role === 'socio').map((m) => m.userId), movements: s.movements, payments: s.payments }); ensure(!failure, failure ?? 'Baixa inválida.');
    const row: Payment = { ...pick(p, ['id', 'operationId', 'direction', 'accountId', 'partnerId', 'partnerMode', 'advanceId', 'paidAt', 'items', 'interestCents', 'fineCents', 'discountCents', 'method', 'proof', 'notes']), authorId: actor, createdAt: now, status: 'efetivado', conflictReason: null, reversedBy: null, reversedAt: null, reverseReason: null } as Payment;
    row.conflictReason = paymentConflict(row, s.entries, s.payments, ['efetivado'], s.lots, { financings: s.financings, renegotiations: s.renegotiations, titles: s.titles, users: s.users }); if (row.conflictReason) row.status = 'conflito';
    return done(put(s, 'payments', row));
  }
  if (kind === 'reverse_payment') {
    const old = s.payments.find((x) => x.id === p.id); ensure(old && ['efetivado', 'conflito'].includes(old.status), 'Baixa indisponível.');
    const block = reversalBlock(old, s.payments, s.renegotiations); ensure(!block, block ?? 'Estorno inválido.'); ensure(textField(p.reason, 500), 'Informe o motivo do estorno.');
    return done(put(s, 'payments', { ...old, status: old.status === 'conflito' ? 'descartado' : 'estornado', reversedBy: actor, reversedAt: now, reverseReason: p.reason }));
  }
  if (kind === 'create_supply' || kind === 'update_supply') {
    const old = s.supplies.find((r) => r.id === p.id); ensure(kind === 'create_supply' ? !old : old, 'Insumo indisponível.'); if (old) previous(old, p.previous);
    const failure = supplyErrors(p, s.supplies.filter((x) => x.operationId === p.operationId && x.id !== p.id)); ensure(!failure, failure ?? 'Insumo inválido.');
    if (old && old.unit !== p.unit) ensure(!s.entries.some((e) => purchaseItems(e).some((i) => i.supplyId === old.id) || ('supplyId' in e.payload && e.payload.supplyId === old.id)), 'Insumo em uso: preserve a unidade.');
    return done(put(s, 'supplies', { ...pick(p, ['id', 'operationId', 'name', 'kind', 'unit', 'conversions', 'minQuantity', 'active']), createdAt: old?.createdAt ?? now } as Tables['supplies']));
  }
  if (kind === 'create_category') {
    ensure(textField(p.name, 80) && [...EXPENSE_NATURES, ...REVENUE_NATURES].includes(p.nature) && !s.categories.some((c) => c.id === p.id), 'Categoria inválida.');
    return done(put(s, 'categories', { id: p.id, operationId: p.operationId, name: p.name.trim(), nature: p.nature, active: true }));
  }
  if (kind === 'save_counterparty') {
    const old = s.counterparties.find((x) => x.id === p.id); if (old) previous(old, p.previous);
    ensure(textField(p.name, 160) && ['fornecedor', 'cliente', 'ambos'].includes(p.kind), 'Fornecedor/cliente inválido.');
    return done(put(s, 'counterparties', { ...pick(p, ['id', 'operationId', 'name', 'kind', 'document', 'phone', 'notes']), createdAt: old?.createdAt ?? now } as Tables['counterparties']));
  }
  if (kind === 'save_cost_center') {
    const old = s.costCenters.find((c) => c.id === p.id); if (old) previous(old, p.previous);
    const row = { ...pick(p, ['id', 'operationId', 'name', 'parentId', 'isGroup', 'active']), version: (old?.version ?? 0) + 1, createdAt: old?.createdAt ?? now } as Tables['costCenters']; validateCostCenter(row, s.costCenters, old);
    return done(put(s, 'costCenters', row));
  }
  if (kind === 'set_lot_payment_plan') {
    const lot = s.lots.find((l) => l.id === p.id); ensure(lot, 'Lote indisponível.'); previous(lot, { purchasePlan: p.previous ?? null });
    const error = purchasePlanError(lot, p.plan); ensure(!error, error ?? 'Plano inválido.'); ensure(!s.payments.some((x) => x.status === 'efetivado' && x.items.some((i) => i.entryId === lot.id)), 'Estorne pagamentos antes de alterar parcelas.');
    return done(put(s, 'lots', { ...lot, purchasePlan: p.plan }));
  }
  if (kind === 'invite') {
    ensure(textField(p.name, 120) && typeof p.contact === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contact) && ['socio', 'funcionario'].includes(p.role), 'Convite inválido.');
    ensure(p.sharePct === null || p.sharePct === undefined || typeof p.sharePct === 'number' && Number.isFinite(p.sharePct) && p.sharePct >= 0 && p.sharePct <= 100, 'Participação deve ficar entre 0 e 100%.');
    ensure(!s.invites.some((i) => i.operationId === p.operationId && i.contact.toLowerCase() === p.contact.toLowerCase()), 'Já existe um convite para este e-mail.', 409, '23505');
    return done(put(s, 'invites', { id: p.id, operationId: p.operationId, name: p.name, contact: p.contact.toLowerCase(), role: p.role, sharePct: p.role === 'socio' && typeof p.sharePct === 'number' ? p.sharePct : null, createdBy: actor, createdAt: now }));
  }
  if (kind === 'cancel_invite') { ensure(s.invites.some((i) => i.id === p.id), 'Convite indisponível.'); s.invites = s.invites.filter((i) => i.id !== p.id); return done({ id: p.id }); }
  if (kind === 'update_member' || kind === 'remove_member') {
    const row = s.memberships.find((m) => m.userId === p.id && m.operationId === p.operationId); ensure(row && row.userId !== actor, 'Não altere o próprio vínculo por esta ação.'); previous(row, p.previous);
    ensure(['socio', 'funcionario'].includes(p.role) || kind === 'remove_member', 'Cargo inválido.');
    ensure(s.operations.find((o) => o.id === p.operationId)?.ownerId !== p.id, 'O titular da operação deve ser preservado.');
    if (kind === 'remove_member') s.memberships = s.memberships.filter((m) => m !== row); else { row.role = p.role; if (row.role === 'funcionario') row.sharePct = null; }
    return done({ id: p.id });
  }
  if (kind === 'delete_pasture') {
    const old = s.pastures.find((x) => x.id === p.id); ensure(old && !pastureInUse(p.id, s.lots, s.entries), 'Pasto em uso: inative para preservar o histórico.');
    s.pastures = s.pastures.filter((x) => x.id !== p.id); return done({ id: p.id });
  }
  if (kind === 'update_farm_boundary' || kind === 'update_pasture_boundary') {
    const collection = kind === 'update_farm_boundary' ? 'farms' : 'pastures';
    const old = s[collection].find((x) => x.id === p.id); ensure(old, 'Área indisponível.');
    ensure(same(old.boundary ?? null, p.previous), 'A área mudou. Sincronize antes de desenhar.', 409);
    ensure(p.boundary === null || list(p.boundary) && p.boundary.every(isValidPosition) && isSimpleRing(p.boundary), 'Contorno inválido ou com cruzamentos.');
    Object.assign(old, { boundary: p.boundary }); return done(old);
  }
  if (kind === 'transfer_lot') {
    const lot = s.lots.find((l) => l.id === p.id), source = s.farms.find((f) => f.id === lot?.farmId), destination = s.farms.find((f) => f.id === p.destinationFarmId);
    ensure(lot && source && destination && p.date === today && idString(p.destinationLotId), 'Lote, destino ou data inválidos.');
    member(s, actor, destination.operationId, true);
    ensure(!s.lots.some((l) => l.id === p.destinationLotId || l.operationId === destination.operationId && l.code.toLowerCase().trim() === String(p.code).toLowerCase().trim()), 'Código de lote já existe no destino.', 409, '23505');
    const summary = summarizeLot(lot, costEntries(s.entries), source.pastureRentCents, today);
    const prepared = prepareLotTransfer(summary, source, destination, p, s.pastures.find((x) => x.id === p.pastureId));
    // Carry value and source exit are committed in the same guarded batch, even across operations.
    put(s, 'lots', { ...lot, transfer: prepared.sourceTransfer }); put(s, 'lots', prepared.lot); return done(prepared);
  }
  if (kind === 'classify_cost') {
    const entry = s.entries.find((e) => e.id === p.id); ensure(entry && (entry.kind === 'despesa' || entry.kind === 'nota_fiscal') && entry.status === 'aprovado', 'Escolha uma despesa aprovada.');
    const old = s.costClassifications.find((c) => c.id === p.id); ensure(same(old ?? null, p.previous), 'A classificação mudou. Sincronize.', 409);
    assertCostCenter(s.costCenters, p.operationId, p.costCenterId); ensure(textField(p.reason, 500), 'Informe o motivo da classificação.');
    const from = old ? old.costCenterId : entry.payload.costCenterId ?? null;
    const row = { id: p.id, operationId: p.operationId, version: (old?.version ?? 0) + 1, costCenterId: p.costCenterId ?? null, history: [...(old?.history ?? []), { at: now, by: actor, from, to: p.costCenterId ?? null, reason: p.reason.trim() }] };
    return done(put(s, 'costClassifications', row));
  }
  if (kind === 'register_movement') {
    ensure(!s.movements.some((m) => m.id === p.id) && day(p.occurredAt), 'Movimentação inválida.');
    const error = movementErrors(p, s.financialAccounts, today, { partners: s.memberships.filter((m) => m.operationId === p.operationId && m.role === 'socio').map((m) => m.userId), financings: s.financings, movements: s.movements }); ensure(!error, error ?? 'Movimentação inválida.');
    if (p.counterpartyId) ensure(s.counterparties.some((c) => c.id === p.counterpartyId && c.operationId === p.operationId), 'Cliente fora da operação.');
    return done(put(s, 'movements', { ...pick(p, ['id', 'operationId', 'kind', 'fromAccountId', 'toAccountId', 'partnerId', 'financingId', 'counterparty', 'counterpartyId', 'invoiceMonth', 'cents', 'occurredAt', 'method', 'proof', 'notes']), status: 'efetivado', conflictReason: null, authorId: actor, createdAt: now, reversedBy: null, reversedAt: null, reverseReason: null } as Tables['movements']));
  }
  if (kind === 'reverse_movement') {
    const old = s.movements.find((m) => m.id === p.id); ensure(old && ['efetivado', 'conflito'].includes(old.status) && textField(p.reason, 500), 'Movimentação ou motivo inválidos.');
    ensure(!(old.kind === 'adiantamento' && s.payments.some((x) => x.advanceId === old.id && x.status === 'efetivado')), 'Estorne as compensações deste adiantamento antes.');
    return done(put(s, 'movements', { ...old, status: old.status === 'efetivado' ? 'estornado' : 'descartado', reversedBy: actor, reversedAt: now, reverseReason: p.reason }));
  }
  if (kind === 'save_financing') {
    ensure(!s.financings.some((f) => f.id === p.id) && s.farms.some((f) => f.id === p.farmId && f.operationId === p.operationId) && list(p.schedule) && p.schedule.every((i: any) => day(i.dueDate)), 'Financiamento inválido.');
    const error = financingErrors(p); ensure(!error, error ?? 'Financiamento inválido.');
    return done(put(s, 'financings', { ...pick(p, ['id', 'operationId', 'farmId', 'bank', 'line', 'contract', 'releasedCents', 'ratePct', 'graceMonths', 'guarantees', 'notes', 'schedule']), authorId: actor, createdAt: now } as Tables['financings']));
  }
  const views = () => installmentViews(s.entries, s.payments, today, [...DEFAULT_CATEGORIES, ...s.categories], s.lots, { financings: s.financings, renegotiations: s.renegotiations, titles: s.titles, users: s.users });
  if (kind === 'renegotiate') {
    ensure(!s.renegotiations.some((r) => r.id === p.id) && list(p.items) && list(p.installments) && p.installments.every((i: any) => day(i.dueDate)), 'Renegociação inválida.');
    const all = views(), error = renegotiationErrors(p, all); ensure(!error, error ?? 'Renegociação inválida.');
    const selected = p.items.map((i: any) => all.find((v) => v.entryId === i.entryId && v.index === i.index)!);
    ensure(selected.every((v: any) => { const source = s.entries.find((e) => e.id === v.entryId); return !source || source.status === 'aprovado'; }), 'A origem precisa estar aprovada antes da renegociação.');
    return done(put(s, 'renegotiations', { id: p.id, operationId: p.operationId, direction: selected[0].direction, items: selected.map((v: any) => ({ entryId: v.entryId, index: v.index, settledCents: v.paidCents })), installments: p.installments, reason: p.reason, status: 'efetivado', conflictReason: null, authorId: actor, createdAt: now, reversedBy: null, reversedAt: null, reverseReason: null }));
  }
  if (kind === 'undo_renegotiation') {
    const old = s.renegotiations.find((r) => r.id === p.id); ensure(old && textField(p.reason, 500), 'Renegociação ou motivo inválidos.');
    const block = undoRenegotiationBlock(old, views()); ensure(!block, block ?? 'Renegociação indisponível.');
    return done(put(s, 'renegotiations', { ...old, status: old.status === 'efetivado' ? 'estornado' : 'descartado', reversedBy: actor, reversedAt: now, reverseReason: p.reason }));
  }
  if (kind === 'save_recurrence') {
    const old = s.recurrences.find((r) => r.id === p.id); if (old) previous(old, p.previous);
    ensure(s.farms.some((f) => f.id === p.farmId && f.operationId === p.operationId), 'Fazenda fora da operação.'); assertCostCenter(s.costCenters, p.operationId, p.costCenterId);
    const error = recurrenceErrors(p, [...DEFAULT_CATEGORIES, ...s.categories.filter((c) => c.operationId === p.operationId)]); ensure(!error, error ?? 'Recorrência inválida.');
    if (p.counterpartyId) ensure(s.counterparties.some((c) => c.id === p.counterpartyId && c.operationId === p.operationId), 'Fornecedor fora da operação.');
    return done(put(s, 'recurrences', { ...pick(p, ['id', 'operationId', 'farmId', 'title', 'categoryId', 'counterparty', 'counterpartyId', 'cents', 'dayOfMonth', 'startMonth', 'endMonth', 'active', 'costCenterId']), createdAt: old?.createdAt ?? now } as Tables['recurrences']));
  }
  if (kind === 'set_budget') {
    ensure(cents(p.cents) && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) && [...DEFAULT_CATEGORIES, ...s.categories].some((c) => c.id === p.categoryId && (c.operationId === null || c.operationId === p.operationId)), 'Orçamento inválido.');
    const old = s.budgets.find((b) => b.operationId === p.operationId && b.month === p.month && b.categoryId === p.categoryId);
    return done(put(s, 'budgets', { id: old?.id ?? p.id, operationId: p.operationId, categoryId: p.categoryId, month: p.month, cents: p.cents }));
  }
  if (kind === 'import_titles') {
    ensure(list(p.titles) && s.farms.some((f) => f.id === p.farmId && f.operationId === p.operationId), 'Importação inválida.');
    const added = [];
    for (const t of p.titles) {
      ensure(idString(t.id) && !s.titles.some((x) => x.id === t.id && x.operationId !== p.operationId) && textField(t.title) && textField(t.importKey, 500) && day(t.occurredAt) && ['pagar', 'receber'].includes(t.direction) && list(t.installments) && t.installments.length > 0, 'Linha importada inválida.');
      ensure(t.installments.every((i: any) => day(i.dueDate) && cents(i.cents) && i.cents > 0), 'Parcelas importadas inválidas.');
      if (s.titles.some((x) => x.operationId === p.operationId && x.importKey === t.importKey)) continue;
      ensure(!s.titles.some((x) => x.id === t.id), 'Identificador importado já existe.');
      const row = { ...pick(t, ['id', 'title', 'direction', 'counterparty', 'categoryId', 'occurredAt', 'installments', 'importKey']), operationId: p.operationId, farmId: p.farmId, authorId: actor, createdAt: now } as Tables['titles']; put(s, 'titles', row); added.push(row);
    }
    return done({ added: added.length, skipped: p.titles.length - added.length });
  }
  ensure(false, `A ação ${kind} ainda não foi migrada. Os dados locais foram preservados.`, 422);
}
