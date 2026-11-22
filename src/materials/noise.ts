/**
 * CPU noise primitives for texture swatches and CPU thumbnails. They mirror the GPU
 * renderer's building blocks (value noise from a tiling 32^3 lattice with smoothstep
 * interpolation, the same octave rotation and gains) so CPU previews match ray-traced
 * renders in character. The lattice values themselves differ from the GPU's texture.
 */

/** 32-bit integer hash of a lattice point and a seed (murmur3-style finalizer). */
export function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}

/** Hash to a float in [0, 1). */
export function hashUnit(h: number): number {
  return (h >>> 8) / 16777216;
}

const N = 32;
const MASK = N - 1;
let table: Float32Array | null = null;

/** Four independent random channels per lattice point, tiling every 32 units (like the GPU noise texture). */
function lattice(): Float32Array {
  if (!table) {
    table = new Float32Array(N * N * N * 4);
    for (let i = 0; i < table.length; i++) table[i] = hashUnit(hash3(i, 0x2f, 0x6b, 0x51f));
  }
  return table;
}

const fadeC1 = (t: number) => t * t * (3 - 2 * t);

/** Value noise in 0..1 (C1 continuous), channel 0..3. */
export function noise3(x: number, y: number, z: number, channel = 0): number {
  const t = lattice();
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = fadeC1(x - ix);
  const fy = fadeC1(y - iy);
  const fz = fadeC1(z - iz);
  const x0 = ix & MASK;
  const x1 = (ix + 1) & MASK;
  const y0 = (iy & MASK) * N;
  const y1 = ((iy + 1) & MASK) * N;
  const z0 = (iz & MASK) * N * N;
  const z1 = ((iz + 1) & MASK) * N * N;
  const at = (a: number, b: number, c: number) => t[(a + b + c) * 4 + channel];
  const a00 = at(x0, y0, z0) + (at(x1, y0, z0) - at(x0, y0, z0)) * fx;
  const a10 = at(x0, y1, z0) + (at(x1, y1, z0) - at(x0, y1, z0)) * fx;
  const a01 = at(x0, y0, z1) + (at(x1, y0, z1) - at(x0, y0, z1)) * fx;
  const a11 = at(x0, y1, z1) + (at(x1, y1, z1) - at(x0, y1, z1)) * fx;
  const b0 = a00 + (a10 - a00) * fy;
  const b1 = a01 + (a11 - a01) * fy;
  return b0 + (b1 - b0) * fz;
}

// Octave rotation (the GPU's OCT_ROT, column-major) breaks up lattice alignment between octaves.
function rotate(p: number[], scale: number, ox: number, oy: number, oz: number) {
  const x = p[0];
  const y = p[1];
  const z = p[2];
  p[0] = (-0.8 * y - 0.6 * z) * scale + ox;
  p[1] = (0.8 * x + 0.36 * y - 0.48 * z) * scale + oy;
  p[2] = (0.6 * x - 0.48 * y + 0.64 * z) * scale + oz;
}

const q = [0, 0, 0];

/** Raw fractal sum of value noise, mean ~0.5 with a narrow spread. */
export function fbmRaw(x: number, y: number, z: number, octaves: number, rough: number): number {
  q[0] = x;
  q[1] = y;
  q[2] = z;
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(q[0], q[1], q[2]);
    norm += amp;
    amp *= rough;
    rotate(q, 2.03, 1.7, 9.2, 3.1);
  }
  return sum / Math.max(norm, 1e-4);
}

const stretch01 = (n: number, k: number) => Math.min(1, Math.max(0, 0.5 + (n - 0.5) * k));

/** fBm stretched to fill 0..1. */
export function fbm(x: number, y: number, z: number, octaves: number, rough: number): number {
  return stretch01(fbmRaw(x, y, z, octaves, rough), 2.2);
}

export function ridgedNoise(x: number, y: number, z: number, octaves: number, rough: number): number {
  q[0] = x;
  q[1] = y;
  q[2] = z;
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let w = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(noise3(q[0], q[1], q[2]) * 2 - 1);
    n *= n;
    sum += amp * n * w;
    norm += amp;
    w = Math.min(1, Math.max(0.3, n * 1.7));
    amp *= rough;
    rotate(q, 2.07, 4.1, 1.3, 7.7);
  }
  return Math.min(1, Math.max(0, (sum / Math.max(norm, 1e-4)) * 1.35));
}

export function turbulenceNoise(x: number, y: number, z: number, octaves: number, rough: number): number {
  q[0] = x;
  q[1] = y;
  q[2] = z;
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * Math.abs(noise3(q[0], q[1], q[2]) * 2 - 1);
    norm += amp;
    amp *= rough;
    rotate(q, 2.01, 2.9, 5.3, 0.6);
  }
  return Math.min(1, Math.max(0, (sum / Math.max(norm, 1e-4)) * 1.9));
}

/** Distance to the nearest jittered feature point (Worley F1). */
export function voronoiF1(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let d1 = 64;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx;
        const cy = yi + dy;
        const cz = zi + dz;
        const h = hash3(cx, cy, cz, 0x7f4a);
        const px = cx + hashUnit(h) - x;
        const py = cy + hashUnit(hash3(cx, cy, cz, 0x1b3)) - y;
        const pz = cz + hashUnit(hash3(cx, cy, cz, 0x2c9)) - z;
        const d = px * px + py * py + pz * pz;
        if (d < d1) d1 = d;
      }
    }
  }
  return Math.sqrt(d1);
}
