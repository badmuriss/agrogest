import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, usePalette } from '@/theme';

import { X } from './lucide';
import { useMotion } from './motion';
import { AppText } from './text';

/** Altura reservada para o rodapé fixo (botões de 52 pt e o respiro). */
const FOOTER_SPACE = 84;

/**
 * Folha de baixo sobre `@gorhom/bottom-sheet`: cresce até o conteúdo (no máximo ~88% da tela) e
 * rola dali em diante, fecha ao arrastar, ao tocar fora ou no X, e respeita "Reduzir animações".
 * Precisa de um `BottomSheetModalProvider` acima (o layout das abas tem um).
 */
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const p = usePalette();
  const motion = useMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const ref = useRef<BottomSheetModal>(null);
  const open = useRef(false);

  // Só fecha o que abriu: `dismiss()` numa folha nunca apresentada deixa o gorhom preso em
  // "fechando", e o `present()` seguinte não mostra nada.
  useEffect(() => {
    if (visible && !open.current) {
      open.current = true;
      ref.current?.present();
    } else if (!visible && open.current) {
      ref.current?.dismiss();
    }
  }, [visible]);
  const handleDismiss = useCallback(() => {
    open.current = false;
    onClose();
  }, [onClose]);

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />,
    [],
  );
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={[styles.footer, { backgroundColor: p.background, borderTopColor: p.border, paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      </BottomSheetFooter>
    ),
    [footer, insets.bottom, p.background, p.border],
  );

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={handleDismiss}
      enableDynamicSizing
      maxDynamicContentSize={height * 0.88}
      backdropComponent={backdrop}
      footerComponent={footer ? renderFooter : undefined}
      overrideReduceMotion={motion ? ReduceMotion.System : ReduceMotion.Always}
      accessibilityLabel={title}
      backgroundStyle={{ backgroundColor: p.background }}
      handleIndicatorStyle={{ backgroundColor: p.fillStrong, width: 40 }}>
      <BottomSheetScrollView
        contentContainerStyle={[styles.body, { paddingBottom: (footer ? FOOTER_SPACE : space.lg) + insets.bottom }]}>
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            hitSlop={10}
            onPress={() => ref.current?.dismiss()}
            style={({ pressed }) => [styles.close, { backgroundColor: pressed ? p.fillStrong : p.fill }]}>
            <X size={20} color={p.text} />
          </Pressable>
        </View>
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg + 4, paddingTop: space.xs, gap: space.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: { flexDirection: 'row', gap: space.sm, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
