/** Architecture presets: temples, colonnades, pyramids and towers. */
import { DEG } from '@/core/math';
import type { SceneObject } from '@/core/types';
import { FAMILY, make } from '../build/kit';
import * as M from '../build/materials';
import { column, restOn } from './parts';
import type { ObjectPreset } from './types';

const C = 'Architecture';

function ruinedTemple(): SceneObject[] {
  const stone = M.limestone();
  const f = FAMILY.amber;
  const out: SceneObject[] = [
    make('cube', { name: 'Stylobate Low', at: [0, 0.3, 0], size: [8, 0.3, 5], material: stone, family: f }),
    make('cube', { name: 'Stylobate High', at: [0, 0.8, 0], size: [7.2, 0.2, 4.3], material: stone, family: f }),
  ];
  const xs = [-6, -2, 2, 6];
  const heights = [1, 1, 0.45, 1];
  for (const [row, z] of [[0, 3.2], [1, -3.2]] as const) {
    xs.forEach((x, i) => {
      const broken = row === 0 ? (heights[i] < 1 ? heights[i] : undefined) : i === 3 ? 0.3 : undefined;
      out.push(...column({ x, z, height: 7, radius: 0.62, material: stone, broken, name: `Column ${row * 4 + i + 1}` }).map((o) => shiftY(o, 1)));
    });
  }
  out.push(
    make('cube', { name: 'Lintel', at: [-4, 8.3, -3.2], size: [2.9, 0.4, 0.8], material: stone, family: f }),
    make('cylinder', { name: 'Fallen Drum', at: [3.4, 0.62, 6.6], size: [0.62, 2.2, 0.62], rot: [0, 18, 90], material: stone, family: f }),
    make('cube', { name: 'Fallen Block', at: [-7.6, 0.45, 6.2], size: [1.1, 0.45, 0.7], rot: [0, 30, 0], material: stone, family: f }),
    make('cube', { name: 'Fallen Lintel', at: [7.8, 0.4, -6.6], size: [2.2, 0.4, 0.7], rot: [0, -25, 0], material: stone, family: f }),
  );
  return restOn(out);
}

function shiftY(o: SceneObject, dy: number): SceneObject {
  const p = o.transform.position;
  return { ...o, transform: { ...o.transform, position: [p[0], p[1] + dy, p[2]] } };
}

function colonnade(): SceneObject[] {
  const m = M.marble();
  const f = FAMILY.amber;
  const out: SceneObject[] = [make('cube', { name: 'Colonnade Base', at: [0, 0.35, 0], size: [11, 0.35, 1.5], material: m, family: f })];
  for (let i = 0; i < 6; i++) out.push(...column({ x: -9 + i * 3.6, z: 0, height: 7.5, radius: 0.6, material: m, name: `Column ${i + 1}` }).map((o) => shiftY(o, 0.7)));
  out.push(
    make('cube', { name: 'Architrave', at: [0, 8.55, 0], size: [10.4, 0.35, 1.1], material: m, family: f }),
    make('cube', { name: 'Cornice', at: [0, 9.1, 0], size: [10.8, 0.2, 1.3], material: m, family: f }),
  );
  return out;
}

function pyramidComplex(): SceneObject[] {
  const m = M.sandstone();
  const f = FAMILY.amber;
  return [
    make('pyramid', { name: 'Great Pyramid', at: [0, 6, -4], size: [8, 6, 8], rot: [0, 8, 0], material: m, family: f }),
    make('pyramid', { name: 'Middle Pyramid', at: [12, 4.4, 4], size: [5.8, 4.4, 5.8], rot: [0, 8, 0], material: m, family: f }),
    make('pyramid', { name: 'Small Pyramid', at: [-10, 2.8, 8], size: [3.6, 2.8, 3.6], rot: [0, 8, 0], material: m, family: f }),
    make('pyramid', { name: 'Queen Pyramid 1', at: [-14.5, 1.2, 1], size: [1.6, 1.2, 1.6], rot: [0, 8, 0], material: m, family: f }),
    make('pyramid', { name: 'Queen Pyramid 2', at: [-14, 1.2, 5], size: [1.6, 1.2, 1.6], rot: [0, 8, 0], material: m, family: f }),
  ];
}

function lighthouse(): SceneObject[] {
  const white = M.gloss([0.95, 0.94, 0.9], 'White Paint');
  const red = M.gloss([0.78, 0.1, 0.08], 'Red Paint');
  const f = FAMILY.amber;
  const out: SceneObject[] = [make('cylinder', { name: 'Lighthouse Footing', at: [0, 0.4, 0], size: [2.4, 0.4, 2.4], material: M.granite(), family: FAMILY.gray })];
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const r = 1.6 - i * 0.12;
    out.push(make('cylinder', { name: `Tower Band ${i + 1}`, at: [0, 0.8 + i * 2 + 1, 0], size: [r, 1, r], material: i % 2 ? red : white, family: f }));
  }
  const top = 0.8 + bands * 2;
  out.push(
    make('cylinder', { name: 'Gallery Deck', at: [0, top + 0.12, 0], size: [1.55, 0.12, 1.55], material: M.brushedSteel(), family: f }),
    make('torus', { name: 'Gallery Rail', at: [0, top + 0.7, 0], size: 1.5, tube: 0.05, material: M.brushedSteel(), family: f }),
    make('cylinder', { name: 'Lantern Glass', at: [0, top + 1.1, 0], size: [0.9, 0.85, 0.9], material: M.glass([1, 0.97, 0.88], 'Lantern Glass'), family: f }),
    make('radialLight', { name: 'Beacon', at: [0, top + 1.1, 0], size: 0.4, family: f, light: { color: [1, 0.9, 0.65], intensity: 140, visible: true, falloff: 'linear' } }),
    make('cone', { name: 'Lantern Roof', at: [0, top + 2.4, 0], size: [1.05, 0.5, 1.05], material: red, family: f }),
    make('sphere', { name: 'Finial', at: [0, top + 3.05, 0], size: 0.16, material: M.brushedSteel(), family: f }),
  );
  return out;
}

function ziggurat(): SceneObject[] {
  const m = M.terracotta();
  const levels = [[9, 1.2], [7, 1.1], [5, 1], [3.2, 0.9]];
  let y = 0;
  const out = levels.map(([half, h], i) => {
    const o = make('cube', { name: `Terrace ${i + 1}`, at: [0, y + h, 0], size: [half, h, half], material: m, family: FAMILY.amber });
    y += h * 2;
    return o;
  });
  out.push(make('cube', { name: 'Shrine', at: [0, y + 1.1, 0], size: [1.6, 1.1, 1.6], material: M.gold(), family: FAMILY.amber }));
  for (let i = 0; i < 6; i++) {
    const h = (i + 1) * 0.4;
    out.push(make('cube', { name: `Stair ${i + 1}`, at: [0, h / 2, 9 + 0.5 * (6 - i) - 0.25], size: [1.6, h / 2, 0.25], material: m, family: FAMILY.amber }));
  }
  return restOn(out);
}

function stoneCircle(): SceneObject[] {
  const m = M.granite([0.55, 0.53, 0.5]);
  const f = FAMILY.gray;
  const out: SceneObject[] = [];
  const n = 6;
  const R = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const tx = -Math.cos(a);
    const tz = Math.sin(a);
    const cx = Math.sin(a) * R;
    const cz = Math.cos(a) * R;
    const yaw = a / DEG;
    out.push(
      make('cube', { name: `Sarsen ${i * 2 + 1}`, at: [cx + tx * 1.3, 2.6, cz + tz * 1.3], size: [0.7, 2.6, 0.5], rot: [0, yaw, 0], material: m, family: f }),
      make('cube', { name: `Sarsen ${i * 2 + 2}`, at: [cx - tx * 1.3, 2.6, cz - tz * 1.3], size: [0.7, 2.6, 0.5], rot: [0, yaw, 0], material: m, family: f }),
      make('cube', { name: `Lintel ${i + 1}`, at: [cx, 5.55, cz], size: [2.1, 0.35, 0.5], rot: [0, yaw, 0], material: m, family: f }),
    );
  }
  out.push(make('cube', { name: 'Altar Stone', at: [0, 0.35, 0], size: [1.8, 0.35, 0.8], rot: [0, 15, 0], material: m, family: f }));
  return out;
}

export const ARCHITECTURE: ObjectPreset[] = [
  {
    id: 'ruined-temple',
    name: 'Ruined Temple',
    category: C,
    description: 'A limestone platform of broken columns, one surviving lintel and stones scattered by some forgotten quake.',
    build: ruinedTemple,
  },
  {
    id: 'colonnade',
    name: 'Colonnade',
    category: C,
    description: 'Six marble columns carrying an architrave and cornice. Instant antiquity.',
    build: colonnade,
  },
  {
    id: 'pyramid-complex',
    name: 'Pyramid Complex',
    category: C,
    description: 'Three sandstone pyramids and two small queens, aligned as if to a star.',
    build: pyramidComplex,
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse',
    category: C,
    description: 'A red and white striped tower with a glass lantern and a real, shining beacon light.',
    build: lighthouse,
  },
  {
    id: 'ziggurat',
    name: 'Ziggurat',
    category: C,
    description: 'Four terracotta terraces, a ceremonial ramp and a golden shrine on top.',
    build: ziggurat,
  },
  {
    id: 'stone-circle',
    name: 'Trilithon Circle',
    category: C,
    description: 'Six granite trilithons ringing an altar stone. Best rendered at sunrise.',
    build: stoneCircle,
  },
];
