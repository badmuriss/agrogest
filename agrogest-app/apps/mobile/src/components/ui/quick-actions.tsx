import { StyleSheet, View } from 'react-native';

import { elevation, radius, space, usePalette } from '@/theme';

import type { LucideIcon } from './lucide';
import { PressableScale } from './motion';
import { AppText } from './text';

export interface QuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /** A ação principal ganha o fundo da marca; as demais ficam neutras. */
  primary?: boolean;
}

/**
 * "Pro dia a dia", como no PicPay: um bloco arredondado só com o ícone e o rótulo embaixo, fora do
 * bloco, em grade de 4. O ícone se acha de olho e o rótulo tem espaço para duas linhas sem apertar.
 * Toque de 44 pt ou mais (o bloco tem cerca de 76 × 64 pt e o rótulo também responde).
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <QuickTile key={action.key} action={action} />
      ))}
    </View>
  );
}

function QuickTile({ action }: { action: QuickAction }) {
  const p = usePalette();
  const Glyph = action.icon;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={action.label}
      containerStyle={styles.cell}
      style={styles.inner}
      scaleTo={0.94}
      onPress={action.onPress}>
      <View style={[styles.tile, { backgroundColor: action.primary ? p.accent : p.surface }, elevation(p), action.primary && { borderColor: p.accent }]}>
        <Glyph color={action.primary ? p.onAccent : p.text} size={26} strokeWidth={1.75} />
      </View>
      <AppText variant="caption" numberOfLines={2} style={[styles.label, { color: p.text }]}>
        {action.label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Colunas de 25% com respiro interno: uma linha incompleta fica alinhada à esquerda, não espalhada.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, marginHorizontal: -space.xs },
  cell: { width: '25%', paddingHorizontal: space.xs },
  inner: { alignItems: 'center', gap: space.sm },
  tile: { alignSelf: 'stretch', height: 64, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  // 12 pt em até duas linhas: "Lançar despesa" e "Fluxo de caixa" quebram entre as palavras.
  label: { textAlign: 'center', fontSize: 12, lineHeight: 16 },
});
