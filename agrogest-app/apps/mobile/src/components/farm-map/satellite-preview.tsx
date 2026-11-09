import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { CategoryIcon } from '@/components/cattle-icon';
import { openRing, type Position } from '@/domain/geo';
import { usePalette } from '@/theme';

import { satelliteUrl } from './map-html';
import { ARCGIS_API_KEY } from './types';

/** Lado do tile em pontos de tela: tiles de 256 px no zoom seguinte ficam nítidos em telas 2×. */
const TILE = 128;
// Em áreas rurais a Esri nem sempre tem imagem no 19; o 18 cobre o Brasil todo.
const MAX_TILE_ZOOM = 18;

/** Web Mercator em "pontos de tile de 128" no zoom `z` (equivale a pixels de 256 no zoom z − 1). */
function project([lng, lat]: Position, z: number): [number, number] {
  const scale = TILE * 2 ** z;
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lng + 180) / 360) * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
}

export interface PreviewPin {
  position: Position;
  category: string;
}

/**
 * Miniatura de satélite da fazenda: tiles da Esri (os mesmos do mapa) num recorte do tamanho do
 * card, com o contorno e os lotes por cima. O expo-image guarda os tiles em disco, então a
 * miniatura continua aparecendo sem internet depois da primeira vez.
 */
export function SatellitePreview({
  boundary,
  pins,
  width,
  height,
  outline,
  color = '#6EE7A0',
}: {
  boundary: Position[];
  pins: PreviewPin[];
  width: number;
  height: number;
  /** Área da fazenda ao fundo, na miniatura de um pasto. Não entra no enquadramento. */
  outline?: Position[] | null;
  /** Cor do contorno principal (amarelo/azul para um pasto, como no mapa). */
  color?: string;
}) {
  const p = usePalette();
  const ring = openRing(boundary);
  const points = [...ring, ...pins.map((pin) => pin.position)];
  if (points.length === 0 || width <= 0) return null;

  // Maior zoom em que a área (com folga de 20%) cabe no card.
  let z = MAX_TILE_ZOOM;
  for (; z > 3; z--) {
    const xy = points.map((pt) => project(pt, z));
    const w = Math.max(...xy.map((q) => q[0])) - Math.min(...xy.map((q) => q[0]));
    const h = Math.max(...xy.map((q) => q[1])) - Math.min(...xy.map((q) => q[1]));
    if (w * 1.2 <= width && h * 1.2 <= height) break;
  }
  const xy = points.map((pt) => project(pt, z));
  const cx = (Math.max(...xy.map((q) => q[0])) + Math.min(...xy.map((q) => q[0]))) / 2;
  const cy = (Math.max(...xy.map((q) => q[1])) + Math.min(...xy.map((q) => q[1]))) / 2;
  const ox = cx - width / 2;
  const oy = cy - height / 2;

  const template = satelliteUrl(ARCGIS_API_KEY);
  const tiles: { key: string; uri: string; left: number; top: number }[] = [];
  const count = 2 ** z;
  for (let tx = Math.floor(ox / TILE); MAP_NETWORK_ENABLED && tx <= Math.floor((ox + width) / TILE); tx++) {
    for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + height) / TILE); ty++) {
      if (ty < 0 || ty >= count) continue;
      const wrapped = ((tx % count) + count) % count;
      tiles.push({
        key: `${z}/${tx}/${ty}`,
        uri: template.replace('{z}', String(z)).replace('{y}', String(ty)).replace('{x}', String(wrapped)),
        left: tx * TILE - ox,
        top: ty * TILE - oy,
      });
    }
  }
  const local = (pt: Position) => {
    const [x, y] = project(pt, z);
    return [x - ox, y - oy] as const;
  };

  return (
    <View style={[styles.frame, { width, height, backgroundColor: p.fill }]} accessible={false}>
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.uri }}
          cachePolicy="disk"
          transition={150}
          style={[styles.tile, { left: tile.left, top: tile.top }]}
        />
      ))}
      {ring.length >= 3 ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {outline && outline.length >= 4 ? (
            <Polygon
              points={openRing(outline).map((pt) => local(pt).join(',')).join(' ')}
              fill="rgba(74, 222, 128, 0.1)"
              stroke="#4ADE80"
              strokeWidth={2}
            />
          ) : null}
          <Polygon
            points={ring.map((pt) => local(pt).join(',')).join(' ')}
            fill={color}
            fillOpacity={0.22}
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
      {pins.map((pin, i) => {
        const [x, y] = local(pin.position);
        return (
          <View key={i} style={[styles.pin, { left: x - 15, top: y - 15 }]}>
            <CategoryIcon category={pin.category} size={20} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  tile: { position: 'absolute', width: TILE, height: TILE },
  pin: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

const MAP_NETWORK_ENABLED = false;
