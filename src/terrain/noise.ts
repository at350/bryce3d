/**
 * Seeded 2D noise primitives for the heightfield generators: gradient (Perlin-style)
 * noise, fBm, ridged multifractal and a jittered-grid cell lookup. Coordinates are in
 * "noise space" (1 unit = one lattice cell of the base octave).
 */
import { hash01, mulberry32, subSeed } from './rng';

export type Noise2 = (x: number, y: number) => number;

/** Gradient noise in roughly [-1, 1]. */
export function gradientNoise(seed: number): Noise2 {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float64Array(256);
  const gy = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const a = rand() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  return (x: number, y: number) => {
    const xf = Math.floor(x);
    const yf = Math.floor(y);
    const X = xf & 255;
    const Y = yf & 255;
    const dx = x - xf;
    const dy = y - yf;
    const u = dx * dx * dx * (dx * (dx * 6 - 15) + 10);
    const v = dy * dy * dy * (dy * (dy * 6 - 15) + 10);
    const pX = perm[X];
    const pX1 = perm[X + 1];
    const a = perm[pX + Y];
    const b = perm[pX1 + Y];
    const c = perm[pX + Y + 1];
    const d = perm[pX1 + Y + 1];
    const n00 = gx[a] * dx + gy[a] * dy;
    const n10 = gx[b] * (dx - 1) + gy[b] * dy;
    const n01 = gx[c] * dx + gy[c] * (dy - 1);
    const n11 = gx[d] * (dx - 1) + gy[d] * (dy - 1);
    const nx0 = n00 + u * (n10 - n00);
    const nx1 = n01 + u * (n11 - n01);
    return (nx0 + v * (nx1 - nx0)) * 1.41421356;
  };
}

/** Per-octave rotations and offsets break up lattice alignment between octaves. */
function octaveFrames(seed: number, octaves: number) {
  const cs = new Float64Array(octaves);
  const sn = new Float64Array(octaves);
  const ox = new Float64Array(octaves);
  const oy = new Float64Array(octaves);
  for (let i = 0; i < octaves; i++) {
    const a = 0.5 + i * 1.913 + hash01(i, 7, seed) * 0.6;
    cs[i] = Math.cos(a);
    sn[i] = Math.sin(a);
    ox[i] = hash01(i, 11, seed) * 173.1;
    oy[i] = hash01(i, 13, seed) * 173.1;
  }
  return { cs, sn, ox, oy };
}

/** Fractal Brownian motion, roughly [-1, 1] (usually within +-0.7). gain = amplitude falloff per octave. */
export function makeFbm(seed: number, octaves: number, gain = 0.5, lacunarity = 2): Noise2 {
  const oct = Math.max(1, Math.min(12, Math.round(octaves)));
  const base = gradientNoise(seed);
  const { cs, sn, ox, oy } = octaveFrames(subSeed(seed, 91), oct);
  const amps = new Float64Array(oct);
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    amps[i] = amp;
    norm += amp;
    amp *= gain;
  }
  const inv = 1 / norm;
  return (x: number, y: number) => {
    let sum = 0;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      const px = x * f;
      const py = y * f;
      sum += amps[i] * base(px * cs[i] - py * sn[i] + ox[i], px * sn[i] + py * cs[i] + oy[i]);
      f *= lacunarity;
    }
    return sum * inv;
  };
}

/**
 * Ridged multifractal (after Musgrave): sharp creases where the noise crosses zero, with
 * detail concentrated on the ridges. Returns roughly [0, 1].
 */
export function makeRidged(seed: number, octaves: number, roughness = 0.5, lacunarity = 2): Noise2 {
  const oct = Math.max(1, Math.min(12, Math.round(octaves)));
  const base = gradientNoise(seed);
  const { cs, sn, ox, oy } = octaveFrames(subSeed(seed, 57), oct);
  const H = Math.max(0.1, 1.6 - roughness * 1.4);
  const w = new Float64Array(oct);
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    w[i] = Math.pow(lacunarity, -i * H);
    norm += w[i];
  }
  const inv = 1 / norm;
  return (x: number, y: number) => {
    let f = 1;
    let signal = 1 - Math.abs(base(x * cs[0] - y * sn[0] + ox[0], x * sn[0] + y * cs[0] + oy[0]));
    signal *= signal;
    let result = signal * w[0];
    for (let i = 1; i < oct; i++) {
      f *= lacunarity;
      const px = x * f;
      const py = y * f;
      let weight = signal * 2;
      if (weight > 1) weight = 1;
      else if (weight < 0) weight = 0;
      signal = 1 - Math.abs(base(px * cs[i] - py * sn[i] + ox[i], px * sn[i] + py * cs[i] + oy[i]));
      signal *= signal * weight;
      result += signal * w[i];
    }
    return result * inv;
  };
}

/**
 * Octave count so the finest octave stays above ~2 pixels: keeps generators resolution
 * independent (a 64^2 grid simply skips detail it cannot show) and cheap at low res.
 */
export function octavesFor(n: number, baseFrequency: number, max: number): number {
  const k = Math.floor(Math.log2(Math.max(2, n) / (2 * Math.max(0.05, baseFrequency)))) + 1;
  return Math.max(1, Math.min(Math.round(max), k));
}

/** Jittered feature point of lattice cell (ix, iy), written into out[0..1]. */
export function cellFeature(ix: number, iy: number, seed: number, jitter: number, out: Float64Array): void {
  out[0] = ix + 0.5 + (hash01(ix, iy, seed) - 0.5) * jitter;
  out[1] = iy + 0.5 + (hash01(ix, iy, seed ^ 0x68bc21eb) - 0.5) * jitter;
}
