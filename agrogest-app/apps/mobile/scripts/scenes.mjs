/**
 * Cenas Lottie do AgroGest: o próprio app em miniatura (cartões, chips, barras e números), sem
 * desenho à mão. Gera assets/animations/<cena>.json e o quadro final de cada uma em SVG
 * (assets/animations/posters/<cena>.json), usado em miniaturas e com "Reduzir animações".
 *
 * Uso, na pasta apps/mobile: node scripts/scenes.mjs
 *
 * - Ícones: o desenho do Lucide instalado (licença ISC), convertido em formas Lottie.
 * - Números: contornos da Inter instalada (@expo-google-fonts/inter, licença OFL), sem fonte no player.
 * - Cores: cada pintura se chama "color:<token>" com um token de src/theme.ts; o app troca pela
 *   paleta do tema claro ou escuro em src/components/animation-source.ts.
 * - Sem dependências: roda só com o Node do projeto e produz sempre o mesmo resultado.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'animations');
const FPS = 60;
const MAX_BYTES = 15 * 1024;

const round = (value) => Math.round(value * 10) / 10;

// ─── Caminhos SVG → curvas cúbicas (formato de vértices do Lottie) ───────────────────────────

/** Cada subcaminho: vértices `v`, tangentes de entrada `i` e saída `o` (relativas), fechado `c`. */
function parsePath(d) {
  const subs = [];
  let index = 0;
  let command = '';
  let cur = null;
  let x = 0, y = 0, startX = 0, startY = 0;
  let lastCubic = null, lastQuad = null;
  const skip = () => { while (index < d.length && /[\s,]/.test(d[index])) index += 1; };
  const number = () => {
    skip();
    const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(index));
    if (!match) throw new Error(`Número esperado em "${d.slice(index, index + 12)}"`);
    index += match[0].length;
    return parseFloat(match[0]);
  };
  const flag = () => { skip(); return d[index++] === '1'; };
  const begin = (px, py) => { cur = { v: [[px, py]], i: [[0, 0]], o: [[0, 0]], c: false }; subs.push(cur); };
  const ensure = () => { if (!cur || cur.c) begin(x, y); };
  const line = (px, py) => { ensure(); cur.v.push([px, py]); cur.i.push([0, 0]); cur.o.push([0, 0]); x = px; y = py; };
  const cubic = (ax, ay, bx, by, px, py) => {
    ensure();
    const last = cur.v.length - 1;
    cur.o[last] = [ax - x, ay - y];
    cur.v.push([px, py]); cur.i.push([bx - px, by - py]); cur.o.push([0, 0]);
    x = px; y = py;
  };
  const arc = (rx, ry, rotation, large, sweep, px, py) => {
    // SVG 1.1, apêndice F.6: centro do arco e divisão em trechos de até 90°.
    if (rx === 0 || ry === 0) return line(px, py);
    const phi = (rotation * Math.PI) / 180;
    const cos = Math.cos(phi), sin = Math.sin(phi);
    const dx = (x - px) / 2, dy = (y - py) / 2;
    const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
    if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
    const sign = large === sweep ? -1 : 1;
    const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
    const coef = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
    const cx1 = (coef * rx * y1) / ry, cy1 = (-coef * ry * x1) / rx;
    const cx = cos * cx1 - sin * cy1 + (x + px) / 2, cy = sin * cx1 + cos * cy1 + (y + py) / 2;
    const angle = (ux, uy, vx, vy) => {
      const value = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      return value;
    };
    const theta = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
    let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;
    const segments = Math.ceil(Math.abs(delta) / (Math.PI / 2));
    const step = delta / segments;
    const k = (4 / 3) * Math.tan(step / 4);
    const point = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
    const derivative = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
    for (let s = 0; s < segments; s += 1) {
      const t1 = theta + s * step, t2 = t1 + step;
      const [p1x, p1y] = point(t1), [p2x, p2y] = point(t2);
      const [d1x, d1y] = derivative(t1), [d2x, d2y] = derivative(t2);
      const end = s === segments - 1 ? [px, py] : [p2x, p2y];
      cubic(p1x + k * d1x, p1y + k * d1y, p2x - k * d2x, p2y - k * d2y, end[0], end[1]);
    }
  };
  for (;;) {
    skip();
    if (index >= d.length) break;
    if (/[a-zA-Z]/.test(d[index])) command = d[index++];
    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0, oy = relative ? y : 0;
    const kind = command.toUpperCase();
    if (kind !== 'C' && kind !== 'S') lastCubic = null;
    if (kind !== 'Q' && kind !== 'T') lastQuad = null;
    switch (kind) {
      case 'M': {
        x = ox + number(); y = oy + number();
        startX = x; startY = y;
        begin(x, y);
        command = relative ? 'l' : 'L';
        break;
      }
      case 'L': line(ox + number(), oy + number()); break;
      case 'H': line(ox + number(), y); break;
      case 'V': line(x, oy + number()); break;
      case 'C': {
        const ax = ox + number(), ay = oy + number(), bx = ox + number(), by = oy + number();
        cubic(ax, ay, bx, by, ox + number(), oy + number());
        lastCubic = [bx, by];
        break;
      }
      case 'S': {
        const ax = lastCubic ? 2 * x - lastCubic[0] : x, ay = lastCubic ? 2 * y - lastCubic[1] : y;
        const bx = ox + number(), by = oy + number();
        cubic(ax, ay, bx, by, ox + number(), oy + number());
        lastCubic = [bx, by];
        break;
      }
      case 'Q': case 'T': {
        const [qx, qy] = kind === 'Q'
          ? [ox + number(), oy + number()]
          : lastQuad ? [2 * x - lastQuad[0], 2 * y - lastQuad[1]] : [x, y];
        const px = ox + number(), py = oy + number();
        cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), px + (2 / 3) * (qx - px), py + (2 / 3) * (qy - py), px, py);
        lastQuad = [qx, qy];
        break;
      }
      case 'A': {
        const rx = number(), ry = number(), rotation = number(), large = flag(), sweep = flag();
        arc(rx, ry, rotation, large, sweep, ox + number(), oy + number());
        break;
      }
      case 'Z': {
        if (cur) {
          cur.c = true;
          const last = cur.v.length - 1;
          if (last > 0 && Math.hypot(cur.v[last][0] - cur.v[0][0], cur.v[last][1] - cur.v[0][1]) < 1e-6) {
            cur.i[0] = cur.i[last];
            cur.v.pop(); cur.i.pop(); cur.o.pop();
          }
        }
        x = startX; y = startY;
        break;
      }
      default: throw new Error(`Comando de caminho sem suporte: ${command}`);
    }
  }
  return subs;
}

// ─── Ícones Lucide ──────────────────────────────────────────────────────────────────────────

/** Formas do ícone na grade 24×24 do Lucide, como geometria do gerador. */
function lucide(name) {
  const source = readFileSync(join(ROOT, 'node_modules', 'lucide-react-native', 'dist', 'esm', 'icons', `${name}.mjs`), 'utf8');
  const match = /const __iconData = (\{[\s\S]*?\n\});/.exec(source);
  if (!match) throw new Error(`Ícone ${name} em formato inesperado`);
  const data = new Function(`return ${match[1]}`)();
  return data.node.flatMap(([tag, a]) => {
    const n = (key) => Number(a[key] ?? 0);
    switch (tag) {
      case 'path': return parsePath(a.d).map((sub) => ({ kind: 'path', ...sub }));
      case 'circle': return [{ kind: 'ellipse', cx: n('cx'), cy: n('cy'), rx: n('r'), ry: n('r') }];
      case 'ellipse': return [{ kind: 'ellipse', cx: n('cx'), cy: n('cy'), rx: n('rx'), ry: n('ry') }];
      case 'rect': return [{ kind: 'rect', x: n('x'), y: n('y'), w: n('width'), h: n('height'), r: n('rx') }];
      case 'line': return parsePath(`M${a.x1} ${a.y1}L${a.x2} ${a.y2}`).map((sub) => ({ kind: 'path', ...sub }));
      case 'polyline': case 'polygon':
        return parsePath(`M${a.points.trim().split(/[\s,]+/).join(' ')}${tag === 'polygon' ? 'Z' : ''}`).map((sub) => ({ kind: 'path', ...sub }));
      default: throw new Error(`Elemento ${tag} sem suporte no ícone ${name}`);
    }
  });
}

/** Leva a geometria para a cena: escala e posição aplicadas aos pontos. */
function place(shapes, scale, dx, dy) {
  return shapes.map((shape) => {
    if (shape.kind === 'ellipse') return { ...shape, cx: dx + shape.cx * scale, cy: dy + shape.cy * scale, rx: shape.rx * scale, ry: shape.ry * scale };
    if (shape.kind === 'rect') return { ...shape, x: dx + shape.x * scale, y: dy + shape.y * scale, w: shape.w * scale, h: shape.h * scale, r: shape.r * scale };
    return {
      ...shape,
      v: shape.v.map(([px, py]) => [dx + px * scale, dy + py * scale]),
      i: shape.i.map(([px, py]) => [px * scale, py * scale]),
      o: shape.o.map(([px, py]) => [px * scale, py * scale]),
    };
  });
}

// ─── Inter (TrueType) → contornos ───────────────────────────────────────────────────────────

function loadFont(file) {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o) => view.getUint16(o), i16 = (o) => view.getInt16(o), u32 = (o) => view.getUint32(o);
  const tables = {};
  for (let t = 0; t < u16(4); t += 1) {
    const o = 12 + t * 16;
    tables[String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])] = u32(o + 8);
  }
  const unitsPerEm = u16(tables.head + 18);
  const longLoca = i16(tables.head + 50) === 1;
  const metrics = u16(tables.hhea + 34);
  let cmap = null;
  for (let k = 0; k < u16(tables.cmap + 2); k += 1) {
    const base = tables.cmap + 4 + k * 8;
    if (u16(base) === 3 && u16(base + 2) === 1) cmap = tables.cmap + u32(base + 4);
  }
  if (!cmap || u16(cmap) !== 4) throw new Error('A fonte precisa de cmap formato 4');
  const segments = u16(cmap + 6) / 2;
  const glyphIndex = (code) => {
    const ends = cmap + 14, starts = ends + segments * 2 + 2, deltas = starts + segments * 2, ranges = deltas + segments * 2;
    for (let s = 0; s < segments; s += 1) {
      if (code > u16(ends + s * 2)) continue;
      const start = u16(starts + s * 2);
      if (code < start) return 0;
      const range = u16(ranges + s * 2);
      if (range === 0) return (code + i16(deltas + s * 2)) & 0xffff;
      const glyph = u16(ranges + s * 2 + range + 2 * (code - start));
      return glyph ? (glyph + i16(deltas + s * 2)) & 0xffff : 0;
    }
    return 0;
  };
  const loca = (g) => (longLoca ? u32(tables.loca + g * 4) : u16(tables.loca + g * 2) * 2);
  const advance = (g) => u16(tables.hmtx + 4 * Math.min(g, metrics - 1));
  const contours = (g) => {
    const offset = tables.glyf + loca(g);
    if (loca(g + 1) === loca(g)) return [];
    const count = i16(offset);
    if (count < 0) {
      const result = [];
      let p = offset + 10;
      for (;;) {
        const flags = u16(p), part = u16(p + 2);
        p += 4;
        const words = flags & 1;
        const dx = words ? i16(p) : view.getInt8(p), dy = words ? i16(p + 2) : view.getInt8(p + 1);
        p += words ? 4 : 2;
        if (flags & 8) p += 2; else if (flags & 0x40) p += 4; else if (flags & 0x80) p += 8;
        for (const contour of contours(part)) result.push(contour.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })));
        if (!(flags & 0x20)) break;
      }
      return result;
    }
    const ends = Array.from({ length: count }, (_, k) => u16(offset + 10 + k * 2));
    const points = (ends.at(-1) ?? -1) + 1;
    let p = offset + 12 + count * 2 + u16(offset + 10 + count * 2);
    const flags = [];
    while (flags.length < points) {
      const flag = bytes[p++];
      flags.push(flag);
      if (flag & 8) for (let r = bytes[p++]; r > 0; r -= 1) flags.push(flag);
    }
    const read = (short, same) => {
      let value = 0;
      return flags.map((flag) => {
        if (flag & short) value += (flag & same ? 1 : -1) * bytes[p++];
        else if (!(flag & same)) { value += i16(p); p += 2; }
        return value;
      });
    };
    const xs = read(2, 16), ys = read(4, 32);
    const result = [];
    let first = 0;
    for (const end of ends) {
      result.push(Array.from({ length: end - first + 1 }, (_, k) => ({ x: xs[first + k], y: ys[first + k], on: (flags[first + k] & 1) === 1 })));
      first = end + 1;
    }
    return result;
  };
  return { unitsPerEm, glyphIndex, advance, contours };
}

const FONTS = {
  semibold: loadFont(join(ROOT, 'node_modules', '@expo-google-fonts', 'inter', '600SemiBold', 'Inter_600SemiBold.ttf')),
  bold: loadFont(join(ROOT, 'node_modules', '@expo-google-fonts', 'inter', '700Bold', 'Inter_700Bold.ttf')),
};

function textWidth(text, size, weight) {
  const font = FONTS[weight];
  return [...text].reduce((sum, char) => sum + font.advance(font.glyphIndex(char.codePointAt(0))), 0) * size / font.unitsPerEm;
}

/**
 * Texto como contornos: TrueType quadrática convertida em cúbica. Os pontos ficam em centésimos
 * de em, inteiros, e o grupo leva escala e posição (linha de base em `y`): cabe muito menos no JSON.
 */
const TEXT_UNITS = 100;
function textShapes(text, x, y, size, weight, align = 'left') {
  const font = FONTS[weight];
  const scale = TEXT_UNITS / font.unitsPerEm;
  const offset = align === 'right' ? textWidth(text, size, weight) : align === 'center' ? textWidth(text, size, weight) / 2 : 0;
  let pen = 0;
  const shapes = [];
  for (const char of text) {
    const glyph = font.glyphIndex(char.codePointAt(0));
    for (const contour of font.contours(glyph)) {
      const at = (pt) => [Math.round(pen + pt.x * scale), Math.round(-pt.y * scale)];
      // Ponto inicial na curva: o primeiro "on" ou o meio entre os dois primeiros controles.
      const n = contour.length;
      let startAt = contour.findIndex((pt) => pt.on);
      const points = [];
      if (startAt < 0) {
        const mid = { x: (contour[0].x + contour[1].x) / 2, y: (contour[0].y + contour[1].y) / 2, on: true };
        points.push(mid, ...contour.slice(1), contour[0]);
        startAt = 0;
      } else {
        for (let k = 0; k < n; k += 1) points.push(contour[(startAt + k) % n]);
      }
      const sub = { kind: 'path', v: [at(points[0])], i: [[0, 0]], o: [[0, 0]], c: true };
      let last = points[0];
      const push = (control, end) => {
        const [lx, ly] = at(last), [ex, ey] = at(end);
        const index = sub.v.length - 1;
        if (control) {
          const [qx, qy] = at(control);
          sub.o[index] = [Math.round((2 / 3) * (qx - lx)), Math.round((2 / 3) * (qy - ly))];
          sub.v.push([ex, ey]); sub.i.push([Math.round((2 / 3) * (qx - ex)), Math.round((2 / 3) * (qy - ey))]); sub.o.push([0, 0]);
        } else {
          sub.v.push([ex, ey]); sub.i.push([0, 0]); sub.o.push([0, 0]);
        }
        last = end;
      };
      for (let k = 1; k <= points.length; k += 1) {
        const pt = points[k % points.length];
        if (pt.on) { push(null, pt); continue; }
        const next = points[(k + 1) % points.length];
        const end = next.on ? next : { x: (pt.x + next.x) / 2, y: (pt.y + next.y) / 2, on: true };
        push(pt, end);
        if (next.on) k += 1;
      }
      // O último vértice repete o primeiro: o caminho fechado o reaproveita.
      const lastIndex = sub.v.length - 1;
      if (lastIndex > 0 && sub.v[lastIndex][0] === sub.v[0][0] && sub.v[lastIndex][1] === sub.v[0][1]) {
        sub.i[0] = sub.i[lastIndex];
        sub.v.pop(); sub.i.pop(); sub.o.pop();
      }
      shapes.push(sub);
    }
    pen += font.advance(glyph) * scale;
  }
  return { shapes, transform: { x: x - offset, y, scale: size / TEXT_UNITS } };
}

// ─── Movimento ──────────────────────────────────────────────────────────────────────────────

/** Curvas de easing (x1, y1, x2, y2), como no CSS. */
const EASE = {
  out: [0.16, 1, 0.3, 1], // desacelera: entradas
  inOut: [0.65, 0, 0.35, 1], // percursos e traços
  pop: [0.34, 1.4, 0.64, 1], // passa um pouco e volta: destaques
  linear: [0, 0, 1, 1],
};

/** Quadros-chave: [quadro, valor, easing do trecho seguinte]. */
const keys = (...frames) => ({ keys: frames });
// Arrays também têm `keys` (Array.prototype.keys): só objetos de quadros-chave contam.
const animated = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value) && 'keys' in value;

function at(value, frame) {
  if (!animated(value)) return value;
  const list = value.keys;
  if (frame <= list[0][0]) return list[0][1];
  for (let k = 0; k < list.length - 1; k += 1) {
    const [t0, v0] = list[k], [t1, v1] = list[k + 1];
    if (frame < t1) {
      const t = (frame - t0) / (t1 - t0);
      return Array.isArray(v0) ? v0.map((v, i) => v + (v1[i] - v) * t) : v0 + (v1 - v0) * t;
    }
  }
  return list.at(-1)[1];
}

/** Entrada padrão: sobe alguns pontos enquanto aparece. */
const rise = (start, distance = 8, duration = 28) => ({
  opacity: keys([start, 0, 'out'], [start + duration * 0.6, 100]),
  move: keys([start, [0, distance], 'out'], [start + duration, [0, 0]]),
});
/** Destaque: cresce do centro, passa um pouco e assenta. */
const pop = (start, duration = 26) => ({
  opacity: keys([start, 0, 'out'], [start + 8, 100]),
  scale: keys([start, 60, 'pop'], [start + duration, 100]),
});
/** Barra que cresce a partir da base (vertical) ou da esquerda (horizontal). */
const grow = (start, axis = 'y', duration = 32) => ({
  scale: keys([start, axis === 'y' ? [100, 0] : [0, 100], 'out'], [start + duration, [100, 100]]),
});
const fade = (start, duration = 18) => ({ opacity: keys([start, 0, 'out'], [start + duration, 100]) });

// ─── Peças de interface ─────────────────────────────────────────────────────────────────────

/** Pintura: token da paleta e opacidade (0–100). */
const fill = (role, opacity = 100) => ({ fill: { role, opacity } });
const stroke = (role, width, opacity = 100) => ({ stroke: { role, width, opacity } });
const rect = (x, y, w, h, r) => ({ kind: 'rect', x, y, w, h, r });
const circle = (cx, cy, r) => ({ kind: 'ellipse', cx, cy, rx: r, ry: r });

/** Camada: desenhos de baixo para cima, girando e escalando em torno de `pivot`. */
const layer = (name, pivot, draws, motion = {}) => ({ name, pivot, draws, ...motion });
const draw = (shapes, paint, trim) => ({ shapes: Array.isArray(shapes) ? shapes : [shapes], ...paint, trim });

const card = (x, y, w, h, r = 18) => [draw(rect(x, y, w, h, r), { ...fill('surface'), ...stroke('border', 1.2) })];
/** Linha de texto em esqueleto: a forma do texto, sem letras. */
const bar = (x, y, w, h = 6, role = 'textFaint', opacity = 40) => draw(rect(x, y, w, h, h / 2), fill(role, opacity));
const icon = (name, cx, cy, size, role, weight = 2) =>
  draw(place(lucide(name), size / 24, cx - size / 2, cy - size / 2), stroke(role, weight * (size / 24)));
/** Ícone em quadrado arredondado com o fundo suave da mesma cor, como nos cartões do app. */
const tile = (name, cx, cy, size, role) => [
  draw(rect(cx - size / 2, cy - size / 2, size, size, size * 0.3), fill(role, 14)),
  icon(name, cx, cy, size * 0.56, role),
];
const text = (value, x, y, size, role, weight = 'bold', align = 'left') => {
  const { shapes, transform } = textShapes(value, x, y, size, weight, align);
  return { ...draw(shapes, fill(role)), transform };
};
/** Chip com ícone e rótulo; `right` alinha a borda direita. Devolve os desenhos e a caixa. */
function chip({ label, iconName, role, x, y, right = false, size = 10, height = 20, barWidth = 0 }) {
  const iconSize = iconName ? size + 2 : 0;
  const labelWidth = label ? textWidth(label, size, 'semibold') : barWidth;
  const width = 16 + iconSize + (iconName && labelWidth ? 4 : 0) + labelWidth;
  const left = right ? x - width : x;
  const draws = [draw(rect(left, y, width, height, height / 2), fill(role, 14))];
  if (iconName) draws.push(icon(iconName, left + 8 + iconSize / 2, y + height / 2, iconSize, role, 2.2));
  // Rótulo em `text`: a cor do chip sobre o fundo suave dela não chega a 4,5:1 no tema claro.
  if (label) draws.push(text(label, left + 8 + iconSize + (iconName ? 4 : 0), y + height / 2 + size * 0.36, size, 'text', 'semibold'));
  else if (barWidth) draws.push(bar(left + 8 + iconSize + (iconName ? 4 : 0), y + height / 2 - 2.5, barWidth, 5, role, 60));
  return { draws, box: { x: left, y, width, height, cx: left + width / 2, cy: y + height / 2 } };
}

// ─── Cenas ──────────────────────────────────────────────────────────────────────────────────
// Ilustrações: 240×180. Estados (sucesso, aguardando, leitura): 200×200.
// O cartão principal entra primeiro; o conteúdo vem em seguida, escalonado.

const CARD = { x: 20, y: 16, w: 200, h: 148 };
const cardLayer = () => layer('card', [120, 90], card(CARD.x, CARD.y, CARD.w, CARD.h), {
  opacity: keys([0, 0, 'out'], [16, 100]),
  scale: keys([0, 96, 'out'], [30, 100]),
});
/** Cabeçalho de cartão: ícone, título e subtítulo em esqueleto. */
const header = (iconName, role, start = 8, titleWidth = 76) => layer('header', [46, 44], [
  ...tile(iconName, 46, 44, 32, role),
  bar(70, 35, titleWidth, 7, 'textFaint', 55),
  bar(70, 47, titleWidth * 0.62, 5, 'textFaint', 30),
], rise(start, 6));

function farm() {
  const pastures = [
    { points: [[44, 76], [102, 72], [108, 106], [48, 112]], role: 'success', opacity: 22 },
    { points: [[114, 72], [196, 78], [190, 104], [116, 108]], role: 'success', opacity: 34 },
    { points: [[50, 120], [118, 114], [196, 110], [198, 148], [52, 148]], role: 'success', opacity: 16 },
  ];
  const outline = (points) => parsePath(`M${points.map((p) => p.join(' ')).join('L')}Z`).map((sub) => ({ kind: 'path', ...sub }));
  const pin = layer('pin', [154, 100], [
    draw({ kind: 'ellipse', cx: 154, cy: 101, rx: 7, ry: 2.4 }, fill('text', 18)),
    draw(circle(154, 87, 6), fill('surface')),
    icon('map-pin', 154, 89, 24, 'warning', 2.2),
  ], {
    opacity: keys([92, 0, 'out'], [100, 100]),
    move: keys([92, [0, -16], 'pop'], [118, [0, 0]]),
  });
  const done = chip({ label: '3', iconName: 'fence', role: 'success', x: 204, y: 34, right: true });
  return {
    size: [240, 180],
    frames: 140,
    layers: [
      cardLayer(),
      header('house', 'accent', 8, 64),
      layer('map', [120, 110], [draw(rect(36, 66, 168, 88, 12), fill('accentSoft'))], fade(16)),
      ...pastures.flatMap(({ points, role, opacity }, k) => [
        layer(`area${k}`, [120, 110], [draw(outline(points), fill(role, opacity))], fade(52 + k * 14, 24)),
        layer(`edge${k}`, [120, 110], [draw(outline(points), stroke(role, 1.6), { end: keys([30 + k * 14, 0, 'inOut'], [66 + k * 14, 100]) })]),
      ]),
      pin,
      layer('done', [done.box.cx, done.box.cy], done.draws, pop(112)),
    ],
  };
}

function herd() {
  const lots = [
    { dot: 'accent', name: 52, heads: 30 },
    { dot: 'warning', name: 44, heads: 26 },
    { dot: 'success', name: 58, heads: 24 },
  ];
  const total = chip({ label: '100', iconName: 'beef', role: 'accent', x: 204, y: 34, right: true });
  return {
    size: [240, 180],
    frames: 130,
    layers: [
      cardLayer(),
      header('beef', 'accent', 8, 56),
      ...lots.map((lot, k) => {
        const y = 82 + k * 30;
        return layer(`lot${k}`, [120, y], [
          ...(k > 0 ? [draw(rect(36, y - 15, 168, 1, 0.5), fill('border'))] : []),
          draw(circle(44, y, 4.5), fill(lot.dot)),
          bar(56, y - 6, lot.name, 6, 'textFaint', 50),
          bar(56, y + 3, lot.name * 0.6, 4, 'textFaint', 28),
          bar(204 - lot.heads, y - 4, lot.heads, 8, 'text', 65),
        ], rise(26 + k * 14));
      }),
      layer('total', [total.box.cx, total.box.cy], total.draws, pop(82)),
    ],
  };
}

function sale() {
  const share = 142.7 / 186.4;
  const track = { x: 36, y: 104, w: 168, h: 10 };
  return {
    size: [240, 180],
    frames: 140,
    layers: [
      cardLayer(),
      header('hand-coins', 'accent', 8, 70),
      layer('sold', [120, 76], [bar(36, 73, 34, 6, 'textFaint', 40), bar(150, 72, 54, 8, 'text', 55)], rise(22)),
      layer('costs', [120, 90], [bar(36, 87, 42, 6, 'textFaint', 40), bar(158, 86, 46, 8, 'text', 55)], rise(32)),
      layer('track', [120, 109], [draw(rect(track.x, track.y, track.w, track.h, 5), fill('fill'))], fade(40)),
      layer('track-costs', [track.x, 109], [draw(rect(track.x, track.y, track.w * share, track.h, 5), fill('textFaint', 45))], grow(46, 'x', 34)),
      layer('track-profit', [track.x + track.w * share, 109], [draw(rect(track.x + track.w * share + 2, track.y, track.w * (1 - share) - 2, track.h, 5), fill('accent'))], grow(76, 'x', 26)),
      layer('result', [120, 140], [
        draw(rect(36, 124, 168, 1, 0.5), fill('border')),
        bar(36, 139, 34, 7, 'textFaint', 55),
      ], rise(88)),
      layer('profit', [170, 141], [text('+R$ 43.700', 204, 148, 18, 'success', 'bold', 'right')], pop(96, 30)),
    ],
  };
}

function expense() {
  const parcels = [
    { label: 28, paid: true },
    { label: 34, paid: false },
    { label: 30, paid: false },
  ];
  return {
    size: [240, 180],
    frames: 140,
    layers: [
      cardLayer(),
      header('badge-dollar-sign', 'warning', 8, 60),
      layer('amount', [80, 86], [bar(36, 68, 40, 5, 'textFaint', 35), text('R$ 3.600', 36, 96, 22, 'text')], rise(20)),
      ...parcels.map((parcel, k) => {
        const y = 116 + k * 16;
        return layer(`parcel${k}`, [120, y], [
          draw(circle(41, y, 4), parcel.paid ? fill('success') : fill('textFaint', 45)),
          bar(52, y - 3, parcel.label, 6, 'textFaint', 45),
          bar(166, y - 3, 38, 6, parcel.paid ? 'success' : 'textFaint', parcel.paid ? 70 : 45),
        ], rise(44 + k * 12, 6));
      }),
    ],
  };
}

function weighing() {
  const weights = [214, 220, 223, 229, 232, 236];
  const points = weights.map((kg, k) => [40 + k * 32.8, 150 - ((kg - 210) / 30) * 34]);
  const line = parsePath(`M${points.map((p) => p.join(' ')).join('L')}`).map((sub) => ({ kind: 'path', ...sub }));
  const area = parsePath(`M${points.map((p) => p.join(' ')).join('L')}L${points.at(-1)[0]} 152L40 152Z`).map((sub) => ({ kind: 'path', ...sub }));
  const last = points.at(-1);
  const gain = chip({ label: '+18', iconName: 'trending-up', role: 'success', x: 204, y: 78, right: true });
  return {
    size: [240, 180],
    frames: 140,
    layers: [
      cardLayer(),
      header('scale', 'accent', 8, 60),
      layer('weight', [80, 88], [bar(36, 70, 46, 5, 'textFaint', 35), text('236 kg', 36, 98, 22, 'text')], rise(18)),
      layer('area', [120, 140], [draw(area, fill('accent', 10))], fade(70, 30)),
      layer('line', [120, 140], [draw(line, stroke('accent', 2.6), { end: keys([30, 0, 'inOut'], [86, 100]) })]),
      layer('dot', last, [draw(circle(last[0], last[1], 5.5), { ...fill('accent'), ...stroke('surface', 2.4) })], pop(84, 22)),
      layer('gain', [gain.box.cx, gain.box.cy], gain.draws, pop(96)),
    ],
  };
}

function invoice() {
  const doc = { x: 30, y: 22, w: 78, h: 136 };
  const lines = [[40, 30], [40, 50], [40, 42], [40, 54], [40, 36], [40, 46]];
  const extracted = [{ y: 92, w: 44 }, { y: 108, w: 52 }, { y: 124, w: 38 }];
  return {
    size: [240, 180],
    frames: 150,
    layers: [
      layer('doc', [69, 90], card(doc.x, doc.y, doc.w, doc.h, 12), {
        opacity: keys([0, 0, 'out'], [14, 100]),
        move: keys([0, [0, 8], 'out'], [26, [0, 0]]),
      }),
      layer('doc-lines', [69, 90], [
        bar(40, 34, 30, 6, 'accent', 80),
        ...lines.map(([x, w], k) => bar(x, 52 + k * 14, w, 5, 'textFaint', 35)),
        draw(rect(40, 140, 58, 1, 0.5), fill('border')),
        bar(40, 146, 22, 5, 'textFaint', 50),
        bar(76, 145, 22, 7, 'text', 70),
      ], fade(10)),
      layer('beam', [69, 0], [
        draw(rect(26, 26, 86, 14, 4), fill('accent', 14)),
        draw(rect(26, 39, 86, 2.4, 1.2), fill('accent')),
      ], {
        opacity: keys([18, 0, 'out'], [24, 100], [70, 100, 'out'], [80, 0]),
        move: keys([18, [0, 0], 'inOut'], [76, [0, 112]]),
      }),
      layer('result', [170, 100], card(120, 46, 98, 98, 16), {
        opacity: keys([60, 0, 'out'], [72, 100]),
        move: keys([60, [-10, 0], 'out'], [86, [0, 0]]),
      }),
      layer('amount', [150, 70], [bar(132, 60, 30, 5, 'textFaint', 35), bar(132, 69, 56, 9, 'text', 70)], rise(70, 6)),
      ...extracted.map(({ y, w }, k) => layer(`field${k}`, [150, y], [
        draw(circle(137, y, 6), fill('success', 16)),
        icon('check', 137, y, 8, 'success', 3),
        bar(148, y - 3, w, 6, 'textFaint', 45),
      ], rise(84 + k * 12, 6))),
      layer('ai', [212, 48], tile('sparkles', 212, 48, 26, 'warning').map((d, k) => (k === 0 ? { ...d, fill: { role: 'warning', opacity: 100 } } : { ...d, stroke: { ...d.stroke, role: 'onAccent' } })), pop(118)),
    ],
  };
}

function loss() {
  const registered = chip({ iconName: 'check', role: 'textMuted', x: 36, y: 122, barWidth: 64 });
  return {
    size: [240, 180],
    frames: 150,
    layers: [
      cardLayer(),
      header('heart-pulse', 'textMuted', 8, 66),
      layer('label', [80, 72], [bar(36, 70, 52, 5, 'textFaint', 35)], fade(18)),
      layer('unit', [80, 92], [bar(72, 92, 34, 7, 'textFaint', 45)], fade(24)),
      layer('before', [50, 92], [text('40', 36, 100, 26, 'text')], {
        opacity: keys([18, 0, 'out'], [30, 100], [54, 100, 'inOut'], [72, 0]),
        move: keys([54, [0, 0], 'inOut'], [76, [0, -10]]),
      }),
      layer('after', [50, 92], [text('39', 36, 100, 26, 'text')], {
        opacity: keys([64, 0, 'out'], [84, 100]),
        move: keys([64, [0, 10], 'out'], [92, [0, 0]]),
      }),
      layer('registered', [registered.box.cx, registered.box.cy], registered.draws, rise(100, 6, 30)),
    ],
  };
}

function team() {
  const avatar = (cx, role, initials) => [
    draw(circle(cx, 92, 19), { ...fill(role), ...stroke('surface', 3) }),
    text(initials, cx, 96.5, 12, 'onAccent', 'bold', 'center'),
  ];
  const sent = chip({ iconName: 'send', role: 'success', x: 36, y: 128, barWidth: 70 });
  return {
    size: [240, 180],
    frames: 140,
    layers: [
      cardLayer(),
      header('users', 'accent', 8, 64),
      layer('first', [56, 92], avatar(56, 'accent', 'JP'), pop(24)),
      layer('second', [90, 92], avatar(90, 'info', 'AS'), pop(36)),
      layer('invite', [124, 92], [
        draw(circle(124, 92, 19), { ...fill('accentSoft'), ...stroke('surface', 3) }),
        icon('user-plus', 125, 92, 18, 'accent', 2.2),
      ], pop(50)),
      layer('roles', [176, 92], [bar(152, 84, 50, 6, 'textFaint', 50), bar(152, 95, 34, 5, 'textFaint', 30)], rise(58, 6)),
      layer('sent', [sent.box.cx, sent.box.cy], sent.draws, pop(86, 28)),
    ],
  };
}

function success() {
  const sparks = Array.from({ length: 6 }, (_, k) => {
    const angle = (k / 6) * Math.PI * 2 - Math.PI / 2 + Math.PI / 6;
    return { x: 100 + Math.cos(angle) * 82, y: 100 + Math.sin(angle) * 82, dx: Math.cos(angle) * 12, dy: Math.sin(angle) * 12 };
  });
  const check = parsePath('M80 101L94 115L122 86').map((sub) => ({ kind: 'path', ...sub }));
  return {
    size: [200, 200],
    frames: 96,
    layers: [
      layer('halo', [100, 100], [draw(circle(100, 100, 66), fill('success', 12))], { ...pop(0, 30) }),
      layer('ring', [100, 100], [draw(circle(100, 100, 66), stroke('success', 4, 35), { end: keys([4, 0, 'inOut'], [40, 100]) })]),
      layer('disc', [100, 100], [draw(circle(100, 100, 46), fill('success'))], pop(14, 26)),
      layer('check', [100, 100], [draw(check, stroke('surface', 9), { end: keys([30, 0, 'out'], [54, 100]) })]),
      ...sparks.map((spark, k) => layer(`spark${k}`, [spark.x, spark.y], [draw(circle(spark.x, spark.y, 4), fill(k % 2 ? 'highlight' : 'success'))], {
        opacity: keys([40, 0, 'out'], [48, 100], [62, 100, 'inOut'], [80, 0]),
        move: keys([40, [-spark.dx, -spark.dy], 'out'], [80, [0, 0]]),
        scale: keys([40, 40, 'out'], [52, 100], [62, 100, 'inOut'], [80, 50]),
      })),
    ],
  };
}

function pending() {
  return {
    size: [200, 200],
    frames: 120,
    loop: true,
    poster: 0,
    layers: [
      layer('track', [100, 100], [draw(circle(100, 100, 62), stroke('textFaint', 6, 22))]),
      layer('arc', [100, 100], [draw(circle(100, 100, 62), stroke('accent', 6), { end: 28, offset: keys([0, 0, 'linear'], [120, 360]) })]),
      layer('disc', [100, 100], [draw(circle(100, 100, 44), fill('accent', 12))]),
      layer('icon', [100, 100], [icon('cloud-upload', 100, 100, 44, 'accent', 2)], {
        move: keys([0, [0, 0], 'inOut'], [60, [0, -4], 'inOut'], [120, [0, 0]]),
      }),
    ],
  };
}

function scan() {
  const lines = [[64, 52], [64, 66], [64, 44], [64, 60], [64, 38]];
  return {
    size: [200, 200],
    frames: 120,
    loop: true,
    poster: 36,
    layers: [
      layer('doc', [100, 100], [
        ...card(54, 30, 92, 140, 14),
        bar(66, 46, 34, 7, 'accent', 80),
        ...lines.map(([x, w], k) => bar(x, 66 + k * 15, w, 5, 'textFaint', 35)),
        draw(rect(66, 146, 68, 1, 0.5), fill('border')),
        bar(66, 153, 24, 5, 'textFaint', 50),
        bar(110, 152, 24, 7, 'text', 70),
      ]),
      layer('beam', [100, 0], [
        draw(rect(58, 36, 84, 16, 4), fill('accent', 14)),
        draw(rect(58, 51, 84, 3, 1.5), fill('accent')),
      ], { move: keys([0, [0, 0], 'inOut'], [60, [0, 106], 'inOut'], [120, [0, 0]]) }),
      layer('ai', [146, 32], tile('sparkles', 146, 32, 30, 'warning').map((d, k) => (k === 0 ? { ...d, fill: { role: 'warning', opacity: 100 } } : { ...d, stroke: { ...d.stroke, role: 'onAccent' } })), {
        scale: keys([0, 100, 'inOut'], [30, 110, 'inOut'], [60, 100, 'inOut'], [90, 110, 'inOut'], [120, 100]),
      }),
    ],
  };
}

const SCENES = { success, pending, scan, farm, herd, sale, expense, weighing, invoice, loss, team };

// ─── Saída Lottie ───────────────────────────────────────────────────────────────────────────

const roundDeep = (value) => (Array.isArray(value) ? value.map(roundDeep) : typeof value === 'number' ? round(value) : value);

/** Propriedade Lottie; `map` converte o valor do modelo no formato da propriedade. */
function prop(value, map = (v) => v) {
  if (!animated(value)) return { a: 0, k: roundDeep(map(value)) };
  const list = value.keys;
  return {
    a: 1,
    k: list.map(([frame, v, ease = 'out'], k) => {
      const item = { t: frame, s: roundDeep([map(v)].flat()) };
      if (k < list.length - 1) {
        const [x1, y1, x2, y2] = EASE[ease];
        item.o = { x: x1, y: y1 };
        item.i = { x: x2, y: y2 };
      }
      return item;
    }),
  };
}

function lottieShape(shape) {
  if (shape.kind === 'rect') return { ty: 'rc', d: 1, p: prop([shape.x + shape.w / 2, shape.y + shape.h / 2]), s: prop([shape.w, shape.h]), r: prop(shape.r) };
  if (shape.kind === 'ellipse') return { ty: 'el', d: 1, p: prop([shape.cx, shape.cy]), s: prop([shape.rx * 2, shape.ry * 2]) };
  return { ty: 'sh', ks: { a: 0, k: { c: shape.c, v: roundDeep(shape.v), i: roundDeep(shape.i), o: roundDeep(shape.o) } } };
}

const TRANSFORM = { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } };

function lottieDraw(item) {
  const it = item.shapes.map(lottieShape);
  if (item.trim) it.push({ ty: 'tm', s: prop(item.trim.start ?? 0), e: prop(item.trim.end ?? 100), o: prop(item.trim.offset ?? 0), m: 1 });
  if (item.stroke) it.push({ ty: 'st', nm: `color:${item.stroke.role}`, c: { a: 0, k: [0, 0, 0, 1] }, o: prop(item.stroke.opacity), w: prop(item.stroke.width), lc: 2, lj: 2 });
  if (item.fill) it.push({ ty: 'fl', nm: `color:${item.fill.role}`, c: { a: 0, k: [0, 0, 0, 1] }, o: prop(item.fill.opacity), r: 1 });
  const tr = item.transform
    ? { ...TRANSFORM, p: prop([item.transform.x, item.transform.y]), s: { a: 0, k: [round(item.transform.scale * 1000) / 10, round(item.transform.scale * 1000) / 10] } }
    : TRANSFORM;
  return { ty: 'gr', it: [...it, tr] };
}

function lottie(name, scene) {
  const [w, h] = scene.size;
  const layers = scene.layers.map((item, index) => {
    const [px, py] = item.pivot;
    const position = item.move ? { keys: item.move.keys.map(([f, [dx, dy], e]) => [f, [px + dx, py + dy, 0], e]) } : [px, py, 0];
    const toScale = (v) => (Array.isArray(v) ? [v[0], v[1], 100] : [v, v, 100]);
    const scale = item.scale === undefined ? [100, 100, 100]
      : animated(item.scale) ? { keys: item.scale.keys.map(([f, v, e]) => [f, toScale(v), e]) }
        : toScale(item.scale);
    return {
      ddd: 0, ind: index + 1, ty: 4, nm: item.name, sr: 1,
      ks: { o: prop(item.opacity ?? 100), r: prop(item.rotation ?? 0), p: prop(position), a: prop([px, py, 0]), s: prop(scale) },
      shapes: [...item.draws].reverse().map(lottieDraw),
      ip: 0, op: scene.frames, st: 0, bm: 0,
    };
  });
  // No Lottie a primeira camada fica por cima; o modelo lista de baixo para cima.
  return { v: '5.7.4', fr: FPS, ip: 0, op: scene.frames, w, h, nm: `AgroGest / ${name}`, ddd: 0, assets: [], layers: layers.reverse() };
}

// ─── Pôster SVG (quadro final ou o quadro `poster` das cenas que repetem) ────────────────────

const svgNumber = (value) => String(round(value));

function svgPath(shape) {
  const point = ([x, y]) => `${svgNumber(x)} ${svgNumber(y)}`;
  let d = `M${point(shape.v[0])}`;
  const count = shape.v.length + (shape.c ? 1 : 0);
  for (let k = 1; k < count; k += 1) {
    const prev = (k - 1) % shape.v.length, curr = k % shape.v.length;
    const [ax, ay] = shape.v[prev], [bx, by] = shape.v[curr];
    const [ox, oy] = shape.o[prev], [ix, iy] = shape.i[curr];
    d += ox || oy || ix || iy ? `C${point([ax + ox, ay + oy])} ${point([bx + ix, by + iy])} ${point([bx, by])}` : `L${point([bx, by])}`;
  }
  return shape.c ? `${d}Z` : d;
}

/** Arco de elipse do traço parcial (o pôster não depende de pathLength no leitor de SVG). */
function svgArc(shape, start, end, offset) {
  const from = ((start / 100) * 360 + offset - 90) * (Math.PI / 180);
  const to = ((end / 100) * 360 + offset - 90) * (Math.PI / 180);
  const p = (t) => `${svgNumber(shape.cx + shape.rx * Math.cos(t))} ${svgNumber(shape.cy + shape.ry * Math.sin(t))}`;
  return `<path d="M${p(from)}A${svgNumber(shape.rx)} ${svgNumber(shape.ry)} 0 ${to - from > Math.PI ? 1 : 0} 1 ${p(to)}"`;
}

function svgDraw(item, frame) {
  const paint = [];
  if (item.fill) paint.push(`fill="$${item.fill.role}"`, ...(item.fill.opacity < 100 ? [`fill-opacity="${item.fill.opacity / 100}"`] : []));
  else paint.push('fill="none"');
  if (item.stroke) {
    paint.push(`stroke="$${item.stroke.role}" stroke-width="${svgNumber(item.stroke.width)}" stroke-linecap="round" stroke-linejoin="round"`);
    if (item.stroke.opacity < 100) paint.push(`stroke-opacity="${item.stroke.opacity / 100}"`);
  }
  const attrs = paint.join(' ');
  const start = at(item.trim?.start ?? 0, frame), end = at(item.trim?.end ?? 100, frame), offset = at(item.trim?.offset ?? 0, frame);
  if (end - start <= 0) return '';
  const partial = end - start < 100;
  const paths = item.shapes.filter((s) => s.kind === 'path');
  const out = [];
  for (const shape of item.shapes) {
    if (shape.kind === 'rect') out.push(`<rect x="${svgNumber(shape.x)}" y="${svgNumber(shape.y)}" width="${svgNumber(shape.w)}" height="${svgNumber(shape.h)}" rx="${svgNumber(shape.r)}" ${attrs}/>`);
    if (shape.kind === 'ellipse') {
      out.push(partial ? `${svgArc(shape, start, end, offset)} ${attrs}/>` : `<ellipse cx="${svgNumber(shape.cx)}" cy="${svgNumber(shape.cy)}" rx="${svgNumber(shape.rx)}" ry="${svgNumber(shape.ry)}" ${attrs}/>`);
    }
  }
  if (paths.length) {
    if (partial) throw new Error('Pôster com traço parcial em caminho: escolha outro quadro');
    const t = item.transform;
    out.push(`<path${t ? ` transform="translate(${svgNumber(t.x)} ${svgNumber(t.y)}) scale(${t.scale})"` : ''} d="${paths.map(svgPath).join('')}" ${attrs}/>`);
  }
  return out.join('');
}

function poster(scene) {
  const frame = scene.poster ?? scene.frames;
  const [w, h] = scene.size;
  const body = scene.layers.map((item) => {
    const opacity = at(item.opacity ?? 100, frame) / 100;
    if (opacity <= 0) return '';
    const [px, py] = item.pivot;
    const [dx, dy] = item.move ? at(item.move, frame) : [0, 0];
    const raw = item.scale === undefined ? 100 : at(item.scale, frame);
    const [sx, sy] = Array.isArray(raw) ? raw : [raw, raw];
    const moved = dx || dy ? `translate(${svgNumber(dx)} ${svgNumber(dy)})` : '';
    const scaled = sx !== 100 || sy !== 100 ? `translate(${px} ${py}) scale(${sx / 100} ${sy / 100}) translate(${-px} ${-py})` : '';
    const transform = `${moved} ${scaled}`.trim();
    const attrs = [transform ? `transform="${transform}"` : '', opacity < 1 ? `opacity="${round(opacity)}"` : ''].filter(Boolean).join(' ');
    const content = item.draws.map((d) => svgDraw(d, frame)).join('');
    return attrs ? `<g ${attrs}>${content}</g>` : content;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

// ─── Contraste nos dois temas ───────────────────────────────────────────────────────────────

/** Tokens de src/theme.ts: o bloco `const light = {` e o `const dark: Palette = {`. */
function palettes() {
  const source = readFileSync(join(ROOT, 'src', 'theme.ts'), 'utf8');
  const read = (marker) => {
    const start = source.indexOf(marker);
    const body = source.slice(start, source.indexOf('\n};', start));
    return Object.fromEntries([...body.matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]));
  };
  return { light: read('const light = {'), dark: read('const dark: Palette = {') };
}

const channel = (hex, k) => parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16) / 255;
const luminance = (hex) => {
  const [r, g, b] = [0, 1, 2].map((k) => channel(hex, k)).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const blend = (top, bottom, alpha) => `#${[0, 1, 2].map((k) => Math.round((channel(top, k) * alpha + channel(bottom, k) * (1 - alpha)) * 255).toString(16).padStart(2, '0')).join('')}`;
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/**
 * Pares de primeiro plano e fundo usados nas cenas. Números: 4,5:1 (texto). Ícones, traços e chips:
 * 3:1 (elementos gráficos, WCAG 1.4.11). Fundo "x@14" é o token x a 14% sobre o cartão.
 */
const PAIRS = [
  ['text', 'surface', 4.5], ['text', 'success@14', 4.5], ['text', 'accent@14', 4.5], ['success', 'surface', 4.5],
  ['onAccent', 'accent', 4.5], ['onAccent', 'info', 4.5],
  ['success', 'success@14', 3], ['accent', 'accent@14', 3], ['warning', 'warning@14', 3], ['textMuted', 'textMuted@14', 3],
  ['accent', 'surface', 3], ['warning', 'surface', 3], ['onAccent', 'warning', 3], ['surface', 'success', 3], ['accent', 'accentSoft', 3],
];

function checkContrast() {
  const failures = [];
  for (const [scheme, p] of Object.entries(palettes())) {
    const color = (role) => {
      const [token, alpha] = role.split('@');
      return alpha ? blend(p[token], p.surface, Number(alpha) / 100) : p[token];
    };
    for (const [fg, bg, min] of PAIRS) {
      const value = ratio(color(fg), color(bg));
      if (value < min) failures.push(`${scheme}: ${fg} sobre ${bg} = ${value.toFixed(2)}:1 (mínimo ${min}:1)`);
    }
  }
  return failures;
}

// ─── Geração ────────────────────────────────────────────────────────────────────────────────

mkdirSync(join(OUT, 'posters'), { recursive: true });
let failed = false;
for (const [name, factory] of Object.entries(SCENES)) {
  const scene = factory();
  const json = JSON.stringify(lottie(name, scene));
  writeFileSync(join(OUT, `${name}.json`), json);
  // Um pôster por arquivo: o app só carrega o da cena que mostra.
  const svg = JSON.stringify(poster(scene));
  writeFileSync(join(OUT, 'posters', `${name}.json`), svg);
  const bytes = Buffer.byteLength(json);
  if (bytes > MAX_BYTES) failed = true;
  console.log(`${name.padEnd(9)} ${String(bytes).padStart(6)} bytes  pôster ${String(Buffer.byteLength(svg)).padStart(5)} bytes  ${(scene.frames / FPS).toFixed(2)} s${scene.loop ? ' (repete)' : ''}${bytes > MAX_BYTES ? '  ACIMA DO LIMITE' : ''}`);
}
const contrast = checkContrast();
for (const failure of contrast) console.error(`Contraste insuficiente: ${failure}`);
if (failed) console.error(`Cada cena precisa ficar abaixo de ${MAX_BYTES} bytes.`);
if (failed || contrast.length) process.exit(1);
console.log(`Contraste ok nos temas claro e escuro (${PAIRS.length} pares).`);
