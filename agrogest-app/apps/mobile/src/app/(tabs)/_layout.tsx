import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewInstance, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMenuTabs } from '@/components/navigation';
import { useNotifications } from '@/components/notifications';
import { RegisterActions } from '@/components/register-actions';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Activity, Beef, House, Menu, Plus, Wallet, type LucideIcon } from '@/components/ui/lucide';
import { haptics, useMotion } from '@/components/ui/motion';
import { useApp } from '@/state/app-state';
import { PerfBoundary } from '@/state/perf-probe';
import { font, radius, soft, usePalette } from '@/theme';

/** Mantém os eventos e links do navegador, com resposta visual desde o toque. */
function TabButton({
  style,
  onPress,
  ref,
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  ...props
}: BottomTabBarButtonProps) {
  const p = usePalette();
  const buttonRef = useCallback((node: ViewInstance | null) => {
    if (typeof ref === 'function') return ref(node);
    if (ref) ref.current = node;
  }, [ref]);
  return (
    <Pressable
      {...props}
      ref={buttonRef}
      onPress={(event) => {
        if (Platform.OS === 'web' && props.href) {
          const modified = ('metaKey' in event && event.metaKey) || ('altKey' in event && event.altKey)
            || ('ctrlKey' in event && event.ctrlKey) || ('shiftKey' in event && event.shiftKey);
          if (modified || ('button' in event && event.button != null && event.button !== 0)) return;
          event.preventDefault();
        }
        onPress?.(event);
      }}
      android_ripple={{ color: soft(p.accent), borderless: false }}
      style={({ pressed }) => [
        style,
        styles.tabButton,
        { backgroundColor: pressed ? p.accentSoft : 'transparent', opacity: pressed ? 0.7 : 1 },
      ]}
    />
  );
}

/**
 * Traço fino (Lucide). A aba ativa ganha uma pílula suave da marca atrás do ícone, como o destaque
 * da aba atual no PicPay: dá para saber onde se está sem ler o rótulo.
 */
function tabIcon(Glyph: LucideIcon) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    const p = usePalette();
    return (
      <View style={[styles.iconSlot, focused && { backgroundColor: p.accentSoft }]}>
        <Glyph color={color as string} size={24} strokeWidth={focused ? 2 : 1.6} />
      </View>
    );
  }
  return TabIcon;
}

/**
 * Menu inferior: Início · Rebanho · (+) · Financeiro ou Atividade · Mais. O quarto lugar depende do
 * modo e da permissão (`useMenuTabs`); a aba fora do menu continua existindo como rota, aberta pelo
 * sino ou pelo Mais. O "+" não navega: abre as ações de registro numa folha de baixo.
 */
export default function TabsLayout() {
  const p = usePalette();
  const app = useApp();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const { financeTab, activityTab } = useMenuTabs();
  const { count: attention } = useNotifications();
  const [registering, setRegistering] = useState(false);
  const overdue = financeTab ? app.installments.filter((v) => v.openCents > 0 && v.daysToDue < 0).length : 0;
  // Badge discreto: verde da marca, sem laranja competindo com o menu.
  const badgeStyle = { backgroundColor: p.accent, color: p.onAccent, fontSize: 10, fontFamily: font.bold, minWidth: 16, height: 16, lineHeight: 16 } as const;
  const badge = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);

  return (
    <BottomSheetModalProvider>
      <PerfBoundary id="tabs">
      <Tabs
        backBehavior="history"
        screenListeners={{ tabPress: () => haptics.tap() }}
        screenOptions={{
          headerShown: false,
          animation: motion ? 'fade' : 'none',
          transitionSpec: { animation: 'timing', config: { duration: motion ? 140 : 0 } },
          tabBarActiveTintColor: p.accent,
          tabBarInactiveTintColor: p.textMuted,
          tabBarButton: (props) => <TabButton {...props} />,
          tabBarLabelPosition: 'below-icon',
          // Contêiner com cantos de cima arredondados e sombra para cima, como o menu do PicPay.
          tabBarStyle: {
            backgroundColor: p.surface,
            height: 76 + insets.bottom,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingHorizontal: 4,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            borderTopWidth: p.scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
            borderColor: p.border,
            ...(p.scheme === 'dark' ? {} : { shadowColor: '#0B0F0C', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 }),
          },
          tabBarIconStyle: { width: 60, height: 32 },
          tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontFamily: font.semibold, marginTop: 4 },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: tabIcon(House) }} />
        <Tabs.Screen name="rebanho" options={{ title: 'Rebanho', tabBarIcon: tabIcon(Beef) }} />
        <Tabs.Screen
          name="registrar"
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              setRegistering(true);
            },
          }}
          options={{
            title: 'Registrar',
            tabBarAccessibilityLabel: 'Registrar novo lançamento',
            tabBarIcon: () => (
              <View style={[styles.plus, { backgroundColor: p.accent }]}>
                <Plus color={p.onAccent} size={24} strokeWidth={2} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="financeiro"
          options={{
            title: 'Financeiro',
            href: financeTab ? undefined : null,
            tabBarBadge: badge(overdue),
            tabBarBadgeStyle: badgeStyle,
            tabBarAccessibilityLabel: overdue > 0 ? `Financeiro, ${overdue} contas vencidas` : 'Financeiro',
            tabBarIcon: tabIcon(Wallet),
          }}
        />
        <Tabs.Screen
          name="atividade"
          options={{
            title: 'Atividade',
            // Fora do menu, só some o botão: o sino e o Início abrem a rota. `href: null` no
            // expo-router 58 esconde a aba redirecionando para o Início.
            tabBarItemStyle: activityTab ? undefined : { display: 'none' },
            tabBarBadge: badge(attention),
            tabBarBadgeStyle: badgeStyle,
            tabBarAccessibilityLabel: attention > 0 ? `Atividade, ${attention} para revisar` : 'Atividade',
            tabBarIcon: tabIcon(Activity),
          }}
        />
        <Tabs.Screen name="mais" options={{ title: 'Mais', tabBarIcon: tabIcon(Menu) }} />
      </Tabs>
      </PerfBoundary>
      <BottomSheet visible={registering} title="Registrar" onClose={() => setRegistering(false)}>
        <RegisterActions onNavigate={() => setRegistering(false)} />
      </BottomSheet>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  tabButton: { minHeight: 56, paddingHorizontal: 0, borderRadius: 16, overflow: 'hidden' },
  iconSlot: { width: 60, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // "+" em destaque: quadrado arredondado da marca, como o botão central do PicPay.
  plus: { width: 52, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
