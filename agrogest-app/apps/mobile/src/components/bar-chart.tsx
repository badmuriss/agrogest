import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { radius, space, usePalette } from '@/theme';

import { useMotion } from './ui/motion';
import { AppText } from './ui/text';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Valores estimados aparecem vazados e com "≈" (não só pela cor). */
  estimated?: boolean;
}

export function BarChart({
  data,
  formatValue,
  height = 132,
  accessibilityLabel,
}: {
  data: BarDatum[];
  formatValue: (value: number) => string;
  height?: number;
  accessibilityLabel: string;
}) {
  const p = usePalette();
  const motion = useMotion();
  const max = Math.max(...data.map((d) => d.value), 1);
  const barArea = height - 18;

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.wrap}>
      <View style={[styles.plot, { height }]}>
        {data.map((d, i) => (
          <View key={d.key} style={styles.column}>
            <AppText variant="caption" tone="faint" numeric numberOfLines={1} style={styles.value}>
              {d.value > 0 ? `${d.estimated ? '≈' : ''}${formatValue(d.value)}` : ''}
            </AppText>
            <Animated.View
              entering={motion ? FadeIn.duration(500).delay(80 + i * 60) : undefined}
              style={[
                styles.bar,
                {
                  height: Math.max(3, (d.value / max) * barArea),
                  backgroundColor: d.value === 0 ? p.fill : d.estimated ? 'transparent' : p.accent,
                  borderColor: d.estimated ? p.accent : 'transparent',
                  borderStyle: d.estimated ? 'dashed' : 'solid',
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {data.map((d) => (
          <AppText key={d.key} variant="caption" tone="faint" numberOfLines={1} style={styles.label}>
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 3 },
  value: { fontSize: 11, lineHeight: 14 },
  bar: { width: '64%', borderRadius: radius.sm - 2, borderWidth: 1.5 },
  labels: { flexDirection: 'row', gap: space.sm },
  label: { flex: 1, textAlign: 'center', fontSize: 12 },
});
