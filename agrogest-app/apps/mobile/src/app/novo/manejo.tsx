import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { pastureCaption, PasturePicker } from '@/components/pasture-form';
import { FarmPicker, LotPicker } from '@/components/pickers';
import { Chip, ChipWrap, Note } from '@/components/ui/controls';
import { DateField, Field, TextField } from '@/components/ui/form';
import { Card, Divider, Group, KV, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { DoneState, StepHeader, WizardNav } from '@/components/wizard';
import { formatDate } from '@/domain/dates';
import { parseInteger, plural } from '@/domain/format';
import type { Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';

const STEPS = ['Qual lote?', 'De onde para onde?', 'Confira'];

/**
 * Mudança de pasto na mesma fazenda: total ou parcial, sem compra, venda ou transferência.
 * Vira um lançamento comum: fila offline, aprovação por outra pessoa e validação de saldo.
 */
export default function ManejoScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string; lote?: string; origem?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'manejo' ? existing : undefined;
  const initialLot = initial?.payload.lotId ?? params.lote ?? null;

  const [step, setStep] = useState(initialLot ? 1 : 0);
  const [farmId, setFarmId] = useState(
    initial?.farmId ?? (initialLot ? app.lotSummary(initialLot)?.lot.farmId : undefined) ?? app.defaultFarmId,
  );
  const [lotId, setLotId] = useState<string | null>(initialLot);
  const [fromId, setFromId] = useState<string | null>(initial?.payload.fromPastureId ?? params.origem ?? null);
  const [toId, setToId] = useState<string | null>(initial?.payload.toPastureId ?? null);
  const [headsText, setHeadsText] = useState(initial ? String(initial.payload.heads) : '');
  const [date, setDate] = useState(initial?.occurredAt ?? app.today);
  const [notes, setNotes] = useState(initial?.payload.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<Entry | null>(null);

  const summary = lotId ? app.lotSummary(lotId) : undefined;
  const groups = lotId ? app.lotGroups(lotId) : [];
  const byPasture = new Map(groups.map((g) => [g.pastureId, g.heads]));
  // Com um grupo só, a origem é óbvia.
  const origin = fromId && byPasture.has(fromId) ? fromId : groups.length === 1 ? groups[0].pastureId : null;
  const available = origin ? (byPasture.get(origin) ?? 0) : 0;
  const heads = headsText ? parseInteger(headsText) : null;
  const headsError =
    headsText && (heads === null || heads <= 0 || heads > available) ? `De 1 a ${plural(available, 'cabeça', 'cabeças')} neste pasto.` : null;
  const destination = toId && toId !== origin ? app.farmPastures(farmId).find((p) => p.id === toId) : undefined;
  const dateError = date > app.today ? 'A mudança não pode ter data futura.' : summary && date < summary.lot.purchasedAt ? `O lote entrou em ${formatDate(summary.lot.purchasedAt)}.` : null;
  const pendingMoves = app.visibleEntries.filter(
    (e) => e.kind === 'manejo' && e.payload.lotId === lotId && e.id !== initial?.id && (e.status === 'aguardando_aprovacao' || e.status === 'aguardando_envio'),
  ).length;

  const canNext =
    step === 0
      ? summary !== undefined && summary.lot.farmId === farmId && summary.headsCurrent > 0
      : step === 1
        ? !!origin && !!destination && heads !== null && !headsError && !dateError
        : true;

  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Outra mudança" onAgain={() => router.replace('/novo/manejo')} />
      </Screen>
    );
  }

  const save = async (submit: boolean) => {
    if (!summary || !origin || !destination || heads === null) return;
    setBusy(true);
    setFailure(null);
    try {
      const farm = app.farm(summary.lot.farmId)!;
      const entry = await app.saveEntry(
        {
          kind: 'manejo',
          payload: { lotId: summary.lot.id, fromPastureId: origin, toPastureId: destination.id, heads, notes: notes.trim() },
          operationId: farm.operationId,
          farmId: farm.id,
          title: `${app.pastureName(origin)} → ${destination.name} — Origem ${summary.lot.code}`,
          amountCents: null,
          occurredAt: date,
        },
        { submit, existingId: initial?.id },
      );
      setSaved(entry);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar a mudança de pasto.');
    } finally {
      setBusy(false);
    }
  };

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
          scope={summary ? { operationId: summary.lot.operationId, kind: 'manejo' } : undefined}
        />
      }>
      <StepHeader steps={STEPS} current={step} />

      <FadeIn key={step}>
        {step === 0 ? (
          <>
            <FarmPicker
              value={farmId}
              onChange={(id) => {
                setFarmId(id);
                setLotId(null);
                setFromId(null);
                setToId(null);
              }}
            />
            <LotPicker
              farmId={farmId}
              value={lotId}
              onChange={(id) => {
                setLotId(id);
                setFromId(null);
                setToId(null);
                setHeadsText('');
              }}
            />
          </>
        ) : null}

        {step === 1 && summary ? (
          <>
            <Section title="Sai de">
              <Group>
                {groups.map((group) => (
                  <ListRow
                    key={group.pastureId}
                    icon="grass"
                    iconTone={origin === group.pastureId ? 'accent' : 'neutral'}
                    title={app.pastureName(group.pastureId)}
                    subtitle={`${plural(group.heads, 'cabeça confirmada', 'cabeças confirmadas')} deste lote`}
                    selected={groups.length > 1 ? origin === group.pastureId : undefined}
                    onPress={
                      groups.length > 1
                        ? () => {
                            setFromId(group.pastureId);
                            if (toId === group.pastureId) setToId(null);
                            setHeadsText('');
                          }
                        : undefined
                    }
                  />
                ))}
              </Group>
            </Section>
            {origin ? (
              <PasturePicker farmId={farmId} value={destination?.id ?? null} onChange={setToId} title="Vai para" exclude={origin} heads={byPasture} />
            ) : null}
            {origin ? (
              <Field label="Cabeças" error={headsError} hint={heads === available ? 'Todo o grupo muda de pasto.' : 'Parte do grupo: o restante continua na origem.'}>
                <TextField keyboardType="number-pad" suffix="cab." placeholder={String(available)} value={headsText} onChangeText={setHeadsText} />
                <ChipWrap>
                  <Chip label={`Todas · ${available}`} selected={heads === available} onPress={() => setHeadsText(String(available))} />
                  {available >= 4 ? (
                    <Chip label={`Metade · ${Math.floor(available / 2)}`} selected={heads === Math.floor(available / 2)} onPress={() => setHeadsText(String(Math.floor(available / 2)))} />
                  ) : null}
                </ChipWrap>
              </Field>
            ) : null}
            <DateField label="Data da mudança" value={date} onChange={setDate} error={dateError} />
            <Field label="Observação">
              <TextField multiline value={notes} onChangeText={setNotes} placeholder="Opcional" maxLength={500} />
            </Field>
            {pendingMoves > 0 ? (
              <Note boxed tone="warning" icon="clock-outline">
                {`Este lote tem ${plural(pendingMoves, 'mudança pendente', 'mudanças pendentes')}. O saldo é conferido de novo no envio.`}
              </Note>
            ) : null}
          </>
        ) : null}

        {step === 2 && summary && origin && destination && heads !== null ? (
          <>
            <Card>
              <KV label="Lote" value={`Origem ${summary.lot.code}`} />
              <KV label="Categoria" value={summary.lot.category} />
              <Divider />
              <KV label="Sai de" value={app.pastureName(origin)} hint={`${available} → ${available - heads} cab.`} />
              <KV label="Vai para" value={destination.name} strong hint={`${byPasture.get(destination.id) ?? 0} → ${(byPasture.get(destination.id) ?? 0) + heads} cab. deste lote`} />
              <KV label="Cabeças" value={heads === available ? `${heads} (todas)` : String(heads)} strong />
              <KV label="Data" value={formatDate(date)} />
              <KV label="Pasto de destino" value={pastureCaption(destination)} />
              <KV label="Responsável" value={app.user.name} />
            </Card>
            <Note icon="history" title="O lote continua o mesmo">
              {`Custos, pesagens e histórico seguem no lote ${summary.lot.code}. A mudança fica registrada com data, quantidade e quem moveu.`}
            </Note>
            <Note icon={app.online ? 'account-check-outline' : 'cloud-off-outline'}>
              {!app.online
                ? 'Sem internet: fica no aparelho e é enviada sozinha depois. O saldo do pasto é conferido no envio.'
                : app.needsApproval({ authorId: app.user.id, operationId: summary.lot.operationId, kind: 'manejo' })
                  ? 'Outra pessoa da operação aprova antes de mudar a ocupação dos pastos.'
                  : 'Entra direto na ocupação: não há outra pessoa para aprovar.'}
            </Note>
            {failure ? (
              <Note boxed tone="danger" icon="alert-circle-outline" title="Não foi possível salvar">
                {failure}
              </Note>
            ) : null}
          </>
        ) : null}
      </FadeIn>
    </Screen>
  );
}
