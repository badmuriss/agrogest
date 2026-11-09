import type { StyleProp, ViewStyle } from 'react-native';

import type { CattleKind } from '@/components/cattle-icon';
import type { Position } from '@/domain/geo';

export type MapMode = 'view' | 'draw' | 'place';

export interface MapPin {
  id: string;
  position: Position;
  kind: CattleKind;
  label: string;
  selected?: boolean;
}

/** Pasto desenhado no mapa: polígono colorido com o nome por cima. */
export interface MapArea {
  id: string;
  ring: Position[];
  label: string;
  /** Segunda linha do rótulo (ex.: cabeças hoje). */
  detail?: string;
  color: string;
  selected?: boolean;
}

export interface FarmMapHandle {
  undo: () => void;
  clear: () => void;
  fit: () => void;
  center: (position: Position, zoom?: number) => void;
  /** Enquadra um lugar buscado e deixa um marcador nele. */
  focus: (position: Position, bounds: [number, number, number, number] | null) => void;
}

export interface FarmMapProps {
  boundary: Position[] | null | undefined;
  pins: MapPin[];
  mode: MapMode;
  accent: string;
  /** Pastos desenhados; no modo de desenho ficam apagados, só como referência. */
  areas?: MapArea[];
  /** Área da fazenda mantida visível enquanto se desenha um pasto (não tocável). */
  outline?: Position[] | null;
  outlineColor?: string;
  /** O que está sendo desenhado (fazenda ou um pasto): ao mudar, o desenho recomeça do contorno salvo. */
  drawKey?: string;
  onDraft?: (points: Position[], closed: boolean) => void;
  onTap?: (position: Position) => void;
  onPinPress?: (id: string) => void;
  onAreaPress?: (id: string) => void;
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
}

export type MapOutMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'draft'; points: Position[]; closed: boolean }
  | { type: 'tap'; position: Position }
  | { type: 'pin'; id: string }
  | { type: 'area'; id: string };

/** Chave opcional do ArcGIS Location Platform; sem ela, o protótipo usa o endpoint público. */
export const ARCGIS_API_KEY = process.env.EXPO_PUBLIC_ARCGIS_API_KEY || undefined;

/** Repassa a mensagem da página do mapa para as props. */
export function dispatchMapMessage(message: MapOutMessage, props: FarmMapProps, onReady: () => void) {
  if (message.type === 'ready') onReady();
  else if (message.type === 'error') props.onError?.();
  else if (message.type === 'draft') props.onDraft?.(message.points, message.closed);
  else if (message.type === 'tap') props.onTap?.(message.position);
  else if (message.type === 'pin') props.onPinPress?.(message.id);
  else if (message.type === 'area') props.onAreaPress?.(message.id);
}
