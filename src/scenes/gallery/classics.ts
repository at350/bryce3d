/** Sample scenes: ray-tracing classics and surreal still lifes. */
import type { Scene, SceneObject } from '@/core/types';
import { FAMILY, cam, composeScene, make, terrainBox } from '../build/kit';
import * as M from '../build/materials';
import * as S from '../build/skies';
import { terrain } from '../build/terrains';
import { column, eyeball, rotateGroup, shift, tree } from '../objects/parts';
import { SURREAL } from '../objects/surreal';

/** The ray tracer's oldest joke: glass and mirror balls on an infinite checkerboard. */
export function glassOrbsCheckerboard(): Scene {
  const ball = (name: string, x: number, z: number, r: number, material: SceneObject['material']) =>
    make('sphere', { name, at: [x, r, z], size: r, family: FAMILY.blue, material });
  return composeScene(
    'Glass Orbs & Checkerboard',
    [
      make('ground', { name: 'Checkerboard', at: [0, 0, 0], family: FAMILY.gray, material: M.checkerboard() }),
      ball('Glass Orb', 0, 0, 3, M.glass()),
      ball('Mirror Orb', -6.6, -3, 2, M.chrome()),
      ball('Ruby Orb', 5.4, 3, 1.5, M.glass([1, 0.35, 0.4], 'Ruby Glass')),
      ball('Gold Orb', 7.2, -6, 2.2, M.gold()),
      ball('Sapphire Orb', -3.6, 5, 1.1, M.glass([0.4, 0.55, 1], 'Sapphire Glass')),
      ball('Emerald Orb', 2.2, 7, 0.8, M.glass([0.45, 1, 0.6], 'Emerald Glass')),
      ball('Pearl', -9, 4, 0.9, M.pearl()),
    ],
    S.clearBlue(),
    cam([0, 4.6, 22], [0, 1.8, 0], 45),
  );
}

/** A giant eye rests in a summer meadow and watches you back, under a lavender sky. */
export function eyeballMeadow(): Scene {
  const big = shift(rotateGroup(eyeball(4.5, [0.15, 0.55, 0.35]), [-8, 6, 0]), [0, 4.5, -6]);
  const small = (x: number, z: number, r: number, yaw: number, irisColor: [number, number, number]) =>
    shift(rotateGroup(eyeball(r, irisColor), [-15, yaw, 0]), [x, r, z]);
  return composeScene(
    'Eyeball Meadow',
    [
      make('ground', { name: 'Meadow', at: [0, 0, 0], family: FAMILY.green, material: M.meadowGrass() }),
      make('terrain', { name: 'Rolling Hills', ...terrainBox([0, -110], -1, 110, 16, 40), family: FAMILY.green, material: M.meadowGrass(), terrain: terrain({ kind: 'hills', seed: 5 }) }),
      ...big,
      ...small(-9, 2, 0.9, 35, [0.55, 0.3, 0.12]),
      ...small(8, 6, 0.7, -50, [0.3, 0.35, 0.85]),
      ...small(-4, 9, 0.5, 15, [0.6, 0.2, 0.6]),
      tree({ x: -15, z: -14, height: 9, seed: 31, name: 'Meadow Oak' }),
      tree({ x: 16, z: -20, height: 11, crown: 'willow', seed: 32, leaves: [0.4, 0.6, 0.22], name: 'Willow' }),
      tree({ x: 22, z: -8, height: 7, seed: 33, leaves: [0.98, 0.62, 0.8], name: 'Blossom' }),
    ],
    S.lavenderDream(),
    cam([0, 3, 22], [0, 5, -6], 50),
  );
}

/** A golden oracle orb floats above frosted ruins; green blades break through the snow. */
export function oracleRuins(): Scene {
  const stone = () => M.marble([0.55, 0.52, 0.62], [0.82, 0.8, 0.9]);
  const columns = [
    column({ x: -9, z: -8, height: 6, radius: 1.2, material: stone(), broken: 0.75, name: 'Fluted Drum' }),
    column({ x: -6.5, z: -4, height: 6, radius: 1.3, material: stone(), broken: 0.5, name: 'Broken Column' }),
    column({ x: 10, z: -12, height: 9, radius: 1.1, material: stone(), broken: 0.9, name: 'Tall Ruin' }),
    column({ x: 14, z: -4, height: 5, radius: 1.4, material: stone(), broken: 0.4, name: 'Stump' }),
  ].flat();
  const blades = Array.from({ length: 9 }, (_, i) => {
    const x = -8 + i * 1.3 + Math.sin(i * 2.3);
    const z = 6 + Math.cos(i * 1.7) * 2;
    return make('cone', {
      name: `Grass Blade ${i + 1}`,
      at: [x, 0.9, z],
      size: [0.12, 1.1, 0.12],
      rot: [Math.sin(i) * 25, i * 40, 20 + Math.cos(i * 3) * 15],
      family: FAMILY.green,
      material: M.gloss([0.2, 0.65, 0.2], 'Blade Green'),
    });
  });
  const orbCenter: [number, number, number] = [0, 5.6, -6];
  const crystals = shift(SURREAL.find((p) => p.id === 'crystal-cluster')!.build(), [9, 0, 4]);
  return composeScene(
    'Oracle Ruins',
    [
      make('ground', { name: 'Frost Plain', at: [0, 0, 0], family: FAMILY.gray, material: M.snowField() }),
      ...columns,
      make('cylinder', { name: 'Stepping Slab', at: [2, 0.25, 4], size: [2.2, 0.25, 2.2], family: FAMILY.amber, material: stone() }),
      make('cylinder', { name: 'Stepping Slab', at: [-3, 0.2, 9], size: [1.6, 0.2, 1.6], family: FAMILY.amber, material: stone() }),
      make('sphere', { name: 'Oracle Orb', at: orbCenter, size: 2.6, family: FAMILY.amber, material: M.gold() }),
      make('torus', { name: 'Orb Halo', at: orbCenter, size: 3.1, rot: [90, 0, 0], tube: 0.05, family: FAMILY.amber, material: M.glow([1, 0.85, 0.35], 'Halo Glow') }),
      ...blades,
      ...crystals,
    ],
    S.violetStorm(),
    cam([0, 3.4, 22], [0, 5, -6], 50),
  );
}
