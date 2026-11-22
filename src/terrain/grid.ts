/** Grid utilities shared by generators, ops and the editor (pure, allocation-conscious). */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Clamp every value to 0..1 in place (NaN becomes 0). Returns the same array. */
export function clampHeightsInPlace(h: Float32Array): Float32Array {
  for (let i = 0; i < h.length; i++) {
    const v = h[i];
    h[i] = v > 0 ? (v < 1 ? v : 1) : 0;
  }
  return h;
}

/** Min / max / mean of a height array. */
export function heightStats(h: Float32Array): { min: number; max: number; mean: number } {
  let lo = Infinity;
  let hi = -Infinity;
  let sum = 0;
  for (let i = 0; i < h.length; i++) {
    const v = h[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
    sum += v;
  }
  if (!h.length) return { min: 0, max: 0, mean: 0 };
  return { min: lo, max: hi, mean: sum / h.length };
}

/** Rescale in place so values span lo..hi. A flat array becomes lo. */
export function normalizeInPlace(h: Float32Array, lo = 0, hi = 1): Float32Array {
  const s = heightStats(h);
  const span = s.max - s.min;
  if (!(span > 1e-12)) {
    h.fill(lo);
    return h;
  }
  const k = (hi - lo) / span;
  for (let i = 0; i < h.length; i++) h[i] = lo + (h[i] - s.min) * k;
  return h;
}

/** Histogram of 0..1 values. */
export function histogram(h: Float32Array, bins = 128): Uint32Array {
  const out = new Uint32Array(bins);
  const k = bins - 1;
  for (let i = 0; i < h.length; i++) out[Math.round(clamp01(h[i]) * k)]++;
  return out;
}

/** out = a + (b - a) * t (new array unless out is given). */
export function lerpHeights(a: Float32Array, b: Float32Array, t: number, out: Float32Array = new Float32Array(a.length)): Float32Array {
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

const clampi = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** One horizontal + vertical box pass of radius r (edges clamped), O(n^2) for any r. */
function boxPass(src: Float32Array, tmp: Float32Array, dst: Float32Array, n: number, r: number): void {
  const inv = 1 / (2 * r + 1);
  const last = n - 1;
  for (let z = 0; z < n; z++) {
    const row = z * n;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + clampi(k, 0, last)];
    for (let x = 0; x < n; x++) {
      tmp[row + x] = acc * inv;
      acc += src[row + clampi(x + r + 1, 0, last)] - src[row + clampi(x - r, 0, last)];
    }
  }
  for (let x = 0; x < n; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[clampi(k, 0, last) * n + x];
    for (let z = 0; z < n; z++) {
      dst[z * n + x] = acc * inv;
      acc += tmp[clampi(z + r + 1, 0, last) * n + x] - tmp[clampi(z - r, 0, last) * n + x];
    }
  }
}

/** Approximately Gaussian blur (repeated box passes) with radius in pixels. Returns a new array. */
export function blurHeights(src: Float32Array, n: number, radiusPx: number, passes = 2): Float32Array {
  const r = Math.max(0, Math.round(radiusPx));
  const out = src.slice();
  if (r < 1 || n < 2) return out;
  const tmp = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) boxPass(out, tmp, out, n, r);
  return out;
}

/** Bilinear sample at fractional grid coordinates (clamped to the grid). */
export function sampleBilinear(h: Float32Array, n: number, fx: number, fz: number): number {
  const last = n - 1;
  const x = fx < 0 ? 0 : fx > last ? last : fx;
  const z = fz < 0 ? 0 : fz > last ? last : fz;
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 < last ? x0 + 1 : last;
  const z1 = z0 < last ? z0 + 1 : last;
  const tx = x - x0;
  const tz = z - z0;
  const a = h[z0 * n + x0];
  const b = h[z0 * n + x1];
  const c = h[z1 * n + x0];
  const d = h[z1 * n + x1];
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

/**
 * Resample an n x n grid to m x m. Corners map to corners. Upsampling is bilinear;
 * downsampling pre-filters with a box blur matching the scale so detail averages
 * instead of aliasing.
 */
export function resampleGrid(heights: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return heights.slice();
  if (to < 1) return new Float32Array(0);
  if (from < 2) return new Float32Array(to * to).fill(heights[0] ?? 0);
  const src = to < from ? blurHeights(heights, from, ((from - 1) / Math.max(1, to - 1)) * 0.5, 1) : heights;
  const out = new Float32Array(to * to);
  const k = to > 1 ? (from - 1) / (to - 1) : 0;
  for (let z = 0; z < to; z++) {
    const fz = z * k;
    for (let x = 0; x < to; x++) out[z * to + x] = sampleBilinear(src, from, x * k, fz);
  }
  return out;
}

/** Signed distance (0..1 normalized coordinates) from cell (x, z) to the nearest grid border. */
export function edgeDistance(x: number, z: number, n: number): number {
  const inv = 1 / (n - 1);
  const u = x * inv;
  const v = z * inv;
  return Math.min(u, v, 1 - u, 1 - v);
}
