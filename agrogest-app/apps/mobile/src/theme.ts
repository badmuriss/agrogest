import { createContext, useContext } from 'react';
import { StyleSheet, useColorScheme, type ViewStyle } from 'react-native';

/**
 * Base neutra e fria: fundo cinza muito claro com cartões brancos separados por um fio de borda (sem
 * sombra: no Android a sombra é cortada em retângulo durante as animações e o cartão parece papel amassado).
 * A marca (verde #0C502F) é a única cor de ação e de destaque; laranja só como acento pontual.
 * Verde, vermelho e amarelo ficam reservados a sucesso, perigo e alerta.
 * Contraste AA (≥ 4,5:1) para todo texto: muted ≥ 7:1 e faint ≥ 4,5:1 sobre o fundo.
 */
const light = {
  scheme: 'light' as 'light' | 'dark',
  background: '#F4F5F7',
  surface: '#FFFFFF',
  fill: '#EFF1F4',
  fillStrong: '#E3E6EB',
  border: '#E2E5EA',
  text: '#0B0F0C',
  textMuted: '#4A5160',
  textFaint: '#626A77',
  accent: '#0C502F',
  onAccent: '#FFFFFF',
  accentSoft: '#E6F2EA',
  highlight: '#FF6F1E',
  /** Faixa escura do topo (Início), com conteúdo claro por cima. */
  hero: '#0C502F',
  onHero: '#FFFFFF',
  onHeroMuted: '#D3E6DB',
  inverse: '#0B0F0C',
  onInverse: '#FFFFFF',
  success: '#15803D',
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
  background: '#0B0F0C',
  surface: '#151C17',
  fill: '#1E2822',
  fillStrong: '#2A352E',
  border: '#2E3A32',
  text: '#F2F5F3',
  textMuted: '#B6C2BA',
  textFaint: '#97A59B',
  accent: '#5FD28B',
  onAccent: '#06210F',
  accentSoft: '#1B3A28',
  highlight: '#FF7A2E',
  hero: '#12301F',
  onHero: '#FFFFFF',
  onHeroMuted: '#B9D6C4',
  inverse: '#F2F5F3',
  onInverse: '#0B0F0C',
  success: '#4ADE80',
  warning: '#FBBF24',
  info: '#60A5FA',
  danger: '#F87171',
  conflict: '#E879F9',
  disabledBackground: '#2A352E',
  disabledText: '#97A59B',
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
