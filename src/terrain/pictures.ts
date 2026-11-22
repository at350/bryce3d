/**
 * Pictures: grayscale images as heightmaps. Pure helpers (no DOM): RGBA -> heights, blend
 * modes, and procedural "picture" patterns that can be blended into a terrain and recorded
 * in a recipe (the 'picture' op).
 */
import { gridCoords } from './genShared';
import { clamp01, smoothstep } from './grid';
import type { ParamSpec, Params } from './params';

/** Luminance of RGBA pixels (alpha composites over black) as heights 0..1. */
export function rgbaToHeights(data: ArrayLike<number>, pixelCount: number, invert = false): Float32Array {
  const out = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const lum = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    const v = lum * (data[o + 3] / 255);
    out[i] = invert ? 1 - v : v;
  }
  return out;
}

export const BLEND_MODES = [
  { code: 0, id: 'mix', label: 'Mix', hint: 'Cross-fade from the terrain to the picture' },
  { code: 1, id: 'add', label: 'Add', hint: 'Raise the terrain by the picture' },
  { code: 2, id: 'subtract', label: 'Subtract', hint: 'Carve the picture into the terrain' },
  { code: 3, id: 'max', label: 'Lighten', hint: 'Keep the higher of terrain and picture' },
  { code: 4, id: 'min', label: 'Darken', hint: 'Keep the lower of terrain and picture' },
  { code: 5, id: 'multiply', label: 'Multiply', hint: 'Mask the terrain with the picture' },
  { code: 6, id: 'average', label: 'Average', hint: 'Average of terrain and picture' },
] as const;

/** Combine a picture with the terrain; amount fades the result in (0 = terrain unchanged). */
export function blendHeights(base: Float32Array, pic: Float32Array, mode: number, amount = 1): Float32Array {
  const out = new Float32Array(base.length);
  const a = clamp01(amount);
  const m = Math.round(mode);
  for (let i = 0; i < base.length; i++) {
    const b = base[i];
    const p = pic[i];
    let r: number;
    switch (m) {
      case 1: r = b + p * 0.5; break;
      case 2: r = b - p * 0.5; break;
      case 3: r = b > p ? b : p; break;
      case 4: r = b < p ? b : p; break;
      case 5: r = b * p; break;
      case 6: r = (b + p) * 0.5; break;
      default: r = p;
    }
    out[i] = clamp01(b + (r - b) * a);
  }
  return out;
}

export interface PatternDef {
  id: string;
  code: number;
  label: string;
  hint: string;
  params: ParamSpec[];
  /** Height at normalized coordinates u, v in -1..1. */
  at(u: number, v: number, p: Params): number;
}

const size = (d = 0.8): ParamSpec => ({ key: 'size', label: 'Size', min: 0.1, max: 1.5, default: d, precision: 2, hint: 'Size of the shape' });

export const PATTERNS: PatternDef[] = [
  {
    id: 'dome', code: 1, label: 'Dome', hint: 'A smooth half-sphere', params: [size(0.8)],
    at: (u, v, p) => {
      const r = Math.sqrt(u * u + v * v) / p.size;
      return r < 1 ? Math.sqrt(1 - r * r) : 0;
    },
  },
  {
    id: 'pyramid', code: 2, label: 'Pyramid', hint: 'A four-sided pyramid', params: [size(0.85)],
    at: (u, v, p) => clamp01(1 - Math.max(Math.abs(u), Math.abs(v)) / p.size),
  },
  {
    id: 'cone', code: 3, label: 'Cone', hint: 'A pointed cone', params: [size(0.85)],
    at: (u, v, p) => clamp01(1 - Math.sqrt(u * u + v * v) / p.size),
  },
  {
    id: 'ripples', code: 4, label: 'Ripples', hint: 'Concentric ripples, like a drop in a pond',
    params: [size(1), { key: 'rings', label: 'Rings', min: 1, max: 20, default: 6, step: 1, hint: 'Number of rings' }],
    at: (u, v, p) => {
      const r = Math.sqrt(u * u + v * v) / p.size;
      if (r >= 1) return 0;
      return (0.5 + 0.5 * Math.cos(r * p.rings * Math.PI * 2)) * (1 - r);
    },
  },
  {
    id: 'star', code: 5, label: 'Star', hint: 'A star-shaped plateau',
    params: [size(0.9), { key: 'points', label: 'Points', min: 3, max: 12, default: 5, step: 1, hint: 'Number of points' }],
    at: (u, v, p) => {
      const r = Math.sqrt(u * u + v * v);
      const a = Math.atan2(v, u);
      const edge = p.size * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos((a * p.points) / 2)), 3));
      return smoothstep(edge, edge * 0.82, r);
    },
  },
  {
    id: 'spiral', code: 6, label: 'Spiral', hint: 'A spiral ridge winding out from the center',
    params: [size(1), { key: 'arms', label: 'Arms', min: 1, max: 6, default: 2, step: 1, hint: 'Spiral arms' }],
    at: (u, v, p) => {
      const r = Math.sqrt(u * u + v * v) / p.size;
      if (r >= 1) return 0;
      const a = Math.atan2(v, u);
      return (0.5 + 0.5 * Math.sin(a * p.arms + r * 18)) * (1 - r * 0.6) * smoothstep(1, 0.85, r);
    },
  },
  {
    id: 'waves', code: 7, label: 'Waves', hint: 'Parallel rolling waves',
    params: [{ key: 'count', label: 'Waves', min: 1, max: 24, default: 6, step: 1, hint: 'Number of waves' }, { key: 'angle', label: 'Angle', min: 0, max: 180, default: 0, step: 1, hint: 'Wave direction' }],
    at: (u, v, p) => {
      const a = (p.angle * Math.PI) / 180;
      const s = u * Math.cos(a) + v * Math.sin(a);
      return 0.5 + 0.5 * Math.sin(s * p.count * Math.PI);
    },
  },
  {
    id: 'checker', code: 8, label: 'Checker', hint: 'Checkerboard blocks (instant city)',
    params: [{ key: 'count', label: 'Squares', min: 2, max: 32, default: 8, step: 1, hint: 'Squares across' }],
    at: (u, v, p) => {
      const k = p.count / 2;
      return (Math.floor((u + 1) * k) + Math.floor((v + 1) * k)) % 2 === 0 ? 1 : 0.2;
    },
  },
  {
    id: 'ramp', code: 9, label: 'Ramp', hint: 'A straight slope from low to high',
    params: [{ key: 'angle', label: 'Angle', min: 0, max: 360, default: 90, step: 1, hint: 'Uphill direction' }],
    at: (u, v, p) => {
      const a = (p.angle * Math.PI) / 180;
      return clamp01((u * Math.cos(a) + v * Math.sin(a)) * 0.5 + 0.5);
    },
  },
  {
    id: 'atoll', code: 10, label: 'Atoll', hint: 'A ring-shaped reef around a lagoon',
    params: [size(0.65), { key: 'width', label: 'Width', min: 0.02, max: 0.5, default: 0.14, precision: 2, hint: 'Ring width' }],
    at: (u, v, p) => {
      const d = (Math.sqrt(u * u + v * v) - p.size) / p.width;
      return Math.exp(-d * d);
    },
  },
  {
    id: 'cross', code: 11, label: 'Cross Ridges', hint: 'Two crossing ridges, canal-like when inverted',
    params: [{ key: 'width', label: 'Width', min: 0.02, max: 0.6, default: 0.18, precision: 2, hint: 'Ridge width' }],
    at: (u, v, p) => Math.max(smoothstep(p.width, 0, Math.abs(u)), smoothstep(p.width, 0, Math.abs(v))),
  },
];

const byId = new Map(PATTERNS.map((p) => [p.id, p]));
const byCode = new Map(PATTERNS.map((p) => [p.code, p]));

export const getPattern = (id: string) => byId.get(id);
export const patternByCode = (code: number) => byCode.get(Math.round(code));

/** Render a pattern into an n x n grid. */
export function renderPattern(def: PatternDef, n: number, params: Params): Float32Array {
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) out[z * n + x] = clamp01(def.at(c[x], c[z], params));
  }
  return out;
}
