/** Nature presets: rocks, stones, trees and islands. */
import { clamp, mulberry32 } from '@/core/math';
import type { SceneObject } from '@/core/types';
import { FAMILY, make } from '../build/kit';
import * as M from '../build/materials';
import { fbm } from '../build/noise';
import { shapedTerrain } from '../build/terrains';
import { palm, restOn, tree } from './parts';
import type { ObjectPreset } from './types';

const C = 'Nature';

const stone = (name: string, x: number, z: number, size: [number, number, number], seed: number, yaw = 0, tint: [number, number, number] = [0.5, 0.48, 0.46]) =>
  make('stone', { name, at: [x, size[1], z], size, rot: [0, yaw, 0], family: FAMILY.brown, stone: { seed, lumpiness: 0.55, roughness: 0.6 }, material: M.granite(tint) });

function boulderField(): SceneObject[] {
  const rand = mulberry32(2024);
  return Array.from({ length: 12 }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const d = 2 + rand() * 9;
    const s = 0.5 + rand() * 1.4;
    return stone(`Boulder ${i + 1}`, Math.sin(a) * d, Math.cos(a) * d, [s * (0.9 + rand() * 0.5), s * (0.6 + rand() * 0.3), s], 100 + i, rand() * 360);
  });
}

function standingStones(): SceneObject[] {
  const out: SceneObject[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = 2.4 + ((i * 37) % 10) / 10;
    out.push(
      make('stone', {
        name: `Standing Stone ${i + 1}`,
        at: [Math.sin(a) * 6, h, Math.cos(a) * 6],
        size: [0.75, h, 0.55],
        rot: [0, (a * 180) / Math.PI, 0],
        family: FAMILY.gray,
        stone: { seed: 300 + i, lumpiness: 0.35, roughness: 0.65 },
        material: M.granite([0.52, 0.52, 0.5]),
      }),
    );
  }
  out.push(stone('Recumbent Stone', 0, 0, [1.8, 0.45, 0.9], 399, 20));
  return out;
}

/** A sandy island dome; returns the dome height function too so palms can stand on it. */
function islandDome(halfW: number, height: number) {
  const n = fbm(91, 4, 0.5);
  const dome = (x: number, z: number) => clamp(1 - (x * x + z * z) / 0.72, 0, 1) ** 0.75 * (0.92 + (n(x * 3, z * 3) - 0.5) * 0.12);
  const island = make('terrain', {
    name: 'Sand Island',
    at: [0, height / 2, 0],
    size: [halfW, height / 2, halfW],
    family: FAMILY.amber,
    material: M.beachSand(),
    terrain: shapedTerrain(128, dome, { normalize: false }),
  });
  const surface = (x: number, z: number) => height * dome(x / halfW, z / halfW);
  return { island, surface };
}

/** A sandy islet with three palms, built on y = 0. */
export function palmIsland(): SceneObject[] {
  const { island, surface } = islandDome(9, 2.4);
  const spots: [number, number, number, number, number][] = [
    [0.8, -1.2, 8, 10, 4],
    [-2.6, 1.4, 6.5, -14, 9],
    [2.8, 2.2, 5.5, 18, 13],
  ];
  return [
    island,
    ...spots.map(([x, z, h, lean, seed]) => palm({ x, z, y: surface(x, z) - 0.2, height: h, lean, yaw: seed * 40, seed })),
    stone('Shore Rock', -4.8, -3, [1, 0.6, 0.8], 501, 30),
    stone('Shore Pebble', 5.6, -1.5, [0.6, 0.35, 0.5], 502),
  ];
}

function floatingIsland(): SceneObject[] {
  const rough = fbm(4242, 6, 0.55);
  const profile = (x: number, z: number) => {
    const r2 = (x * x + z * z) / 0.8;
    return clamp(Math.max(0, 1 - r2) ** 0.6 * (0.85 + (rough(x * 4, z * 4) - 0.5) * 0.35), 0, 1);
  };
  const cy = 9;
  const half: [number, number, number] = [6, 3, 6];
  const top = cy + half[1] * profile(0.05, 0.05);
  return [
    make('lattice', {
      name: 'Floating Isle',
      at: [0, cy, 0],
      size: half,
      family: FAMILY.green,
      material: M.islandRock(),
      terrain: shapedTerrain(128, profile, { normalize: false, clipLow: 0.03 }),
    }),
    tree({ x: 0.3, y: top - 0.5, z: 0.3, height: 5, crown: 'round', seed: 77, name: 'Lone Tree' }),
  ];
}

export const NATURE: ObjectPreset[] = [
  {
    id: 'rock-cluster',
    name: 'Rock Cluster',
    category: C,
    description: 'Four weathered granite stones huddled together, big to small.',
    build: () => [
      stone('Big Rock', 0, 0, [2.2, 1.6, 1.9], 11, 15),
      stone('Rock', 2.6, 1.2, [1.3, 1, 1.2], 12, 70),
      stone('Small Rock', -2.2, 1.6, [0.9, 0.6, 0.8], 13, 140),
      stone('Pebble', 1.2, 2.8, [0.5, 0.35, 0.45], 14, 200),
    ],
  },
  {
    id: 'standing-stones',
    name: 'Standing Stones',
    category: C,
    description: 'Seven rough menhirs around a recumbent stone. Nobody remembers who raised them.',
    build: standingStones,
  },
  {
    id: 'tree-grove',
    name: 'Tree Grove',
    category: C,
    description: 'A small mixed grove: broadleaf, conifer and a weeping willow.',
    build: () => [
      tree({ x: 0, z: 0, height: 9, crown: 'round', seed: 21, name: 'Oak' }),
      tree({ x: -5, z: -2, height: 10, crown: 'cone', seed: 22, name: 'Fir' }),
      tree({ x: 4.6, z: -3, height: 8, crown: 'willow', seed: 23, leaves: [0.42, 0.58, 0.2], name: 'Willow' }),
      tree({ x: -2.4, z: 4, height: 6.5, crown: 'round', seed: 24, leaves: [0.32, 0.52, 0.16], name: 'Young Oak' }),
      tree({ x: 3.2, z: 3.6, height: 7.5, crown: 'cone', seed: 25, name: 'Young Fir' }),
    ],
  },
  {
    id: 'pine-forest',
    name: 'Pine Stand',
    category: C,
    description: 'Nine dark conifers of different heights, ready for a snowy mountainside.',
    build: () => {
      const rand = mulberry32(77);
      return Array.from({ length: 9 }, (_, i) => {
        const a = rand() * Math.PI * 2;
        const d = i === 0 ? 0 : 2.5 + rand() * 4.5;
        return tree({ x: Math.sin(a) * d, z: Math.cos(a) * d, height: 7 + rand() * 6, crown: 'cone', seed: 40 + i, name: `Pine ${i + 1}` });
      });
    },
  },
  {
    id: 'blossom-grove',
    name: 'Blossom Trees',
    category: C,
    description: 'Three cherry trees in full pink bloom. Pairs nicely with a lavender sky.',
    build: () => [
      tree({ x: 0, z: 0, height: 7, crown: 'round', seed: 61, leaves: [0.98, 0.62, 0.78], name: 'Cherry Tree' }),
      tree({ x: -4.2, z: 1.8, height: 5.5, crown: 'round', seed: 62, leaves: [0.95, 0.7, 0.85], name: 'Cherry Tree' }),
      tree({ x: 3.8, z: 2.4, height: 6, crown: 'round', seed: 63, leaves: [1, 0.78, 0.88], name: 'Cherry Tree' }),
    ],
  },
  {
    id: 'palm-island',
    name: 'Palm Island',
    category: C,
    description: 'A sandy islet with three leaning palms. Add a water plane and you are on holiday.',
    build: palmIsland,
  },
  {
    id: 'boulder-field',
    name: 'Boulder Field',
    category: C,
    description: 'A dozen boulders strewn across the ground as if dropped by a glacier.',
    build: () => restOn(boulderField()),
  },
  {
    id: 'floating-island',
    name: 'Floating Island',
    category: C,
    description: 'A symmetrical lattice of grassy rock drifting in mid-air, with one stubborn tree on top.',
    build: floatingIsland,
  },
];
