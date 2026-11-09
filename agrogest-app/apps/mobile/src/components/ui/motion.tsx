import * as Haptics from 'expo-haptics';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/** Preferência "Reduzir animações" do app; o sistema também é respeitado. */
export const ReduceMotionContext = createContext(false);

export const MotionEnvironmentContext = createContext({ active: true, systemReduced: false });

/** Um único observador para todo o app, inclusive mudanças de preferência do sistema. */
export function MotionEnvironmentProvider({ children }: { children: ReactNode }) {
  const initialReduced = useReducedMotion();
  const [systemReduced, setSystemReduced] = useState(initialReduced);
  const [active, setActive] = useState(AppState.currentState === null || AppState.currentState === 'active');

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setSystemReduced(value);
    }).catch(() => {});
    const reduced = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduced);
    const lifecycle = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => {
      mounted = false;
      reduced?.remove();
      lifecycle?.remove();
    };
  }, []);

  return <MotionEnvironmentContext.Provider value={{ active, systemReduced }}>{children}</MotionEnvironmentContext.Provider>;
}

export function useMotion(): boolean {
  const appReduced = useContext(ReduceMotionContext);
  const { systemReduced } = useContext(MotionEnvironmentContext);
  return !appReduced && !systemReduced;
}

export const haptics = {
  tap: () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  },
  success: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
};

/** Botão/cartão que "afunda" levemente ao toque. */
export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.97,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  disabledOpacity = 0.4,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Estilo de layout do toque (flex, largura); style vai no conteúdo animado. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Controles com cores próprias de desabilitado não precisam reduzir a opacidade. */
  disabledOpacity?: number;
  scaleTo?: number;
}) {
  const motion = useMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      {...rest}
      style={containerStyle}
      disabled={disabled}
      onPress={(e) => {
        haptics.tap();
        onPress?.(e);
      }}
      onPressIn={(event) => {
        if (motion) scale.set(withTiming(scaleTo, { duration: 90 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(motion ? withSpring(1, { damping: 14, stiffness: 260 }) : 1);
        onPressOut?.(event);
      }}>
      <Animated.View style={[style, animated, disabled && { opacity: disabledOpacity }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Entrada suave em cascata para blocos de tela (empilha os filhos com o mesmo espaçamento da tela). */
export function FadeIn({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const motion = useMotion();
  // O entering do Reanimated 4.7 pode manter o conteúdo oculto na web após navegar.
  if (Platform.OS === 'web') return <View style={[{ gap: 24 }, style]}>{children}</View>;
  return (
    <Animated.View
      style={[{ gap: 24 }, style]}
      entering={motion ? FadeInDown.duration(200).delay(index * 24).withInitialValues({ transform: [{ translateY: 6 }] }) : undefined}>
      {children}
    </Animated.View>
  );
}
