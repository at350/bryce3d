/**
 * Terrain helpers for scenes and presets. Generators are looked up in the terrain module
 * by keyword (its catalogue grows over time); a missing generator or op falls back to a
 * fractal look-alike so a scene always builds. Recipes record exactly what was used, so
 * share links can rebuild the heights from a few bytes.
 */
import { clamp, smoothstep } from '@/core/math';
import type { TerrainData, TerrainRecipe, TerrainRecipeOp } from '@/core/types';
import { TERRAIN_GENERATORS, TERRAIN_OPS, heightsFromRecipe, normalizeHeights } from '@/terrain';
import { fbm } from './noise';

export type TerrainKind =
  | 'fractal'
  | 'mountains'
  | 'alpine'
  | 'hills'
  | 'canyon'
  | 'mesa'
  | 'volcano'
  | 'islands'
  | 'dunes'
  | 'craters'
  | 'terraces'
  | 'spikes'
  | 'mounds';

/** Keywords tried in order against generator ids, then labels. */
const GENERATOR_KEYWORDS: Record<TerrainKind, string[]> = {
  fractal: ['fractal'],
  mountains: ['ridged', 'rugged', 'mountain'],
  alpine: ['alpine', 'ridged', 'mountain'],
  hills: ['rolling', 'hills', 'hill'],
  canyon: ['canyon'],
  mesa: ['mesa', 'plateau'],
  volcano: ['volcano', 'volcan'],
  islands: ['archipelago', 'islands', 'island'],
  dunes: ['dunes', 'dune'],
  craters: ['craters', 'crater'],
  terraces: ['terraces', 'terrace'],
  spikes: ['spikes', 'spike'],
  mounds: ['mounds', 'mound'],
};

/** Fractal params that approximate a kind when its own generator is missing. */
const FRACTAL_LOOKALIKE: Record<TerrainKind, Record<string, number>> = {
  fractal: { octaves: 7, roughness: 0.5, frequency: 3 },
  mountains: { octaves: 8, roughness: 0.56, frequency: 3 },
  alpine: { octaves: 8, roughness: 0.58, frequency: 3.5 },
  hills: { octaves: 4, roughness: 0.4, frequency: 2 },
  canyon: { octaves: 7, roughness: 0.55, frequency: 3 },
  mesa: { octaves: 5, roughness: 0.45, frequency: 2.5 },
  volcano: { octaves: 6, roughness: 0.5, frequency: 2 },
  islands: { octaves: 7, roughness: 0.55, frequency: 5 },
  dunes: { octaves: 3, roughness: 0.35, frequency: 4 },
  craters: { octaves: 6, roughness: 0.5, frequency: 4 },
  terraces: { octaves: 6, roughness: 0.5, frequency: 3 },
  spikes: { octaves: 8, roughness: 0.65, frequency: 6 },
  mounds: { octaves: 3, roughness: 0.4, frequency: 3 },
};

function findByKeyword(list: { id: string; label: string }[], keywords: string[]): string | null {
  for (const k of keywords) {
    const exact = list.find((g) => g.id.toLowerCase() === k);
    if (exact) return exact.id;
  }
  for (const k of keywords) {
    const partial = list.find((g) => g.id.toLowerCase().includes(k) || g.label.toLowerCase().includes(k));
    if (partial) return partial.id;
  }
  return null;
}

/** Generators fast enough to run on the main thread while a scene or thumbnail builds. */
const lightGenerators = () => TERRAIN_GENERATORS.filter((g) => !(g as { heavy?: boolean }).heavy && g.id !== 'random');

/** The generator id (and params) to use for a kind in the current terrain module. */
export function resolveGenerator(kind: TerrainKind, params?: Record<string, number>): { id: string; params?: Record<string, number> } {
  const found = findByKeyword(lightGenerators(), GENERATOR_KEYWORDS[kind]);
  if (found && (kind === 'fractal' || found !== 'fractal')) return { id: found, params: kind === 'fractal' ? { ...FRACTAL_LOOKALIKE.fractal, ...params } : params };
  return { id: 'fractal', params: FRACTAL_LOOKALIKE[kind] };
}

export interface TerrainOpSpec {
  /** Op keyword(s); the first one the terrain module knows is used, otherwise the op is skipped. */
  op: string | string[];
  params?: Record<string, number>;
}

export interface TerrainSpec {
  kind: TerrainKind;
  seed: number;
  /** Grid size (default 256). */
  resolution?: number;
  /** Params for the kind's own generator (ignored by the fractal fallback). */
  params?: Record<string, number>;
  ops?: TerrainOpSpec[];
  clipLow?: number;
  clipHigh?: number;
}

function resolveOps(ops: TerrainOpSpec[] = []): TerrainRecipeOp[] {
  const out: TerrainRecipeOp[] = [];
  for (const o of ops) {
    const keys = Array.isArray(o.op) ? o.op : [o.op];
    const id = findByKeyword(TERRAIN_OPS.filter((t) => !(t as { heavy?: boolean }).heavy), keys);
    if (id) out.push(o.params ? { op: id, params: { ...o.params } } : { op: id });
  }
  return out;
}

/** A recipe-backed terrain (reproducible from its seed). */
export function terrain(spec: TerrainSpec): TerrainData {
  const resolution = spec.resolution ?? 256;
  const gen = resolveGenerator(spec.kind, spec.params);
  const recipe: TerrainRecipe = { generator: gen.id, seed: spec.seed, resolution, ops: resolveOps(spec.ops) };
  if (gen.params) recipe.params = gen.params;
  let heights: Float32Array;
  try {
    heights = heightsFromRecipe(recipe);
  } catch {
    // a generator that throws must never break a sample scene: fall back to plain fractal
    recipe.generator = 'fractal';
    recipe.params = FRACTAL_LOOKALIKE[spec.kind];
    recipe.ops = [];
    heights = heightsFromRecipe(recipe);
  }
  return { resolution, heights, recipe, clipLow: spec.clipLow ?? 0, clipHigh: spec.clipHigh ?? 1 };
}

/**
 * A hand-shaped terrain from a height function over object-space x, z in [-1, 1].
 * It has no recipe (like a painted terrain), so share links carry its heights.
 */
export function shapedTerrain(
  resolution: number,
  fn: (x: number, z: number) => number,
  options: { normalize?: boolean; clipLow?: number; clipHigh?: number } = {},
): TerrainData {
  const n = resolution;
  let heights: Float32Array = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = (j / (n - 1)) * 2 - 1;
    for (let i = 0; i < n; i++) heights[j * n + i] = fn((i / (n - 1)) * 2 - 1, z);
  }
  if (options.normalize !== false) heights = normalizeHeights(heights);
  for (let i = 0; i < heights.length; i++) heights[i] = Number.isFinite(heights[i]) ? clamp(heights[i], 0, 1) : 0;
  return { resolution: n, heights, clipLow: options.clipLow ?? 0, clipHigh: options.clipHigh ?? 1 };
}

/** A sandstone plateau cut by a meandering river canyon with terraced walls (runs along z). */
export function riverCanyon(seed: number, resolution = 256): TerrainData {
  const rough = fbm(seed, 6, 0.55);
  const wobble = fbm(seed + 7, 3, 0.5);
  return shapedTerrain(
    resolution,
    (x, z) => {
      const center = 0.22 * Math.sin(z * 2.4 + 0.7) + 0.07 * Math.sin(z * 6.1 + 1.3) + (wobble(z * 2, 3.1) - 0.5) * 0.12;
      const d = Math.abs(x - center);
      const plateau = 0.86 + (rough(x * 3 + 5, z * 3) - 0.5) * 0.14;
      const t = clamp((d - 0.045) / 0.42, 0, 1);
      const steps = 4;
      const stair = (Math.floor(t * steps) + smoothstep(0.55, 1, (t * steps) % 1)) / steps;
      const wall = 0.02 + stair * plateau + (rough(x * 9, z * 9) - 0.5) * 0.05 * t;
      return Math.min(plateau, wall);
    },
    { normalize: false },
  );
}

/** Height (0..1) at which a lava pool fills the crater of volcanoCone(). */
export const VOLCANO_POOL_LEVEL = 0.5;

/** A cone volcano with a bowl-shaped crater whose floor sits below VOLCANO_POOL_LEVEL. */
export function volcanoCone(seed: number, resolution = 256): TerrainData {
  const rough = fbm(seed, 7, 0.55);
  const ridges = fbm(seed + 3, 4, 0.5);
  const rim = 0.2;
  const coneAt = (r: number) => Math.max(0, 1 - r / 0.95) ** 1.35 * 0.96;
  return shapedTerrain(
    resolution,
    (x, z) => {
      const r = Math.hypot(x, z) * (0.92 + ridges(x * 2 + 9, z * 2) * 0.16);
      const base = r < rim ? coneAt(rim) - 0.26 * (1 - (r / rim) ** 2) : coneAt(r);
      const gullies = (rough(x * 6, z * 6) - 0.5) * 0.1 * Math.min(1, r * 3) * (1 - r);
      return clamp(base + gullies + (rough(x * 2, z * 2) - 0.5) * 0.03, 0, 1);
    },
    { normalize: false },
  );
}
