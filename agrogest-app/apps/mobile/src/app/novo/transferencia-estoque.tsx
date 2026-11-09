import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FieldInput, FormField } from '@/components/fields';
import { FarmPicker } from '@/components/pickers';
import { SupplyPicker } from '@/components/stock-ui';
import { Note } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { DoneState, SubmitButtons } from '@/components/wizard';
import { formatNumber, parseDecimal } from '@/domain/format';
import { roundQty, stockConflict, UNIT_LABEL } from '@/domain/stock';
import type { Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';

/** Leva insumo para outra fazenda da mesma operação, pelo custo médio. Chega quando aprovado. */
export default function TransferenciaEstoqueScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'transferencia_estoque' ? existing : undefined;
  const [farmId, setFarmId] = useState(initial?.farmId ?? app.defaultFarmId);
  const [supplyId, setSupplyId] = useState<string | null>(initial?.payload.supplyId ?? null);
  const [toFarmId, setToFarmId] = useState<string | null>(initial?.payload.toFarmId ?? null);
  const [qtyText, setQtyText] = useState(initial ? formatNumber(initial.payload.quantity, 3) : '');
  const [notes, setNotes] = useState(initial?.payload.notes ?? '');
  const [date, setDate] = useState(initial?.occurredAt ?? app.today);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<Entry | null>(null);

  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Outra transferência" onAgain={() => router.replace('/novo/transferencia-estoque')} />
      </Screen>
    );
  }
  const farm = app.farm(farmId);
  const destinations = app.visibleFarms.filter((f) => f.id !== farmId && f.operationId === farm?.operationId);
  const supply = supplyId ? app.supply(supplyId) : undefined;
  const quantity = roundQty(parseDecimal(qtyText) ?? 0);
  const payload = { supplyId: supplyId ?? '', quantity, toFarmId: toFarmId ?? '', notes: notes.trim() };
  const conflict =
    supply && quantity > 0
      ? stockConflict(app.visibleEntries, { id: initial?.id ?? 'nova-transferencia', kind: 'transferencia_estoque', status: 'aguardando_aprovacao', operationId: farm?.operationId ?? '',
          farmId, authorId: app.user.id, title: '', amountCents: null, occurredAt: date, createdAt: new Date().toISOString(), decidedBy: null, decidedAt: null,
          decisionNote: null, pendingDecision: null, pendingDecisionBy: null, pendingDecisionNote: null, conflictReason: null, history: [], payload },
        'reserva', { supply: (id) => app.supply(id), farm: (id) => app.farm(id)?.name ?? 'esta fazenda' })
      : null;
  const ready = !!farm && !!supply && quantity > 0 && !!toFarmId && date <= app.today && !conflict;

  const save = async (submit: boolean) => {
    if (!farm || !supply) return;
    setBusy(true);
    setFailure(null);
    try {
      setSaved(await app.saveEntry(
        { kind: 'transferencia_estoque', payload, operationId: farm.operationId, farmId: farm.id, title: `Transferência de ${supply.name}`, amountCents: null, occurredAt: date },
        { submit, existingId: initial?.id },
      ));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar a transferência.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<SubmitButtons disabled={!ready} draftDisabled={!farm || !supply || !toFarmId} busy={busy} onSave={save} scope={farm ? { operationId: farm.operationId, kind: 'transferencia_estoque' } : undefined} />}>
      <FarmPicker value={farmId} onChange={(id) => { setFarmId(id); setSupplyId(null); setToFarmId(null); }} />
      {farm && destinations.length === 0 ? (
        <EmptyState icon="warehouse" title="Sem outra fazenda nesta operação" message="A transferência de estoque é entre fazendas da mesma sociedade." />
      ) : farm ? (
        <>
          <SupplyPicker farmId={farm.id} value={supplyId} onChange={setSupplyId} title="Insumo que sai" />
          <Section title="Para">
            <Group>
              {destinations.map((f) => (
                <ListRow key={f.id} icon="barn" title={f.name} selected={toFarmId === f.id} onPress={() => setToFarmId(f.id)} />
              ))}
            </Group>
          </Section>
          {supply ? (
            <FormField label={`Quantidade (${UNIT_LABEL[supply.unit]?.[1] ?? supply.unit})`} error={conflict}>
              <FieldInput value={qtyText} onChangeText={setQtyText} keyboardType="decimal-pad" suffix={supply.unit} />
            </FormField>
          ) : null}
          <DateField label="Quando" value={date} onChange={setDate} />
          <FormField label="Observação (opcional)">
            <FieldInput value={notes} onChangeText={setNotes} maxLength={500} />
          </FormField>
          <Note icon="information-outline">Sai daqui pelo custo médio e chega no destino quando for aprovada.</Note>
        </>
      ) : null}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline">
          {failure}
        </Note>
      ) : null}
    </Screen>
  );
}
