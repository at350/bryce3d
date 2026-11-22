/**
 * Terrain heightfield generation and editing operations (pure functions, no DOM).
 * Public API used by the store defaults, the Create palette, the Terrain Editor,
 * presets and share links. Heights are row-major (index = z * N + x), values 0..1.
 *
 * Every function returns a NEW Float32Array; inputs are never mutated. Everything is
 * deterministic for a given seed (no Math.random inside generators or ops), so a
 * TerrainRecipe (generator + seed + ops) reproduces its heights exactly.
 */
import type { TerrainData, TerrainRecipe } from '@/core/types';
import { GENERATOR_DEFS, runGenerator } from './generators';
import { normalizeInPlace, resampleGrid } from './grid';
import { OP_DEFS, runOp, type OpGroup } from './ops';
import { buildFromRecipe, DEFAULT_TERRAIN_RESOLUTION, makeTerrainData } from './terrainData';

export interface TerrainGeneratorInfo {
  id: string;
  label: string;
  /** One-line description for hint bars and tooltips. */
  hint?: string;
  /** Slow (erosion): run it off the main thread when the grid is large. */
  heavy?: boolean;
}

export interface TerrainOpInfo {
  id: string;
  label: string;
  hint?: string;
  group?: OpGroup;
  heavy?: boolean;
}

/** Every generator, in button order, ending with the dice ('random'). */
export const TERRAIN_GENERATORS: TerrainGeneratorInfo[] = [
  ...GENERATOR_DEFS.map((g) => ({ id: g.id, label: g.label, hint: g.hint, heavy: g.heavy })),
  { id: 'random', label: 'Random', hint: 'Roll the dice: a random generator with random settings' },
];

/** Every user-facing op, in button order. */
export const TERRAIN_OPS: TerrainOpInfo[] = OP_DEFS.filter((o) => !o.internal).map((o) => ({
  id: o.id,
  label: o.label,
  hint: o.hint,
  group: o.group,
  heavy: o.heavy,
}));

export { DEFAULT_TERRAIN_RESOLUTION };

/** Rescale heights to fill 0..1. */
export function normalizeHeights(h: Float32Array): Float32Array {
  return normalizeInPlace(h.slice());
}

/** Generate a fresh heightfield ('random' picks a generator from the seed; unknown ids give fractal). */
export function generateHeights(
  generator: string,
  seed: number,
  resolution: number,
  params: Record<string, number> = {},
): Float32Array {
  return runGenerator(generator, seed, resolution, params);
}

/**
 * Apply an editing operation, returning a new array. Unknown ops return a copy.
 * params.amount (0..1) fades the op in; params.seed overrides `seed`.
 */
export function applyOp(
  heights: Float32Array,
  resolution: number,
  op: string,
  params: Record<string, number> = {},
  seed = 1,
): Float32Array {
  return runOp(heights, resolution, op, params, seed);
}

/** Resample to a new grid size (bilinear up, box-filtered down; corners map to corners). */
export function resampleHeights(heights: Float32Array, from: number, to: number): Float32Array {
  return resampleGrid(heights, from, to);
}

/** Rebuild heights from a recipe (generator + ops). Deterministic. */
export function heightsFromRecipe(recipe: TerrainRecipe): Float32Array {
  return buildFromRecipe(recipe);
}

/** A complete TerrainData built from a generator, with its recipe recorded. */
export function createTerrainData(
  generator = 'fractal',
  seed = 1,
  resolution = DEFAULT_TERRAIN_RESOLUTION,
  params?: Record<string, number>,
): TerrainData {
  return makeTerrainData(generator, seed, resolution, params);
}

export {
  applyOpToTerrain,
  changeResolution,
  opInvocation,
  randomTerrainData,
  recipeOpSeed,
  reseedTerrain,
  TERRAIN_RESOLUTIONS,
  withEditedHeights,
  withOpResult,
} from './terrainData';
export { FLAT_GENERATOR, GENERATOR_DEFS, getGenerator, resolveRandomGenerator, type GeneratorDef } from './generators';
export { getOp, OP_DEFS, type OpDef, type OpGroup } from './ops';
export type { ParamSpec } from './params';
export { CURVE_PRESETS, buildCurveLUT, applyLUT, curveToParams, paramsToCurve, identityCurve, isIdentityCurve, type FilterCurve, type CurvePoint, type CurvePreset } from './curve';
export { BLEND_MODES, PATTERNS, blendHeights, renderPattern, rgbaToHeights, getPattern } from './pictures';
export { BRUSH_MODES, brushDab, strokePoints, unionRect, dabSpacingPx, brushRadiusPx, type BrushMode, type BrushSettings, type DirtyRect } from './brush';
export { heightStats, histogram } from './grid';
