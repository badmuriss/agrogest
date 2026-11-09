import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { useSyncStatus, type ContextTransition as TransitionInfo } from '@/state/sync-status';
import { space, usePalette } from '@/theme';

import { useMotion } from './ui/motion';
import { BoneLines } from './ui/skeletons';
import { AppText, IconTile, type IconName } from './ui/text';

const ICON: Record<TransitionInfo['kind'], IconName> = {
  farm: 'barn',
  overview: 'view-grid-outline',
  user: 'account-outline',
  data: 'database-outline',
};

/** Feedback durante operações reais; a simples seleção de fazenda não bloqueia a tela. */
export function ContextTransition() {
  const { transition } = useSyncStatus();
  return transition ? <Overlay key={transition.id} info={transition} /> : null;
}

function Overlay({ info }: { info: TransitionInfo }) {
  const p = usePalette();
  const motion = useMotion();

  return (
    <Animated.View
      entering={motion ? FadeIn.duration(100) : undefined}
      exiting={motion ? FadeOut.duration(120) : undefined}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${info.eyebrow} ${info.title}`}
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: p.background }]}>
      <View style={styles.content}>
        <IconTile name={ICON[info.kind]} tone="accent" size={68} />
        <View style={styles.text}>
          <AppText variant="caption" tone="muted">
            {info.eyebrow}
          </AppText>
          <AppText variant="title" style={styles.center}>
            {info.title}
          </AppText>
          {info.subtitle ? (
            <AppText variant="caption" tone="faint" style={styles.center}>
              {info.subtitle}
            </AppText>
          ) : null}
        </View>
        {/* O esqueleto do que vem a seguir, no lugar do spinner. */}
        <BoneLines lines={3} style={styles.preview} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  content: { alignItems: 'center', gap: space.lg, paddingHorizontal: space.xl },
  text: { alignItems: 'center', gap: 2 },
  center: { textAlign: 'center' },
  preview: { width: 220 },
});
