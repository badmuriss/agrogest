import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ToggleGroup } from '@/components/fields';
import { CounterpartyField } from '@/components/finance-ui';
import { IllustrationHeader } from '@/components/illustration-header';
import { FarmPicker, LotGroupPicker, LotPicker, useLotGroup } from '@/components/pickers';
import { Chip, ChipWrap, Note } from '@/components/ui/controls';
import { DateField, Field, MoneyField, TextField } from '@/components/ui/form';
import { Card, Divider, KV, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { DoneState, SubmitButtons } from '@/components/wizard';
import { monthlyInstallments } from '@/domain/allocation';
import { carcassArrobas, saleGrossCents } from '@/domain/cattle';
import { formatDate } from '@/domain/dates';
import { formatCents, formatNumber, parseDecimal, parseInteger } from '@/domain/format';
import type { Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';

export default function VendaScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string; lote?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'venda' ? existing : undefined;
  const initialLot = initial?.payload.lotId ?? params.lote ?? null;

  const [farmId, setFarmId] = useState(
    initial?.farmId ?? (initialLot ? app.lotSummary(initialLot)?.lot.farmId : undefined) ?? app.defaultFarmId,
  );
  const [lotId, setLotId] = useState<string | null>(initialLot);
  const [buyer, setBuyer] = useState(initial?.payload.buyer ?? '');
  const [headsText, setHeadsText] = useState(initial ? String(initial.payload.heads) : '');
  const [date, setDate] = useState(initial?.occurredAt ?? app.today);
  const [carcassText, setCarcassText] = useState(initial ? formatNumber(initial.payload.carcassKg, 1) : '');
  const [priceCents, setPriceCents] = useState(initial?.payload.pricePerArrobaCents ?? 0);
  const [deductionsCents, setDeductionsCents] = useState(initial?.payload.deductionsCents ?? 0);
  const [groupId, setGroupId] = useState<string | null>(initial?.payload.pastureId ?? null);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(initial?.payload.counterpartyId ?? null);
  const [term, setTerm] = useState<'avista' | 'prazo'>((initial?.payload.installments?.length ?? 0) > 1 || (initial?.payload.installments?.[0] && initial.payload.installments[0].dueDate !== initial.occurredAt) ? 'prazo' : 'avista');
  const [count, setCount] = useState(Math.max(1, initial?.payload.installments?.length ?? 1));
  const [firstDue, setFirstDue] = useState(initial?.payload.installments?.[0]?.dueDate ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Entry | null>(null);

  const summary = lotId ? app.lotSummary(lotId) : undefined;
  const finance = summary ? app.canSeeFinance(summary.lot.operationId) : false;
  const group = useLotGroup(lotId, groupId);
  const available = group.split ? (group.heads ?? 0) : (summary?.headsCurrent ?? 0);
  const heads = parseInteger(headsText);
  const carcassKg = parseDecimal(carcassText);
  const headsError =
    summary && headsText && (heads === null || heads <= 0 || heads > available)
      ? `De 1 a ${available} cabeças (saldo confirmado${group.split ? ' no pasto' : ''}).`
      : null;
  const carcassError = carcassText && (carcassKg === null || carcassKg <= 0) ? 'Informe o peso total de carcaça.' : null;
  const valid =
    summary !== undefined &&
    summary.lot.farmId === farmId &&
    (!group.split || group.pastureId !== null) &&
    buyer.trim() !== '' &&
    heads !== null &&
    !headsError &&
    carcassKg !== null &&
    !carcassError &&
    priceCents > 0;

  const arrobas = carcassKg ? carcassArrobas(carcassKg) : 0;
  const gross = carcassKg ? saleGrossCents(carcassKg, priceCents) : 0;
  const soldCostEstimate = summary && heads ? summary.costPerHeadCents * heads : 0;
  const net = gross - deductionsCents;
  const installments = net > 0 ? (term === 'avista' ? [{ dueDate: date, cents: net }] : monthlyInstallments(net, count, firstDue || date)) : [];

  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Outra venda" onAgain={() => router.replace('/novo/venda')} />
      </Screen>
    );
  }

  const save = async (submit: boolean) => {
    if (!summary || heads === null || carcassKg === null) return;
    setBusy(true);
    const farm = app.farm(summary.lot.farmId)!;
    const entry = await app.saveEntry(
      {
        kind: 'venda',
        payload: { lotId: summary.lot.id, buyer: buyer.trim(), heads, carcassKg, pricePerArrobaCents: priceCents, deductionsCents, pastureId: group.pastureId,
          installments, counterpartyId },
        operationId: farm.operationId,
        farmId: farm.id,
        title: `Venda de ${heads} cabeças — Origem ${summary.lot.code}`,
        amountCents: gross,
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
          scope={summary ? { operationId: summary.lot.operationId, kind: 'venda' } : undefined}
        />
      }>
      {initial?.status === 'conflito' && initial.conflictReason ? (
        <Note boxed tone="conflict" icon="alert-outline" title="Revisando um conflito">
          {initial.conflictReason}
        </Note>
      ) : null}
      <FadeIn>
        {summary ? null : <IllustrationHeader name="sale" title="Da fazenda ao resultado" description="Escolha o lote e confira as cabeças e o valor da venda." />}
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
          <LotGroupPicker lotId={summary.lot.id} value={group.pastureId} onChange={setGroupId} title="De qual pasto saem os animais?" />
          {finance ? (
            <CounterpartyField
              operationId={summary.lot.operationId}
              kind="cliente"
              label="Frigorífico"
              name={buyer}
              counterpartyId={counterpartyId}
              onChange={(name, id) => {
                setBuyer(name);
                setCounterpartyId(id);
              }}
            />
          ) : (
            <Field label="Frigorífico">
              <TextField value={buyer} onChangeText={setBuyer} placeholder="Frigorífico Vale do Rio" />
            </Field>
          )}
          <Field label="Cabeças vendidas" error={headsError}>
            <TextField keyboardType="number-pad" suffix="cab." value={headsText} onChangeText={setHeadsText} />
          </Field>
          <DateField label="Data do abate" value={date} onChange={setDate} />
          <Field label="Peso de carcaça total (romaneio)" error={carcassError}>
            <TextField keyboardType="decimal-pad" suffix="kg" placeholder="2.400" value={carcassText} onChangeText={setCarcassText} />
          </Field>
          <Field label="Preço negociado por arroba" hint="O acertado com o frigorífico, não a cotação do dia.">
            <MoneyField accessibilityLabel="Preço por arroba" cents={priceCents} onChange={setPriceCents} />
          </Field>
          <Field label="Deduções" hint="Frete, comissão, impostos e descontos.">
            <MoneyField accessibilityLabel="Deduções" cents={deductionsCents} onChange={setDeductionsCents} />
          </Field>

          <Section title="Cálculo">
            <Card>
              <KV label="Arrobas de carcaça" value={`${formatNumber(arrobas, 2)} @`} hint="kg ÷ 15" />
              <KV label="Receita bruta" value={formatCents(gross)} />
              <KV label="Receita líquida" value={formatCents(gross - deductionsCents)} strong />
              {finance && heads ? (
                <>
                  <Divider />
                  <KV
                    label="Custo dos vendidos"
                    value={`− ${formatCents(soldCostEstimate)}`}
                    hint={`${formatCents(summary.costPerHeadCents)} por cabeça hoje`}
                  />
                  <KV
                    label="Resultado previsto"
                    value={formatCents(gross - deductionsCents - soldCostEstimate)}
                    strong
                    hint={app.needsApproval({ authorId: app.user.id, operationId: summary.lot.operationId, kind: 'venda' }) ? 'provisório até a aprovação' : 'estimativa'}
                  />
                </>
              ) : null}
            </Card>
          </Section>
          {finance ? (
            <Section title="Recebimento">
              <ToggleGroup
                accessibilityLabel="Recebimento"
                options={[
                  { value: 'avista', label: 'À vista' },
                  { value: 'prazo', label: 'A prazo' },
                ]}
                value={term}
                onChange={setTerm}
              />
              {term === 'prazo' ? (
                <>
                  <Field label="Parcelas">
                    <ChipWrap>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <Chip key={n} label={n === 1 ? 'Uma vez' : `${n}x`} selected={count === n} onPress={() => setCount(n)} />
                      ))}
                    </ChipWrap>
                  </Field>
                  <DateField label={count > 1 ? 'Primeiro recebimento' : 'Data do recebimento'} value={firstDue || date} onChange={setFirstDue} />
                </>
              ) : null}
              {installments.length > 0 ? (
                <Card>
                  {installments.map((item, i) => (
                    <KV key={i} label={`${installments.length > 1 ? `${i + 1}ª · ` : ''}${formatDate(item.dueDate)}`} value={formatCents(item.cents)} />
                  ))}
                </Card>
              ) : null}
              <Note>A receita conta na data do abate. Cada parcela vira conta a receber até o dinheiro entrar.</Note>
            </Section>
          ) : null}
          {heads !== null && !headsError && heads < summary.headsCurrent ? (
            <Note>{`Venda parcial: ${summary.headsCurrent - heads} cabeças continuam no lote com o custo delas.`}</Note>
          ) : null}
        </FadeIn>
      ) : null}
    </Screen>
  );
}
