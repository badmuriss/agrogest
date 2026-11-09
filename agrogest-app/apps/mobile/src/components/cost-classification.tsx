import { useState } from 'react';

import { CostCenterField } from '@/components/cost-center-field';
import { FieldInput, FormField } from '@/components/fields';
import { Button, Note } from '@/components/ui/controls';
import { Card, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { formatDateTime } from '@/domain/dates';
import type { Entry } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

export function CostClassificationPanel({ entry }: { entry: Extract<Entry, { kind: 'despesa' | 'nota_fiscal' }> }) {
  const app = useApp();
  const current = app.costClassifications.find((c) => c.id === entry.id);
  const selected = current ? current.costCenterId : entry.payload.costCenterId ?? null;
  const [value, setValue] = useState(selected);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  if (!app.canSeeFinance(entry.operationId)) return null;
  const name = (id: string | null) => app.costCenters.find((c) => c.id === id)?.name ?? 'Sem centro de custo';
  const save = async () => {
    setBusy(true); setFailure(null);
    try { await app.classifyCost(entry.id, value, reason); setReason(''); }
    catch (e) { setFailure(e instanceof Error ? e.message : 'Não foi possível classificar.'); }
    finally { setBusy(false); }
  };
  return <Section title="Classificação gerencial">
    <Card style={{ gap: space.md }}>
      <AppText>Atual: {name(selected)}</AppText>
      {entry.status === 'aprovado' ? <>
        <CostCenterField operationId={entry.operationId} value={value} onChange={setValue} />
        <FormField label="Motivo da classificação"><FieldInput value={reason} onChangeText={setReason} maxLength={500} placeholder="Ex.: Organização do histórico de manutenção" /></FormField>
        <Button title={busy ? 'Salvando…' : 'Salvar classificação'} disabled={busy || !reason.trim() || value === selected} onPress={save} />
        <AppText variant="caption" tone="muted">Apenas a finalidade muda. Valores, datas, parcelas e aprovações são preservados.</AppText>
      </> : null}
      {failure ? <Note tone="danger">{failure}</Note> : null}
      {current?.history.map((h, i) => <AppText key={i} variant="caption" tone="muted">
        {`${formatDateTime(h.at)} · ${app.userName(h.by)}: ${name(h.from)} → ${name(h.to)}. ${h.reason}`}
      </AppText>)}
    </Card>
  </Section>;
}
