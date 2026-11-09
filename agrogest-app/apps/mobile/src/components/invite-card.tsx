import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatDateShort } from '@/domain/dates';
import type { Invite } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { radius, space, usePalette } from '@/theme';
import { Badge } from './ui/controls';
import { PressableScale } from './ui/motion';
import { AppText, Avatar, Icon } from './ui/text';

export function getInviteDetails(app: ReturnType<typeof useApp>, invite: Invite) {
  return {
    inviter: invite.context?.inviterName ?? app.users.find((u) => u.id === invite.createdBy)?.name ?? 'Uma pessoa da operação',
    farms: invite.context?.farmNames ?? app.visibleFarms.filter((f) => f.operationId === invite.operationId).map((f) => f.name),
    operation: invite.context?.operationName ?? app.operation(invite.operationId)?.name,
    role: invite.role === 'socio' ? 'Sócio' : 'Funcionário',
  };
}

/** Avatar de quem convidou com um selo de envelope: lido como "convite" antes do texto. */
export function InviteAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const p = usePalette();
  const seal = Math.round(size * 0.46);
  return <View>
    <Avatar name={name} size={size} tone="accent" />
    <View style={[styles.seal, { width: seal, height: seal, borderRadius: seal / 2, backgroundColor: p.accent, borderColor: p.surface }]}>
      <Icon name="email-outline" size={seal * 0.58} color={p.onAccent} />
    </View>
  </View>;
}

export function InviteCard({ invite }: { invite: Invite }) {
  const app = useApp();
  const { inviter, farms, operation, role } = getInviteDetails(app, invite);
  const place = farms.join(', ') || operation || 'Operação compartilhada';
  const p = usePalette();
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`Convite de ${inviter} para ${place}, como ${role}. Ver convite.`}
      onPress={() => router.push({ pathname: '/pessoas/convite/[id]', params: { id: invite.id } })}
      style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
      <View style={styles.row}>
        <InviteAvatar name={inviter} />
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={2}>{inviter} <AppText tone="muted">convidou você</AppText></AppText>
          <AppText variant="caption" tone="faint">{formatDateShort(invite.createdAt.slice(0, 10))}</AppText>
        </View>
      </View>
      <View style={[styles.place, { backgroundColor: p.fill }]}>
        <Icon name="barn" size={20} color={p.textMuted} />
        <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>{place}</AppText>
        <Badge label={role} tone="accent" icon={invite.role === 'socio' ? 'handshake-outline' : 'account-hard-hat-outline'} />
      </View>
      <View style={[styles.action, { backgroundColor: p.accentSoft }]}>
        <AppText variant="label" tone="accent">Ver e responder</AppText>
        <Icon name="arrow-right" size={18} color={p.accent} />
      </View>
    </PressableScale>
  );
}
const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.xl, borderWidth: 1, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, minWidth: 0, gap: 2 },
  flex: { flex: 1, minWidth: 0 },
  seal: { position: 'absolute', right: -4, bottom: -4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg },
  action: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm, minHeight: 44, borderRadius: radius.lg },
});
