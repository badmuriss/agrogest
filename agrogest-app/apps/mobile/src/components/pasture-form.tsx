import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldInput, FormField } from '@/components/fields';
import { formatNumber, parseDecimal, plural } from '@/domain/format';
import { FORAGE_SUGGESTIONS, pastureErrors, pastureKey, type PastureErrors, type PastureInput } from '@/domain/pasture';
import type { Pasture } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

import { Button, Chip, ChipWrap, Note } from './ui/controls';
import { Card, Group, ListRow, Section } from './ui/layout';
import { haptics } from './ui/motion';
import { AppText } from './ui/text';

export interface PastureDraft {
  name: string;
  areaText: string;
  forage: string;
  notes: string;
  active: boolean;
}

export function draftFrom(pasture?: Pasture): PastureDraft {
  return {
    name: pasture?.name ?? '',
    areaText: pasture?.areaHa ? formatNumber(pasture.areaHa, 2) : '',
    forage: pasture?.forage ?? '',
    notes: pasture?.notes ?? '',
    active: pasture?.active ?? true,
  };
}

export function draftInput(draft: PastureDraft): PastureInput {
  return { name: draft.name, areaHa: parseDecimal(draft.areaText), forage: draft.forage, notes: draft.notes, active: draft.active };
}

export function draftErrors(draft: PastureDraft, others: Pasture[]): PastureErrors {
  return pastureErrors(draftInput(draft), others);
}

/** Área como o produtor fala: "20 ha"; sem área nos pastos convertidos do texto antigo. */
export function areaLabel(pasture: Pasture | undefined): string {
  return pasture?.areaHa ? `${formatNumber(pasture.areaHa, 2)} ha` : 'Área não informada';
}

export function pastureCaption(pasture: Pasture | undefined): string {
  if (!pasture) return '';
  return [areaLabel(pasture), pasture.forage.trim() || 'Capim não informado'].join(' · ');
}

/** Nome, área, capim e observações. Os erros só aparecem depois da primeira tentativa. */
export function PastureFields({
  draft,
  onChange,
  errors,
}: {
  draft: PastureDraft;
  onChange: (draft: PastureDraft) => void;
  errors: PastureErrors | null;
}) {
  const set = (patch: Partial<PastureDraft>) => onChange({ ...draft, ...patch });
  const selected = pastureKey(draft.forage);
  return (
    <View style={styles.fields}>
      <FormField label="Nome ou identificação" error={errors?.name}>
        <FieldInput value={draft.name} onChangeText={(name) => set({ name })} placeholder="Ex.: Pasto 01" maxLength={150} autoCapitalize="sentences" />
      </FormField>
      <FormField label="Área útil" error={errors?.areaHa} hint="Só a área de pastejo deste pasto, não a da fazenda.">
        <FieldInput value={draft.areaText} onChangeText={(areaText) => set({ areaText })} placeholder="Ex.: 20" keyboardType="decimal-pad" suffix="ha" />
      </FormField>
      <FormField label="Tipo de capim" error={errors?.forage}>
        <ChipWrap>
          {FORAGE_SUGGESTIONS.map((option) => (
            <Chip key={option} label={option} selected={selected === pastureKey(option)} onPress={() => set({ forage: option })} />
          ))}
        </ChipWrap>
        <FieldInput value={draft.forage} onChangeText={(forage) => set({ forage })} placeholder="Ou escreva, ex.: Brachiaria e Mombaça" maxLength={150} />
      </FormField>
      <FormField label="Observações (opcional)" error={errors?.notes}>
        <FieldInput value={draft.notes} onChangeText={(notes) => set({ notes })} placeholder="Água, cocho, cerca…" multiline maxLength={500} />
      </FormField>
    </View>
  );
}

/**
 * Pastos ativos da fazenda para escolher, com "Cadastrar novo pasto" ali mesmo: o formulário
 * de fora (lote, transferência, movimentação) continua montado e não perde o que foi digitado.
 */
export function PasturePicker({
  farmId,
  value,
  onChange,
  title = 'Pasto',
  exclude,
  error,
  heads,
}: {
  farmId: string;
  value: string | null;
  onChange: (pastureId: string) => void;
  title?: string;
  /** Pasto que não pode ser escolhido (ex.: a origem de uma movimentação). */
  exclude?: string | null;
  error?: string | null;
  /** Cabeças confirmadas do lote em cada pasto, para mostrar ao lado. */
  heads?: Map<string, number>;
}) {
  const app = useApp();
  const farm = app.farm(farmId);
  const options = app.farmPastures(farmId).filter((p) => p.id !== exclude);
  const canCreate = !!farm && app.canManagePastures(farm.operationId);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<PastureDraft>(() => draftFrom());
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const showForm = creating || (canCreate && options.length === 0);
  const errors = draftErrors(draft, app.farmPastures(farmId, true));

  const save = async () => {
    setTried(true);
    setFailure(null);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      const created = await app.createPasture(farmId, draftInput(draft));
      haptics.success();
      onChange(created.id);
      setCreating(false);
      setDraft(draftFrom());
      setTried(false);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível cadastrar o pasto.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={title}>
      {options.length > 0 ? (
        <Group>
          {options.map((pasture) => {
            const count = heads?.get(pasture.id) ?? 0;
            return (
              <ListRow
                key={pasture.id}
                icon="grass"
                iconTone={value === pasture.id ? 'accent' : 'neutral'}
                title={pasture.name}
                subtitle={[pastureCaption(pasture), count > 0 ? `${plural(count, 'cabeça', 'cabeças')} deste lote` : null].filter(Boolean).join('\n')}
                selected={value === pasture.id}
                onPress={() => onChange(pasture.id)}
              />
            );
          })}
          {canCreate && !showForm ? (
            <ListRow icon="plus" iconTone="accent" title="Cadastrar novo pasto" subtitle="Sem sair deste formulário" onPress={() => setCreating(true)} />
          ) : null}
        </Group>
      ) : null}
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      {showForm ? (
        <Card style={styles.card}>
          <AppText variant="bodyStrong" accessibilityRole="header">
            {options.length === 0 ? 'Cadastre o primeiro pasto da fazenda' : 'Novo pasto'}
          </AppText>
          <PastureFields draft={draft} onChange={setDraft} errors={tried ? errors : null} />
          {failure ? (
            <Note tone="danger" icon="alert-circle-outline" boxed>
              {failure}
            </Note>
          ) : null}
          <View style={styles.actions}>
            {options.length > 0 ? <Button title="Cancelar" variant="secondary" disabled={busy} onPress={() => setCreating(false)} /> : null}
            <Button title={busy ? 'Salvando…' : 'Salvar pasto'} icon="check" disabled={busy} onPress={save} style={styles.grow} />
          </View>
        </Card>
      ) : null}
      {!canCreate && options.length === 0 ? (
        <Note icon="lock-outline" title="Nenhum pasto ativo">
          Peça a um sócio da operação para cadastrar os pastos desta fazenda.
        </Note>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.lg },
  card: { gap: space.lg },
  actions: { flexDirection: 'row', gap: space.sm },
  grow: { flexGrow: 2 },
});
