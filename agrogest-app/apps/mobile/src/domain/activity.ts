import { formatDayMonth } from './dates';
import { formatNumber, plural } from './format';
import type { Entry, EntryKind, Pasture, User } from './types';

/**
 * Atividade da fazenda: quem fez o quê, em linguagem de gente. No modo conectado vem do
 * servidor (trilha de auditoria de cada comando); no protótipo local é montada a partir do
 * histórico dos lançamentos e dos cadastros. O resumo nunca traz valores em dinheiro.
 */
export interface ActivityItem {
  id: string;
  operationId: string;
  farmId: string | null;
  actorId: string;
  actorName: string | null;
  /** Comando que gerou a ação (`create_pasture`, `save_entry`...). */
  kind: string;
  /** Data e hora ISO. */
  at: string;
  subject: ActivitySubject;
}

export interface ActivitySubject {
  name?: string;
  pastureId?: string;
  lotId?: string;
  code?: string;
  entryId?: string;
  entryKind?: EntryKind;
  lotCode?: string;
  submit?: boolean;
  decision?: string;
  heads?: number;
  fromPasture?: string;
  toPasture?: string;
  active?: boolean;
  wasActive?: boolean;
  cleared?: boolean;
  direction?: 'saida' | 'entrada';
  fromFarm?: string;
  toFarm?: string;
  role?: string;
  /** Insumo e quantidade (estoque); nunca valores. */
  supplyName?: string;
  quantity?: number;
  unit?: string;
  /** Baixa: pagamento ou recebimento e quantas parcelas. */
  paymentDirection?: 'pagar' | 'receber';
  count?: number;
  /** Baixa estornada (true) ou conflito descartado (false). */
  reversed?: boolean;
  /** Movimentação (transferência, aporte...) e o sócio envolvido. */
  movementKind?: string;
  partnerName?: string;
  /** Renegociação: quantas parcelas novas (0 = cancelou). */
  newCount?: number;
  month?: string;
}

export type ActivityTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface ActivityText {
  /** "cadastrou o pasto" */
  action: string;
  /** "Piquete 3" (em destaque), ou null. */
  object: string | null;
  /** Complemento discreto: "12 cabeças · Pasto 01 → Pasto 02". */
  detail: string | null;
  icon: string;
  tone: ActivityTone;
}

const ENTRY_NOUN: Record<EntryKind, string> = {
  pesagem: 'uma pesagem',
  manejo: 'uma mudança de pasto',
  despesa: 'uma despesa',
  nota_fiscal: 'uma nota fiscal',
  mortalidade: 'uma morte',
  venda: 'uma venda',
  consumo: 'um consumo de insumo',
  ajuste_estoque: 'um ajuste de estoque',
  transferencia_estoque: 'uma transferência de estoque',
  receita: 'uma receita',
};

const ENTRY_ICON: Record<EntryKind, string> = {
  pesagem: 'scale-balance',
  manejo: 'swap-horizontal',
  despesa: 'cash-minus',
  nota_fiscal: 'file-document-outline',
  mortalidade: 'heart-broken-outline',
  venda: 'cash-plus',
  consumo: 'silo',
  ajuste_estoque: 'clipboard-check-outline',
  transferencia_estoque: 'truck-outline',
  receita: 'cash-plus',
};

const MOVEMENT_NOUN: Record<string, string> = {
  transferencia: 'uma transferência',
  aporte: 'um aporte',
  retirada: 'uma retirada',
  distribuicao: 'uma distribuição de lucro',
  liberacao: 'uma liberação de financiamento',
  adiantamento: 'um adiantamento de cliente',
};

function entryDetail(s: ActivitySubject): string | null {
  const parts = [
    s.lotCode ? `Origem ${s.lotCode}` : null,
    typeof s.heads === 'number' ? plural(s.heads, 'cabeça', 'cabeças') : null,
    s.fromPasture && s.toPasture ? `${s.fromPasture} → ${s.toPasture}` : null,
    s.supplyName ? `${s.supplyName}${typeof s.quantity === 'number' ? ` · ${formatNumber(s.quantity, 3)} ${s.unit ?? ''}`.trimEnd() : ''}` : null,
    s.toFarm && s.entryKind === 'transferencia_estoque' ? `para ${s.toFarm}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Frase curta de cada ação. Ação desconhecida (versão nova do servidor) ainda aparece. */
export function describeActivity(item: ActivityItem): ActivityText {
  const s = item.subject;
  const entry = s.entryKind ? ENTRY_NOUN[s.entryKind] : 'um lançamento';
  const entryIcon = s.entryKind ? ENTRY_ICON[s.entryKind] : 'note-text-outline';
  switch (item.kind) {
    case 'create_farm':
      return { action: 'criou a fazenda', object: s.name ?? null, detail: null, icon: 'barn', tone: 'accent' };
    case 'update_farm':
      return { action: 'editou a fazenda', object: s.name ?? null, detail: null, icon: 'barn', tone: 'neutral' };
    case 'update_farm_boundary':
      return { action: s.cleared ? 'apagou a área da fazenda' : 'desenhou a área da fazenda', object: null, detail: null, icon: 'vector-polygon', tone: 'neutral' };
    case 'create_pasture':
      return { action: 'cadastrou o pasto', object: s.name ?? null, detail: null, icon: 'grass', tone: 'accent' };
    case 'update_pasture':
      if (s.wasActive === true && s.active === false) return { action: 'inativou o pasto', object: s.name ?? null, detail: null, icon: 'archive-outline', tone: 'warning' };
      if (s.wasActive === false && s.active === true) return { action: 'reativou o pasto', object: s.name ?? null, detail: null, icon: 'grass', tone: 'accent' };
      return { action: 'editou o pasto', object: s.name ?? null, detail: null, icon: 'pencil-outline', tone: 'neutral' };
    case 'update_pasture_boundary':
      return { action: s.cleared ? 'tirou do mapa o pasto' : 'desenhou no mapa o pasto', object: s.name ?? null, detail: null, icon: 'vector-polygon', tone: 'neutral' };
    case 'delete_pasture':
      return { action: 'excluiu o pasto', object: s.name ?? null, detail: null, icon: 'delete-outline', tone: 'danger' };
    case 'create_lot':
      return { action: 'cadastrou o lote', object: s.code ? `Origem ${s.code}` : null, detail: null, icon: 'cow', tone: 'accent' };
    case 'update_lot':
      return { action: 'editou o lote', object: s.code ? `Origem ${s.code}` : null, detail: null, icon: 'pencil-outline', tone: 'neutral' };
    case 'place_lot':
      return { action: s.cleared ? 'tirou do mapa o lote' : 'posicionou no mapa o lote', object: s.code ? `Origem ${s.code}` : null, detail: null, icon: 'map-marker-outline', tone: 'neutral' };
    case 'transfer_lot':
      return {
        action: s.direction === 'entrada' ? 'recebeu o lote' : 'transferiu o lote',
        object: s.code ? `Origem ${s.code}` : null,
        detail: s.direction === 'entrada' ? (s.fromFarm ? `de ${s.fromFarm}` : null) : s.toFarm ? `para ${s.toFarm}` : null,
        icon: 'truck-delivery-outline',
        tone: 'info',
      };
    case 'invite':
      return { action: 'convidou', object: s.name ?? null, detail: s.role === 'socio' ? 'como sócio' : s.role === 'funcionario' ? 'como funcionário' : null, icon: 'account-plus-outline', tone: 'info' };
    case 'cancel_invite':
      return { action: 'cancelou o convite de', object: s.name ?? null, detail: null, icon: 'account-cancel-outline', tone: 'neutral' };
    case 'accept_invite':
      return { action: 'entrou na operação', object: null, detail: null, icon: 'account-check-outline', tone: 'success' };
    case 'update_member':
      return { action: 'alterou o cargo de', object: s.name ?? null, detail: s.role === 'socio' ? 'para sócio' : 'para funcionário', icon: 'account-edit-outline', tone: 'info' };
    case 'remove_member':
      return { action: 'removeu o acesso de', object: s.name ?? null, detail: null, icon: 'account-remove-outline', tone: 'warning' };
    case 'save_entry':
      return { action: s.submit ? `registrou ${entry}` : `salvou o rascunho de ${entry}`, object: null, detail: entryDetail(s), icon: entryIcon, tone: 'neutral' };
    case 'decide_entry': {
      const approved = s.decision === 'aprovar';
      return { action: `${approved ? 'aprovou' : 'recusou'} ${entry}`, object: null, detail: entryDetail(s), icon: approved ? 'check-circle-outline' : 'close-circle-outline', tone: approved ? 'success' : 'danger' };
    }
    case 'discard_entry':
      return { action: `descartou ${entry}`, object: null, detail: entryDetail(s), icon: 'delete-outline', tone: 'neutral' };
    case 'create_supply':
      return { action: 'cadastrou o insumo', object: s.name ?? null, detail: null, icon: 'silo', tone: 'accent' };
    case 'update_supply':
      return { action: 'editou o insumo', object: s.name ?? null, detail: null, icon: 'pencil-outline', tone: 'neutral' };
    case 'create_account':
      return { action: 'cadastrou a conta', object: s.name ?? null, detail: null, icon: 'bank-outline', tone: 'accent' };
    case 'update_account':
      return { action: 'editou a conta', object: s.name ?? null, detail: null, icon: 'bank-outline', tone: 'neutral' };
    case 'create_category':
      return { action: 'criou a categoria', object: s.name ?? null, detail: null, icon: 'shape-outline', tone: 'neutral' };
    case 'save_counterparty':
      return { action: 'salvou o contato', object: s.name ?? null, detail: null, icon: 'card-account-details-outline', tone: 'neutral' };
    case 'set_lot_payment_plan':
      return {
        action: s.cleared ? 'tirou o pagamento da compra do lote' : 'informou o pagamento da compra do lote',
        object: s.code ? `Origem ${s.code}` : null,
        detail: null,
        icon: 'cash-check',
        tone: 'neutral',
      };
    case 'register_payment': {
      const receiving = s.paymentDirection === 'receber';
      return {
        action: receiving ? 'registrou um recebimento' : 'registrou um pagamento',
        object: null,
        detail: typeof s.count === 'number' ? plural(s.count, 'parcela', 'parcelas') : null,
        icon: receiving ? 'cash-plus' : 'cash-check',
        tone: 'success',
      };
    }
    case 'reverse_payment':
      return {
        action: s.reversed === false ? 'descartou uma baixa em conflito' : s.paymentDirection === 'receber' ? 'estornou um recebimento' : 'estornou um pagamento',
        object: null,
        detail: null,
        icon: 'undo-variant',
        tone: 'warning',
      };
    case 'register_movement':
    case 'reverse_movement': {
      const label = MOVEMENT_NOUN[s.movementKind ?? ''] ?? 'uma movimentação';
      if (item.kind === 'reverse_movement') {
        return { action: s.reversed === false ? 'descartou uma movimentação em conflito' : `estornou ${label}`, object: s.partnerName ?? null, detail: null, icon: 'undo-variant', tone: 'warning' };
      }
      return { action: `registrou ${label}`, object: s.partnerName ?? null, detail: null, icon: 'swap-horizontal', tone: 'neutral' };
    }
    case 'save_financing':
      return { action: 'cadastrou o financiamento', object: s.name ?? null, detail: null, icon: 'bank-transfer-in', tone: 'accent' };
    case 'renegotiate':
      return {
        action: s.newCount === 0 ? 'cancelou contas' : 'renegociou contas',
        object: null,
        detail: typeof s.count === 'number' ? `${plural(s.count, 'parcela', 'parcelas')}${s.newCount ? ` → ${plural(s.newCount, 'nova', 'novas')}` : ''}` : null,
        icon: 'calendar-edit',
        tone: 'info',
      };
    case 'undo_renegotiation':
      return { action: 'desfez uma renegociação', object: null, detail: null, icon: 'undo-variant', tone: 'warning' };
    case 'save_recurrence':
      return { action: 'salvou a despesa recorrente', object: s.name ?? null, detail: null, icon: 'calendar-sync', tone: 'neutral' };
    case 'set_budget':
      return { action: 'definiu o orçamento', object: s.month ? `${s.month.slice(5, 7)}/${s.month.slice(0, 4)}` : null, detail: null, icon: 'target', tone: 'neutral' };
    case 'import_titles':
      return { action: 'importou a planilha', object: null, detail: typeof s.count === 'number' ? plural(s.count, 'conta', 'contas') : null, icon: 'file-table-outline', tone: 'info' };
    default:
      return { action: 'fez uma alteração', object: null, detail: null, icon: 'history', tone: 'neutral' };
  }
}

/** "Hoje", "Ontem" ou a data, para agrupar a lista. */
export function activityDay(at: string, today: string): string {
  const day = localDay(at);
  if (day === today) return 'Hoje';
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDay(yesterday.toISOString())) return 'Ontem';
  return formatDayMonth(day, today);
}

function localDay(at: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return at;
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "14:32" no fuso do aparelho; datas sem hora (dados antigos) ficam sem hora. */
export function activityTime(at: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return null;
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Protótipo local (sem servidor): atividade montada do histórico de cada lançamento e da
 * data de cadastro dos pastos. Mais recente primeiro.
 */
export function localActivity(input: {
  entries: Entry[];
  pastures: Pasture[];
  users: User[];
  lotCode: (lotId: string) => string | undefined;
  pastureName: (pastureId: string) => string;
  supply?: (supplyId: string) => { name: string; unit: string } | undefined;
}): ActivityItem[] {
  const name = (id: string) => input.users.find((u) => u.id === id)?.name ?? null;
  const items: ActivityItem[] = [];
  for (const pasture of input.pastures) {
    items.push({
      id: `pasture:${pasture.id}`,
      operationId: pasture.operationId,
      farmId: pasture.farmId,
      actorId: '',
      actorName: null,
      kind: 'create_pasture',
      at: pasture.createdAt,
      subject: { pastureId: pasture.id, name: pasture.name },
    });
  }
  for (const entry of input.entries) {
    const lotId = 'lotId' in entry.payload ? entry.payload.lotId : undefined;
    const subject: ActivitySubject = {
      entryId: entry.id,
      entryKind: entry.kind,
      lotCode: lotId ? input.lotCode(lotId) : undefined,
    };
    if (entry.kind === 'pesagem' || entry.kind === 'mortalidade' || entry.kind === 'manejo') {
      subject.heads = entry.kind === 'pesagem' ? entry.payload.headsWeighed : entry.payload.heads;
      if (entry.kind === 'manejo') {
        subject.fromPasture = input.pastureName(entry.payload.fromPastureId);
        subject.toPasture = input.pastureName(entry.payload.toPastureId);
      }
    }
    if (entry.kind === 'consumo' || entry.kind === 'ajuste_estoque' || entry.kind === 'transferencia_estoque') {
      const supply = input.supply?.(entry.payload.supplyId);
      subject.supplyName = supply?.name;
      subject.unit = supply?.unit;
      subject.quantity = entry.kind === 'ajuste_estoque' ? entry.payload.delta : entry.payload.quantity;
    }
    entry.history.forEach((h, i) => {
      const kind = h.action === 'aprovado' || h.action === 'recusado' ? 'decide_entry' : h.action === 'criado' || h.action === 'enviado' ? 'save_entry' : null;
      if (!kind) return;
      // Criado e enviado juntos viram uma linha só ("registrou").
      if (h.action === 'criado' && entry.history.some((o) => o.action === 'enviado' && o.at === h.at)) return;
      items.push({
        id: `${entry.id}:${i}`,
        operationId: entry.operationId,
        farmId: entry.farmId,
        actorId: h.by,
        actorName: name(h.by),
        kind,
        at: h.at,
        subject: { ...subject, submit: h.action === 'enviado', decision: h.action === 'aprovado' ? 'aprovar' : h.action === 'recusado' ? 'recusar' : undefined },
      });
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}
