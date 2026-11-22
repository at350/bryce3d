/**
 * Filter curves (the Terrain Editor's Filtering tab): a height-remapping graph, input height
 * on x, output height on y. Points are interpolated with a monotone cubic (Fritsch-Carlson),
 * which stays smooth but never overshoots, so plateaus come out flat. A curve is stored in a
 * recipe op as plain numbers: { n, smooth, x0, y0, x1, y1, ... }.
 */
import type { Params } from './params';

export interface CurvePoint {
  x: number;
  y: number;
}

export interface FilterCurve {
  points: CurvePoint[];
  /** false = straight segments (crisp steps and cliffs). */
  smooth: boolean;
}

export const MAX_CURVE_POINTS = 24;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function identityCurve(): FilterCurve {
  return { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], smooth: true };
}

/** Sorted by x, clamped to 0..1, duplicates in x removed (later wins), at least one point. */
export function sanitizeCurve(c: FilterCurve): FilterCurve {
  const pts = c.points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }))
    .sort((a, b) => a.x - b.x);
  const out: CurvePoint[] = [];
  for (const p of pts) {
    if (out.length && Math.abs(out[out.length - 1].x - p.x) < 1e-4) out[out.length - 1] = p;
    else out.push(p);
  }
  if (!out.length) return identityCurve();
  return { points: out.slice(0, MAX_CURVE_POINTS), smooth: c.smooth };
}

/** Fritsch-Carlson tangents for monotone cubic interpolation. */
function tangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k] / d[k];
    const b = m[k + 1] / d[k];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[k] = t * a * d[k];
      m[k + 1] = t * b * d[k];
    }
  }
  return m;
}

/** Lookup table of the curve sampled at `size` evenly spaced inputs. */
export function buildCurveLUT(curve: FilterCurve, size = 1024): Float32Array {
  const c = sanitizeCurve(curve);
  const lut = new Float32Array(size);
  const xs = c.points.map((p) => p.x);
  const ys = c.points.map((p) => p.y);
  const n = xs.length;
  if (n === 1) return lut.fill(ys[0]);
  const m = c.smooth ? tangents(xs, ys) : null;
  let k = 0;
  for (let i = 0; i < size; i++) {
    const x = size > 1 ? i / (size - 1) : 0;
    if (x <= xs[0]) {
      lut[i] = ys[0];
      continue;
    }
    if (x >= xs[n - 1]) {
      lut[i] = ys[n - 1];
      continue;
    }
    while (k < n - 2 && x > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k];
    const t = (x - xs[k]) / h;
    if (!m) {
      lut[i] = ys[k] + (ys[k + 1] - ys[k]) * t;
      continue;
    }
    const t2 = t * t;
    const t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1];
    lut[i] = clamp01(y);
  }
  return lut;
}

/** Remap heights through a LUT (linear interpolation between entries). */
export function applyLUT(h: Float32Array, lut: Float32Array): Float32Array {
  const out = new Float32Array(h.length);
  const last = lut.length - 1;
  for (let i = 0; i < h.length; i++) {
    const f = clamp01(h[i]) * last;
    const j = f | 0;
    const t = f - j;
    out[i] = j >= last ? lut[last] : lut[j] + (lut[j + 1] - lut[j]) * t;
  }
  return out;
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

export function curveToParams(curve: FilterCurve): Params {
  const c = sanitizeCurve(curve);
  const p: Params = { n: c.points.length, smooth: c.smooth ? 1 : 0 };
  c.points.forEach((pt, i) => {
    p[`x${i}`] = r4(pt.x);
    p[`y${i}`] = r4(pt.y);
  });
  return p;
}

export function paramsToCurve(p: Params | undefined): FilterCurve {
  if (!p || !(p.n >= 1)) return identityCurve();
  const points: CurvePoint[] = [];
  const n = Math.min(MAX_CURVE_POINTS, Math.round(p.n));
  for (let i = 0; i < n; i++) {
    const x = p[`x${i}`];
    const y = p[`y${i}`];
    if (typeof x === 'number' && typeof y === 'number') points.push({ x, y });
  }
  return sanitizeCurve({ points, smooth: p.smooth !== 0 });
}

export function isIdentityCurve(curve: FilterCurve): boolean {
  const lut = buildCurveLUT(curve, 64);
  for (let i = 0; i < lut.length; i++) if (Math.abs(lut[i] - i / 63) > 1e-3) return false;
  return true;
}

const pts = (...xy: number[]): CurvePoint[] => {
  const out: CurvePoint[] = [];
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] });
  return out;
};

function stairs(steps: number): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let k = 0; k < steps; k++) {
    const y = k / (steps - 1);
    out.push({ x: k / steps, y }, { x: (k + 0.82) / steps, y });
  }
  return out;
}

export interface CurvePreset {
  id: string;
  label: string;
  hint: string;
  curve: FilterCurve;
}

export const CURVE_PRESETS: CurvePreset[] = [
  { id: 'reset', label: 'Reset', hint: 'Straight diagonal: heights unchanged', curve: identityCurve() },
  { id: 'plateau', label: 'Plateau', hint: 'Rounds the summits off into flat tablelands', curve: { points: pts(0, 0, 0.45, 0.62, 0.64, 0.8, 1, 0.83), smooth: true } },
  { id: 'canyon', label: 'Canyon', hint: 'Low ground drops into steep-walled canyons', curve: { points: pts(0, 0, 0.3, 0.03, 0.42, 0.6, 0.7, 0.75, 1, 0.82), smooth: true } },
  { id: 'mesa', label: 'Mesa', hint: 'Flat floors, sheer cliffs, flat tops', curve: { points: pts(0, 0.03, 0.4, 0.07, 0.48, 0.74, 1, 0.8), smooth: false } },
  { id: 'ridges', label: 'Ridges', hint: 'Folds the middle heights into extra ridgelines', curve: { points: pts(0, 0, 0.32, 0.78, 0.5, 0.42, 0.72, 1, 1, 0.55), smooth: true } },
  { id: 'invert', label: 'Invert', hint: 'Mountains become canyons', curve: { points: pts(0, 1, 1, 0), smooth: true } },
  { id: 'steps', label: 'Steps', hint: 'Hard stair-stepped terraces', curve: { points: stairs(6), smooth: false } },
  { id: 'peaks', label: 'Peaks', hint: 'Sharper peaks over broad, low valleys', curve: { points: pts(0, 0, 0.5, 0.16, 0.8, 0.5, 1, 1), smooth: true } },
  { id: 'rounded', label: 'Rounded', hint: 'Swollen, rounded hills', curve: { points: pts(0, 0, 0.2, 0.42, 0.5, 0.8, 1, 1), smooth: true } },
  { id: 'lagoon', label: 'Lagoon', hint: 'Floods the lowlands flat', curve: { points: pts(0, 0, 0.38, 0, 1, 1), smooth: true } },
  { id: 'sawtooth', label: 'Sawtooth', hint: 'Jagged icebergs and desert scarps', curve: { points: pts(0, 0, 0.33, 0.62, 0.34, 0.22, 0.66, 0.84, 0.67, 0.44, 1, 1), smooth: false } },
];
