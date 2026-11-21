/**
 * Terrain heightfield generation and editing operations (pure functions, no DOM).
 * Public API used by the store defaults, the Create palette, the Terrain Editor,
 * presets and share links. Heights are row-major (index = z * N + x), values 0..1.
 *
 * Every function returns a NEW Float32Array; inputs are never mutated.
 *
 * NOTE: foundation version. The terrain module owner expands generators/ops, keeping
 * these exported signatures stable.
 */
import { mulberry32 } from '@/core/math';
import type { TerrainData, TerrainRecipe } from '@/core/types';

export interface TerrainGeneratorInfo {
  id: string;
  label: string;
}

export interface TerrainOpInfo {
  id: string;
  label: string;
}

export const TERRAIN_GENERATORS: TerrainGeneratorInfo[] = [{ id: 'fractal', label: 'Fractal' }];

export const TERRAIN_OPS: TerrainOpInfo[] = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'invert', label: 'Invert' },
];

export const DEFAULT_TERRAIN_RESOLUTION = 256;

function valueNoise2D(seed: number) {
  const rand = mulberry32(seed);
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  const vals = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    perm[i] = i;
    vals[i] = rand();
  }
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  for (let i = 0; i < SIZE; i++) perm[i + SIZE] = perm[i];
  const at = (x: number, y: number) => vals[perm[(perm[x & 255] + y) & 511] & 255];
  return (x: number, y: number) => {
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

/** Rescale heights to fill 0..1. */
export function normalizeHeights(h: Float32Array): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < h.length; i++) {
    if (h[i] < lo) lo = h[i];
    if (h[i] > hi) hi = h[i];
  }
  const out = new Float32Array(h.length);
  const span = hi - lo || 1;
  for (let i = 0; i < h.length; i++) out[i] = (h[i] - lo) / span;
  return out;
}

/** Generate a fresh heightfield. */
export function generateHeights(
  generator: string,
  seed: number,
  resolution: number,
  params: Record<string, number> = {},
): Float32Array {
  void generator;
  const n = resolution;
  const noise = valueNoise2D(seed);
  const octaves = params.octaves ?? 7;
  const roughness = params.roughness ?? 0.5;
  const frequency = params.frequency ?? 3;
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const u = x / (n - 1);
      const v = z / (n - 1);
      let amp = 1;
      let f = frequency;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += amp * noise(u * f + o * 17.3, v * f + o * 9.1);
        norm += amp;
        amp *= roughness;
        f *= 2;
      }
      // Island falloff so the default terrain is a mountain, not a cut-off slab.
      const dx = u * 2 - 1;
      const dz = v * 2 - 1;
      const r = Math.min(1, Math.sqrt(dx * dx + dz * dz));
      const falloff = 1 - r * r * (3 - 2 * r);
      out[z * n + x] = (sum / norm) * falloff;
    }
  }
  return normalizeHeights(out);
}

/** Apply an editing operation, returning a new array. Unknown ops return a copy. */
export function applyOp(
  heights: Float32Array,
  resolution: number,
  op: string,
  params: Record<string, number> = {},
  _seed = 1,
): Float32Array {
  const n = resolution;
  if (op === 'invert') {
    const out = new Float32Array(heights.length);
    for (let i = 0; i < heights.length; i++) out[i] = 1 - heights[i];
    return out;
  }
  if (op === 'smooth') {
    const passes = params.passes ?? 1;
    let src = heights;
    for (let p = 0; p < passes; p++) {
      const out = new Float32Array(src.length);
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          let s = 0;
          let c = 0;
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              const zz = z + dz;
              if (xx < 0 || zz < 0 || xx >= n || zz >= n) continue;
              s += src[zz * n + xx];
              c++;
            }
          }
          out[z * n + x] = s / c;
        }
      }
      src = out;
    }
    return src;
  }
  return heights.slice();
}

/** Bilinear resample to a new grid size. */
export function resampleHeights(heights: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return heights.slice();
  const out = new Float32Array(to * to);
  for (let z = 0; z < to; z++) {
    for (let x = 0; x < to; x++) {
      const fx = (x / (to - 1)) * (from - 1);
      const fz = (z / (to - 1)) * (from - 1);
      const x0 = Math.floor(fx);
      const z0 = Math.floor(fz);
      const x1 = Math.min(from - 1, x0 + 1);
      const z1 = Math.min(from - 1, z0 + 1);
      const tx = fx - x0;
      const tz = fz - z0;
      const a = heights[z0 * from + x0];
      const b = heights[z0 * from + x1];
      const c = heights[z1 * from + x0];
      const d = heights[z1 * from + x1];
      out[z * to + x] = (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    }
  }
  return out;
}

/** Rebuild heights from a recipe (generator + ops). Deterministic. */
export function heightsFromRecipe(recipe: TerrainRecipe): Float32Array {
  let h = generateHeights(recipe.generator, recipe.seed, recipe.resolution, recipe.params);
  recipe.ops.forEach((o, i) => {
    h = applyOp(h, recipe.resolution, o.op, o.params, recipe.seed + i + 1);
  });
  return h;
}

/** A complete TerrainData built from a generator, with its recipe recorded. */
export function createTerrainData(
  generator = 'fractal',
  seed = 1,
  resolution = DEFAULT_TERRAIN_RESOLUTION,
  params?: Record<string, number>,
): TerrainData {
  const recipe: TerrainRecipe = { generator, seed, resolution, params, ops: [] };
  return { resolution, heights: heightsFromRecipe(recipe), recipe, clipLow: 0, clipHigh: 1 };
}
