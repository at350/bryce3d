/** Sample scenes: alien worlds and cosmic surrealism. */
import type { Scene, SceneObject } from '@/core/types';
import { FAMILY, cam, composeScene, make, terrainBox } from '../build/kit';
import * as M from '../build/materials';
import * as S from '../build/skies';
import { VOLCANO_POOL_LEVEL, terrain, volcanoCone } from '../build/terrains';
import { aimDown, palm, rotateGroup, scaleGroup, shift } from '../objects/parts';
import { chessSet } from '../objects/surreal';

/** A basalt volcano over a sea of molten lava; a black mirror sphere hangs in the red haze. */
export function lavaPlanet(): Scene {
  const volcanoH = 30;
  const poolY = -1 + volcanoH * VOLCANO_POOL_LEVEL;
  return composeScene(
    'Lava Planet',
    [
      make('ground', { name: 'Lava Sea', at: [0, 0, 0], family: FAMILY.amber, material: M.moltenLava() }),
      make('terrain', { name: 'Volcano', ...terrainBox([4, -70], -1, 42, volcanoH), family: FAMILY.brown, material: M.lavaRock(), terrain: volcanoCone(66) }),
      make('disc', { name: 'Crater Lava', at: [4, poolY, -70], size: [6, 1, 6], family: FAMILY.amber, material: M.moltenLava() }),
      make('radialLight', { name: 'Crater Glow', at: [4, poolY + 5, -70], size: 0.5, family: FAMILY.amber, light: { color: [1, 0.42, 0.12], intensity: 160, falloff: 'linear', visible: false } }),
      make('terrain', { name: 'Basalt Shelf', ...terrainBox([-20, -6], -1.2, 11, 6), rot: [0, 25, 0], family: FAMILY.brown, material: M.lavaRock(), terrain: terrain({ kind: 'mountains', seed: 451, resolution: 128 }) }),
      make('stone', { name: 'Cinder Block', at: [12, 0.6, 8], size: [1.8, 1.2, 1.5], family: FAMILY.brown, stone: { seed: 452, lumpiness: 0.6, roughness: 0.8 }, material: M.lavaRock() }),
      make('stone', { name: 'Cinder', at: [7, 0.3, 14], size: [0.9, 0.6, 0.8], family: FAMILY.brown, stone: { seed: 453, lumpiness: 0.6, roughness: 0.8 }, material: M.lavaRock() }),
      make('sphere', { name: 'Black Mirror', at: [9, 8, -8], size: 3.4, family: FAMILY.blue, material: M.blackMirror() }),
    ],
    S.infernalSky(),
    cam([0, 6, 32], [2, 11, -40], 55),
  );
}

/** A chrome ring holding a gilded crystal, orbited by satellite spheres over a pastel sea. */
export function orbitalGarden(): Scene {
  const center: [number, number, number] = [0, 12, -10];
  const ringR = 7;
  const satellites: SceneObject[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const strutLen = 2.4;
    const mid = ringR + strutLen / 2;
    satellites.push(
      make('cylinder', {
        name: `Strut ${i + 1}`,
        at: [center[0] + dx * mid, center[1] + dy * mid, center[2]],
        size: [0.12, strutLen / 2, 0.12],
        rot: [0, 0, (a * 180) / Math.PI - 90],
        family: FAMILY.blue,
        material: M.chrome(),
      }),
      make('sphere', {
        name: `Satellite ${i + 1}`,
        at: [center[0] + dx * (ringR + strutLen + 1.3), center[1] + dy * (ringR + strutLen + 1.3), center[2]],
        size: 1.4,
        family: FAMILY.blue,
        material: i % 2 ? M.chrome() : M.glass([0.75, 0.95, 0.95], 'Aqua Glass'),
      }),
    );
  }
  return composeScene(
    'Orbital Garden',
    [
      make('water', {
        name: 'Pastel Sea',
        at: [0, 0, 0],
        family: FAMILY.teal,
        material: M.water({ name: 'Pastel Sea', deep: [0.32, 0.24, 0.5], shallow: [0.85, 0.65, 0.85], reflection: 72, transparency: 10, waves: 6, waveScale: 3 }),
      }),
      make('torus', { name: 'Great Ring', at: center, size: ringR + 0.5, rot: [90, 0, 0], tube: 0.12, family: FAMILY.blue, material: M.chrome() }),
      make('sphere', { name: 'Inner Glass', at: center, size: 3.6, family: FAMILY.blue, material: M.glass([0.95, 0.92, 1], 'Moon Glass') }),
      make('pyramid', { name: 'Crystal Upper', at: [center[0], center[1] + 1.2, center[2]], size: [1.3, 1.2, 1.3], rot: [0, 45, 0], family: FAMILY.amber, material: M.gold() }),
      make('pyramid', { name: 'Crystal Lower', at: [center[0], center[1] - 1.2, center[2]], size: [1.3, 1.2, 1.3], rot: [180, 45, 0], family: FAMILY.amber, material: M.gold() }),
      ...satellites,
    ],
    S.pastelSwirl(),
    cam([0, 9, 28], [0, 11.5, -10], 52),
  );
}

/** An endless neon grid toward a huge setting sun, chrome shapes and palm silhouettes. */
export function vaporwaveGrid(): Scene {
  const night = () => M.leaves([0.12, 0.04, 0.2], 'Night Fronds');
  const palmL = palm({ x: -16, z: -6, height: 11, lean: -10, yaw: 30, seed: 3 });
  const palmR = palm({ x: 17, z: -14, height: 9, lean: 12, yaw: 200, seed: 8 });
  return composeScene(
    'Vaporwave Grid',
    [
      make('ground', { name: 'Neon Grid', at: [0, 0, 0], family: FAMILY.pink, material: M.neonGrid([1, 0.2, 0.85], [0.04, 0.01, 0.09], 4) }),
      make('sphere', { name: 'Sunset Disc', at: [0, 20, -220], size: [52, 52, 1], family: FAMILY.amber, material: M.glow([1, 0.42, 0.5], 'Sunset Glow') }),
      make('sphere', { name: 'Chrome Orb', at: [0, 3, -8], size: 3, family: FAMILY.blue, material: M.chrome() }),
      make('pyramid', { name: 'Chrome Pyramid', at: [-24, 7, -60], size: [9, 7, 9], rot: [0, 30, 0], family: FAMILY.blue, material: M.chrome() }),
      make('pyramid', { name: 'Magenta Pyramid', at: [26, 5, -48], size: [6, 5, 6], rot: [0, 12, 0], family: FAMILY.pink, material: M.gloss([0.95, 0.15, 0.7], 'Hot Magenta') }),
      make('torus', { name: 'Cyan Ring', at: [10, 0.35, 4], size: 2.4, tube: 0.12, family: FAMILY.teal, material: M.glow([0.2, 0.95, 1], 'Cyan Neon') }),
      { ...palmL, material: night() },
      { ...palmR, material: night() },
    ],
    S.vaporSunset(),
    cam([0, 3.4, 26], [0, 7, -40], 56),
  );
}

/** A chessboard adrift among the stars, a ringed giant on the horizon. */
export function cosmicChess(): Scene {
  const lifted = shift(rotateGroup(scaleGroup(chessSet(), 1.4), [0, -28, 0]), [0, 8, 0]);
  const planet = rotateGroup(
    [
      make('sphere', { name: 'Gas Giant', at: [0, 0, 0], size: 14, family: FAMILY.amber, material: M.alienRock([0.2, 0.25, 0.55], [0.6, 0.72, 0.95], 'Ice Giant Bands') }),
      make('torus', { name: 'Giant Ring', at: [0, 0, 0], size: 26, tube: 0.1, family: FAMILY.amber, material: M.pearl() }),
    ],
    [20, 0, -15],
  );
  const keyPos: [number, number, number] = [-30, 40, 30];
  return composeScene(
    'Cosmic Chess',
    [
      ...lifted,
      ...shift(planet, [-60, 30, -140]),
      make('parallelLight', { name: 'Starlight', at: keyPos, size: 1, rot: aimDown(keyPos, [0, 8, 0]), family: FAMILY.amber, light: { color: [0.85, 0.9, 1], intensity: 85 } }),
      make('radialLight', { name: 'Nebula Glow', at: [14, 4, -10], size: 0.5, family: FAMILY.amber, light: { color: [0.4, 0.55, 1], intensity: 90, falloff: 'linear', visible: false } }),
    ],
    S.deepSpace(),
    cam([12, 21, 26], [0, 8.5, 0], 44),
  );
}
