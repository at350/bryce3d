/**
 * Tiny DSL for composing scenes and object presets in code. Every call returns fresh
 * objects (new ids, new arrays), so builders can be called any number of times.
 */
import { defaultLight, defaultRenderSettings, defaultTransform } from '@/core/defaults';
import { newId } from '@/core/ids';
import { OBJECT_BASE_NAMES, isLight, isTerrainLike } from '@/core/objects';
import type {
  CameraState,
  LightParams,
  Material,
  ObjectType,
  Scene,
  SceneObject,
  Sky,
  StoneParams,
  TerrainData,
  TreeParams,
  Vec3,
} from '@/core/types';
import { defaultMaterialFor } from '@/materials/defaults';
import { terrain } from './terrains';

/** Wireframe family indices (see FAMILY_COLORS in core/defaults.ts). */
export const FAMILY = { gray: 0, blue: 1, green: 2, amber: 3, violet: 4, teal: 5, brown: 6, pink: 7 } as const;

export interface ObjectSpec {
  name?: string;
  /** Position of the object's box center. */
  at?: Vec3;
  /** Half-extents; a number means a uniform size. */
  size?: Vec3 | number;
  /** Euler XYZ, degrees. */
  rot?: Vec3;
  material?: Material;
  family?: number;
  /** Torus tube radius (0.05..0.5). */
  tube?: number;
  stone?: Partial<StoneParams>;
  tree?: Partial<TreeParams>;
  light?: Partial<LightParams>;
  terrain?: TerrainData;
  hidden?: boolean;
}

const vec = (v: Vec3): Vec3 => [v[0], v[1], v[2]];

/** Build one object. Unlike core createObject, never generates throwaway terrains or random seeds. */
export function make(type: ObjectType, spec: ObjectSpec = {}): SceneObject {
  const base = defaultTransform(type);
  const size = spec.size === undefined ? base.scale : typeof spec.size === 'number' ? ([spec.size, spec.size, spec.size] as Vec3) : spec.size;
  const obj: SceneObject = {
    id: newId(),
    name: spec.name ?? OBJECT_BASE_NAMES[type],
    type,
    transform: { position: vec(spec.at ?? base.position), rotation: vec(spec.rot ?? [0, 0, 0]), scale: vec(size) },
    material: spec.material ?? defaultMaterialFor(type),
    family: spec.family ?? 0,
  };
  if (type === 'torus') obj.torus = { minorRadius: spec.tube ?? 0.3 };
  if (type === 'stone') obj.stone = { seed: 7, lumpiness: 0.5, roughness: 0.5, ...spec.stone };
  if (type === 'tree') {
    obj.tree = {
      seed: 11,
      trunkHeight: 0.45,
      trunkWidth: 0.1,
      crown: 'round',
      crownNoise: 0.5,
      trunkColor: [0.32, 0.22, 0.14],
      ...spec.tree,
    };
  }
  if (isTerrainLike(type)) obj.terrain = spec.terrain ?? terrain({ kind: 'fractal', seed: 1, resolution: 128 });
  if (isLight(type)) obj.light = { ...defaultLight(type), ...spec.light };
  if (spec.hidden) obj.hidden = true;
  return obj;
}

/** A camera looking from `position` at `target`. */
export function cam(position: Vec3, target: Vec3, fov = 50, roll = 0): CameraState {
  return { position: vec(position), target: vec(target), roll, fov };
}

/** Assemble a complete scene with default render settings. */
export function composeScene(name: string, objects: SceneObject[], sky: Sky, camera: CameraState): Scene {
  return { version: 1, name, objects, sky, camera, render: defaultRenderSettings() };
}

/**
 * Center and half-size for a terrain box whose base (height 0) sits at baseY and whose
 * tallest point reaches baseY + height. Terrain heights map h -> y = 2h - 1 in object space.
 */
export function terrainBox(center: [number, number], baseY: number, halfWidth: number, height: number, halfDepth = halfWidth): Pick<ObjectSpec, 'at' | 'size'> {
  return { at: [center[0], baseY + height / 2, center[1]], size: [halfWidth, height / 2, halfDepth] };
}
