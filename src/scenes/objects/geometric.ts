/** Geometric presets: pure-primitive sculpture in the Bryce tradition. */
import { DEG } from '@/core/math';
import type { SceneObject } from '@/core/types';
import { FAMILY, make } from '../build/kit';
import * as M from '../build/materials';
import { restOn } from './parts';
import type { ObjectPreset } from './types';

const C = 'Geometric';

/** A round Roman arch: two piers and a ring of wedge stones. */
function arch(): SceneObject[] {
  const m = M.limestone();
  const f = FAMILY.amber;
  const span = 3.2;
  const pierH = 5;
  const thick = 1.1;
  const depth = 1.4;
  const n = 9;
  const radius = span + thick / 2;
  const half = ((Math.PI * radius) / n / 2) * 0.95;
  const stones = Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * (i + 0.5)) / n;
    const key = i === (n - 1) / 2;
    return make('cube', {
      name: key ? 'Keystone' : `Voussoir ${i + 1}`,
      at: [Math.cos(a) * radius, pierH + Math.sin(a) * radius, 0],
      size: [half * (key ? 1.08 : 1), (thick / 2) * (key ? 1.15 : 1), (depth / 2) * (key ? 1.06 : 1)],
      rot: [0, 0, a / DEG - 90],
      material: m,
      family: f,
    });
  });
  return [
    make('cube', { name: 'Left Pier', at: [-radius, pierH / 2, 0], size: [thick / 2 + 0.1, pierH / 2, depth / 2 + 0.05], material: m, family: f }),
    make('cube', { name: 'Right Pier', at: [radius, pierH / 2, 0], size: [thick / 2 + 0.1, pierH / 2, depth / 2 + 0.05], material: m, family: f }),
    ...stones,
  ];
}

function stairs(): SceneObject[] {
  const m = M.marble([0.6, 0.6, 0.64]);
  return Array.from({ length: 10 }, (_, i) =>
    make('cube', { name: `Step ${i + 1}`, at: [0, (i + 1) * 0.25, -i * 0.7], size: [2.6, (i + 1) * 0.25, 0.35], material: m, family: FAMILY.amber }),
  );
}

function sphereStack(): SceneObject[] {
  const out: SceneObject[] = [];
  const r = 1;
  const layers = [3, 2, 1];
  layers.forEach((n, layer) => {
    const y = r + layer * r * Math.SQRT2;
    const off = ((n - 1) * r);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      out.push(make('sphere', { name: `Cannonball ${out.length + 1}`, at: [i * 2 * r - off, y, j * 2 * r - off], size: r, material: layer === 2 ? M.gold() : M.chrome(), family: FAMILY.blue }));
    }
  });
  return out;
}

export const GEOMETRIC: ObjectPreset[] = [
  {
    id: 'monolith',
    name: 'Monolith',
    category: C,
    description: 'A slab of polished night, proportioned 1:4:9. It hums faintly when nobody is looking.',
    build: () => [make('cube', { name: 'Monolith', at: [0, 4.5, 0], size: [2, 4.5, 0.5], material: M.obsidian(), family: FAMILY.gray })],
  },
  {
    id: 'arch',
    name: 'Stone Arch',
    category: C,
    description: 'Two piers and nine wedge stones locked by a keystone. Frame a sunset through it.',
    build: arch,
  },
  {
    id: 'column',
    name: 'Marble Column',
    category: C,
    description: 'A single classical column with plinth, rings and capital, in white veined marble.',
    build: () => column8(),
  },
  {
    id: 'pedestal-orb',
    name: 'Pedestal & Orb',
    category: C,
    description: 'A fluted plinth presenting a perfect mirror sphere: the essential Bryce still life.',
    build: () => [
      make('cube', { name: 'Pedestal Base', at: [0, 0.3, 0], size: [1.5, 0.3, 1.5], material: M.marble(), family: FAMILY.amber }),
      make('cylinder', { name: 'Pedestal', at: [0, 1.9, 0], size: [0.9, 1.3, 0.9], material: M.marble(), family: FAMILY.amber }),
      make('cube', { name: 'Pedestal Top', at: [0, 3.4, 0], size: [1.25, 0.2, 1.25], material: M.marble(), family: FAMILY.amber }),
      make('sphere', { name: 'Mirror Orb', at: [0, 4.75, 0], size: 1.15, material: M.chrome(), family: FAMILY.blue }),
    ],
  },
  {
    id: 'sphere-ring',
    name: 'Ring of Spheres',
    category: C,
    description: 'Twelve chrome spheres in a perfect circle, each reflecting all the others.',
    build: () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return make('sphere', { name: `Ring Sphere ${i + 1}`, at: [Math.sin(a) * 6, 1, Math.cos(a) * 6], size: 1, material: M.chrome(), family: FAMILY.blue });
      }),
  },
  {
    id: 'stairs',
    name: 'Stairway',
    category: C,
    description: 'Ten marble steps climbing away from you toward nothing in particular.',
    build: stairs,
  },
  {
    id: 'obelisk',
    name: 'Obelisk',
    category: C,
    description: 'A tall granite needle capped with a gilded pyramidion.',
    build: () => [
      make('cube', { name: 'Obelisk Base', at: [0, 0.5, 0], size: [1.6, 0.5, 1.6], material: M.granite([0.55, 0.5, 0.48]), family: FAMILY.amber }),
      make('cube', { name: 'Obelisk Shaft', at: [0, 6, 0], size: [0.85, 5, 0.85], material: M.granite([0.62, 0.56, 0.52]), family: FAMILY.amber }),
      make('pyramid', { name: 'Pyramidion', at: [0, 11.6, 0], size: [0.85, 0.6, 0.85], material: M.gold(), family: FAMILY.amber }),
    ],
  },
  {
    id: 'torus-gate',
    name: 'Torus Gate',
    category: C,
    description: 'A chrome ring standing on its edge in a low stone cradle. Step through.',
    build: () => [
      make('torus', { name: 'Gate Ring', at: [0, 4.2, 0], size: 4, rot: [90, 0, 0], tube: 0.14, material: M.chrome(), family: FAMILY.blue }),
      make('cube', { name: 'Gate Cradle', at: [0, 0.3, 0], size: [1.6, 0.3, 0.9], material: M.granite(), family: FAMILY.gray }),
    ],
  },
  {
    id: 'cannonball-stack',
    name: 'Sphere Pyramid',
    category: C,
    description: 'Fourteen mirror balls stacked like cannonballs, crowned with gold.',
    build: () => restOn(sphereStack()),
  },
  {
    id: 'platonic-trio',
    name: 'Primitive Trio',
    category: C,
    description: 'Cube, cone and sphere in glossy primary colors: the first lesson of every 3D program.',
    build: () => [
      make('cube', { name: 'Red Cube', at: [-3, 1.5, 0], size: 1.5, rot: [0, 25, 0], material: M.gloss([0.85, 0.12, 0.1], 'Red Gloss'), family: FAMILY.pink }),
      make('cone', { name: 'Yellow Cone', at: [0, 2, -1.5], size: [1.4, 2, 1.4], material: M.gloss([0.95, 0.75, 0.1], 'Yellow Gloss'), family: FAMILY.amber }),
      make('sphere', { name: 'Blue Sphere', at: [2.8, 1.4, 0.6], size: 1.4, material: M.gloss([0.1, 0.3, 0.85], 'Blue Gloss'), family: FAMILY.blue }),
    ],
  },
];

function column8(): SceneObject[] {
  const m = M.marble();
  const f = FAMILY.amber;
  const r = 0.8;
  return [
    make('cube', { name: 'Column Plinth', at: [0, 0.24, 0], size: [r * 1.35, 0.24, r * 1.35], material: m, family: f }),
    make('torus', { name: 'Column Base', at: [0, 0.56, 0], size: r * 1.14, tube: 0.16, material: m, family: f }),
    make('cylinder', { name: 'Column Shaft', at: [0, 4.3, 0], size: [r, 3.8, r], material: m, family: f }),
    make('torus', { name: 'Column Neck', at: [0, 8, 0], size: r * 1.1, tube: 0.14, material: m, family: f }),
    make('cube', { name: 'Column Capital', at: [0, 8.3, 0], size: [r * 1.3, 0.2, r * 1.3], material: m, family: f }),
  ];
}
