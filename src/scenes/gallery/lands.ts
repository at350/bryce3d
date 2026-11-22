/** Sample scenes: canyons, mountains and deserts. */
import type { Scene } from '@/core/types';
import { FAMILY, cam, composeScene, make, terrainBox } from '../build/kit';
import * as M from '../build/materials';
import * as S from '../build/skies';
import { riverCanyon, terrain } from '../build/terrains';
import { palm, shift } from '../objects/parts';
import { ARCHITECTURE } from '../objects/architecture';

const B = FAMILY.brown;

/** Looking down a terraced sandstone gorge as a green river winds into the golden haze. */
export function canyonRiver(): Scene {
  const canyonH = 24;
  return composeScene(
    'Canyon River',
    [
      make('ground', { name: 'Desert Floor', at: [0, 0, 0], family: FAMILY.amber, material: M.desertSand() }),
      make('terrain', { name: 'Canyon', ...terrainBox([0, -40], -0.8, 34, canyonH, 70), family: B, material: M.canyonStrata(), terrain: riverCanyon(7) }),
      make('square', {
        name: 'River',
        at: [0, 0.4, -40],
        size: [34, 1, 70],
        family: FAMILY.teal,
        material: M.water({ name: 'Jade River', deep: [0.06, 0.24, 0.18], shallow: [0.3, 0.55, 0.42], reflection: 50, transparency: 20, waves: 12, waveScale: 1.2 }),
      }),
      make('terrain', { name: 'Far Mesas', ...terrainBox([20, -190], -0.5, 70, 22, 20), family: B, material: M.canyonStrata(), terrain: terrain({ kind: 'mesa', seed: 8, resolution: 128 }) }),
    ],
    S.desertGold(),
    cam([2, 27, 36], [0, 6, -50], 52),
  );
}

/** Snow peaks under a full moon and a sky full of stars; mist pools on a frozen lake. */
export function moonlitPeaks(): Scene {
  return composeScene(
    'Moonlit Peaks',
    [
      make('water', {
        name: 'Frozen Lake',
        at: [0, 0, 0],
        family: FAMILY.teal,
        material: M.water({ name: 'Night Lake', deep: [0.01, 0.02, 0.06], shallow: [0.12, 0.18, 0.3], reflection: 85, transparency: 6, waves: 3, waveScale: 4 }),
      }),
      make('terrain', { name: 'Great Peak', ...terrainBox([6, -120], -2, 60, 48), family: B, material: M.snowyRock([0.3, 0.32, 0.38], 0.5), terrain: terrain({ kind: 'alpine', seed: 71 }) }),
      make('terrain', { name: 'West Spur', ...terrainBox([-70, -70], -2, 40, 30), rot: [0, 20, 0], family: B, material: M.snowyRock([0.3, 0.32, 0.38], 0.48), terrain: terrain({ kind: 'mountains', seed: 72 }) }),
      make('terrain', { name: 'East Spur', ...terrainBox([66, -84], -2, 44, 34), rot: [0, -15, 0], family: B, material: M.snowyRock([0.3, 0.32, 0.38], 0.5), terrain: terrain({ kind: 'alpine', seed: 73 }) }),
      make('terrain', { name: 'Near Shore', ...terrainBox([-26, 8], -1, 16, 4), family: B, material: M.snowField([0.75, 0.8, 0.95]), terrain: terrain({ kind: 'hills', seed: 74, resolution: 128 }) }),
    ],
    S.moonNight(),
    cam([0, 5, 40], [0, 16, -60], 55),
  );
}

/** Three pyramids on a golden plain, an obelisk, and a tiny oasis with two palms. */
export function desertPyramids(): Scene {
  const pyramids = ARCHITECTURE.find((p) => p.id === 'pyramid-complex')!.build();
  return composeScene(
    'Desert Pyramids',
    [
      make('ground', { name: 'Desert', at: [0, 0, 0], family: FAMILY.amber, material: M.desertSand() }),
      make('terrain', { name: 'Dune Horizon', ...terrainBox([0, -170], -1, 140, 8, 40), family: FAMILY.amber, material: M.desertSand(), terrain: terrain({ kind: 'dunes', seed: 9, resolution: 128 }) }),
      ...shift(pyramids, [2, 0, -34]),
      make('cube', { name: 'Obelisk', at: [15, 6, 6], size: [0.7, 6, 0.7], family: FAMILY.amber, material: M.granite([0.6, 0.52, 0.46]) }),
      make('pyramid', { name: 'Obelisk Tip', at: [15, 12.45, 6], size: [0.7, 0.45, 0.7], family: FAMILY.amber, material: M.gold() }),
      make('disc', {
        name: 'Oasis',
        at: [-13, 0.05, 10],
        size: [4.5, 1, 3.2],
        family: FAMILY.teal,
        material: M.water({ name: 'Oasis Pool', deep: [0.04, 0.25, 0.25], shallow: [0.3, 0.6, 0.5], reflection: 60, transparency: 25, waves: 5 }),
      }),
      palm({ x: -16, z: 8, height: 8, lean: -10, seed: 4 }),
      palm({ x: -10.5, z: 7, height: 6.5, lean: 12, yaw: 60, seed: 6 }),
    ],
    S.desertGold(),
    cam([6, 3.2, 40], [-2, 6, -20], 50),
  );
}
