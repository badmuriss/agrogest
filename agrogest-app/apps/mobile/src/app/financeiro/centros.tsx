import { useState } from 'react';

import { FieldInput, FormField } from '@/components/fields';
import { Button, Chip, ChipWrap, Note, SwitchRow } from '@/components/ui/controls';
import { Card, EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import type { CostCenter } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

export default function CentrosScreen() {
  const app = useApp();
  const operations = [...new Set(app.scopedFarms.filter((f) => app.canSeeFinance(f.operationId)).map((f) => f.operationId))].map((id) => ({ id, name: app.operation(id)?.name ?? 'Operação' }));
  const [chosen, setChosen] = useState<string | null>(null);
  const operationId = operations.find((o) => o.id === chosen)?.id ?? operations[0]?.id;
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [name, setName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const reset = () => { setEditing(null); setName(''); setIsGroup(false); setParentId(null); setActive(true); setFailure(null); };
  if (!operationId) return <Screen><EmptyState icon="lock-outline" title="Centros de custo dos sócios" /></Screen>;
  const centers = app.costCenters.filter((c) => c.operationId === operationId);
  const save = async () => {
    setBusy(true); setFailure(null);
    try { await app.saveCostCenter({ operationId, name, isGroup, parentId: isGroup ? null : parentId, active }, editing?.id); reset(); }
    catch (e) { setFailure(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  return <Screen>
    {operations.length > 1 ? <ChipWrap>{operations.map((o) => <Chip key={o.id} label={o.name} selected={o.id === operationId} onPress={() => { reset(); setChosen(o.id); }} />)}</ChipWrap> : null}
    <Section title="Centros e agrupamentos">
      <Group>{centers.map((c) => <ListRow key={c.id} icon="file-tree-outline" title={c.name}
        subtitle={`${c.isGroup ? 'Agrupamento' : centers.find((g) => g.id === c.parentId)?.name ?? 'Centro independente'}${c.active ? '' : ' · Inativo'}`}
        onPress={() => { setEditing(c); setName(c.name); setIsGroup(c.isGroup); setParentId(c.parentId); setActive(c.active); setFailure(null); }} />)}</Group>
      {!centers.length ? <AppText tone="muted">Cadastre, por exemplo, Hidráulica e depois Roda d’água dentro dela.</AppText> : null}
    </Section>
    <Section title={editing ? `Editar ${editing.name}` : 'Novo centro ou agrupamento'}>
      <Card style={{ gap: space.md }}>
        <FormField label="Nome"><FieldInput value={name} onChangeText={setName} maxLength={80} placeholder="Ex.: Roda d’água" /></FormField>
        {!editing ? <SwitchRow label="É um agrupamento" description="Reúne centros, como Hidráulica." value={isGroup} onValueChange={setIsGroup} /> : null}
        {!isGroup && !editing ? <FormField label="Agrupamento"><ChipWrap>
          <Chip label="Sem agrupamento" selected={!parentId} onPress={() => setParentId(null)} />
          {centers.filter((g) => g.isGroup && g.active).map((g) => <Chip key={g.id} label={g.name} selected={parentId === g.id} onPress={() => setParentId(g.id)} />)}
        </ChipWrap></FormField> : null}
        {editing ? <SwitchRow label="Ativo" description="Inativar impede novos usos e preserva o histórico." value={active} onValueChange={setActive} /> : null}
        <Note icon="information-outline">O agrupamento fica fixo para preservar os relatórios passados. Para mudar a estrutura, crie outro centro e inative o anterior.</Note>
        {failure ? <Note tone="danger">{failure}</Note> : null}
        <Button title={busy ? 'Salvando…' : 'Salvar'} disabled={busy || !name.trim()} onPress={save} />
        {editing ? <Button title="Cancelar edição" variant="secondary" disabled={busy} onPress={reset} /> : null}
      </Card>
    </Section>
  </Screen>;
}
