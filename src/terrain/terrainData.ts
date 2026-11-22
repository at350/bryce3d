/**
 * TerrainData helpers: recipes (generator + ops reproduce heights exactly), applying ops so
 * they are recorded, changing resolution, re-seeding and the dice.
 */
import type { TerrainData, TerrainRecipe, TerrainRecipeOp } from '@/core/types';
import { resolveRandomGenerator, runGenerator } from './generators';
import { resampleGrid } from './grid';
import { runOp } from './ops';
import type { Params } from './params';

export const DEFAULT_TERRAIN_RESOLUTION = 256;

/** Grid sizes offered by the editor's resolution selector. */
export const TERRAIN_RESOLUTIONS = [64, 128, 256, 512, 1024] as const;

/** Seed an op receives inside a recipe (index = its position in recipe.ops). */
export const recipeOpSeed = (recipe: TerrainRecipe, index: number) => recipe.seed + index + 1;

/** Rebuild heights from a recipe, optionally reporting progress (0..1). */
export function buildFromRecipe(recipe: TerrainRecipe, onProgress?: (fraction: number) => void): Float32Array {
  const steps = 1 + recipe.ops.length;
  const part = (k: number) => (onProgress ? (f: number) => onProgress((k + f) / steps) : undefined);
  let h = runGenerator(recipe.generator, recipe.seed, recipe.resolution, recipe.params, part(0));
  recipe.ops.forEach((o, i) => {
    h = runOp(h, recipe.resolution, o.op, o.params, recipeOpSeed(recipe, i), part(i + 1));
  });
  onProgress?.(1);
  return h;
}

/** A fresh terrain from a generator, recipe recorded ('random' resolves through the dice). */
export function makeTerrainData(generator: string, seed: number, resolution: number, params?: Params): TerrainData {
  let gen = generator;
  let p = params;
  if (generator === 'random') {
    const r = resolveRandomGenerator(seed);
    gen = r.generator;
    p = { ...r.params, ...params };
  }
  const recipe: TerrainRecipe = { generator: gen, seed: seed >>> 0, resolution, ops: [] };
  if (p && Object.keys(p).length) recipe.params = { ...p };
  return { resolution, heights: buildFromRecipe(recipe), recipe, clipLow: 0, clipHigh: 1 };
}

/** The dice: a random generator with random parameters (deterministic for a given seed). */
export function randomTerrainData(seed?: number, resolution = DEFAULT_TERRAIN_RESOLUTION): TerrainData {
  // Dice buttons are allowed to be non-deterministic; generators themselves never are.
  const s = seed ?? Math.floor(Math.random() * 0x7fffffff);
  return makeTerrainData('random', s, resolution);
}

/** The op as it would be recorded, and the seed it runs with on this terrain. */
export function opInvocation(t: TerrainData, op: string, params: Params = {}): { entry: TerrainRecipeOp; seed: number } {
  const entry: TerrainRecipeOp = Object.keys(params).length ? { op, params: { ...params } } : { op };
  const seed = t.recipe ? recipeOpSeed(t.recipe, t.recipe.ops.length) : (params.seed ?? 1);
  return { entry, seed };
}

/** New TerrainData with already computed heights for an op, recorded into the recipe when there is one. */
export function withOpResult(t: TerrainData, op: string, params: Params, heights: Float32Array): TerrainData {
  const { entry } = opInvocation(t, op, params);
  return { ...t, heights, recipe: t.recipe ? { ...t.recipe, ops: [...t.recipe.ops, entry] } : undefined };
}

/** Apply an op synchronously and record it. */
export function applyOpToTerrain(t: TerrainData, op: string, params: Params = {}): TerrainData {
  const { seed } = opInvocation(t, op, params);
  return withOpResult(t, op, params, runOp(t.heights, t.resolution, op, params, seed));
}

/** Hand-edited heights: the recipe can no longer reproduce them, so it is dropped. */
export function withEditedHeights(t: TerrainData, heights: Float32Array, resolution = t.resolution): TerrainData {
  const next: TerrainData = { ...t, resolution, heights };
  delete next.recipe;
  return next;
}

/** Same terrain at another grid size: regenerated from the recipe when possible, else resampled. */
export function changeResolution(t: TerrainData, resolution: number): TerrainData {
  if (resolution === t.resolution) return t;
  if (t.recipe) {
    const recipe = { ...t.recipe, resolution };
    return { ...t, resolution, heights: buildFromRecipe(recipe), recipe };
  }
  return { ...t, resolution, heights: resampleGrid(t.heights, t.resolution, resolution) };
}

/** Same recipe with another seed (ops re-run with their derived seeds). Null without a recipe. */
export function reseedTerrain(t: TerrainData, seed: number): TerrainData | null {
  if (!t.recipe) return null;
  const recipe = { ...t.recipe, seed: seed >>> 0 };
  return { ...t, heights: buildFromRecipe(recipe), recipe };
}
