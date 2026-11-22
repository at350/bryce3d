/** The startup scene and the File > New scene. Owned by the scenes module. */
import { createObject, defaultCamera, defaultRenderSettings } from '@/core/defaults';
import type { Scene } from '@/core/types';
import { defaultSky } from '@/sky/defaults';
import { FAMILY, cam, composeScene, make, terrainBox } from './build/kit';
import * as M from './build/materials';
import { posterSky } from './build/skies';
import { terrain } from './build/terrains';

/** File > New: Bryce starts with a ground plane under the default sky. */
export function emptyScene(): Scene {
  return {
    version: 1,
    name: 'Untitled',
    objects: [createObject('ground')],
    sky: defaultSky(),
    camera: defaultCamera(),
    render: defaultRenderSettings(),
  };
}

/**
 * The first thing every visitor renders: an "alien floating world" poster. A snow-capped
 * island rises from a violet sea, a chrome sphere hovers over its own reflection, a glass
 * dome floats half-sunk, and a grassy rock island drifts in the sky toward a low sun.
 */
export function createDefaultScene(): Scene {
  const objects = [
    make('ground', { name: 'Sea Floor', at: [0, -4, 0], family: FAMILY.brown, material: M.beachSand() }),
    make('water', {
      name: 'Violet Sea',
      at: [0, 0, 0],
      family: FAMILY.teal,
      material: M.water({ name: 'Violet Sea', deep: [0.05, 0.09, 0.26], shallow: [0.28, 0.46, 0.68], reflection: 70, transparency: 24, waves: 14, waveScale: 2.6 }),
    }),
    make('terrain', {
      name: 'Snowcap Island',
      ...terrainBox([18, -14], -1.5, 15, 16),
      rot: [0, -18, 0],
      family: FAMILY.brown,
      material: M.snowyRock([0.5, 0.45, 0.46], 0.56),
      terrain: terrain({ kind: 'mountains', seed: 1994 }),
    }),
    make('terrain', {
      name: 'Far Isles',
      ...terrainBox([-44, -118], -1, 34, 9, 18),
      family: FAMILY.brown,
      material: M.alienRock([0.18, 0.16, 0.26], [0.46, 0.42, 0.58], 'Far Isle Rock'),
      terrain: terrain({ kind: 'islands', seed: 77, resolution: 128 }),
    }),
    make('lattice', {
      name: 'Floating Isle',
      at: [4, 24.5, -32],
      size: [9.5, 4.4, 8],
      rot: [0, 25, 0],
      family: FAMILY.green,
      material: M.islandRock(),
      terrain: terrain({ kind: 'fractal', seed: 3021, resolution: 128, clipLow: 0.04 }),
    }),
    make('sphere', { name: 'Chrome Sphere', at: [-7, 6, 8], size: 4, family: FAMILY.blue, material: M.chrome() }),
    make('sphere', { name: 'Glass Dome', at: [6.5, 0.4, 16], size: 2.6, family: FAMILY.blue, material: M.glass([0.86, 0.92, 1], 'Glass Dome') }),
    make('stone', { name: 'Sea Stack', at: [-11.5, 1.1, 22], size: [2.6, 2.4, 2.2], rot: [0, 20, 0], family: FAMILY.brown, stone: { seed: 41, lumpiness: 0.65, roughness: 0.6 }, material: M.granite([0.36, 0.34, 0.4]) }),
    make('stone', { name: 'Sea Pebble', at: [-7.5, 0.2, 27], size: [1.3, 0.9, 1.1], rot: [0, -35, 0], family: FAMILY.brown, stone: { seed: 42, lumpiness: 0.5, roughness: 0.6 }, material: M.granite([0.36, 0.34, 0.4]) }),
  ];
  return composeScene('First Light', objects, posterSky(), cam([0, 3.2, 44], [0, 7, 0], 50));
}
