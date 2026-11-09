import NativeSegmentedControl, { type SegmentedControlProps } from '@react-native-segmented-control/segmented-control';
import type { ComponentType } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { usePalette } from '@/theme';

import { haptics } from './motion';

// A declaração da biblioteca ainda estende NativeMethods, removido da API estrita do RN 0.88.
// Preserve a tipagem pública das props sem depender dessa declaração antiga de instância.
const SegmentedControl = NativeSegmentedControl as unknown as ComponentType<SegmentedControlProps>;

/**
 * Abas do topo dos hubs (Financeiro, Rebanho, Atividade, Relatórios) sobre o controle segmentado
 * nativo (`@react-native-segmented-control`): UISegmentedControl no iOS e a implementação da
 * biblioteca no Android e na web. O contador entra no rótulo ("Para você · 3"; em telas estreitas,
 * "Para você 3" e fonte menor, para não quebrar a linha).
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const compact = useWindowDimensions().width < 360;
  const fontSize = compact ? 13 : 14;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <SegmentedControl
      accessibilityLabel={accessibilityLabel}
      values={options.map((o) => (o.count ? `${o.label}${compact ? ' ' : ' · '}${o.count > 99 ? '99+' : o.count}` : o.label))}
      selectedIndex={index}
      onChange={(event) => {
        const next = options[event.nativeEvent.selectedSegmentIndex];
        if (!next || next.value === value) return;
        haptics.tap();
        onChange(next.value);
      }}
      appearance={p.scheme}
      backgroundColor={p.fill}
      tintColor={p.surface}
      fontStyle={{ color: p.textMuted, fontSize, fontWeight: '600' }}
      activeFontStyle={{ color: p.text, fontSize, fontWeight: '700' }}
      style={styles.control}
    />
  );
}

const styles = StyleSheet.create({
  control: { height: 44 },
});
