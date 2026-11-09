import { router } from 'expo-router';

import { InviteCard } from '@/components/invite-card';
import { Button, Note, StatusText } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { Avatar } from '@/components/ui/text';
import { useApp } from '@/state/app-state';

const ROLE = { socio: 'Sócio', funcionario: 'Funcionário' } as const;

export default function PessoasScreen() {
  const app = useApp();
  // Segue a fazenda escolhida no topo do app; sem escolha, mostra todas.
  const farms = app.scopedFarms;
  const alone = farms.every((f) => app.peopleIn(f.operationId).length <= 1);
  const incoming = app.cloudMode ? app.invites.filter((invite) => invite.contact === app.account?.email && !app.roleIn(invite.operationId)) : [];

  return (
    <Screen
      footer={
        farms.length > 0 && (!app.cloudMode || farms.some((farm) => app.canSeeFinance(farm.operationId))) ? (
          <Button title="Convidar pessoa" icon="account-plus-outline" onPress={() => router.push('/pessoas/nova')} />
        ) : undefined
      }>
      {incoming.length > 0 ? <Section title="Convites para você">
        {incoming.map((invite) => <InviteCard key={invite.id} invite={invite} />)}
      </Section> : null}
      {farms.length === 0 ? (
        <EmptyState icon="account-multiple-outline" title="Crie uma fazenda primeiro" message="As pessoas entram numa fazenda.">
          <Button title="Criar fazenda" icon="plus" onPress={() => router.push('/fazenda/nova')} />
        </EmptyState>
      ) : (
        <>
          {app.contextFarm && app.visibleFarms.length > 1 ? (
            <Note icon="barn">{`Pessoas de ${app.contextFarm.name}. Troque a fazenda no topo do app para ver as outras.`}</Note>
          ) : null}
          {alone ? (
            <Note boxed icon="account-check-outline" title="Só você por enquanto">
              O que você registra entra direto, sem esperar aprovação. Quando um sócio ou funcionário aceitar o convite,
              os lançamentos passam a ser conferidos por outra pessoa.
            </Note>
          ) : null}
          {farms.map((farm, i) => {
            const people = app.peopleIn(farm.operationId);
            const invites = app.invites.filter((inv) => inv.operationId === farm.operationId);
            return (
              <FadeIn key={farm.id} index={i}>
                <Section title={farm.name}>
                  <Group>
                    {people.map((person) => (
                      <ListRow
                        key={person.user.id}
                        leading={<Avatar name={person.user.name} size={34} />}
                        title={person.user.id === app.user.id ? `${person.user.name} (você)` : person.user.name}
                        subtitle={`${ROLE[person.role]}${person.sharePct ? ` · ${person.sharePct}%` : ''}`}
                        onPress={app.memberManagementReason(farm.operationId, person.user.id) === null
                          ? () => router.push({ pathname: '/pessoas/editar/[id]', params: { id: person.user.id, operationId: farm.operationId } }) : undefined}
                      />
                    ))}
                    {invites.map((invite) => (
                      <ListRow
                        key={invite.id}
                        leading={<Avatar name={invite.name} size={34} tone="warning" />}
                        title={invite.name}
                        subtitle={<StatusText label={`Convite pendente · ${ROLE[invite.role]}`} tone="warning" />}
                        onPress={() => router.push({ pathname: '/pessoas/convite/[id]', params: { id: invite.id } })}
                      />
                    ))}
                  </Group>
                </Section>
              </FadeIn>
            );
          })}
        </>
      )}
    </Screen>
  );
}
