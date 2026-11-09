import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getInviteDetails, InviteAvatar } from '@/components/invite-card';
import { Badge, Button, Note } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText, Avatar } from '@/components/ui/text';
import { formatDateTime } from '@/domain/dates';
import { firstName, useApp } from '@/state/app-state';
import { space } from '@/theme';

export default function ConviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invite = app.invites.find((i) => i.id === id);

  if (!invite) {
    return (
      <Screen>
        <EmptyState icon="account-question-outline" title="Convite não encontrado" message="Ele pode ter sido aceito ou cancelado." />
      </Screen>
    );
  }

  const { inviter, farms, operation, role } = getInviteDetails(app, invite);
  const name = firstName(invite.name);
  const place = farms.join(', ') || operation || 'uma operação compartilhada';
  const incoming = app.cloudMode && invite.contact === app.account?.email && !app.roleIn(invite.operationId);
  const accept = async () => {
    setBusy(true); setError(null);
    try { await app.acceptInvite(invite.id); router.back(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível aceitar o convite.'); }
    finally { setBusy(false); }
  };

  return (
    <Screen
      footer={
        <>
          {incoming ? <Button title={busy ? 'Aceitando…' : 'Aceitar convite'} icon="account-check-outline" disabled={busy} onPress={accept} /> : <Button
            title={confirmCancel ? 'Confirmar' : 'Cancelar convite'}
            variant={confirmCancel ? 'danger' : 'secondary'}
            onPress={async () => {
              if (!confirmCancel) {
                setConfirmCancel(true);
                return;
              }
              await app.cancelInvite(invite.id);
              router.back();
            }}
          />}
        </>
      }>
      <View style={styles.hero}>
        {incoming ? <InviteAvatar name={inviter} size={72} /> : <Avatar name={invite.name} size={72} />}
        <View style={styles.heroText}>
          <AppText variant="title" style={styles.center}>{incoming ? `${inviter} convidou você` : `Convite para ${invite.name}`}</AppText>
          <AppText tone="muted" style={styles.center}>
            {incoming ? `Para participar de ${place} como ${role.toLowerCase()}.` : 'A participação começa quando o convite for aceito.'}
          </AppText>
        </View>
        <View><Badge label={incoming ? 'Aguardando sua resposta' : 'Aguardando resposta'} tone="warning" icon="clock-outline" /></View>
      </View>
      <Section title="Detalhes do convite">
        <Group>
          <ListRow icon="barn" title={place} subtitle={farms.length > 1 ? 'Fazendas da operação' : 'Fazenda'} />
          {operation && operation !== farms[0] ? <ListRow icon="account-group-outline" title={operation} subtitle="Operação" /> : null}
          <ListRow icon={invite.role === 'socio' ? 'handshake-outline' : 'account-hard-hat-outline'} title={role}
            subtitle={invite.sharePct !== null ? `${incoming ? 'Seu papel' : 'Papel'} · ${invite.sharePct}% da sociedade` : incoming ? 'Seu papel' : 'Papel'} />
          {!incoming ? <ListRow icon="account-arrow-right-outline" title={inviter} subtitle="Convidado por" /> : null}
          <ListRow icon="email-outline" title={invite.contact} subtitle={incoming ? 'Enviado para seu e-mail' : 'Enviado para'} />
          <ListRow icon="clock-outline" title={formatDateTime(invite.createdAt)} subtitle="Enviado em" />
        </Group>
      </Section>
      {error ? <Note boxed tone="danger" icon="alert-circle-outline">{error}</Note> : null}
      <Note icon={incoming ? 'shield-check-outline' : 'information-outline'}>
        {incoming ? 'Ao aceitar, você passa a acessar esta operação com o papel indicado.' : `Enquanto ${name} não aceitar, não vê nada da fazenda nem aprova lançamentos.`}
      </Note>

      {!app.cloudMode ? <View style={styles.sim}>
        <AppText variant="label" tone="muted">
          PROTÓTIPO
        </AppText>
        <Button
          title={`Simular que ${name} aceitou`}
          variant="secondary"
          icon="account-check-outline"
          onPress={async () => {
            await app.acceptInvite(invite.id);
            router.back();
          }}
        />
        <AppText variant="caption" tone="muted">
          {invite.role === 'socio'
            ? `Depois disso, o que você registrar nessa fazenda espera a aprovação de ${name}. Para aprovar, use Ferramentas do protótipo › Ver como outra pessoa.`
            : `Depois disso, pesagens e mortes que você registrar esperam a aprovação de ${name}. Despesas continuam entrando direto, porque só outro sócio pode aprová-las.`}
        </AppText>
      </View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.sm },
  heroText: { gap: space.xs, alignItems: 'center' },
  center: { textAlign: 'center' },
  sim: { gap: space.sm },
});
