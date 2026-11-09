import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Note } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import type { MemberRole } from '@/domain/types';
import { useApp } from '@/state/app-state';

export default function EditarPessoaScreen() {
  const { id, operationId } = useLocalSearchParams<{ id: string; operationId: string }>();
  const app = useApp();
  const member = app.peopleIn(operationId).find((m) => m.user.id === id);
  const [previous] = useState(() => member ? { role: member.role, sharePct: member.sharePct } : null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  if (!member || !previous) return <Screen><EmptyState icon="account-question-outline" title="Acesso não encontrado" message="Esta pessoa pode ter sido removida. Volte para Pessoas e sincronize." /></Screen>;
  const reason = app.memberManagementReason(operationId, id);
  if (reason) return <Screen><EmptyState icon="shield-account-outline" title="Acesso protegido" message={reason} /></Screen>;
  const selected = role ?? previous.role;
  const operation = app.membershipsOf(id).find((m) => m.operation.id === operationId)?.operation;
  const save = async (remove: boolean) => {
    setBusy(true); setFailure(null);
    try {
      if (remove) await app.removeMember(operationId, id, previous);
      else await app.updateMemberRole(operationId, id, selected, previous);
      router.back();
    } catch (error) { setFailure(error instanceof Error ? error.message : 'Não foi possível alterar o acesso.'); }
    finally { setBusy(false); }
  };
  return (
    <Screen footer={<Button title={busy ? 'Salvando…' : 'Salvar cargo'} icon="check" disabled={busy || selected === previous.role || confirmRemove} onPress={() => save(false)} />}>
      <AppText variant="title">{member.user.name}</AppText>
      <AppText tone="muted">{operation?.name ?? 'Operação'}</AppText>
      <Section title="Cargo na operação">
        <Group>
          {(['socio', 'funcionario'] as const).map((value) => (
            <ListRow key={value} title={value === 'socio' ? 'Sócio' : 'Funcionário'}
              subtitle={value === 'socio' ? 'Acessa o financeiro e gerencia pessoas e aprovações' : 'Registra no campo, sem acesso ao financeiro'}
              selected={selected === value} onPress={busy ? undefined : () => { setRole(value); setConfirmRemove(false); }} />
          ))}
        </Group>
        {selected !== previous.role ? <Note boxed tone="warning" icon="shield-account-outline">
          {selected === 'socio' ? 'Ao salvar, esta pessoa passa a acessar os valores financeiros e a gerenciar acessos nesta operação.' : 'Ao salvar, esta pessoa perde o acesso ao financeiro e à gestão de pessoas desta operação. A participação percentual deixa de ser aplicada.'}
        </Note> : null}
      </Section>
      <Section title="Remover acesso">
        <Note>Remove a pessoa desta operação. A conta, as outras fazendas e o histórico dos lançamentos são preservados.</Note>
        {confirmRemove ? <Note boxed tone="danger">{`Confirma remover o acesso de ${member.user.name} a esta operação?`}</Note> : null}
        <Button title={confirmRemove ? 'Confirmar remoção do acesso' : 'Remover da operação'} variant="danger" icon="account-remove-outline" disabled={busy}
          onPress={() => confirmRemove ? save(true) : setConfirmRemove(true)} />
        {confirmRemove ? <Button title="Cancelar remoção" variant="secondary" disabled={busy} onPress={() => setConfirmRemove(false)} /> : null}
      </Section>
      {app.cloudMode ? <Note icon="cloud-check-outline">É preciso estar conectado e sem registros aguardando envio. A mudança vale no servidor; o outro aparelho atualiza o acesso ao sincronizar.</Note> : null}
      {failure ? <Note boxed tone="danger">{failure}</Note> : null}
    </Screen>
  );
}
