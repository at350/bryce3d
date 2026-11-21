/**
 * Factories for scene values: camera, render settings, lights, transforms and complete
 * objects. Materials come from src/materials/defaults.ts, the sky from src/sky/defaults.ts,
 * the startup scene from src/scenes/defaultScene.ts.
 */
import { defaultMaterialFor } from '@/materials/defaults';
import { createTerrainData } from '@/terrain';
import { newId } from './ids';
import { OBJECT_BASE_NAMES, isLight } from './objects';
import type { CameraState, LightParams, ObjectType, RGB, RenderSettings, SceneObject, Transform, Vec3 } from './types';

export { defaultMaterial, makeComponent, makeMaterial, cloneMaterial } from './materialUtils';

/** Wireframe colors for object families (index 0 is the default family). */
export const FAMILY_COLORS: RGB[] = [
  [0.42, 0.42, 0.45], // default: graphite
  [0.18, 0.36, 0.82], // blue
  [0.1, 0.55, 0.3], // green
  [0.85, 0.55, 0.05], // amber
  [0.6, 0.2, 0.7], // violet
  [0.05, 0.6, 0.65], // teal
  [0.55, 0.35, 0.2], // brown
  [0.9, 0.3, 0.55], // pink
];

export const FAMILY_NAMES = ['Default', 'Blue', 'Green', 'Amber', 'Violet', 'Teal', 'Brown', 'Pink'];

/** Wireframe color of selected objects (Bryce red). */
export const SELECTED_COLOR: RGB = [0.92, 0.08, 0.06];

export function defaultCamera(): CameraState {
  return { position: [0, 7, 48], target: [0, 4, 0], roll: 0, fov: 50 };
}

export function defaultRenderSettings(): RenderSettings {
  return { width: 800, height: 600, quality: 'normal', mosaic: true, maxBounces: 6, samples: 12, exposure: 1 };
}

export function defaultLight(type: ObjectType): LightParams {
  return {
    color: [1, 0.95, 0.85],
    intensity: type === 'parallelLight' ? 60 : 100,
    falloff: type === 'parallelLight' ? 'none' : 'squared',
    coneAngle: 45,
    softness: 0.3,
    visible: type === 'radialLight',
    castShadows: true,
  };
}

/** Default transform for a newly created object of this type, placed near the origin. */
export function defaultTransform(type: ObjectType): Transform {
  const t = (position: Vec3, scale: Vec3): Transform => ({ position, rotation: [0, 0, 0], scale });
  switch (type) {
    case 'water': return t([0, 0.5, 0], [1, 1, 1]);
    case 'ground': return t([0, 0, 0], [1, 1, 1]);
    case 'cloud': return t([0, 60, 0], [1, 6, 1]);
    case 'terrain': return t([0, 5, 0], [20, 5, 20]);
    case 'lattice': return t([0, 8, 0], [10, 4, 10]);
    case 'stone': return t([0, 1.2, 0], [1.6, 1.2, 1.4]);
    case 'tree': return t([0, 4, 0], [2.5, 4, 2.5]);
    case 'disc':
    case 'square': return t([0, 2, 0], [2, 1, 2]);
    case 'torus': return t([0, 2, 0], [2, 2, 2]);
    case 'radialLight': return t([0, 10, 6], [0.5, 0.5, 0.5]);
    case 'spotLight':
    case 'squareSpotLight': return t([0, 14, 6], [0.6, 0.6, 0.6]);
    case 'parallelLight': return t([0, 16, 0], [0.8, 0.8, 0.8]);
    default: return t([0, 2, 0], [2, 2, 2]);
  }
}

/** Next free "Name N" for a type within a scene. */
export function nextObjectName(type: ObjectType, existing: SceneObject[]): string {
  const base = OBJECT_BASE_NAMES[type];
  let max = 0;
  for (const o of existing) {
    if (!o.name.startsWith(base + ' ')) continue;
    const n = Number(o.name.slice(base.length + 1));
    if (Number.isInteger(n)) max = Math.max(max, n);
  }
  return `${base} ${max + 1}`;
}

/** Build a complete new object of the given type (overrides win). */
export function createObject(type: ObjectType, overrides: Partial<SceneObject> = {}, existing: SceneObject[] = []): SceneObject {
  const obj: SceneObject = {
    id: newId(),
    name: nextObjectName(type, existing),
    type,
    transform: defaultTransform(type),
    material: defaultMaterialFor(type),
    family: 0,
  };
  if (type === 'torus') obj.torus = { minorRadius: 0.3 };
  if (type === 'stone') obj.stone = { seed: Math.floor(Math.random() * 1e6), lumpiness: 0.5, roughness: 0.5 };
  if (type === 'tree') {
    obj.tree = {
      seed: Math.floor(Math.random() * 1e6),
      trunkHeight: 0.45,
      trunkWidth: 0.1,
      crown: 'round',
      crownNoise: 0.5,
      trunkColor: [0.32, 0.22, 0.14],
    };
  }
  if (type === 'terrain' || type === 'lattice') obj.terrain = createTerrainData('fractal', Math.floor(Math.random() * 1e6));
  if (isLight(type)) obj.light = defaultLight(type);
  return { ...obj, ...overrides };
}
