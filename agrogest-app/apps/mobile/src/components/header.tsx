import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { firstName, useApp } from '@/state/app-state';
import { useSyncStatus } from '@/state/sync-status';
import { radius, space, toneColor, usePalette, type Tone } from '@/theme';

import { goBack } from './navigation';
import { NotificationBell } from './notifications';
import { IconButton } from './ui/controls';
import { haptics, useMotion } from './ui/motion';
import { Avatar, AppText, Icon } from './ui/text';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Topo das abas: título, estado da conexão (só quando foge do normal) e uma ação opcional.
 * `back`: a tela é do menu, mas não está no menu deste perfil (aberta pelo sino ou pelo Mais).
 */
export function AppHeader({
  title,
  context = false,
  action,
  back = false,
  bell = true,
}: {
  title: string;
  context?: boolean;
  action?: ReactNode;
  back?: boolean;
  bell?: boolean;
}) {
  const app = useApp();
  return (
    <View style={styles.wrap}>
      {/* Uma linha só: título à esquerda; conexão (só quando foge do normal) e sino à direita. */}
      <View style={styles.top}>
        <View style={[styles.titleRow, styles.shrink]}>
          {back ? <IconButton icon="arrow-left" accessibilityLabel="Voltar" onPress={goBack} /> : null}
          <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={styles.shrink}>
            {title}
          </AppText>
        </View>
        <HeaderActions action={action} bell={bell} />
      </View>
      {context && app.visibleFarms.length > 0 ? <ContextSwitch size="small" /> : null}
    </View>
  );
}

/**
 * Faixa escura do topo do Início, como no PicPay: na primeira linha o avatar (leva ao Mais), a
 * conexão e o sino; embaixo, a saudação e a fazenda atual com a largura toda, para o nome não
 * ser cortado. Vai até a borda da tela; a área de status é respeitada aqui (`Screen` com `hero`).
 */
export function HomeHeader() {
  const app = useApp();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const hasFarm = app.visibleFarms.length > 0;
  return (
    <View style={[heroBand, { backgroundColor: p.hero, paddingTop: insets.top + space.md }]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil, preferências e ferramentas"
          onPress={() => {
            haptics.tap();
            router.navigate('/mais');
          }}
          hitSlop={6}>
          <Avatar name={app.user.name} size={40} onDark />
        </Pressable>
        <View style={styles.right}>
          <ConnectionPill onDark />
          <NotificationBell onDark />
        </View>
      </View>
      <View style={styles.greet}>
        <AppText variant="caption" style={{ color: p.onHeroMuted }} numberOfLines={1}>
          {greeting()}, {firstName(app.user.name)}
        </AppText>
        {/* Sem fazenda, a chamada para cadastrar a primeira é o título do topo. */}
        {hasFarm ? (
          <ContextSwitch size="large" onDark />
        ) : (
          <AppText variant="title" style={{ color: p.onHero }}>
            Comece pela fazenda
          </AppText>
        )}
      </View>
    </View>
  );
}

function HeaderActions({ action, bell = true }: { action?: ReactNode; bell?: boolean }) {
  return (
    <View style={styles.right}>
      <ConnectionPill />
      {action}
      {bell ? <NotificationBell /> : null}
    </View>
  );
}

/** Fazenda atual (ou visão geral) com a sociedade responsável; abre o seletor. */
export function ContextSwitch({ size, onDark = false }: { size: 'small' | 'large'; onDark?: boolean }) {
  const app = useApp();
  const p = usePalette();
  const motion = useMotion();
  const farm = app.contextFarm;
  const title = farm?.name ?? 'Todas as fazendas';
  const caption = farm ? app.farmCaption(farm) : `${app.visibleFarms.length} fazendas`;
  const canSwitch = app.visibleFarms.length > 1;
  const titleColor = onDark ? p.onHero : p.text;
  const captionColor = onDark ? p.onHeroMuted : p.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Você está em ${title}, ${caption}. Toque para trocar.`}
      onPress={() => {
        haptics.tap();
        router.push('/contexto');
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.context, { opacity: pressed ? 0.6 : 1 }]}>
      <Animated.View key={farm?.id ?? 'overview'} entering={motion ? FadeIn.duration(160) : undefined}>
        <View style={styles.contextRow}>
          <AppText variant={size === 'large' ? 'title' : 'bodyStrong'} numberOfLines={1} style={[styles.shrink, { color: titleColor }]}>
            {title}
          </AppText>
          <Icon name={canSwitch ? 'chevron-down' : 'chevron-right'} size={size === 'large' ? 22 : 18} color={captionColor} />
        </View>
        <AppText variant="caption" numberOfLines={1} style={{ color: captionColor }}>
          {caption}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

function SpinningSync({ color }: { color: string }) {
  const motion = useMotion();
  const rotation = useSharedValue(0);
  useEffect(() => {
    if (motion) rotation.set(withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1));
    return () => cancelAnimation(rotation);
  }, [motion, rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon name="sync" size={22} color={color} />
    </Animated.View>
  );
}

/**
 * Conexão só aparece quando há algo a saber: sem internet (neutro, não é erro),
 * sincronizando ou com conflito. Online e em dia é o normal e não ocupa espaço.
 */
export function ConnectionPill({ onDark = false }: { onDark?: boolean } = {}) {
  const app = useApp();
  const sync = useSyncStatus();
  const p = usePalette();
  let state: { label: string; tone: Tone; action: string } | null = null;
  if (sync.syncing) state = { label: 'Sincronizando', tone: 'info', action: '' };
  else if (!app.online) state = { label: 'Offline', tone: 'neutral', action: 'Toque para reconectar.' };
  else if (sync.syncError) state = { label: 'Revisar envio', tone: 'conflict', action: 'Toque para revisar.' };
  else if (sync.pendingCommands > 0) state = { label: 'Aguardando envio', tone: 'neutral', action: 'Toque para sincronizar.' };
  else if (app.counts.conflicts > 0) state = { label: 'Conflito', tone: 'conflict', action: 'Toque para revisar.' };
  if (!state) return null;
  // Só o ícone, num botão redondo do mesmo tamanho do sino. O texto vai para o leitor de tela e a dica.
  // Sobre a faixa escura, o ícone é claro; no resto da tela, o tom normal.
  const color = onDark ? p.onHero : state.tone === 'neutral' ? p.textMuted : toneColor(p, state.tone);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conexão: ${state.label}. ${state.action}`}
      accessibilityState={{ disabled: sync.syncing }}
      disabled={sync.syncing}
      hitSlop={6}
      onPress={() => {
        haptics.tap();
        if (!app.online) app.setOnline(true);
        else if (app.cloudMode) router.navigate('/sincronizacao');
        else router.navigate({ pathname: '/atividade', params: { filtro: 'voce' } });
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: onDark ? 'rgba(255,255,255,0.14)' : p.fill, opacity: pressed ? 0.7 : 1 },
      ]}>
      {sync.syncing ? (
        <SpinningSync color={color} />
      ) : (
        <Icon name={app.online ? 'alert-circle-outline' : 'cloud-off-outline'} size={22} color={color} />
      )}
    </Pressable>
  );
}

/**
 * Faixa escura do topo (Início e Mais): vai de borda a borda, anulando o padding da tela, e sobe até o
 * topo. Quem usa soma a área de status (safe area) e a cor `hero` da paleta.
 */
export const heroBand = {
  marginHorizontal: -(space.lg + 4),
  marginTop: -space.md,
  paddingHorizontal: space.lg + 4,
  paddingBottom: space.lg,
  gap: space.md,
  borderBottomLeftRadius: radius.xxl,
  borderBottomRightRadius: radius.xxl,
} as const;

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 44 },
  greet: { gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  topCompact: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 0 },
  rightCompact: { flexWrap: 'wrap', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: 'auto' },
  shrink: { flexShrink: 1 },
  context: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, justifyContent: 'center' },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    minHeight: 44,
    maxWidth: '100%',
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
});
