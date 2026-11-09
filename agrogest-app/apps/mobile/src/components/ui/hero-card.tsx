import { Pressable, StyleSheet, View } from 'react-native';

import { usePreferences } from '@/state/preferences';
import { elevation, radius, space, usePalette } from '@/theme';

import { Button } from './controls';
import { haptics, PressableScale } from './motion';
import { AppText, Icon } from './text';

/**
 * Cartão-herói: o número que mais importa, grande. Fica logo abaixo da faixa escura do topo, sem
 * sobrepô-la. Um número por cartão; o resto vai em listas.
 * - `action`: botão grande para uma ação de verdade (registrar), nunca só para navegar.
 * - `onPress`: o cartão inteiro abre o detalhe (como o saldo no PicPay), com a seta à direita.
 * - `money`: valor em reais; ganha o olho e compartilha a preferência dos cartões principais.
 */
export function HeroCard({
  caption,
  value,
  detail,
  action,
  onPress,
  pressLabel,
  money = false,
}: {
  caption: string;
  value: string;
  detail?: string;
  action?: { title: string; onPress: () => void };
  onPress?: () => void;
  /** O que o toque no cartão abre, para o leitor de tela. */
  pressLabel?: string;
  money?: boolean;
}) {
  const p = usePalette();
  const prefs = usePreferences();
  const hidden = money && prefs.hideValues;
  const shown = hidden ? 'R$ •••••' : value;

  // O olho fica por cima do cartão, como irmão: botão dentro de botão não vale (e na web nem é HTML válido).
  const eye = money ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'}
      hitSlop={10}
      onPress={() => {
        haptics.tap();
        void prefs.setHideValues(!hidden);
      }}
      style={({ pressed }) => [styles.eye, pressed && { opacity: 0.5 }]}>
      <Icon name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={p.textMuted} />
    </Pressable>
  ) : null;

  const content = (
    <>
      <View style={[styles.top, money && styles.topWithEye]}>
        <AppText variant="label" tone="muted" style={styles.shrink}>
          {caption}
        </AppText>
      </View>
      <View style={styles.valueRow}>
        <AppText
          variant="display"
          numeric
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          accessibilityRole="header"
          style={styles.shrink}>
          {shown}
        </AppText>
        {onPress ? <Icon name="chevron-right" size={26} color={p.textFaint} /> : null}
      </View>
      {detail && !hidden ? (
        <AppText variant="caption" tone="muted">
          {detail}
        </AppText>
      ) : null}
      {action ? <Button title={action.title} onPress={action.onPress} size="lg" style={styles.action} /> : null}
    </>
  );

  return (
    <View style={styles.container}>
      {onPress ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${caption}: ${hidden ? 'valor escondido' : value}. ${pressLabel ?? 'Ver detalhe'}`}
          onPress={onPress}
          scaleTo={0.98}
          style={[styles.card, { backgroundColor: p.surface }, elevation(p)]}>
          {content}
        </PressableScale>
      ) : (
        <View style={[styles.card, { backgroundColor: p.surface }, elevation(p)]}>{content}</View>
      )}
      {eye}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: space.md },
  card: {
    borderRadius: radius.xxl,
    padding: space.lg + 4,
    gap: space.xs,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 24 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  topWithEye: { paddingRight: 40 },
  eye: { position: 'absolute', top: space.lg + 4 - 6, right: space.lg + 4 - 6, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  action: { marginTop: space.md, alignSelf: 'stretch' },
});
