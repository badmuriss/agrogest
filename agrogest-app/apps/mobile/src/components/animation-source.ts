import type { AnimationObject } from 'lottie-react-native';

import type { Palette } from '@/theme';

// Gerados por scripts/scenes.mjs. Metro inclui os arquivos locais; cada JSON só é avaliado quando a
// cena aparece, e o pôster (SVG do quadro final) separado do movimento.
const SOURCES = {
  success: () => require('@/assets/animations/success.json'),
  pending: () => require('@/assets/animations/pending.json'),
  scan: () => require('@/assets/animations/scan.json'),
  farm: () => require('@/assets/animations/farm.json'),
  herd: () => require('@/assets/animations/herd.json'),
  sale: () => require('@/assets/animations/sale.json'),
  expense: () => require('@/assets/animations/expense.json'),
  weighing: () => require('@/assets/animations/weighing.json'),
  invoice: () => require('@/assets/animations/invoice.json'),
  loss: () => require('@/assets/animations/loss.json'),
  team: () => require('@/assets/animations/team.json'),
};

const POSTERS: Record<keyof typeof SOURCES, () => string> = {
  success: () => require('@/assets/animations/posters/success.json'),
  pending: () => require('@/assets/animations/posters/pending.json'),
  scan: () => require('@/assets/animations/posters/scan.json'),
  farm: () => require('@/assets/animations/posters/farm.json'),
  herd: () => require('@/assets/animations/posters/herd.json'),
  sale: () => require('@/assets/animations/posters/sale.json'),
  expense: () => require('@/assets/animations/posters/expense.json'),
  weighing: () => require('@/assets/animations/posters/weighing.json'),
  invoice: () => require('@/assets/animations/posters/invoice.json'),
  loss: () => require('@/assets/animations/posters/loss.json'),
  team: () => require('@/assets/animations/posters/team.json'),
};

export type AnimationName = keyof typeof SOURCES;

/** Estados (quadrados): sucesso, aguardando envio e leitura de nota. As demais são ilustrações 4:3. */
const STATUS = ['success', 'pending', 'scan'] as const;
export type IllustrationName = Exclude<AnimationName, (typeof STATUS)[number]>;

interface Shape {
  ty: string;
  nm?: string;
  c?: { a: number; k: number[] };
  it?: Shape[];
}

// Cache limitado a 11 cenas × 2 temas, compartilhado entre cabeçalhos, listas e atalhos.
const animations = new Map<string, AnimationObject>();
const images = new Map<string, string>();
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** O SVG gerado usa apenas ASCII; o loader de data URI no Android exige Base64. */
function encodeSvg(svg: string): string {
  let encoded = '';
  for (let i = 0; i < svg.length; i += 3) {
    const value = (svg.charCodeAt(i) << 16) | ((svg.charCodeAt(i + 1) || 0) << 8) | (svg.charCodeAt(i + 2) || 0);
    encoded += BASE64[(value >> 18) & 63] + BASE64[(value >> 12) & 63];
    encoded += i + 1 < svg.length ? BASE64[(value >> 6) & 63] : '=';
    encoded += i + 2 < svg.length ? BASE64[value & 63] : '=';
  }
  return encoded;
}

/** Cada pintura se chama "color:<token>": a cena é o app em miniatura, com as cores do tema atual. */
function token(p: Palette, role: string): string | undefined {
  const value = (p as unknown as Record<string, unknown>)[role];
  return typeof value === 'string' && value.startsWith('#') ? value : undefined;
}

function rgba(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255).concat(1);
}

function tint(shapes: Shape[], p: Palette): Shape[] {
  return shapes.map((shape) => {
    const color = shape.nm?.startsWith('color:') ? token(p, shape.nm.slice(6)) : undefined;
    return {
      ...shape,
      ...(shape.c && color ? { c: { ...shape.c, k: rgba(color) } } : {}),
      ...(shape.it ? { it: tint(shape.it, p) } : {}),
    };
  });
}

export function animationSource(name: AnimationName, p: Palette): AnimationObject {
  const key = `${name}:${p.scheme}`;
  const cached = animations.get(key);
  if (cached) return cached;
  const source: AnimationObject = SOURCES[name]();
  const themed = {
    ...source,
    layers: source.layers.map((layer: { shapes?: Shape[] }) => ({
      ...layer,
      ...(layer.shapes ? { shapes: tint(layer.shapes, p) } : {}),
    })),
  };
  animations.set(key, themed);
  return themed;
}

/** O quadro final em SVG, sem inicializar um motor de animação. */
export function animationPoster(name: AnimationName, p: Palette): string {
  const key = `${name}:${p.scheme}`;
  const cached = images.get(key);
  if (cached) return cached;
  const svg = POSTERS[name]().replace(/\$(\w+)/g, (_, role: string) => token(p, role) ?? '#000000');
  const uri = `data:image/svg+xml;base64,${encodeSvg(svg)}`;
  images.set(key, uri);
  return uri;
}

export function isIllustration(name: AnimationName): name is IllustrationName {
  return !(STATUS as readonly string[]).includes(name);
}
