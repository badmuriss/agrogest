import { createContext, useContext } from 'react';
import { StyleSheet, useColorScheme, type ViewStyle } from 'react-native';

/**
 * Base neutra e fria: fundo cinza muito claro com cartões brancos separados por um fio de borda (sem
 * sombra: no Android a sombra é cortada em retângulo durante as animações e o cartão parece papel amassado).
 * A marca usa laranja, branco e carvão; o laranja escuro no tema claro preserva o contraste.
 * Estados usam texto e ícone; a aprovação acompanha o laranja, e perigo/alerta mantêm semântica própria.
 * Contraste AA (≥ 4,5:1) para todo texto: muted ≥ 7:1 e faint ≥ 4,5:1 sobre o fundo.
 */
const light = {
  scheme: 'light' as 'light' | 'dark',
  background: '#F4F5F7',
  surface: '#FFFFFF',
  fill: '#EFF1F4',
  fillStrong: '#E3E6EB',
  border: '#E2E5EA',
  text: '#151619',
  textMuted: '#4A5160',
  textFaint: '#626A77',
  accent: '#A63D00',
  onAccent: '#FFFFFF',
  accentSoft: '#FFF0E6',
  highlight: '#FF6F1E',
  /** Faixa escura do topo (Início), com conteúdo claro por cima. */
  hero: '#A63D00',
  onHero: '#FFFFFF',
  onHeroMuted: '#FFEBDD',
  inverse: '#151619',
  onInverse: '#FFFFFF',
  success: '#A63D00',
  warning: '#B45309',
  info: '#1D4ED8',
  danger: '#B91C1C',
  conflict: '#86198F',
  disabledBackground: '#E3E6EB',
  disabledText: '#626A77',
};

export type Palette = typeof light;

const dark: Palette = {
  scheme: 'dark',
  background: '#111214',
  surface: '#1B1D21',
  fill: '#24262B',
  fillStrong: '#303339',
  border: '#393D44',
  text: '#F4F5F7',
  textMuted: '#C0C4CC',
  textFaint: '#A3A9B4',
  accent: '#FF8A4C',
  onAccent: '#21140C',
  accentSoft: '#3A251B',
  highlight: '#FF7A2E',
  hero: '#202125',
  onHero: '#FFFFFF',
  onHeroMuted: '#D2D4D8',
  inverse: '#F4F5F7',
  onInverse: '#151619',
  success: '#FF9A65',
  warning: '#FBBF24',
  info: '#60A5FA',
  danger: '#F87171',
  conflict: '#E879F9',
  disabledBackground: '#303339',
  disabledText: '#A3A9B4',
};

export const palettes = { light, dark };

export type ThemePreference = 'system' | 'light' | 'dark';

/** Esquema efetivo escolhido pelo usuário; null = seguir o sistema. */
export const ColorSchemeContext = createContext<'light' | 'dark' | null>(null);

export function useIsDark(): boolean {
  const chosen = useContext(ColorSchemeContext);
  const system = useColorScheme();
  return (chosen ?? system) === 'dark';
}

export function usePalette(): Palette {
  return useIsDark() ? dark : light;
}

export type Tone = 'neutral' | 'accent' | 'highlight' | 'success' | 'warning' | 'info' | 'danger' | 'conflict';

export function toneColor(p: Palette, tone: Tone): string {
  switch (tone) {
    case 'accent':
      return p.accent;
    case 'highlight':
      return p.highlight;
    case 'success':
      return p.success;
    case 'warning':
      return p.warning;
    case 'info':
      return p.info;
    case 'danger':
      return p.danger;
    case 'conflict':
      return p.conflict;
    default:
      return p.textMuted;
  }
}

/** Fundo bem suave a partir de uma cor (10% de opacidade). */
export function soft(color: string): string {
  return `${color}1A`;
}

/**
 * Inter (via @expo-google-fonts/inter, carregada em src/app/_layout.tsx). No RN a família carrega o peso,
 * por isso não se usa fontWeight junto com estas chaves.
 */
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/**
 * Família Inter para Text/Heading do Gluestack, a partir das classes de peso (`font-semibold` etc.).
 * Aplicada como estilo explícito: a família já carrega o peso, então o negrito sintético do Android
 * (peso pedido sem o arquivo correspondente) não acontece.
 */
export function gluestackFont(className?: string, bold?: boolean): string {
  const classes = className ?? '';
  if (bold || /\bfont-(bold|extrabold|black)\b/.test(classes)) return font.bold;
  if (/\bfont-semibold\b/.test(classes)) return font.semibold;
  if (/\bfont-medium\b/.test(classes)) return font.medium;
  return font.regular;
}

/** Grade de 8 (com os meios passos de 4 nos componentes pequenos). */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Cantos generosos: cartões 20–24, blocos de atalho 16, chips e botões em pílula. */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

/**
 * Separação do cartão: um fio de borda nos dois temas, plano como no PicPay. Sombra (`elevation`)
 * foi abandonada: dentro de uma tela ou bloco que entra com fade, o Android desenha a sombra numa
 * camada recortada em retângulo e o canto arredondado ganha manchas cinzas.
 */
export function elevation(p: Palette): ViewStyle {
  return { borderWidth: StyleSheet.hairlineWidth, borderColor: p.border };
}
