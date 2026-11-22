/** Terrain jobs: the unit of work the editor hands to the worker (or runs inline as a fallback). */
import type { TerrainRecipe } from '@/core/types';
import { runGenerator } from './generators';
import { resampleGrid } from './grid';
import { runOp } from './ops';
import type { Params } from './params';
import { buildFromRecipe } from './terrainData';

export type TerrainJob =
  | { kind: 'generate'; generator: string; seed: number; resolution: number; params?: Params }
  | { kind: 'op'; heights: Float32Array; resolution: number; op: string; params?: Params; seed: number }
  | { kind: 'recipe'; recipe: TerrainRecipe }
  | { kind: 'resample'; heights: Float32Array; from: number; to: number };

export function runTerrainJob(job: TerrainJob, onProgress?: (fraction: number) => void): Float32Array {
  switch (job.kind) {
    case 'generate': return runGenerator(job.generator, job.seed, job.resolution, job.params, onProgress);
    case 'op': return runOp(job.heights, job.resolution, job.op, job.params, job.seed, onProgress);
    case 'recipe': return buildFromRecipe(job.recipe, onProgress);
    case 'resample': return resampleGrid(job.heights, job.from, job.to);
  }
}

/** Rough cost estimate in "fractal 256^2 units", used to decide whether to show a busy state. */
export function jobCost(job: TerrainJob, heavy: boolean): number {
  const n = job.kind === 'resample' ? Math.max(job.from, job.to) : job.kind === 'recipe' ? job.recipe.resolution : job.resolution;
  const area = (n / 256) ** 2;
  const steps = job.kind === 'recipe' ? 1 + job.recipe.ops.length : 1;
  return area * steps * (heavy ? 8 : 1);
}

export interface WorkerRequest {
  id: number;
  job: TerrainJob;
}

export type WorkerResponse =
  | { id: number; type: 'progress'; value: number }
  | { id: number; type: 'done'; heights: Float32Array }
  | { id: number; type: 'error'; message: string };
