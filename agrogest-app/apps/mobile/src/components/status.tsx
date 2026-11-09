import { CRITERION_LABEL } from '@/domain/allocation';
import type { AllocationCriterion, Entry, EntryKind, EntryStatus, HistoryAction, WeightMethod } from '@/domain/types';
import { isDirect } from '@/domain/workflow';
import type { Tone } from '@/theme';

import { Badge, StatusText } from './ui/controls';
import type { IconName } from './ui/text';

/** Estados distintos: salvo no aparelho ≠ enviado ≠ aprovado. */
export const STATUS_META: Record<EntryStatus, { label: string; tone: Tone; help: string }> = {
  rascunho: { label: 'Rascunho', tone: 'neutral', help: 'Salvo só neste aparelho. Ainda não foi enviado.' },
  aguardando_envio: {
    label: 'Salvo no aparelho',
    tone: 'info',
    help: 'Vai ser enviado sozinho quando houver internet. Ainda não foi aprovado.',
  },
  aguardando_aprovacao: {
    label: 'Aguardando aprovação',
    tone: 'warning',
    help: 'Entra nos números depois que outra pessoa aprovar.',
  },
  aprovado: { label: 'Aprovado', tone: 'success', help: 'Consolidado nos saldos e resultados.' },
  rejeitado: { label: 'Recusado', tone: 'danger', help: 'Corrija e envie de novo.' },
  conflito: { label: 'Conflito', tone: 'conflict', help: 'Não cabe no saldo confirmado. Nada foi sobrescrito.' },
};

export const KIND_META: Record<EntryKind, { label: string; icon: IconName }> = {
  pesagem: { label: 'Pesagem', icon: 'scale-balance' },
  despesa: { label: 'Despesa', icon: 'receipt-text-outline' },
  mortalidade: { label: 'Mortalidade', icon: 'heart-broken-outline' },
  venda: { label: 'Venda', icon: 'truck-outline' },
  nota_fiscal: { label: 'Nota fiscal', icon: 'file-document-outline' },
  manejo: { label: 'Mudança de pasto', icon: 'swap-horizontal' },
  consumo: { label: 'Consumo de insumo', icon: 'silo' },
  ajuste_estoque: { label: 'Ajuste de estoque', icon: 'clipboard-check-outline' },
  transferencia_estoque: { label: 'Transferência de estoque', icon: 'warehouse' },
  receita: { label: 'Receita', icon: 'cash-plus' },
};

export const HISTORY_LABEL: Record<HistoryAction, string> = {
  criado: 'criou',
  enviado: 'enviou para aprovação',
  recebido: 'recebeu e validou o envio',
  ia_extraiu: 'leu a nota com IA',
  revisado: 'revisou',
  intencao_aprovar: 'registrou intenção de aprovar (offline)',
  intencao_recusar: 'registrou intenção de recusar (offline)',
  intencao_descartada: 'teve a decisão offline descartada',
  aprovado: 'aprovou',
  recusado: 'recusou',
  efetivado: 'efetivou direto: ninguém mais na operação para aprovar',
  conflito: 'detectou conflito',
};

const DIRECT_META = {
  label: 'Registrado',
  tone: 'success' as Tone,
  help: 'Já conta nos saldos e resultados. Não havia outra pessoa para aprovar.',
};

/** Como o estado aparece: efetivado sem segunda pessoa vira "Registrado", não "Aprovado". */
export function statusMeta(entry: Pick<Entry, 'status' | 'decidedBy'>) {
  return isDirect(entry) ? DIRECT_META : STATUS_META[entry.status];
}

export function EntryStatusText({ entry }: { entry: Pick<Entry, 'status' | 'decidedBy'> }) {
  const meta = statusMeta(entry);
  return <StatusText label={meta.label} tone={meta.tone} />;
}

/** Medido e estimado nunca se confundem (RN-09): sempre em texto. */
export function WeightTag({ method }: { method: WeightMethod }) {
  return method === 'medido' ? <Badge label="Medido" /> : <Badge label="Estimado" tone="warning" />;
}

export function CriterionBadge({ criterion }: { criterion: AllocationCriterion }) {
  return <Badge label={CRITERION_LABEL[criterion]} />;
}
