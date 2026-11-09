import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useApp } from '@/state/app-state';
import { usePreferences } from '@/state/preferences';
import { usePalette } from '@/theme';
import { PressableScale } from './ui/motion';
import { AppText, Icon } from './ui/text';

/**
 * O que pede ação, numa lista só: o número do sino, o "Precisa de você" do Início e o "Para você" da
 * Atividade saem daqui e por isso sempre batem.
 */
export function useNotifications() {
  const app = useApp();
  const invites = app.cloudMode ? app.invites.filter((i) => i.contact.toLowerCase() === app.account?.email?.toLowerCase() && !app.roleIn(i.operationId)) : [];
  const toApprove = app.visibleEntries.filter((e) => e.status === 'aguardando_aprovacao' && !e.pendingDecision && app.blockReason(e) === null);
  const conflicts = app.visibleEntries.filter((e) => e.status === 'conflito');
  const rejected = app.visibleEntries.filter((e) => e.status === 'rejeitado' && e.authorId === app.user.id);
  const drafts = app.visibleEntries.filter((e) => e.status === 'rascunho' && e.authorId === app.user.id);
  const entries = [...toApprove, ...conflicts, ...rejected, ...drafts];
  const purchases = app.allPendingPurchases;
  return {
    invites, toApprove, conflicts, rejected, drafts, entries, purchases,
    count: invites.length + entries.length + purchases.length,
  };
}

/**
 * Sino do topo: o contador do que pede ação e um ponto para ações novas de outras pessoas. Abre a
 * Atividade em "Para você" (ou em "Convites", se só houver convite) quando há algo pendente; senão, em "Tudo".
 */
export function NotificationBell({ onDark = false }: { onDark?: boolean } = {}) {
  const { count, invites } = useNotifications();
  const prefs = usePreferences();
  // Só convite pendente: abre direto em Convites.
  const filtro = count === 0 ? undefined : count === invites.length ? 'convites' : 'voce';
  const p = usePalette();
  const unseen = prefs.unseenActivity;
  const label = count
    ? `Atividade, ${count} itens para revisar`
    : unseen
      ? `Atividade, ${unseen} novas ações da equipe`
      : 'Atividade, tudo em dia';
  // Sobre a faixa escura: círculo translúcido e a borda do contador usa a cor da faixa.
  const ring = onDark ? p.hero : p.background;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label}
      onPress={() => router.push({ pathname: '/atividade', params: filtro ? { filtro } : {} })}
      style={[styles.bell, { backgroundColor: onDark ? 'rgba(255,255,255,0.14)' : p.fill }]}>
      <Icon name={count ? 'bell-ring-outline' : 'bell-outline'} size={24} color={onDark ? p.onHero : p.text} />
      {count > 0 ? <View style={[styles.badge, { backgroundColor: onDark ? p.onHero : p.accent, borderColor: ring }]}>
        <AppText variant="label" style={{ color: onDark ? p.hero : p.onAccent, fontSize: 10, lineHeight: 14 }}>{count > 99 ? '99+' : count}</AppText>
      </View> : unseen > 0 ? <View style={[styles.dot, { backgroundColor: p.accent, borderColor: ring }]} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 1, right: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
