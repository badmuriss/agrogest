import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View, type ColorValue, type TextProps } from 'react-native';

import { font, soft, toneColor, usePalette, type Tone } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  return <MaterialCommunityIcons name={name} size={size} style={{ color }} />;
}

/** Ícone num quadrado arredondado: neutro por padrão, cor só quando há significado. */
export function IconTile({
  name,
  size = 36,
  tone = 'neutral',
}: {
  name: IconName;
  size?: number;
  tone?: Tone;
}) {
  const p = usePalette();
  const color = tone === 'neutral' ? p.text : toneColor(p, tone);
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tone === 'neutral' ? p.fill : soft(color) },
      ]}>
      <Icon name={name} size={size * 0.52} color={color} />
    </View>
  );
}

type Variant = 'display' | 'largeTitle' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'label' | 'caption';
export type TextTone = 'default' | 'muted' | 'faint' | Tone;

export function AppText({
  variant = 'body',
  tone = 'default',
  numeric,
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: TextTone; numeric?: boolean }) {
  const p = usePalette();
  const color =
    tone === 'default' ? p.text : tone === 'muted' ? p.textMuted : tone === 'faint' ? p.textFaint : toneColor(p, tone);
  return <Text {...rest} style={[styles[variant], { color }, numeric && styles.numeric, style]} />;
}

/** Círculo com as iniciais da pessoa. `onDark`: sobre a faixa escura do topo (texto branco, fundo translúcido). */
export function Avatar({
  name,
  size = 44,
  tone = 'neutral',
  onDark = false,
}: {
  name: string;
  size?: number;
  tone?: Tone;
  onDark?: boolean;
}) {
  const p = usePalette();
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  const color = onDark ? p.onHero : tone === 'neutral' ? p.text : toneColor(p, tone);
  const background = onDark ? 'rgba(255,255,255,0.18)' : tone === 'neutral' ? p.fill : soft(color);
  return (
    <View
      accessible={false}
      style={[styles.tile, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
      <Text style={{ color, fontSize: size * 0.38, fontFamily: font.bold }}>{initials || '?'}</Text>
    </View>
  );
}

/**
 * Escala curta em Inter: display (números grandes), título, corpo e legenda. As demais variantes
 * são apelidos dessa escala, para não espalhar tamanhos pelas telas.
 */
const styles = StyleSheet.create({
  display: { fontFamily: font.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  largeTitle: { fontFamily: font.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  title: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  heading: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  numeric: { fontVariant: ['tabular-nums'] },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
