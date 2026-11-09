import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FieldInput, FormField } from '@/components/fields';
import { Button, Chip, ChipWrap, Note, SwitchRow } from '@/components/ui/controls';
import { EmptyState, Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { COUNTERPARTY_KIND_LABEL } from '@/domain/finance';
import type { CounterpartyKind } from '@/domain/types';
import { useApp, type CounterpartyInput } from '@/state/app-state';

const KINDS = Object.keys(COUNTERPARTY_KIND_LABEL) as CounterpartyKind[];

export default function ContatoScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const current = params.id ? app.counterparties.find((c) => c.id === params.id) : undefined;
  const operationId = current?.operationId ?? app.scopedFarms.find((f) => app.canSeeFinance(f.operationId))?.operationId ?? '';
  const [input, setInput] = useState<CounterpartyInput>(() => ({
    name: current?.name ?? '',
    kind: current?.kind ?? 'fornecedor',
    document: current?.document ?? '',
    contact: current?.contact ?? '',
    pixKey: current?.pixKey ?? '',
    notes: current?.notes ?? '',
    active: current?.active ?? true,
  }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!operationId || !app.canSeeFinance(operationId) || (params.id && !current)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Cadastro dos sócios" />
      </Screen>
    );
  }
  const set = (patch: Partial<CounterpartyInput>) => setInput({ ...input, ...patch });
  const save = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await app.saveCounterparty(operationId, input, current?.id);
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar.');
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : current ? 'Salvar alterações' : 'Cadastrar contato'} icon="check" size="lg" disabled={busy || !input.name.trim()} onPress={save} />}>
      <FormField label="Nome ou razão social">
        <FieldInput value={input.name} onChangeText={(name) => set({ name })} placeholder="Ex.: Frigorífico Boi Gordo" maxLength={150} autoCapitalize="words" />
      </FormField>
      <FormField label="É">
        <ChipWrap>
          {KINDS.map((k) => (
            <Chip key={k} label={COUNTERPARTY_KIND_LABEL[k]} selected={input.kind === k} onPress={() => set({ kind: k })} />
          ))}
        </ChipWrap>
      </FormField>
      <FormField label="CPF ou CNPJ (opcional)">
        <FieldInput value={input.document} onChangeText={(document) => set({ document })} keyboardType="numbers-and-punctuation" maxLength={150} />
      </FormField>
      <FormField label="Telefone ou e-mail (opcional)">
        <FieldInput value={input.contact} onChangeText={(contact) => set({ contact })} maxLength={150} />
      </FormField>
      <FormField label="Chave Pix (opcional)">
        <FieldInput value={input.pixKey} onChangeText={(pixKey) => set({ pixKey })} autoCapitalize="none" maxLength={150} />
      </FormField>
      <FormField label="Observações (opcional)">
        <FieldInput value={input.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={500} />
      </FormField>
      {current ? (
        <SwitchRow label="Contato ativo" description={input.active ? 'Aparece nas sugestões.' : 'Sai das sugestões; os lançamentos antigos continuam com o nome.'} value={input.active} onValueChange={(active) => set({ active })} />
      ) : null}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline">
          {failure}
        </Note>
      ) : null}
    </Screen>
  );
}
