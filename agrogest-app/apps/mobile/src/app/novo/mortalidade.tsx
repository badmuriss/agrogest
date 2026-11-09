import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { IllustrationHeader } from '@/components/illustration-header';
import { FarmPicker, LotGroupPicker, LotPicker, useLotGroup } from '@/components/pickers';
import { Chip, ChipWrap, Note } from '@/components/ui/controls';
import { DateField, Field, TextField } from '@/components/ui/form';
import { Screen } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import { DoneState, SubmitButtons } from '@/components/wizard';
import { parseInteger } from '@/domain/format';
import type { Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';

const CAUSES = ['Doença', 'Acidente', 'Picada de cobra', 'Desconhecida', 'Outra'];

export default function MortalidadeScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string; lote?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'mortalidade' ? existing : undefined;
  const initialLot = initial?.payload.lotId ?? params.lote ?? null;

  const [farmId, setFarmId] = useState(
    initial?.farmId ?? (initialLot ? app.lotSummary(initialLot)?.lot.farmId : undefined) ?? app.defaultFarmId,
  );
  const [lotId, setLotId] = useState<string | null>(initialLot);
  const [headsText, setHeadsText] = useState(initial ? String(initial.payload.heads) : '1');
  const [date, setDate] = useState(initial?.occurredAt ?? app.today);
  const [cause, setCause] = useState(initial?.payload.cause ?? '');
  const [notes, setNotes] = useState(initial?.payload.notes ?? '');
  const [groupId, setGroupId] = useState<string | null>(initial?.payload.pastureId ?? null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Entry | null>(null);

  const summary = lotId ? app.lotSummary(lotId) : undefined;
  const group = useLotGroup(lotId, groupId);
  const available = group.split ? (group.heads ?? 0) : (summary?.headsCurrent ?? 0);
  const heads = parseInteger(headsText);
  const headsError =
    summary && (!group.split || group.pastureId) && (heads === null || heads <= 0 || heads > available)
      ? `De 1 a ${available} cabeças (saldo confirmado${group.split ? ' no pasto' : ''}).`
      : null;
  const valid =
    summary !== undefined && summary.lot.farmId === farmId && heads !== null && !headsError && cause !== '' && (!group.split || group.pastureId !== null);

  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Registrar outra" onAgain={() => router.replace('/novo/mortalidade')} />
      </Screen>
    );
  }

  const save = async (submit: boolean) => {
    if (!summary || heads === null) return;
    setBusy(true);
    const farm = app.farm(summary.lot.farmId)!;
    const entry = await app.saveEntry(
      {
        kind: 'mortalidade',
        payload: { lotId: summary.lot.id, heads, cause, notes: notes.trim(), pastureId: group.pastureId },
        operationId: farm.operationId,
        farmId: farm.id,
        title: `Mortalidade — Origem ${summary.lot.code}`,
        amountCents: null,
        occurredAt: date,
      },
      { submit, existingId: initial?.id },
    );
    setBusy(false);
    setSaved(entry);
  };

  return (
    <Screen
      footer={
        <SubmitButtons
          disabled={!valid}
          busy={busy}
          onSave={save}
          scope={summary ? { operationId: summary.lot.operationId, kind: 'mortalidade' } : undefined}
        />
      }>
      <FadeIn>
        {summary ? null : <IllustrationHeader name="loss" title="Cuidado com cada registro" description="Informe a baixa para manter o saldo do rebanho atualizado." />}
        <FarmPicker
          value={farmId}
          onChange={(id) => {
            setFarmId(id);
            setLotId(null);
          }}
        />
        <LotPicker farmId={farmId} value={lotId} onChange={setLotId} />
      </FadeIn>
      {summary ? (
        <FadeIn>
          <LotGroupPicker lotId={summary.lot.id} value={group.pastureId} onChange={setGroupId} />
          <Field label="Cabeças" error={headsText ? headsError : null}>
            <TextField keyboardType="number-pad" suffix="cab." value={headsText} onChangeText={setHeadsText} />
          </Field>
          {heads !== null && !headsError ? (
            <AppText variant="caption" tone="muted">
              Saldo do lote depois: {summary.headsCurrent} → {summary.headsCurrent - heads}
            </AppText>
          ) : null}
          <Field label="Causa">
            <ChipWrap>
              {CAUSES.map((c) => (
                <Chip key={c} label={c} selected={cause === c} onPress={() => setCause(c)} />
              ))}
            </ChipWrap>
          </Field>
          <DateField label="Data" value={date} onChange={setDate} />
          <Field label="Observação">
            <TextField multiline value={notes} onChangeText={setNotes} placeholder="Opcional" />
          </Field>
          <Note icon="shield-check-outline">
            O saldo é conferido de novo no envio. Se outro celular baixou animais antes, vira conflito, sem sobrescrever.
          </Note>
        </FadeIn>
      ) : null}
    </Screen>
  );
}
