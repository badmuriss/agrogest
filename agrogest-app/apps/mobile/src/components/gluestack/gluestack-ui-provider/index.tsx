import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { ToastProvider } from '@gluestack-ui/core/toast/creator';
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

export type ModeType = 'light' | 'dark' | 'system';

/**
 * No nativo, o tema (Appearance) já é aplicado pelo ThemePreferenceProvider, inclusive o
 * modo "sistema"; por isso `mode` só tem efeito na web (index.web.tsx).
 */
export function GluestackUIProvider({
  children,
  style,
}: {
  mode?: ModeType;
  children?: ReactNode;
  style?: ViewProps['style'];
}) {
  return (
    <View style={[{ flex: 1, height: '100%', width: '100%' }, style]}>
      <OverlayProvider>
        <ToastProvider>{children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}
