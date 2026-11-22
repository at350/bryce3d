/** Surreal presets: eyes, chess, floating orbs and crystals. */
import { mulberry32 } from '@/core/math';
import type { Material, SceneObject } from '@/core/types';
import { FAMILY, make } from '../build/kit';
import * as M from '../build/materials';
import { chessPiece, eyeball, restOn, rotateGroup, scaleGroup, shift, tiltThenYaw, type ChessPiece } from './parts';
import type { ObjectPreset } from './types';

const C = 'Surreal';

const ivory = (): Material => M.pearl();
const ebony = (): Material => M.gloss([0.05, 0.05, 0.07], 'Ebony Lacquer');

/** Board and eight pieces mid-game, board top at y = 0.6. */
export function chessSet(): SceneObject[] {
  const board = make('cube', {
    name: 'Chess Board',
    at: [0, 0.3, 0],
    size: [8, 0.3, 8],
    family: FAMILY.violet,
    material: M.checkerboard([0.1, 0.1, 0.12], [0.9, 0.88, 0.84], 0.25),
  });
  board.material = { ...board.material, components: board.material.components.map((c) => ({ ...c, mapping: 'objectTop' as const })) };
  const place = (piece: ChessPiece, col: number, row: number, white: boolean) =>
    shift(scaleGroup(chessPiece(piece, white ? ivory() : ebony(), `${white ? 'White' : 'Black'} ${piece[0].toUpperCase()}${piece.slice(1)}`), 0.72), [-7 + col * 2, 0.6, -7 + row * 2]);
  return [
    board,
    ...place('king', 4, 7, true),
    ...place('queen', 3, 6, true),
    ...place('knight', 5, 5, true),
    ...place('pawn', 2, 4, true),
    ...place('king', 4, 0, false),
    ...place('rook', 0, 0, false),
    ...place('bishop', 6, 2, false),
    ...place('pawn', 3, 3, false),
  ];
}

function constellation(): SceneObject[] {
  const rand = mulberry32(9);
  const mats = [M.chrome, () => M.glass(), M.gold, M.pearl, () => M.glass([1, 0.6, 0.75], 'Rose Glass')];
  return Array.from({ length: 9 }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const d = 1 + rand() * 6;
    const r = 0.5 + rand() * 1.1;
    return make('sphere', { name: `Floating Orb ${i + 1}`, at: [Math.sin(a) * d, 2 + rand() * 7 + r, Math.cos(a) * d], size: r, family: FAMILY.blue, material: mats[i % mats.length]() });
  });
}

function crystalCluster(): SceneObject[] {
  const amethyst = () => M.crystal([0.72, 0.45, 0.95], 'Amethyst');
  const shards: [number, number, number, number][] = [
    [0, 0, 3.4, 0.5],
    [20, 30, 2.6, 0.38],
    [24, 140, 2.2, 0.34],
    [28, 250, 2.4, 0.36],
    [35, 80, 1.6, 0.28],
    [38, 200, 1.4, 0.26],
    [40, 320, 1.7, 0.3],
  ];
  const out = shards.flatMap(([tilt, yaw, h, w], i) =>
    tiltThenYaw([make('pyramid', { name: `Crystal ${i + 1}`, at: [0, h, 0], size: [w, h, w], rot: [0, 45, 0], material: amethyst(), family: FAMILY.violet })], tilt, yaw),
  );
  out.push(make('stone', { name: 'Geode Rock', at: [0, 0.35, 0], size: [1.5, 0.5, 1.3], family: FAMILY.brown, stone: { seed: 808, lumpiness: 0.6, roughness: 0.7 }, material: M.granite([0.36, 0.33, 0.38]) }));
  return restOn(out);
}

function atom(): SceneObject[] {
  const out: SceneObject[] = [make('sphere', { name: 'Nucleus', at: [0, 0, 0], size: 1.1, material: M.glow([1, 0.55, 0.2], 'Nucleus Glow'), family: FAMILY.amber })];
  for (let i = 0; i < 3; i++) {
    out.push(
      ...tiltThenYaw(
        [
          make('torus', { name: `Orbit ${i + 1}`, at: [0, 0, 0], size: 4, tube: 0.05, material: M.chrome(), family: FAMILY.blue }),
          make('sphere', { name: `Electron ${i + 1}`, at: [Math.cos(i * 2.1) * 3.84, 0, Math.sin(i * 2.1) * 3.84], size: 0.35, material: M.glow([0.4, 0.8, 1], 'Electron Glow'), family: FAMILY.blue }),
        ],
        70,
        i * 60,
      ),
    );
  }
  return shift(out, [0, 6, 0]);
}

function orbTrail(): SceneObject[] {
  const tangerine = () => M.gloss([1, 0.34, 0.06], 'Tangerine Gloss');
  const out: SceneObject[] = [];
  let x = -9;
  for (let i = 0; i < 7; i++) {
    const r = 1.8 * 0.8 ** i;
    const hop = i % 2 ? 1.6 * r : 0;
    out.push(make('sphere', { name: `Orb ${i + 1}`, at: [x, r + hop, -i * 1.6], size: r, material: tangerine(), family: FAMILY.amber }));
    x += r * 2.6;
  }
  return out;
}

function chessPreset(piece: ChessPiece, description: string): ObjectPreset {
  const title = piece[0].toUpperCase() + piece.slice(1);
  return {
    id: `chess-${piece}`,
    name: `Chess ${title}`,
    category: C,
    description,
    build: () => scaleGroup(chessPiece(piece, piece === 'knight' || piece === 'rook' ? ebony() : ivory()), 1.4),
  };
}

export const SURREAL: ObjectPreset[] = [
  {
    id: 'eyeball',
    name: 'Giant Eyeball',
    category: C,
    description: 'A glossy, slightly bloodshot eye the size of a boulder. It is watching the camera.',
    build: () => shift(eyeball(2.2), [0, 2.2, 0]),
  },
  {
    id: 'chess-set',
    name: 'Chess Endgame',
    category: C,
    description: 'A checkerboard slab mid-game: ivory and ebony pieces built entirely from primitives.',
    build: chessSet,
  },
  chessPreset('king', 'Cone body, crown and cross: the tallest piece, from nine primitives.'),
  chessPreset('queen', 'A crowned cone with a ring of pearls on top.'),
  chessPreset('bishop', 'A slender cone with a mitre-shaped ellipsoid head.'),
  chessPreset('knight', 'An abstract horse made of tilted blocks, with two cone ears.'),
  chessPreset('rook', 'A little castle tower with four merlons.'),
  chessPreset('pawn', 'The humble pawn: a cone, a collar and a ball.'),
  {
    id: 'orb-constellation',
    name: 'Orb Constellation',
    category: C,
    description: 'Nine spheres of chrome, glass, gold and pearl hanging weightless in the air.',
    build: constellation,
  },
  {
    id: 'crystal-cluster',
    name: 'Crystal Cluster',
    category: C,
    description: 'Amethyst shards bursting from a dark geode. High refraction, lots of sparkle.',
    build: crystalCluster,
  },
  {
    id: 'atom',
    name: 'Atom',
    category: C,
    description: 'A glowing nucleus circled by three chrome orbits and their electrons.',
    build: atom,
  },
  {
    id: 'ringed-planet',
    name: 'Ringed Planet',
    category: C,
    description: 'A banded gas giant with a tilted ring, hovering just above the horizon.',
    build: () =>
      rotateGroup(
        [
          make('sphere', { name: 'Gas Giant', at: [0, 0, 0], size: 3, material: M.alienRock([0.62, 0.4, 0.24], [0.95, 0.82, 0.6], 'Gas Bands'), family: FAMILY.amber }),
          make('torus', { name: 'Planet Ring', at: [0, 0, 0], size: 5.6, tube: 0.12, material: M.pearl(), family: FAMILY.amber }),
        ],
        [18, 0, -12],
      ).map((o) => ({ ...o, transform: { ...o.transform, position: [o.transform.position[0], o.transform.position[1] + 7, o.transform.position[2]] } })),
  },
  {
    id: 'orb-trail',
    name: 'Bouncing Orbs',
    category: C,
    description: 'Seven tangerine spheres skipping away, each smaller than the last.',
    build: orbTrail,
  },
];
