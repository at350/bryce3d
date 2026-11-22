/**
 * Scene <-> JSON text (.bryce.json files and autosave). The file is the Scene itself plus a
 * format marker; terrain heights are base64 (Float32, or Uint16 when large). Loading always
 * goes through normalizeScene, so old, partial or hand-edited files still open.
 */
import type { Scene, TerrainData } from '@/core/types';
import { base64ToF32, f32ToBase64, heightsToU16Base64, u16Base64ToHeights } from './heights';
import { NOT_A_SCENE, isObj, normalizeSceneReport, type NormalizeReport } from './normalize';

export { normalizeScene, normalizeSceneReport, type NormalizeReport } from './normalize';

export const FILE_FORMAT = 'bryce3d-web-scene';
/** 1 = the foundation format (no marker), 2 = this format. */
export const FILE_VERSION = 2;

export interface SerializeOptions {
  /**
   * How terrain heights are written:
   * auto   = Float32 up to 256 x 256, Uint16 above (default);
   * f32 / u16 = always that encoding;
   * recipe = omit heights of terrains that have a recipe (rebuilt on load), Uint16 for the rest.
   */
  heights?: 'auto' | 'f32' | 'u16' | 'recipe';
  /** JSON indentation (default none). */
  space?: number;
}

/** JSON text for a .bryce.json file. */
export function serializeScene(scene: Scene, options: SerializeOptions = {}): string {
  const mode = options.heights ?? 'auto';
  const doc = { format: FILE_FORMAT, fileVersion: FILE_VERSION, ...scene };
  return JSON.stringify(
    doc,
    function (this: unknown, key: string, value: unknown) {
      if (key !== 'heights' || !(value instanceof Float32Array)) return value;
      const owner = this as Partial<TerrainData>;
      if (mode === 'recipe' && owner.recipe) return undefined;
      const big = value.length > 256 * 256;
      if (mode === 'f32' || (mode === 'auto' && !big)) return { f32: f32ToBase64(value) };
      return { u16: heightsToU16Base64(value) };
    },
    options.space,
  );
}

function reviveHeights(_key: string, value: unknown): unknown {
  if (_key !== 'heights' || !isObj(value)) return value;
  try {
    if (typeof value.f32 === 'string') return base64ToF32(value.f32);
    if (typeof value.u16 === 'string') return u16Base64ToHeights(value.u16);
  } catch {
    return null; // damaged data: normalizeScene rebuilds the terrain and reports it
  }
  return value;
}

/** Parse scene text, collecting repair warnings. Throws a readable Error when it is not a scene. */
export function deserializeSceneReport(text: string): NormalizeReport {
  let raw: unknown;
  try {
    raw = JSON.parse(text, reviveHeights);
  } catch {
    throw new Error(`${NOT_A_SCENE.slice(0, -1)} (it is not valid JSON).`);
  }
  return normalizeSceneReport(raw);
}

/** Parse a .bryce.json file. Throws a readable Error when the text is not a scene. */
export function deserializeScene(text: string): Scene {
  return deserializeSceneReport(text).scene;
}
