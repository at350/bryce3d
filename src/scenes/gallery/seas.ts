/** Sample scenes: seas, lagoons and islands. */
import type { Scene } from '@/core/types';
import { FAMILY, cam, composeScene, make, terrainBox } from '../build/kit';
import * as M from '../build/materials';
import * as S from '../build/skies';
import { terrain } from '../build/terrains';
import { palmIsland } from '../objects/nature';
import { shift } from '../objects/parts';

const T = FAMILY.teal;
const B = FAMILY.brown;

/** Homage to the reel's first frame: a dark monolith in a teal sea under a pink and teal sky. */
export function monolithSea(): Scene {
  return composeScene(
    'Monolith Sea',
    [
      make('ground', { name: 'Sea Bed', at: [0, -6, 0], family: B, material: M.matte([0.05, 0.12, 0.12], 'Dark Silt') }),
      make('water', {
        name: 'Teal Sea',
        at: [0, 0, 0],
        family: T,
        material: M.water({ name: 'Teal Sea', deep: [0.03, 0.24, 0.22], shallow: [0.26, 0.66, 0.56], reflection: 58, transparency: 18, waves: 22, waveScale: 1.7 }),
      }),
      make('cube', { name: 'Monolith', at: [6, 7, -30], size: [2.2, 9, 0.6], rot: [0, -28, 0], family: FAMILY.gray, material: M.obsidian() }),
      make('cube', { name: 'Distant Monolith', at: [-46, 4, -170], size: [1.6, 6, 0.45], rot: [0, 10, 0], family: FAMILY.gray, material: M.obsidian() }),
    ],
    S.tealDream(),
    cam([0, 2.2, 14], [4, 6.5, -30], 46),
  );
}

/** Cobalt-blue dreamscape: a huge glass sphere hovers over jagged isles and a half-sunk dome. */
export function alienFloatingWorlds(): Scene {
  return composeScene(
    'Alien Floating Worlds',
    [
      make('water', {
        name: 'Mirror Sea',
        at: [0, 0, 0],
        family: T,
        material: M.water({ name: 'Cobalt Mirror Sea', deep: [0.04, 0.06, 0.24], shallow: [0.3, 0.36, 0.7], reflection: 80, transparency: 12, waves: 8, waveScale: 3 }),
      }),
      make('sphere', { name: 'Great Glass Sphere', at: [-10, 14, -12], size: 7.5, family: FAMILY.blue, material: M.glass([0.86, 0.9, 1], 'Dream Glass') }),
      make('sphere', { name: 'Glass Dome', at: [9, 0, 3], size: 4.2, family: FAMILY.blue, material: M.glass([0.8, 0.8, 1], 'Lilac Glass') }),
      make('cone', { name: 'Golden Spire', at: [3.5, 4.5, -1], size: [0.35, 5.2, 0.35], rot: [0, 0, -24], family: FAMILY.amber, material: M.gold() }),
      make('terrain', {
        name: 'Jagged Isle',
        ...terrainBox([24, -44], -1.5, 12, 20),
        family: B,
        material: M.alienRock([0.1, 0.16, 0.14], [0.42, 0.55, 0.5], 'Verdigris Rock'),
        terrain: terrain({ kind: 'spikes', seed: 1999 }),
      }),
      make('terrain', {
        name: 'Low Isle',
        ...terrainBox([-36, -64], -1, 8, 6),
        family: B,
        material: M.alienRock([0.3, 0.12, 0.1], [0.75, 0.42, 0.34], 'Rust Rock'),
        terrain: terrain({ kind: 'mountains', seed: 64, resolution: 128 }),
      }),
      make('lattice', {
        name: 'Drifting Rock',
        at: [18, 24, -60],
        size: [5, 2.4, 4],
        rot: [0, 30, 0],
        family: FAMILY.green,
        material: M.islandRock(),
        terrain: terrain({ kind: 'fractal', seed: 808, resolution: 128, clipLow: 0.05 }),
      }),
      make('lattice', {
        name: 'High Drifter',
        at: [-30, 30, -95],
        size: [4, 2, 3.5],
        family: FAMILY.green,
        material: M.islandRock(),
        terrain: terrain({ kind: 'fractal', seed: 909, resolution: 128, clipLow: 0.05 }),
      }),
    ],
    S.cobaltDream(),
    cam([0, 4, 30], [0, 9.5, -10], 55),
  );
}

/** Turquoise shallows ringed by rocky isles, with chrome spheres hovering over the sand. */
export function chromeSphereLagoon(): Scene {
  return composeScene(
    'Chrome Sphere Lagoon',
    [
      make('ground', { name: 'Lagoon Sand', at: [0, -1.6, 0], family: B, material: M.beachSand() }),
      make('water', {
        name: 'Lagoon',
        at: [0, 0, 0],
        family: T,
        material: M.water({ name: 'Turquoise Lagoon', deep: [0.02, 0.34, 0.4], shallow: [0.4, 0.88, 0.82], reflection: 42, transparency: 58, waves: 10, waveScale: 2 }),
      }),
      make('terrain', { name: 'West Isle', ...terrainBox([-28, -32], -1.8, 14, 13), family: B, material: M.islandRock(), terrain: terrain({ kind: 'mountains', seed: 311 }) }),
      make('terrain', { name: 'East Isle', ...terrainBox([30, -50], -1.8, 18, 17), rot: [0, 40, 0], family: B, material: M.islandRock(), terrain: terrain({ kind: 'alpine', seed: 312 }) }),
      make('terrain', { name: 'Far Ridge', ...terrainBox([0, -130], -1, 44, 11, 16), family: B, material: M.islandRock(), terrain: terrain({ kind: 'mountains', seed: 313, resolution: 128 }) }),
      ...shift(palmIsland(), [-13, -1.4, 6]),
      make('sphere', { name: 'Hovering Chrome', at: [5, 6, -8], size: 3.6, family: FAMILY.blue, material: M.chrome() }),
      make('sphere', { name: 'Resting Chrome', at: [-2, 1.2, 6], size: 2, family: FAMILY.blue, material: M.chrome() }),
      make('sphere', { name: 'Little Chrome', at: [12, 3.2, 5], size: 1.2, family: FAMILY.blue, material: M.chrome() }),
    ],
    S.tropicalNoon(),
    cam([0, 3.6, 34], [1, 4, -10], 52),
  );
}

/** The Bryce 2 box cover remembered: purple crags, turquoise shallows and a far sandy shore. */
export function tropicalCove(): Scene {
  const crag = () => M.alienRock([0.2, 0.18, 0.26], [0.6, 0.56, 0.66], 'Purple Crag');
  return composeScene(
    'Tropical Cove',
    [
      make('ground', { name: 'Shallows Sand', at: [0, -1.1, 0], family: B, material: M.beachSand() }),
      make('water', {
        name: 'Cove Water',
        at: [0, 0, 0],
        family: T,
        material: M.water({ name: 'Cove Shallows', deep: [0.05, 0.4, 0.38], shallow: [0.45, 0.92, 0.78], reflection: 38, transparency: 62, waves: 8, waveScale: 1.6 }),
      }),
      make('terrain', { name: 'Foreground Crag', ...terrainBox([-13, 6], -1.6, 12, 10), rot: [0, 15, 0], family: B, material: crag(), terrain: terrain({ kind: 'mountains', seed: 1996 }) }),
      make('terrain', { name: 'Sand Bar', ...terrainBox([12, -18], -1.6, 20, 3.4, 12), family: FAMILY.amber, material: M.beachSand(), terrain: terrain({ kind: 'dunes', seed: 21, resolution: 128 }) }),
      make('terrain', { name: 'Headland', ...terrainBox([36, -80], -1, 34, 24), family: B, material: M.islandRock(), terrain: terrain({ kind: 'alpine', seed: 1997 }) }),
      make('terrain', { name: 'Far Point', ...terrainBox([-40, -120], -1, 30, 10), family: B, material: crag(), terrain: terrain({ kind: 'mountains', seed: 1998, resolution: 128 }) }),
      ...[
        [-3, 1.2, [1.5, 0.8, 1.2]],
        [4, -2, [1, 0.6, 0.9]],
        [-6, -8, [1.8, 0.9, 1.4]],
        [8, 8, [0.8, 0.5, 0.7]],
        [1, 12, [1.2, 0.5, 1]],
      ].map(([x, z, size], i) =>
        make('stone', { name: `Reef Rock ${i + 1}`, at: [x as number, 0, z as number], size: size as [number, number, number], family: B, stone: { seed: 900 + i, lumpiness: 0.6, roughness: 0.7 }, material: crag() }),
      ),
    ],
    S.lavenderNoon(),
    cam([3, 6, 30], [5, 1.5, -12], 56),
  );
}

/** Tangerine spheres skipping across a summer sea, smaller and smaller toward the horizon. */
export function tangerineTide(): Scene {
  const orbs: [number, number, number, number][] = [
    [-7.5, 4.2, 5, 3],
    [-2.5, 2.2, -8, 2.2],
    [4, 3.8, -20, 1.6],
    [9, 1.1, -32, 1.1],
    [13, 2.5, -44, 0.8],
    [16, 0.6, -56, 0.55],
    [18.5, 1.6, -68, 0.4],
  ];
  return composeScene(
    'Tangerine Tide',
    [
      make('water', {
        name: 'Summer Sea',
        at: [0, 0, 0],
        family: T,
        material: M.water({ name: 'Summer Sea', deep: [0.02, 0.12, 0.4], shallow: [0.2, 0.45, 0.8], reflection: 60, transparency: 15, waves: 18, waveScale: 2 }),
      }),
      ...orbs.map(([x, y, z, r], i) => make('sphere', { name: `Tangerine Orb ${i + 1}`, at: [x, y, z], size: r, family: FAMILY.amber, material: M.gloss([1, 0.34, 0.06], 'Tangerine Gloss') })),
    ],
    S.azureSummer(),
    cam([0, 4, 24], [3, 3, -20], 50),
  );
}

/** Still black water between ice walls; icebergs drift in the fog under a pale overcast sky. */
export function frozenFjord(): Scene {
  const ice = () => M.iceShelf();
  return composeScene(
    'Frozen Fjord',
    [
      make('water', {
        name: 'Fjord',
        at: [0, 0, 0],
        family: T,
        material: M.water({ name: 'Glacial Water', deep: [0.02, 0.06, 0.1], shallow: [0.2, 0.32, 0.4], reflection: 82, transparency: 10, waves: 4, waveScale: 3.5 }),
      }),
      make('terrain', { name: 'West Wall', ...terrainBox([-36, -60], -2, 24, 42, 70), family: B, material: M.snowyRock([0.32, 0.34, 0.38], 0.42), terrain: terrain({ kind: 'alpine', seed: 61 }) }),
      make('terrain', { name: 'East Wall', ...terrainBox([38, -72], -2, 26, 46, 74), family: B, material: M.snowyRock([0.32, 0.34, 0.38], 0.45), terrain: terrain({ kind: 'alpine', seed: 62 }) }),
      make('terrain', { name: 'Glacier Peak', ...terrainBox([0, -190], -2, 60, 56), family: B, material: ice(), terrain: terrain({ kind: 'mountains', seed: 63 }) }),
      make('stone', { name: 'Iceberg', at: [-6, 0.6, -10], size: [3.2, 1.8, 2.6], family: FAMILY.blue, stone: { seed: 71, lumpiness: 0.4, roughness: 0.3 }, material: ice() }),
      make('stone', { name: 'Floe', at: [7, 0.2, -2], size: [2, 0.7, 1.6], rot: [0, 40, 0], family: FAMILY.blue, stone: { seed: 72, lumpiness: 0.3, roughness: 0.3 }, material: ice() }),
      make('stone', { name: 'Far Berg', at: [4, 1, -40], size: [4, 2.6, 3], family: FAMILY.blue, stone: { seed: 73, lumpiness: 0.45, roughness: 0.3 }, material: ice() }),
      make('cube', { name: 'Ice Block', at: [2, 0.5, 8], size: [1, 0.9, 1], rot: [12, 30, 8], family: FAMILY.blue, material: M.crystal([0.8, 0.92, 1], 'Clear Ice') }),
    ],
    S.arcticOvercast(),
    cam([0, 4.5, 40], [0, 10, -60], 55),
  );
}
