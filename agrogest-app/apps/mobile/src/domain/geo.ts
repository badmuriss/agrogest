/** Ponto no formato GeoJSON: [longitude, latitude] em graus. */
export type Position = [number, number];

/** Raio usado pelo GeoJSON/Turf para área geodésica (WGS 84, semi-eixo maior). */
const EARTH_RADIUS_M = 6_378_137;
const RAD = Math.PI / 180;

/** Limite de vértices: suficiente para contornar uma fazenda, pequeno para validar no servidor. */
export const MAX_RING_VERTICES = 500;

const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];

/** Vértices sem o ponto de fechamento repetido. */
export function openRing(ring: Position[]): Position[] {
  return ring.length > 1 && same(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring;
}

/** Anel GeoJSON: o primeiro ponto repetido no fim. */
export function closeRing(points: Position[]): Position[] {
  const open = openRing(points);
  return open.length === 0 ? [] : [...open, open[0]];
}

export function isValidPosition(p: unknown): p is Position {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number' &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}

/** Área geodésica em m² (fórmula de Chamberlain & Duquette, a mesma do Turf). */
export function ringAreaM2(ring: Position[]): number {
  const pts = openRing(ring);
  if (pts.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const [lng1, lat1] = pts[i];
    const [lng2, lat2] = pts[(i + 1) % pts.length];
    total += (lng2 - lng1) * RAD * (2 + Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function ringAreaHa(ring: Position[]): number {
  return ringAreaM2(ring) / 10_000;
}

/** Distância em metros pela fórmula de haversine. */
export function distanceM(a: Position, b: Position): number {
  const dLat = (b[1] - a[1]) * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function ringPerimeterM(ring: Position[]): number {
  const pts = openRing(ring);
  if (pts.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < pts.length; i++) total += distanceM(pts[i], pts[(i + 1) % pts.length]);
  return total;
}

function orientation(a: Position, b: Position, c: Position): number {
  const v = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  return Math.abs(v) < 1e-15 ? 0 : v > 0 ? 1 : 2;
}

function onSegment(a: Position, b: Position, c: Position): boolean {
  return (
    Math.min(a[0], c[0]) <= b[0] && b[0] <= Math.max(a[0], c[0]) && Math.min(a[1], c[1]) <= b[1] && b[1] <= Math.max(a[1], c[1])
  );
}

function segmentsIntersect(p1: Position, q1: Position, p2: Position, q2: Position): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && onSegment(p1, p2, q1)) ||
    (o2 === 0 && onSegment(p1, q2, q1)) ||
    (o3 === 0 && onSegment(p2, p1, q2)) ||
    (o4 === 0 && onSegment(p2, q1, q2))
  );
}

/** Polígono simples: pelo menos 3 vértices distintos e nenhuma aresta cruzando outra. */
export function isSimpleRing(ring: Position[]): boolean {
  const pts = openRing(ring);
  const n = pts.length;
  if (n < 3 || n > MAX_RING_VERTICES || !pts.every(isValidPosition)) return false;
  if (new Set(pts.map((p) => `${p[0]},${p[1]}`)).size !== n) return false;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Arestas vizinhas compartilham um vértice; não contam como cruzamento.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsIntersect(a1, a2, pts[j], pts[(j + 1) % n])) return false;
    }
  }
  return ringAreaM2(pts) > 0;
}

/** Centro de massa plano do polígono (bom o bastante na escala de uma fazenda). */
export function ringCentroid(ring: Position[]): Position | null {
  const pts = openRing(ring);
  if (pts.length === 0) return null;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-18) {
    const n = pts.length;
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Ponto dentro do polígono (raio horizontal). */
export function pointInRing(point: Position, ring: Position[]): boolean {
  const pts = openRing(ring);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Distância em metros do ponto até a borda do anel (projeção local plana, boa para fazendas).
 * Serve de tolerância: um ponto preso na cerca pode cair milímetros fora por arredondamento.
 */
export function distanceToRingM(point: Position, ring: Position[]): number {
  const pts = openRing(ring);
  const kx = EARTH_RADIUS_M * RAD * Math.cos(point[1] * RAD);
  const ky = EARTH_RADIUS_M * RAD;
  const xy = (p: Position) => [(p[0] - point[0]) * kx, (p[1] - point[1]) * ky];
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = xy(pts[i]);
    const [bx, by] = xy(pts[(i + 1) % pts.length]);
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Fora do anel por mais que `toleranceM` metros. */
export function outsideRing(point: Position, ring: Position[], toleranceM = 1): boolean {
  return !pointInRing(point, ring) && distanceToRingM(point, ring) > toleranceM;
}

/** Limites [oeste, sul, leste, norte]. */
export function bounds(points: Position[]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lng, lat] of points) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [w, s, e, n];
}

export function formatHectares(ha: number): string {
  const digits = ha < 10 ? 2 : ha < 1000 ? 1 : 0;
  return `${ha.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ha`;
}

/**
 * Coordenadas digitadas: "-20.45, -54.6" ou "-20,45 -54,6" (latitude primeiro, como no Google Maps).
 * Devolve [lng, lat] ou null quando o texto não é uma coordenada válida.
 */
export function parseCoordinates(text: string): Position | null {
  const numbers = text.trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!numbers) return null;
  const lat = Number(numbers[1].replace(',', '.'));
  const lng = Number(numbers[2].replace(',', '.'));
  const position: Position = [lng, lat];
  return isValidPosition(position) ? position : null;
}
