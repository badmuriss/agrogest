import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField } from '@/components/fields';
import { formatDate, formatDateShort, monthLabel } from '@/domain/dates';
import { ACCOUNT_KIND_LABEL, STATE_LABEL, type InstallmentState, type InstallmentView } from '@/domain/finance';
import { formatCents, plural } from '@/domain/format';
import type { CounterpartyKind, PaymentStatus } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { radius, soft, space, toneColor, usePalette, type Tone } from '@/theme';

import { Button, Note, StatusText } from './ui/controls';
import { Group, ListRow, Section } from './ui/layout';
import { haptics } from './ui/motion';
import { AppText } from './ui/text';

export const STATE_TONE: Record<InstallmentState, Tone> = {
  paga: 'success',
  parcial: 'info',
  vencida: 'danger',
  vence_hoje: 'warning',
  em_aberto: 'neutral',
  renegociada: 'neutral',
  cancelada: 'neutral',
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  aguardando_envio: { label: 'Esperando internet', tone: 'info' },
  efetivado: { label: 'Efetivada', tone: 'success' },
  conflito: { label: 'Conflito', tone: 'danger' },
  estornado: { label: 'Estornada', tone: 'warning' },
  descartado: { label: 'Descartada', tone: 'neutral' },
};

/** `withDate: false` quando a data já aparece ao lado (bloco da data na lista). */
export function dueText(v: Pick<InstallmentView, 'daysToDue' | 'dueDate' | 'openCents'>, withDate = true): string {
  const date = withDate ? ` · ${formatDateShort(v.dueDate)}` : '';
  if (v.openCents <= 0) return `Venceu ${formatDate(v.dueDate)}`;
  if (v.daysToDue < 0) return `Venceu há ${plural(-v.daysToDue, 'dia', 'dias')}${date}`;
  if (v.daysToDue === 0) return 'Vence hoje';
  if (v.daysToDue === 1) return 'Vence amanhã';
  return `Vence em ${plural(v.daysToDue, 'dia', 'dias')}${date}`;
}

/** Estados que o texto do vencimento não diz sozinho e por isso ganham etiqueta. */
const STATE_WITH_TAG: InstallmentState[] = ['paga', 'parcial', 'renegociada', 'cancelada'];

/** Dia e mês do vencimento em bloco, na cor do estado: a lista se lê pela coluna das datas. */
export function DueDateTile({ date, tone }: { date: string; tone: Tone }) {
  const p = usePalette();
  const color = tone === 'neutral' ? p.text : toneColor(p, tone);
  return (
    <View accessible={false} style={[styles.dateTile, { backgroundColor: tone === 'neutral' ? p.fill : soft(color) }]}>
      <AppText variant="bodyStrong" numeric style={[styles.dateDay, { color }]}>
        {date.slice(8, 10)}
      </AppText>
      <AppText variant="label" style={[styles.dateMonth, { color: tone === 'neutral' ? p.textMuted : color }]}>
        {monthLabel(date)}
      </AppText>
    </View>
  );
}

/** Parcela em lista: o que é, de quem, quando vence, quanto falta. */
export function InstallmentRow({
  view,
  selected,
  onPress,
}: {
  view: InstallmentView;
  selected?: boolean;
  onPress?: () => void;
}) {
  const parcel = view.count > 1 ? ` · ${view.position}/${view.count}` : '';
  const tone: Tone = view.state === 'vencida' ? 'danger' : view.state === 'vence_hoje' ? 'warning' : view.state === 'paga' ? 'success' : 'neutral';
  return (
    <ListRow
      leading={<DueDateTile date={view.dueDate} tone={tone} />}
      selected={selected}
      accessibilityLabel={`${view.title}${parcel}, ${formatCents(view.openCents)} em aberto, ${dueText(view)}`}
      title={
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={2} style={styles.flex}>
            {view.title}
            {parcel}
          </AppText>
          <AppText variant="bodyStrong" numeric>
            {formatCents(view.openCents > 0 ? view.openCents : view.cents)}
          </AppText>
        </View>
      }
      subtitle={
        // Fornecedor numa linha própria: dividindo a linha com o vencimento, ele saía cortado.
        <View style={styles.subStack}>
          {view.counterparty ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {view.counterparty}
            </AppText>
          ) : null}
          <View style={styles.sub}>
            {view.openCents > 0 ? (
              <AppText variant="caption" numberOfLines={1} tone={tone === 'danger' || tone === 'warning' ? tone : 'muted'} style={[styles.keep, (tone === 'danger' || tone === 'warning') && styles.strong]}>
                {dueText(view, false)}
              </AppText>
            ) : null}
            <View style={styles.flex} />
            {STATE_WITH_TAG.includes(view.state) ? <StatusText label={STATE_LABEL[view.state]} tone={STATE_TONE[view.state]} /> : null}
          </View>
        </View>
      }
      onPress={onPress ?? (() => router.push({ pathname: '/financeiro/parcela/[id]', params: { id: view.id } }))}
    />
  );
}

/** Contas ativas da operação para escolher de onde saiu ou entrou o dinheiro. */
export function AccountPicker({
  operationId,
  value,
  onChange,
}: {
  operationId: string;
  value: string | null;
  onChange: (accountId: string) => void;
}) {
  const app = useApp();
  const options = app.accounts.filter((a) => a.operationId === operationId && a.active);
  return (
    <Section title="Conta">
      {options.length > 0 ? (
        <Group>
          {options.map((a) => (
            <ListRow
              key={a.id}
              icon={a.kind === 'caixa' ? 'cash' : 'bank-outline'}
              title={a.name}
              subtitle={`${ACCOUNT_KIND_LABEL[a.kind]} · saldo ${formatCents(app.accountBalance(a.id))}`}
              selected={value === a.id}
              onPress={() => onChange(a.id)}
            />
          ))}
          <ListRow icon="plus" iconTone="accent" title="Cadastrar conta" onPress={() => router.push({ pathname: '/financeiro/conta/editar', params: { operacao: operationId } })} />
        </Group>
      ) : (
        <Note boxed icon="bank-outline" title="Cadastre a primeira conta">
          <AppText variant="caption" tone="muted">Banco, poupança ou o caixa em dinheiro, com o saldo de hoje.</AppText>
          <Button title="Cadastrar conta" variant="secondary" icon="plus" onPress={() => router.push({ pathname: '/financeiro/conta/editar', params: { operacao: operationId } })} />
        </Note>
      )}
    </Section>
  );
}

/**
 * Fornecedor ou cliente do cadastro, com o nome em texto como antes. Escolher do cadastro liga
 * o lançamento ao contato; digitar só o nome continua valendo (lançamentos antigos).
 */
export function CounterpartyField({
  operationId,
  kind,
  name,
  counterpartyId,
  onChange,
  label,
}: {
  operationId: string;
  kind: Exclude<CounterpartyKind, 'ambos'>;
  name: string;
  counterpartyId: string | null;
  onChange: (name: string, counterpartyId: string | null) => void;
  label: string;
}) {
  const app = useApp();
  const options = app.counterparties.filter((c) => c.operationId === operationId && c.active && (c.kind === kind || c.kind === 'ambos'));
  const query = name.trim().toLowerCase();
  const matches = query ? options.filter((c) => c.name.toLowerCase().includes(query) && c.id !== counterpartyId).slice(0, 4) : [];
  const exact = options.some((c) => c.name.toLowerCase() === query);
  const canSave = app.canSeeFinance(operationId) && query.length > 0 && !exact && !counterpartyId;
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.counterparty}>
      <FormField label={label} hint={counterpartyId ? 'Do cadastro de fornecedores e clientes.' : undefined}>
        <FieldInput value={name} onChangeText={(text) => onChange(text, null)} placeholder="Opcional" autoCapitalize="words" maxLength={150} />
      </FormField>
      {matches.length > 0 || canSave ? (
        <Group>
          {matches.map((c) => (
            <ListRow key={c.id} icon="card-account-details-outline" title={c.name} subtitle={c.document || undefined} chevron={false} onPress={() => onChange(c.name, c.id)} />
          ))}
          {canSave ? (
            <ListRow
              icon="plus"
              iconTone="accent"
              title={`Salvar "${name.trim()}" no cadastro`}
              chevron={false}
              onPress={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  const saved = await app.saveCounterparty(operationId, { name, kind, document: '', contact: '', pixKey: '', notes: '', active: true });
                  haptics.success();
                  onChange(saved.name, saved.id);
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </Group>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  sub: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  subStack: { gap: 2 },
  shrink: { flexShrink: 1 },
  keep: { flexShrink: 0 },
  counterparty: { gap: space.sm },
  strong: { fontWeight: '600' },
  dateTile: { width: 44, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 17, lineHeight: 20 },
  dateMonth: { fontSize: 11, lineHeight: 13, textTransform: 'uppercase', letterSpacing: 0.4 },
});
