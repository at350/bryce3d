/**
 * Reusable multi-object parts (columns, chess pieces, the eyeball, palms, lamps) shared by
 * the object library and the sample scenes. Parts are built around the origin, front = +Z.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import { DEG } from '@/core/math';
import type { Material, RGB, SceneObject, Vec3 } from '@/core/types';
import { FAMILY, make } from '../build/kit';
import * as M from '../build/materials';
import { groupBounds } from '../build/placement';

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Translate a group. */
export function shift(objects: SceneObject[], d: Vec3): SceneObject[] {
  return objects.map((o) => {
    const p = o.transform.position;
    return { ...o, transform: { ...o.transform, position: [r6(p[0] + d[0]), r6(p[1] + d[1]), r6(p[2] + d[2])] as Vec3 } };
  });
}

/** Uniformly scale a group about a pivot. */
export function scaleGroup(objects: SceneObject[], s: number, pivot: Vec3 = [0, 0, 0]): SceneObject[] {
  return objects.map((o) => {
    const p = o.transform.position;
    const sc = o.transform.scale;
    return {
      ...o,
      transform: {
        ...o.transform,
        position: [r6(pivot[0] + (p[0] - pivot[0]) * s), r6(pivot[1] + (p[1] - pivot[1]) * s), r6(pivot[2] + (p[2] - pivot[2]) * s)] as Vec3,
        scale: [r6(sc[0] * s), r6(sc[1] * s), r6(sc[2] * s)] as Vec3,
      },
    };
  });
}

/** Rotate a group rigidly (Euler XYZ degrees) about a pivot. */
export function rotateGroup(objects: SceneObject[], euler: Vec3, pivot: Vec3 = [0, 0, 0]): SceneObject[] {
  const q = new Quaternion().setFromEuler(new Euler(euler[0] * DEG, euler[1] * DEG, euler[2] * DEG, 'XYZ'));
  return objects.map((o) => {
    const p = new Vector3(...o.transform.position).sub(new Vector3(...pivot)).applyQuaternion(q).add(new Vector3(...pivot));
    const r = o.transform.rotation;
    const qo = new Quaternion().setFromEuler(new Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'XYZ')).premultiply(q);
    const e = new Euler().setFromQuaternion(qo, 'XYZ');
    return {
      ...o,
      transform: {
        ...o.transform,
        position: [r6(p.x), r6(p.y), r6(p.z)] as Vec3,
        rotation: [r6(e.x / DEG), r6(e.y / DEG), r6(e.z / DEG)] as Vec3,
      },
    };
  });
}

/** Tilt a group about X, then turn it about world Y (both degrees) around a pivot. */
export function tiltThenYaw(objects: SceneObject[], tiltDeg: number, yawDeg: number, pivot: Vec3 = [0, 0, 0]): SceneObject[] {
  return rotateGroup(rotateGroup(objects, [tiltDeg, 0, 0], pivot), [0, yawDeg, 0], pivot);
}

/** Euler XYZ (degrees) that points a light's local -Y axis from `from` toward `to`. */
export function aimDown(from: Vec3, to: Vec3): Vec3 {
  const d = new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), d);
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  return [r6(e.x / DEG), r6(e.y / DEG), r6(e.z / DEG)];
}

/** Move a group vertically so its lowest point sits on `floor`. */
export function restOn(objects: SceneObject[], floor = 0): SceneObject[] {
  const b = groupBounds(objects);
  return b ? shift(objects, [0, floor - b.min[1], 0]) : objects;
}

// --- architecture ------------------------------------------------------------------

export interface ColumnOptions {
  x?: number;
  z?: number;
  height?: number;
  radius?: number;
  material?: Material;
  /** A broken stump: shorter, no capital. */
  broken?: number;
  name?: string;
}

/** A classical column: square plinth, base ring, shaft, neck ring and capital. */
export function column(o: ColumnOptions = {}): SceneObject[] {
  const { x = 0, z = 0, height = 8, radius = 0.7, material = M.marble(), name = 'Column' } = o;
  const plinthH = radius * 0.6;
  const capH = o.broken ? 0 : radius * 0.5;
  const total = o.broken ? height * o.broken : height;
  const shaftH = total - plinthH - capH;
  const fam = FAMILY.amber;
  const parts = [
    make('cube', { name: `${name} Plinth`, at: [x, plinthH / 2, z], size: [radius * 1.35, plinthH / 2, radius * 1.35], material, family: fam }),
    make('torus', { name: `${name} Base`, at: [x, plinthH + radius * 0.1, z], size: radius * 1.14, tube: 0.16, material, family: fam }),
    make('cylinder', { name: `${name} Shaft`, at: [x, plinthH + shaftH / 2, z], size: [radius, shaftH / 2, radius], material, family: fam }),
  ];
  if (!o.broken) {
    parts.push(
      make('torus', { name: `${name} Neck`, at: [x, plinthH + shaftH - radius * 0.12, z], size: radius * 1.1, tube: 0.14, material, family: fam }),
      make('cube', { name: `${name} Capital`, at: [x, plinthH + shaftH + capH / 2, z], size: [radius * 1.3, capH / 2, radius * 1.3], material, family: fam }),
    );
  }
  return parts;
}

// --- chess pieces (base radius 1, built on y = 0) -------------------------------------

export type ChessPiece = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

function chessBase(m: Material, name: string, r = 1): SceneObject[] {
  return [
    make('cylinder', { name: `${name} Base`, at: [0, 0.15, 0], size: [r, 0.15, r], material: m, family: FAMILY.violet }),
    make('torus', { name: `${name} Base Ring`, at: [0, 0.34, 0], size: r * 0.86, tube: 0.2, material: m, family: FAMILY.violet }),
  ];
}

/** One chess piece of unit base radius standing on y = 0. */
export function chessPiece(piece: ChessPiece, m: Material, label?: string): SceneObject[] {
  const name = label ?? piece[0].toUpperCase() + piece.slice(1);
  const f = FAMILY.violet;
  const P = (type: Parameters<typeof make>[0], part: string, at: Vec3, size: Vec3 | number, extra: Parameters<typeof make>[1] = {}) =>
    make(type, { name: `${name} ${part}`, at, size, material: m, family: f, ...extra });
  switch (piece) {
    case 'pawn':
      return [
        ...chessBase(m, name),
        P('cone', 'Body', [0, 0.95, 0], [0.62, 0.65, 0.62]),
        P('cylinder', 'Collar', [0, 1.45, 0], [0.52, 0.06, 0.52]),
        P('sphere', 'Head', [0, 1.86, 0], 0.45),
      ];
    case 'rook': {
      const crenels = [0, 1, 2, 3].map((i) => {
        const a = (45 + i * 90) * DEG;
        return P('cube', `Merlon ${i + 1}`, [Math.sin(a) * 0.58, 2.66, Math.cos(a) * 0.58], [0.2, 0.16, 0.2], { rot: [0, 45 + i * 90, 0] });
      });
      return [
        ...chessBase(m, name),
        P('cylinder', 'Tower', [0, 1.2, 0], [0.64, 0.9, 0.64]),
        P('cylinder', 'Parapet', [0, 2.3, 0], [0.8, 0.2, 0.8]),
        ...crenels,
      ];
    }
    case 'bishop':
      return [
        ...chessBase(m, name),
        P('cone', 'Body', [0, 1.25, 0], [0.6, 0.95, 0.6]),
        P('cylinder', 'Collar', [0, 1.98, 0], [0.48, 0.06, 0.48]),
        P('sphere', 'Mitre', [0, 2.42, 0], [0.38, 0.55, 0.38]),
        P('sphere', 'Finial', [0, 3.03, 0], 0.12),
      ];
    case 'knight':
      return [
        ...chessBase(m, name),
        P('cylinder', 'Body', [0, 0.78, 0], [0.62, 0.48, 0.62]),
        P('cube', 'Neck', [0, 1.72, -0.05], [0.36, 0.72, 0.5], { rot: [-18, 0, 0] }),
        P('cube', 'Muzzle', [0, 2.3, 0.42], [0.3, 0.26, 0.55], { rot: [28, 0, 0] }),
        P('cube', 'Mane', [0, 1.95, -0.5], [0.09, 0.62, 0.22], { rot: [-18, 0, 0] }),
        P('cone', 'Left Ear', [-0.16, 2.72, -0.08], [0.09, 0.16, 0.09]),
        P('cone', 'Right Ear', [0.16, 2.72, -0.08], [0.09, 0.16, 0.09]),
      ];
    case 'queen': {
      const points = Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60 + 30) * DEG;
        return P('sphere', `Crown Point ${i + 1}`, [Math.sin(a) * 0.5, 3.1, Math.cos(a) * 0.5], 0.1);
      });
      return [
        ...chessBase(m, name, 1.05),
        P('cone', 'Body', [0, 1.5, 0], [0.72, 1.2, 0.72]),
        P('cylinder', 'Collar', [0, 2.45, 0], [0.6, 0.06, 0.6]),
        P('cylinder', 'Crown', [0, 2.75, 0], [0.46, 0.2, 0.46]),
        P('torus', 'Crown Ring', [0, 2.97, 0], 0.56, { tube: 0.25 }),
        ...points,
        P('sphere', 'Orb', [0, 3.26, 0], 0.2),
      ];
    }
    case 'king':
      return [
        ...chessBase(m, name, 1.05),
        P('cone', 'Body', [0, 1.6, 0], [0.74, 1.3, 0.74]),
        P('cylinder', 'Collar', [0, 2.6, 0], [0.62, 0.06, 0.62]),
        P('cylinder', 'Crown', [0, 2.92, 0], [0.5, 0.24, 0.5]),
        P('cube', 'Cross Upright', [0, 3.46, 0], [0.09, 0.3, 0.09]),
        P('cube', 'Cross Bar', [0, 3.52, 0], [0.27, 0.08, 0.09]),
      ];
  }
}

// --- the eye ----------------------------------------------------------------------------

/** A glossy eyeball of the given radius centered at the origin, looking down +Z. */
export function eyeball(radius = 2, irisColor: RGB = [0.12, 0.5, 0.78]): SceneObject[] {
  const r = radius;
  return [
    make('sphere', { name: 'Eyeball', at: [0, 0, 0], size: r, material: M.eyeWhite(), family: FAMILY.pink }),
    make('sphere', { name: 'Iris', at: [0, 0, r * 0.92], size: [r * 0.48, r * 0.48, r * 0.12], material: M.iris(irisColor), family: FAMILY.pink }),
    make('sphere', { name: 'Pupil', at: [0, 0, r * 1.0], size: [r * 0.2, r * 0.2, r * 0.06], material: M.pupil(), family: FAMILY.pink }),
  ];
}

// --- plants -----------------------------------------------------------------------------

export interface PalmOptions {
  x?: number;
  y?: number;
  z?: number;
  height?: number;
  /** Lean in degrees (tilts toward +X before the yaw). */
  lean?: number;
  yaw?: number;
  seed?: number;
}

export function palm(o: PalmOptions = {}): SceneObject {
  const { x = 0, y = 0, z = 0, height = 7, lean = 8, yaw = 0, seed = 5 } = o;
  return make('tree', {
    name: 'Palm Tree',
    at: [x, y + height / 2, z],
    size: [height * 0.36, height / 2, height * 0.36],
    rot: [0, yaw, -lean],
    family: FAMILY.green,
    material: M.leaves([0.34, 0.56, 0.16], 'Palm Fronds'),
    tree: { seed, crown: 'palm', trunkHeight: 0.78, trunkWidth: 0.06, crownNoise: 0.35, trunkColor: [0.48, 0.36, 0.22] },
  });
}

export interface TreeOptions {
  x?: number;
  y?: number;
  z?: number;
  height?: number;
  width?: number;
  crown?: 'round' | 'cone' | 'willow';
  leaves?: RGB;
  seed?: number;
  name?: string;
}

export function tree(o: TreeOptions = {}): SceneObject {
  const { x = 0, y = 0, z = 0, height = 8, crown = 'round', seed = 3, name = 'Tree' } = o;
  const width = o.width ?? (crown === 'cone' ? height * 0.24 : height * 0.36);
  return make('tree', {
    name,
    at: [x, y + height / 2, z],
    size: [width, height / 2, width],
    family: FAMILY.green,
    material: M.leaves(o.leaves ?? (crown === 'cone' ? [0.12, 0.32, 0.14] : [0.25, 0.48, 0.14]), crown === 'cone' ? 'Pine Needles' : 'Summer Leaves'),
    tree: {
      seed,
      crown,
      trunkHeight: crown === 'cone' ? 0.25 : crown === 'willow' ? 0.4 : 0.42,
      trunkWidth: crown === 'cone' ? 0.12 : 0.1,
      crownNoise: crown === 'cone' ? 0.25 : 0.55,
      trunkColor: [0.3, 0.2, 0.13],
    },
  });
}

// --- lights ------------------------------------------------------------------------------

/** An iron lamp post with a glowing lantern (a visible radial light). */
export function lampPost(x = 0, z = 0, color: RGB = [1, 0.82, 0.55]): SceneObject[] {
  const iron = M.brushedSteel();
  const f = FAMILY.amber;
  return [
    make('cylinder', { name: 'Lamp Foot', at: [x, 0.25, z], size: [0.45, 0.25, 0.45], material: iron, family: f }),
    make('cylinder', { name: 'Lamp Pole', at: [x, 2.9, z], size: [0.11, 2.4, 0.11], material: iron, family: f }),
    make('torus', { name: 'Lamp Collar', at: [x, 5.3, z], size: 0.42, tube: 0.25, material: iron, family: f }),
    make('radialLight', { name: 'Lantern Light', at: [x, 5.75, z], size: 0.34, family: f, light: { color, intensity: 70, falloff: 'squared', visible: true, softness: 0.4 } }),
    make('pyramid', { name: 'Lamp Cap', at: [x, 6.32, z], size: [0.42, 0.22, 0.42], rot: [0, 45, 0], material: iron, family: f }),
  ];
}
