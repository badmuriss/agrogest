import { StyleSheet, View } from 'react-native';

import { elevation, radius, space, usePalette } from '@/theme';

import type { LucideIcon } from './lucide';
import { PressableScale } from './motion';
import { AppText } from './text';

export interface AccessItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Linha curta abaixo do rótulo (ex.: "3 contas"). */
  hint?: string;
  onPress: () => void;
  /** Um bloco em destaque com o fundo da marca, como o bloco escuro do menu do PicPay. */
  primary?: boolean;
}

/**
 * "Acesso rápido": blocos grandes em duas colunas, ícone no canto de cima e rótulo embaixo, como
 * o menu do PicPay. Substitui listas longas de atalhos por algo que se acha de olho.
 */
export function AccessGrid({ items }: { items: AccessItem[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <AccessTile key={item.key} item={item} />
      ))}
    </View>
  );
}

function AccessTile({ item }: { item: AccessItem }) {
  const p = usePalette();
  const Glyph = item.icon;
  const fg = item.primary ? p.onAccent : p.text;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={item.hint ? `${item.label}, ${item.hint}` : item.label}
      onPress={item.onPress}
      scaleTo={0.97}
      containerStyle={styles.cell}
      style={[styles.tile, { backgroundColor: item.primary ? p.accent : p.surface }, elevation(p), item.primary && { borderColor: p.accent }]}>
      <Glyph color={fg} size={26} strokeWidth={1.75} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1} style={[styles.label, { color: fg }]}>
          {item.label}
        </AppText>
        {item.hint ? (
          <AppText variant="caption" numberOfLines={2} style={[styles.hint, { color: item.primary ? p.onAccent : p.textMuted }, item.primary && styles.dim]}>
            {item.hint}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  cell: { width: '48.2%' },
  tile: { minHeight: 112, borderRadius: radius.xl, padding: space.lg, justifyContent: 'space-between', gap: space.md },
  text: { gap: 1 },
  label: { fontSize: 15, lineHeight: 20 },
  hint: { fontSize: 12, lineHeight: 16 },
  dim: { opacity: 0.85 },
});
