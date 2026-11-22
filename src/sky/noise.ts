/**
 * Tiny deterministic 2D value noise + fBm for the sky painters (cloud textures,
 * thumbnails). Hash-based, so no tables and no allocation per call.
 */

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in 0..1. */
export function valueNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal sum of value noise, normalized to 0..1. */
export function fbm(x: number, y: number, octaves = 4, roughness = 0.5, seed = 0): number {
  let amp = 1;
  let f = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f + o * 31.7, y * f - o * 17.3, seed + o);
    norm += amp;
    amp *= roughness;
    f *= 2.03;
  }
  return sum / norm;
}

/** Deterministic pseudo-random 0..1 for an integer pair (star fields). */
export const hash01 = (x: number, y: number, seed = 0) => hash2(x | 0, y | 0, seed | 0);
