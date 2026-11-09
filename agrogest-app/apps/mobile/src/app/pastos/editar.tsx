import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { draftErrors, draftFrom, draftInput, PastureFields, type PastureDraft } from '@/components/pasture-form';
import { Button, Note, SwitchRow } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { useApp } from '@/state/app-state';

/**
 * Cadastro e edição do pasto. Só um pasto nunca usado pode ser excluído (cadastro errado ou
 * duplicado); com histórico, ele é inativado para preservar ocupação e GMD.
 */
export default function EditarPastoScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string; fazenda?: string }>();
  const current = params.id ? app.pasture(params.id) : undefined;
  const farmId = current?.farmId ?? params.fazenda ?? app.defaultFarmId;
  const farm = app.farm(farmId);
  const [draft, setDraft] = useState<PastureDraft>(() => draftFrom(current));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!farm || (params.id && !current)) {
    return (
      <Screen>
        <EmptyState icon="grass" title="Pasto não encontrado" />
      </Screen>
    );
  }
  if (!app.canManagePastures(farm.operationId)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Cadastro por um sócio" message="Peça a um sócio desta operação para cadastrar ou editar pastos." />
      </Screen>
    );
  }

  const others = app.farmPastures(farm.id, true).filter((p) => p.id !== current?.id);
  const errors = draftErrors(draft, others);
  const save = async () => {
    setTried(true);
    setFailure(null);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      if (current) await app.updatePasture(current.id, draftInput(draft));
      else await app.createPasture(farm.id, draftInput(draft));
      haptics.success();
      router.back();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível salvar o pasto.');
      setBusy(false);
    }
  };

  const deletable = current ? app.canDeletePasture(current.id) : false;
  const remove = async () => {
    if (!current) return;
    if (!confirmDelete) {
      haptics.tap();
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await app.deletePasture(current.id);
      haptics.success();
      // O detalhe do pasto (embaixo desta tela) deixa de existir: volta para a aba Pastos do Rebanho.
      router.dismissTo({ pathname: '/rebanho', params: { aba: 'pastos', fazenda: farm.id } });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Não foi possível excluir o pasto.');
      setConfirmDelete(false);
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : current ? 'Salvar alterações' : 'Cadastrar pasto'} icon="check" size="lg" disabled={busy} onPress={save} />}>
      <Group>
        <ListRow icon="barn" title={farm.name} subtitle={app.farmCaption(farm)} />
      </Group>
      {current?.legacy && (!current.areaHa || !current.forage) ? (
        <Note boxed tone="info" icon="history" title="Convertido do cadastro anterior">
          Este pasto veio do nome em texto dos lotes antigos. Informe a área e o capim; o histórico continua o mesmo.
        </Note>
      ) : null}
      <PastureFields draft={draft} onChange={setDraft} errors={tried ? errors : null} />
      {current ? (
        <SwitchRow
          label="Pasto ativo"
          description={draft.active ? 'Pode receber animais.' : 'Não recebe animais; o histórico e os indicadores continuam disponíveis.'}
          value={draft.active}
          onValueChange={(active) => setDraft({ ...draft, active })}
        />
      ) : null}
      {current ? (
        deletable ? (
          <Group>
            <ListRow
              icon={confirmDelete ? 'alert-outline' : 'delete-outline'}
              iconTone="danger"
              title={confirmDelete ? 'Toque de novo para excluir' : 'Excluir pasto'}
              subtitle={confirmDelete ? 'Não dá para desfazer.' : 'Nenhum lote ou lançamento usou este pasto ainda.'}
              chevron={false}
              onPress={() => void remove()}
            />
          </Group>
        ) : (
          <Note icon="archive-outline" title="Por que não dá para excluir">
            Este pasto já teve animais ou lançamentos, e a ocupação e o ganho de peso dependem dele. Desligue “Pasto ativo” acima
            para ele sair das escolhas, sem perder o histórico.
          </Note>
        )
      ) : null}
      {failure ? (
        <Note boxed tone="danger" icon="alert-circle-outline" title="Não foi possível salvar">
          {failure}
        </Note>
      ) : tried && Object.keys(errors).length > 0 ? (
        <Note boxed tone="warning" icon="alert-outline">
          Confira os campos marcados acima.
        </Note>
      ) : null}
    </Screen>
  );
}
