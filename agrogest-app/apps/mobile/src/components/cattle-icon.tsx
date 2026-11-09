import Svg, { Path } from 'react-native-svg';

/*
 * Bovinos do Fluent Emoji Flat (Microsoft, licença MIT):
 * https://github.com/microsoft/fluentui-emoji — cow e ox, viewBox 32×32.
 * Coloridos de propósito: no pasto, forma e cor se leem melhor que traço fino.
 */
const COW: [string, string][] = [
  ['#9b9b9b', 'M14 20h2l1.88 6.55c.08.29.08.59 0 .87l-.7 2.39c-.03.11-.13.18-.24.18h-1.48c-.17 0-.29-.16-.24-.32l.76-2.59c.02-.05.02-.11 0-.17zm6.29 10h1.48c.11 0 .21-.07.24-.18L23.96 23h-2l-1.91 6.68c-.05.16.07.32.24.32'],
  ['#ff8687', 'M25.94 25h-5.06c-1.63 0-2.94-1.32-2.94-2.94V19h8z'],
  ['#d3d3d3', 'M25.31 10h-.443l-5.994 2.245l-4.883-3.1a5.05 5.05 0 0 1-1.47-1.525l-.22-.37L10.72 10H6l.91 5.014l1.198 1.948l.91 3.076l-.894 1.437A2.54 2.54 0 0 0 9.99 22.96v6.79c0 .14.11.25.25.25h1.5c.14 0 .25-.11.25-.25V27l.87-.44c.69-.35 1.13-1.05 1.13-1.82V23h6.39c.61 0 1.16-.21 1.61-.55c0 1.5 1.02 2.81 2.48 3.17L26 26v3.75c0 .14.11.25.25.25h1.5c.14 0 .25-.11.25-.25v-9.46c.38-.25.71-.55 1-.89v4.61h1V14.7c0-2.6-2.1-4.7-4.69-4.7'],
  ['#f9c23c', 'm9.07 4.47l.52 1.03h1.5l-.82-1.63a.67.67 0 0 0-.6-.37c-.5 0-.82.52-.6.97'],
  ['#e6e6e6', 'M10.016 5h2.125l-6.106 8h-.354l-3.044-2.06l1.48-2.78l3.798-2.512A3.76 3.76 0 0 1 10.016 5'],
  ['#636363', 'M6.503 9.678L4.182 12.97c.13.02.26.03.4.03h4.453a3.26 3.26 0 0 0 3.263-3.252V7.284h.41A2.294 2.294 0 0 0 15 5h-2.832c-.55 0-1.081.16-1.551.449L6.674 7.963zM25.58 12.25l-.43.43A3.93 3.93 0 0 0 24 15.45v1.05c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-3.66c0-.74-.9-1.11-1.42-.59M30 23a2 2 0 1 0 0 4zm-16.39-6.54l3.14 2.36c.51.38.24 1.18-.39 1.18h-2.4a.96.96 0 0 1-.96-.96v-2.27c0-.32.36-.5.61-.31M6.91 15l.36 2l.68 3.9c.05.29.15.56.29.8c.19.34.65.4.93.13c.53-.53.82-1.24.82-1.99v-.42c0-.25.1-.49.27-.67l.6-.63c.62-.64.61-1.66-.01-2.29c-.52-.53-1.23-.83-1.97-.83zM24 20a1 1 0 1 1-2 0a1 1 0 0 1 2 0m-1-6.68v1.98c0 1.49-1.21 2.7-2.72 2.71a2.7 2.7 0 0 1-1.28-.32l-3.26-1.74a3.33 3.33 0 0 1-1.75-2.93V9.16c.81.55 1.78.85 2.79.85h8.09l-1.14 1.33c-.47.55-.73 1.25-.73 1.98'],
  ['#ff8687', 'M5.723 13v-2.973c0-1.167-.85-1.885-1.581-1.885L2.71 9.1A1.6 1.6 0 0 0 2 10.426A2.58 2.58 0 0 0 4.582 13z'],
  ['#1c1c1c', 'M7.5 10.47c-.28 0-.5-.23-.5-.5v-.68c0-.28.22-.5.5-.5s.5.22.5.5v.68c0 .27-.22.5-.5.5'],
  ['#bb1d80', 'M3.5 11.56c-.28 0-.5-.22-.5-.5v-.56c0-.28.22-.5.5-.5s.5.22.5.5v.55c0 .28-.22.51-.5.51'],
];

const OX: [string, string][] = [
  ['#6d4534', 'M13.95 20h2l1.87 6.56c.08.29.08.59 0 .87l-.7 2.39c-.03.11-.13.18-.24.18H15.4c-.16 0-.28-.16-.23-.33l.76-2.59c.02-.05.02-.11 0-.17zm5.33 10h1.48c.11 0 .21-.07.24-.18l2.47-8.67h-2l-2.43 8.53c-.05.16.07.32.24.32'],
  ['#a56953', 'M25.31 10h-3.76c-.62 0-1.2-.27-1.63-.72A3.93 3.93 0 0 0 17 8h-2c-.16 0-.31-.08-.39-.22l-.56-.96A3.63 3.63 0 0 0 10.9 5h-.89c-.78 0-1.55.23-2.2.67l-5.1 3.4c-.44.29-.71.79-.71 1.32C2 11.82 3.13 13 4.56 13H7l.73 4.03l.68 3.9a2.54 2.54 0 0 0 2.04 2.06v6.79c0 .14.11.25.25.25h1.5c.14 0 .25-.11.25-.25v-2.75l.87-.44c.69-.35 1.13-1.05 1.13-1.82v-1.74l5.94-.03c.61 0 1.16-.21 1.61-.55c0 1.5 1.02 2.81 2.48 3.17L26 26v3.75c0 .14.11.25.25.25h1.5c.14 0 .25-.11.25-.25v-9.46c.38-.25.71-.55 1-.89V24h1v-9.31C30 12.1 27.9 10 25.31 10'],
  ['#f9c23c', 'M8 5a3 3 0 0 1-2.5-1.55c-.11-.21-.43-.16-.46.08c-.03.15-.04.3-.04.45C4.99 5.64 6.39 7 8.05 7H10c.55 0 1-.45 1-1s-.45-1-1-1z'],
  ['#6d4534', 'M10 8.4c0-.51.15-.99.41-1.4L14 10.59a2.601 2.601 0 0 1-4-2.19m-6 2.116c0 .271.22.484.5.484s.5-.213.5-.484v-.532a.487.487 0 0 0-.5-.484c-.28 0-.5.213-.5.484z'],
  ['#1c1c1c', 'M7 9.47c0 .28.22.5.5.5s.5-.22.5-.5v-.64c0-.28-.22-.5-.5-.5s-.5.22-.5.5zM28 25c0-1.1.9-2 2-2v4c-1.1 0-2-.9-2-2'],
];

export type CattleKind = 'vaca' | 'boi';

/** Mesmo desenho como texto SVG, para o mapa (HTML dentro do WebView). */
export function cattleSvg(kind: CattleKind, size: number): string {
  const paths = (kind === 'vaca' ? COW : OX).map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${paths}</svg>`;
}

/** Boi ou vaca da categoria do lote. Categoria livre (lotes antigos) vira boi. */
export function categoryKind(category: string): CattleKind {
  return CATTLE_CATEGORIES.find((c) => c.label === category)?.kind ?? 'boi';
}

export function CattleIcon({ kind, size = 32 }: { kind: CattleKind; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {(kind === 'vaca' ? COW : OX).map(([fill, d], i) => (
        <Path key={i} fill={fill} d={d} />
      ))}
    </Svg>
  );
}

export interface CattleCategory {
  label: string;
  kind: CattleKind;
  sex: 'macho' | 'femea';
  /** 0 bezerro, 1 jovem, 2 adulto: o desenho cresce com a idade. */
  age: 0 | 1 | 2;
  hint: string;
}

export const CATTLE_CATEGORIES: CattleCategory[] = [
  { label: 'Bezerros', kind: 'boi', sex: 'macho', age: 0, hint: 'até 1 ano' },
  { label: 'Garrotes', kind: 'boi', sex: 'macho', age: 1, hint: '1 a 2 anos' },
  { label: 'Bois', kind: 'boi', sex: 'macho', age: 2, hint: 'adultos' },
  { label: 'Bezerras', kind: 'vaca', sex: 'femea', age: 0, hint: 'até 1 ano' },
  { label: 'Novilhas', kind: 'vaca', sex: 'femea', age: 1, hint: '1 a 2 anos' },
  { label: 'Vacas', kind: 'vaca', sex: 'femea', age: 2, hint: 'adultas' },
];

export const AGE_SCALE = [0.62, 0.8, 1];

/** Ícone da categoria do lote, no tamanho da idade. Categoria livre (lotes antigos) vira boi adulto. */
export function CategoryIcon({ category, size = 32 }: { category: string; size?: number }) {
  const found = CATTLE_CATEGORIES.find((c) => c.label === category);
  return <CattleIcon kind={found?.kind ?? 'boi'} size={Math.round(size * AGE_SCALE[found?.age ?? 2])} />;
}

