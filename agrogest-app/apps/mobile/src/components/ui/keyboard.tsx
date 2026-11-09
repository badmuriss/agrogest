import { useIsFocused } from 'expo-router';
import { useCallback, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Keyboard, Pressable, StyleSheet, View, useWindowDimensions, type ViewInstance, type ScrollViewInstance, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView, KeyboardProvider, KeyboardStickyView, useKeyboardState, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

import { space, usePalette } from '@/theme';

import { AppText, Icon } from './text';

export function KeyboardEnvironment({ children }: { children: ReactNode }) {
  return <KeyboardProvider preload={false}>{children}</KeyboardProvider>;
}

export interface FormViewportProps {
  children: ReactNode;
  footer?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  contentContainerStyle: ScrollViewProps['contentContainerStyle'];
}

/** O rodapé acompanha o teclado; a área rolável mantém o campo acima dos dois. */
export function FormViewport({ children, footer, scrollRef, contentContainerStyle }: FormViewportProps) {
  const p = usePalette();
  const focused = useIsFocused();
  const keyboardVisible = useKeyboardState((state) => state.isVisible) && focused;
  const container = useRef<ViewInstance>(null);
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  useImperativeHandle(scrollRef, () => scroll.current!, []);
  const [footerHeight, setFooterHeight] = useState(0);
  const [bottomGap, setBottomGap] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const measureContainer = useCallback(() => {
    // Guarde a distância sem teclado, mesmo se o sistema redimensionar a janela.
    if (Keyboard.isVisible()) return;
    container.current?.measureInWindow((_x, y, _width, height) => {
      if (Keyboard.isVisible()) return;
      // Inclui a área segura e, nas abas, a barra de navegação.
      setBottomGap(Math.max(0, windowHeight - y - height));
    });
  }, [windowHeight]);

  return (
    <View ref={container} collapsable={false} style={styles.flex} onLayout={measureContainer}>
      <KeyboardAwareScrollView
        ref={scroll}
        style={styles.flex}
        enabled={focused}
        contentContainerStyle={contentContainerStyle}
        bottomOffset={footerHeight + space.lg}
        extraKeyboardSpace={-bottomGap}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}>
        {children}
      </KeyboardAwareScrollView>
      <KeyboardStickyView enabled={focused} offset={{ opened: bottomGap }}>
        <View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={{ backgroundColor: p.background }}>
          {keyboardVisible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar teclado"
              onPress={Keyboard.dismiss}
              style={({ pressed }) => [styles.dismiss, { borderTopColor: p.border, opacity: pressed ? 0.6 : 1 }]}>
              <Icon name="keyboard-close" size={20} color={p.accent} />
              <AppText variant="label" style={{ color: p.accent }}>Fechar teclado</AppText>
            </Pressable>
          ) : null}
          {footer}
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dismiss: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
});
