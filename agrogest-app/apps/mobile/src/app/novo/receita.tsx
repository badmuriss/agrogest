import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CounterpartyField } from '@/components/finance-ui';
import { FarmPicker } from '@/components/pickers';
import { Chip, ChipWrap, Note, Segmented } from '@/components/ui/controls';
import { DateField, Field, MoneyField, TextField } from '@/components/ui/form';
import { Card, Divider, EmptyState, KV, Screen } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { DoneState, StepHeader, WizardNav } from '@/components/wizard';
import { monthlyInstallments } from '@/domain/allocation';
import { formatDate } from '@/domain/dates';
import { categoryOf, OTHER_REVENUE_CATEGORY_ID, REVENUE_NATURES } from '@/domain/finance';
import { formatCents, plural } from '@/domain/format';
import type { Entry, Installment } from '@/domain/types';
import { useApp } from '@/state/app-state';

/**
 * Receita fora da venda de animais: couro, arrendamento recebido, serviços prestados. Vira conta a
 * receber e entra no resultado na data em que aconteceu; só sócio registra e outro sócio aprova.
 */
export default function ReceitaScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'receita' ? existing : undefined;
  const [step, setStep] = useState(0);
  const [amountCents, setAmountCents] = useState(initial?.amountCents ?? 0);
  const [description, setDescription] = useState(initial?.payload.description ?? '');
  const [categoryId, setCategoryId] = useState<string>(initial ? (categoryOf(initial.payload, app.categories)?.id ?? OTHER_REVENUE_CATEGORY_ID) : OTHER_REVENUE_CATEGORY_ID);
  const [date, setDate] = useState(initial?.occurredAt ?? app.today);
  const [farmId, setFarmId] = useState(initial?.farmId ?? app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.id ?? app.defaultFarmId);
  const [counterparty, setCounterparty] = useState(initial?.payload.counterparty ?? '');
  const [counterpartyId, setCounterpartyId] = useState<string | null>(initial?.payload.counterpartyId ?? null);
  const [document, setDocument] = useState(initial?.payload.document ?? '');
  const [parcelado, setParcelado] = useState((initial?.payload.installments.length ?? 1) > 1);
  const [count, setCount] = useState(Math.max(2, initial?.payload.installments.length ?? 2));
  const [firstDue, setFirstDue] = useState(initial?.payload.installments[0]?.dueDate ?? app.today);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Entry | null>(null);

  const farm = app.farm(farmId);
  if (!farm || !app.canSeeFinance(farm.operationId)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Receitas dos sócios" message="Somente um sócio da operação registra receitas." />
      </Screen>
    );
  }
  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Outra receita" onAgain={() => router.replace('/novo/receita')} />
      </Screen>
    );
  }

  const options = app.categories.filter((c) => c.active && REVENUE_NATURES.includes(c.nature) && c.id !== 'cat-venda-animais' && (c.operationId === null || c.operationId === farm.operationId));
  const category = options.find((c) => c.id === categoryId);
  const installments: Installment[] = parcelado ? monthlyInstallments(amountCents, count, firstDue) : [{ dueDate: firstDue, cents: amountCents }];
  const approvers = app.approversFor({ authorId: initial?.authorId ?? app.user.id, operationId: farm.operationId, kind: 'receita' });
  const steps = ['O que foi?', 'Como recebe?', 'Confira'];
  const canNext = [category !== undefined && amountCents > 0 && description.trim() !== '', true, true][step];

  const save = async (submit: boolean) => {
    if (!category) return;
    setBusy(true);
    try {
      const entry = await app.saveEntry(
        {
          kind: 'receita',
          payload: {
            categoryId: category.id,
            category: category.name,
            description: description.trim(),
            counterparty: counterparty.trim(),
            counterpartyId,
            document: document.trim(),
            installments,
          },
          operationId: farm.operationId,
          farmId: farm.id,
          title: description.trim(),
          amountCents,
          occurredAt: date,
        },
        { submit, existingId: initial?.id },
      );
      setSaved(entry);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<WizardNav step={step} last={steps.length - 1} canNext={canNext} onStep={setStep} busy={busy} onSave={save} scope={{ operationId: farm.operationId, kind: 'receita' }} />}>
      <StepHeader steps={steps} current={step} />
      <FadeIn key={step}>
        {step === 0 ? (
          <>
            <Field label="Valor">
              <MoneyField accessibilityLabel="Valor" cents={amountCents} onChange={setAmountCents} />
            </Field>
            <Field label="Descrição">
              <TextField value={description} onChangeText={setDescription} placeholder="Ex.: Venda do couro de outubro" />
            </Field>
            <Field label="Categoria">
              <ChipWrap>
                {options.map((c) => (
                  <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                ))}
              </ChipWrap>
            </Field>
            <DateField label="Quando aconteceu" value={date} onChange={setDate} />
            <FarmPicker value={farmId} onChange={(id) => { setFarmId(id); setCounterpartyId(null); }} />
            <CounterpartyField
              operationId={farm.operationId}
              kind="cliente"
              label="Cliente"
              name={counterparty}
              counterpartyId={counterpartyId}
              onChange={(name, id) => {
                setCounterparty(name);
                setCounterpartyId(id);
              }}
            />
            <Field label="Documento">
              <TextField value={document} onChangeText={setDocument} placeholder="Nº da nota ou recibo (opcional)" />
            </Field>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <Segmented
              accessibilityLabel="Forma de recebimento"
              options={[
                { value: 'avista', label: 'À vista' },
                { value: 'parcelado', label: 'Parcelado' },
              ]}
              value={parcelado ? 'parcelado' : 'avista'}
              onChange={(v) => setParcelado(v === 'parcelado')}
            />
            {parcelado ? (
              <Field label="Parcelas">
                <ChipWrap>
                  {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                    <Chip key={n} label={`${n}x`} selected={count === n} onPress={() => setCount(n)} />
                  ))}
                </ChipWrap>
              </Field>
            ) : null}
            <DateField label={parcelado ? 'Primeiro vencimento' : 'Vencimento'} value={firstDue} onChange={setFirstDue} />
            <Card>
              {installments.map((item, i) => (
                <KV key={i} label={`${parcelado ? `${i + 1}ª · ` : ''}${formatDate(item.dueDate)}`} value={formatCents(item.cents)} />
              ))}
            </Card>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Card>
              <KV label="Receita" value={description} />
              <KV label="Categoria" value={category?.name ?? ''} />
              <KV label="Valor" value={formatCents(amountCents)} strong />
              <KV label="Quando" value={formatDate(date)} />
              <Divider />
              <KV label="Fazenda" value={farm.name} />
              {counterparty ? <KV label="Cliente" value={counterparty} /> : null}
              <KV label="Conta a receber" value={plural(installments.length, 'parcela', 'parcelas')} />
            </Card>
            <Note icon="information-outline">Entra no resultado na data em que aconteceu, fora dos lotes. O caixa só muda quando o recebimento for registrado.</Note>
            <Note icon="account-check-outline">
              {approvers.length > 0 ? `Precisa da aprovação de outro sócio: ${approvers.map((u) => u.name).join(', ')}.` : 'Não há outro sócio para aprovar: entra direto.'}
            </Note>
          </>
        ) : null}
      </FadeIn>
    </Screen>
  );
}
