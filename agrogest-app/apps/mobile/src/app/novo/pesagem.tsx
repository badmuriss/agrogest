import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { IllustrationHeader } from '@/components/illustration-header';
import { FarmPicker, LotGroupPicker, LotPicker, useLotGroup } from '@/components/pickers';
import { WeightTag } from '@/components/status';
import { Note } from '@/components/ui/controls';
import { DateField, Field, TextField } from '@/components/ui/form';
import { Card, Divider, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { DoneState, StepHeader, WizardNav } from '@/components/wizard';
import { daysBetween, formatDate } from '@/domain/dates';
import { formatNumber, parseDecimal, parseInteger } from '@/domain/format';
import type { Entry, WeightMethod } from '@/domain/types';
import { useApp } from '@/state/app-state';

const STEPS = ['Qual lote?', 'Qual o peso?', 'Confira'];

export default function PesagemScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string; lote?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'pesagem' ? existing : undefined;
  const initialLot = initial?.payload.lotId ?? params.lote ?? null;

  const [step, setStep] = useState(initialLot ? 1 : 0);
  const [farmId, setFarmId] = useState(
    initial?.farmId ?? (initialLot ? app.lotSummary(initialLot)?.lot.farmId : undefined) ?? app.defaultFarmId,
  );
  const [lotId, setLotId] = useState<string | null>(initialLot);
  const [method, setMethod] = useState<WeightMethod | null>(initial?.payload.method ?? null);
  const [weightText, setWeightText] = useState(initial ? formatNumber(initial.payload.avgWeightKg, 1) : '');
  const [headsText, setHeadsText] = useState(initial ? String(initial.payload.headsWeighed) : '');
  const [date, setDate] = useState(initial?.occurredAt ?? app.today);
  const [notes, setNotes] = useState(initial?.payload.notes ?? '');
  const [groupId, setGroupId] = useState<string | null>(initial?.payload.pastureId ?? null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Entry | null>(null);

  const summary = lotId ? app.lotSummary(lotId) : undefined;
  const group = useLotGroup(lotId, groupId);
  // Lote dividido: a pesagem é de um grupo, num pasto; o limite de cabeças é o do grupo.
  const available = group.split ? (group.heads ?? 0) : (summary?.headsCurrent ?? 0);
  const weight = parseDecimal(weightText);
  const heads = headsText ? parseInteger(headsText) : group.split && group.heads === null ? null : available;
  const weightError =
    weightText && (weight === null || weight <= 0 || weight > 1500) ? 'Informe um peso entre 1 e 1.500 kg.' : null;
  const headsError =
    headsText && (heads === null || heads <= 0 || (summary !== undefined && heads > available))
      ? `De 1 a ${available} cabeças.`
      : null;
  const canNext =
    step === 0
      ? summary !== undefined && summary.lot.farmId === farmId
      : step === 1
        ? method !== null && weight !== null && heads !== null && !weightError && !headsError && (!group.split || group.pastureId !== null)
        : true;

  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Outra pesagem" onAgain={() => router.replace('/novo/pesagem')} />
      </Screen>
    );
  }

  const save = async (submit: boolean) => {
    if (!summary || !method || weight === null || heads === null) return;
    setBusy(true);
    const farm = app.farm(summary.lot.farmId)!;
    const entry = await app.saveEntry(
      {
        kind: 'pesagem',
        payload: { lotId: summary.lot.id, method, avgWeightKg: weight, headsWeighed: heads, notes: notes.trim(), pastureId: group.pastureId },
        operationId: farm.operationId,
        farmId: farm.id,
        title: `${method === 'medido' ? 'Pesagem' : 'Estimativa de peso'} — Origem ${summary.lot.code}`,
        amountCents: null,
        occurredAt: date,
      },
      { submit, existingId: initial?.id },
    );
    setBusy(false);
    setSaved(entry);
  };

  const days = summary ? daysBetween(summary.lot.purchasedAt, date) : 0;
  const gmdPreview = summary && weight !== null && days > 0 ? (weight - summary.lot.entryWeightKg) / days : null;

  return (
    <Screen
      footer={
        <WizardNav
          step={step}
          last={STEPS.length - 1}
          canNext={canNext}
          onStep={setStep}
          busy={busy}
          onSave={save}
          scope={summary ? { operationId: summary.lot.operationId, kind: 'pesagem' } : undefined}
        />
      }>
      <StepHeader steps={STEPS} current={step} />
      {step === 0 ? <IllustrationHeader name="weighing" title="Veja o rebanho crescer" description="Registre o peso na balança ou uma estimativa para acompanhar a evolução." /> : null}

      <FadeIn key={step}>
        {step === 0 ? (
          <>
            <FarmPicker
              value={farmId}
              onChange={(id) => {
                setFarmId(id);
                setLotId(null);
              }}
            />
            <LotPicker farmId={farmId} value={lotId} onChange={setLotId} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            {lotId ? <LotGroupPicker lotId={lotId} value={group.pastureId} onChange={setGroupId} title="Qual grupo foi pesado?" /> : null}
            <Section title="Como foi pesado">
              <Group>
                <ListRow
                  icon="scale-balance"
                  title="Na balança"
                  subtitle="Peso médio medido"
                  selected={method === 'medido'}
                  onPress={() => setMethod('medido')}
                />
                <ListRow
                  icon="eye-outline"
                  title="No olho"
                  subtitle="Estimativa visual, fica marcada como estimada"
                  selected={method === 'estimado'}
                  onPress={() => setMethod('estimado')}
                />
              </Group>
            </Section>
            <Field label="Peso médio por cabeça" error={weightError}>
              <TextField keyboardType="decimal-pad" suffix="kg" placeholder="Ex.: 305" value={weightText} onChangeText={setWeightText} />
            </Field>
            <Field
              label={method === 'estimado' ? 'Cabeças avaliadas' : 'Cabeças pesadas'}
              error={headsError}
              hint={summary && (!group.split || group.heads !== null) ? `Em branco = todas as ${available}${group.split ? ' do pasto' : ''}.` : undefined}>
              <TextField
                keyboardType="number-pad"
                suffix="cab."
                placeholder={summary ? String(available) : ''}
                value={headsText}
                onChangeText={setHeadsText}
              />
            </Field>
            <DateField label="Data" value={date} onChange={setDate} />
            <Field label="Observação">
              <TextField multiline value={notes} onChangeText={setNotes} placeholder="Opcional" />
            </Field>
          </>
        ) : null}

        {step === 2 && summary && method && weight !== null ? (
          <>
            <Card>
              <KV label="Lote" value={`Origem ${summary.lot.code}`} />
              {group.pastureId ? <KV label="Pasto" value={app.pastureName(group.pastureId)} /> : null}
              <KV label="Operação" value={app.operation(summary.lot.operationId)?.name ?? ''} />
              <KV label="Método" value={<WeightTag method={method} />} />
              <KV label="Peso médio" value={`${formatNumber(weight, 1)} kg`} strong />
              <KV label="Cabeças" value={String(heads)} />
              <KV label="Data" value={formatDate(date)} />
              <Divider />
              <KV
                label="Antes"
                value={`${formatNumber(summary.lastWeighing.kg)} kg`}
                hint={`${summary.lastWeighing.method} em ${formatDate(summary.lastWeighing.date)}`}
              />
              <KV
                label="GMD desde a compra"
                value={gmdPreview !== null ? `${method === 'estimado' ? '≈' : ''}${formatNumber(gmdPreview, 2)} kg/dia` : '—'}
              />
            </Card>
            <Note icon={app.online ? 'account-check-outline' : 'cloud-off-outline'}>
              {!app.online
                ? 'Sem internet: fica no aparelho e é enviado sozinho depois.'
                : app.needsApproval({ authorId: app.user.id, operationId: summary.lot.operationId, kind: 'pesagem' })
                  ? 'Outra pessoa da operação aprova antes de entrar nos indicadores.'
                  : 'Entra direto nos indicadores: não há outra pessoa para aprovar.'}
            </Note>
          </>
        ) : null}
      </FadeIn>
    </Screen>
  );
}
