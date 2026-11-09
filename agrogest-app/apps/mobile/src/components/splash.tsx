import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '@/theme';

import { LogoMark, useBrandAssets, Wordmark } from './brand';

const MARK_WIDTH = 132;
const WORD_WIDTH = 176;
const GAP = 18;

/**
 * Splash animado: continua o splash nativo (só a vaca) revelando o nome e uma linha de
 * carregamento; some quando os dados locais estão prontos. No Expo Go e na web, onde o
 * splash nativo não é o nosso, a vaca também anima a entrada.
 */
export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const p = usePalette();
  const brand = useBrandAssets();
  const reduced = useReducedMotion();
  const animateEntrance = Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const [minTimeDone, setMinTimeDone] = useState(false);

  const markOpacity = useSharedValue(animateEntrance ? 0 : 1);
  const markScale = useSharedValue(animateEntrance ? 0.86 : 1);
  // Mantém o símbolo centralizado antes de revelar o nome, nas duas versões.
  const markY = useSharedValue((GAP + WORD_WIDTH / brand.wordmarkRatio + 22) / 2);
  const wordOpacity = useSharedValue(0);
  const wordY = useSharedValue(10);
  const bar = useSharedValue(0);
  const overlay = useSharedValue(1);
  const overlayScale = useSharedValue(1);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    if (reduced) {
      markOpacity.set(1);
      markScale.set(1);
      markY.set(0);
      wordOpacity.set(1);
      wordY.set(0);
      bar.set(1);
    } else {
      const out = Easing.out(Easing.cubic);
      markOpacity.set(withTiming(1, { duration: 380 }));
      markScale.set(withSpring(1, { damping: 12, stiffness: 140 }));
      markY.set(withDelay(420, withTiming(0, { duration: 520, easing: out })));
      wordOpacity.set(withDelay(560, withTiming(1, { duration: 420 })));
      wordY.set(withDelay(560, withTiming(0, { duration: 520, easing: out })));
      bar.set(withDelay(820, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })));
    }
    const timer = setTimeout(() => setMinTimeDone(true), reduced ? 300 : 1700);
    return () => clearTimeout(timer);
    // Roda só uma vez, na abertura do app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !minTimeDone) return;
    overlay.set(withTiming(0, { duration: 380 }));
    overlayScale.set(withTiming(reduced ? 1 : 1.06, { duration: 380 }));
    const timer = setTimeout(onDone, 400);
    return () => clearTimeout(timer);
  }, [ready, minTimeDone, reduced, onDone, overlay, overlayScale]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.get() }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: overlayScale.get() }] }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.get(),
    transform: [{ translateY: markY.get() }, { scale: markScale.get() }],
  }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordOpacity.get(), transform: [{ translateY: wordY.get() }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.get() * 100}%` }));

  return (
    <Animated.View
      pointerEvents={ready && minTimeDone ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: p.background }, overlayStyle]}>
      <Animated.View style={[styles.content, contentStyle]}>
        <Animated.View style={markStyle}>
          <LogoMark width={MARK_WIDTH} />
        </Animated.View>
        <Animated.View style={[styles.word, wordStyle]}>
          <Wordmark width={WORD_WIDTH} />
          <View style={[styles.track, { backgroundColor: p.fill }]}>
            <Animated.View style={[styles.bar, { backgroundColor: p.accent }, barStyle]} />
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  content: { alignItems: 'center' },
  word: { marginTop: GAP, alignItems: 'center', gap: 18 },
  track: { width: 72, height: 3, borderRadius: 2, overflow: 'hidden' },
  bar: { height: 3, borderRadius: 2 },
});
