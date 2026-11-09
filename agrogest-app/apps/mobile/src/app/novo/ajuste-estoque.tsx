import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FieldInput, FormField, ToggleGroup } from '@/components/fields';
import { FarmPicker } from '@/components/pickers';
import { SupplyPicker } from '@/components/stock-ui';
import { Chip, ChipWrap, Note } from '@/components/ui/controls';
import { DateField } from '@/components/ui/form';
import { Card, KV, Screen } from '@/components/ui/layout';
import { DoneState, SubmitButtons } from '@/components/wizard';
import { formatNumber, parseDecimal } from '@/domain/format';
import { formatQty, roundQty, stockConflict, UNIT_LABEL } from '@/domain/stock';
import type { Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';

const REASONS = ['Contagem do estoque', 'Sacos rasgados ou molhados', 'Produto vencido', 'Furto ou extravio', 'Sobra encontrada'];

/**
 * Ajuste de inventário: a diferença entre o saldo do app e o que tem no depósito, com o motivo.
 * Perda sai do estoque pelo custo médio e não vai para os lotes. Precisa de outro sócio.
 */
export default function AjusteEstoqueScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = params.id ? app.entry(params.id) : undefined;
  const initial = existing?.kind === 'ajuste_estoque' ? existing : undefined;
  const [farmId, setFarmId] = useState(initial?.farmId ?? app.defaultFarmId);
  const [supplyId, setSupplyId] = useState<string | null>(initial?.payload.supplyId ?? null);
  const [sign, setSign] = useState<'saida' | 'entrada'>((initial?.payload.delta ?? -1) < 0 ? 'saida' : 'entrada');
  const [qtyText, setQtyText] = useState(initial ? formatNumber(Math.abs(initial.payload.delta), 3) : '');
  const [reason, setReason] = useState(initial?.payload.reason ?? '');
  const [date, setDate] = useState(initial?.occurredAt ?? app.today);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState<Entry | null>(null);

  if (saved) {
    return (
      <Screen>
        <DoneState entry={saved} againLabel="Outro ajuste" onAgain={() => router.replace('/novo/ajuste-estoque')} />
      </Screen>
    );
  }
  const farm = app.farm(farmId);
  const supply = supplyId ? app.supply(supplyId) : undefined;
  const delta = roundQty((parseDecimal(qtyText) ?? 0) * (sign === 'saida' ? -1 : 1));
  const position = supply ? app.stock([farmId]).find((p) => p.supply.id === supply.id) : undefined;
  const payload = { supplyId: supplyId ?? '', delta, reason: reason.trim() };
  const conflict =
    supply && delta < 0
      ? stockConflict(app.visibleEntries, { id: initial?.id ?? 'novo-ajuste', kind: 'ajuste_estoque', status: 'aguardando_aprovacao', operationId: farm?.operationId ?? '',
          farmId, authorId: app.user.id, title: '', amountCents: null, occurredAt: date, createdAt: new Date().toISOString(), decidedBy: null, decidedAt: null,
          decisionNote: null, pendingDecision: null, pendingDecisionBy: null, pendingDecisionNote: null, conflictReason: null, history: [], payload },
        'reserva', { supply: (id) => app.supply(id), farm: (id) => app.farm(id)?.name ?? 'esta fazenda' })
      : null;
  const ready = !!farm && !!supply && delta !== 0 && !!payload.reason && date <= app.today && !conflict;

  const save = async (submit: boolean) => {
    if (!farm || !supply) return;
    setBusy(true);
    setFailure(null);
    try {
      setSaved(await app.saveEntry(
        { kind: 'ajuste_estoque', payload, operationId: farm.operationId, farmId: farm.id, title: `Ajuste de ${supply.name}`, amountCents: null, occurredAt: date },
        { submit, existingId: initial?.id },
      ));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar o ajuste.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<SubmitButtons disabled={!ready} draftDisabled={!farm || !supply} busy={busy} onSave={save} scope={farm ? { operationId: farm.operationId, kind: 'ajuste_estoque' } : undefined} />}>
      <FarmPicker value={farmId} onChange={(id) => { setFarmId(id); setSupplyId(null); }} />
      {farm ? <SupplyPicker farmId={farm.id} value={supplyId} onChange={setSupplyId} /> : null}
      {supply ? (
        <>
          {position ? (
            <Card>
              <KV label="Saldo no app" value={formatQty(position.qty, supply.unit)} />
            </Card>
          ) : null}
          <ToggleGroup
            accessibilityLabel="Tipo de ajuste"
            options={[
              { value: 'saida', label: 'Tem menos' },
              { value: 'entrada', label: 'Tem mais' },
            ]}
            value={sign}
            onChange={setSign}
          />
          <FormField label={`Diferença (${UNIT_LABEL[supply.unit]?.[1] ?? supply.unit})`} error={conflict}>
            <FieldInput value={qtyText} onChangeText={setQtyText} keyboardType="decimal-pad" suffix={supply.unit} placeholder="Ex.: 2" />
          </FormField>
          <FormField label="Motivo">
            <ChipWrap>
              {REASONS.map((r) => (
                <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
              ))}
            </ChipWrap>
            <FieldInput value={reason} onChangeText={setReason} placeholder="Ou escreva o motivo" maxLength={500} />
          </FormField>
          <DateField label="Quando" value={date} onChange={setDate} />
          <Note icon="information-outline">
            {sign === 'saida'
              ? 'A perda sai do estoque pelo custo médio e não vira custo dos lotes. Outro sócio precisa aprovar.'
              : 'A sobra entra pelo custo médio atual. Outro sócio precisa aprovar.'}
          </Note>
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
