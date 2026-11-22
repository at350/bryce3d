/** Seeded 2D value noise + fBm for the hand-shaped terrains in sample scenes and presets. */
import { mulberry32 } from '@/core/math';

export type Noise2 = (x: number, y: number) => number;

/** Smooth value noise in 0..1 (lattice values from a seeded permutation). */
export function valueNoise(seed: number): Noise2 {
  const rand = mulberry32(seed);
  const perm = new Uint16Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rand();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const at = (x: number, y: number) => vals[perm[(perm[x & 255] + (y & 255)) & 511] & 255];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal sum of value noise, normalized to roughly 0..1. */
export function fbm(seed: number, octaves = 6, roughness = 0.5): Noise2 {
  const n = valueNoise(seed);
  return (x, y) => {
    let amp = 1;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * n(x * f + o * 31.7, y * f + o * 17.3);
      norm += amp;
      amp *= roughness;
      f *= 2;
    }
    return sum / norm;
  };
}
