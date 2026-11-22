/**
 * Pure transform operations behind the Edit palette tools, the arrow-key nudges and the
 * Align / Land / Randomize commands. Everything returns new objects (scene values are
 * immutable); infinite planes only ever change height.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import { DEG, clamp, mulberry32, objectMatrix, v3 } from '@/core/math';
import { isFlat, isInfinitePlane } from '@/core/objects';
import type { SceneObject, Transform, Vec3 } from '@/core/types';

export type Axis = 0 | 1 | 2;
export type AlignMode = 'min' | 'center' | 'max';

const MIN_SCALE = 0.01;
const MAX_SCALE = 10000;
const tidy = (v: number) => Number(v.toFixed(6));

function withTransform(o: SceneObject, patch: Partial<Transform>): SceneObject {
  return { ...o, transform: { ...o.transform, ...patch } };
}

/** Fraction of the object-space Y half-extent the shape really fills (a torus only fills ±r). */
export function shapeYFactor(o: SceneObject): number {
  if (o.type === 'torus') return o.torus?.minorRadius ?? 0.3;
  if (isFlat(o.type)) return 0;
  return 1;
}

/**
 * World-space axis-aligned bounds of an object's actual shape (exact for spheres/ellipsoids,
 * cylinders, discs, tori, cones and pyramids; the rotated box for everything else).
 * Infinite planes are unbounded in X/Z.
 */
export function worldBounds(o: SceneObject): { min: Vec3; max: Vec3 } {
  const t = o.transform;
  const p = t.position;
  if (isInfinitePlane(o.type)) {
    const h = o.type === 'cloud' ? t.scale[1] : 0;
    return { min: [-Infinity, p[1] - h, -Infinity], max: [Infinity, p[1] + h, Infinity] };
  }
  // Column-major: local X axis = e[0..2], Y = e[4..6], Z = e[8..10] (scale included).
  const e = objectMatrix(t).elements;
  const min: Vec3 = [0, 0, 0];
  const max: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const x = e[i];
    const y = e[4 + i];
    const z = e[8 + i];
    const ring = Math.hypot(x, z);
    let lo: number;
    let hi: number;
    switch (o.type) {
      case 'sphere':
        hi = Math.hypot(x, y, z);
        lo = -hi;
        break;
      case 'cylinder':
        hi = Math.abs(y) + ring;
        lo = -hi;
        break;
      case 'disc':
        hi = ring;
        lo = -hi;
        break;
      case 'torus': {
        const r = o.torus?.minorRadius ?? 0.3;
        hi = (1 - r) * ring + r * Math.hypot(x, y, z);
        lo = -hi;
        break;
      }
      case 'cone':
        // apex at local y = +1, base disc of radius 1 at y = -1
        hi = Math.max(y, -y + ring);
        lo = Math.min(y, -y - ring);
        break;
      case 'pyramid': {
        const base = Math.abs(x) + Math.abs(z);
        hi = Math.max(y, -y + base);
        lo = Math.min(y, -y - base);
        break;
      }
      default: {
        const ext = Math.abs(x) + Math.abs(y) * shapeYFactor(o) + Math.abs(z);
        hi = ext;
        lo = -ext;
      }
    }
    min[i] = p[i] + lo;
    max[i] = p[i] + hi;
  }
  return { min, max };
}

/** Multiply the size (per axis). Clouds may change thickness; other infinite planes are untouched. */
export function resizeObject(o: SceneObject, factor: Vec3): SceneObject {
  const s = o.transform.scale;
  if (isInfinitePlane(o.type)) {
    if (o.type !== 'cloud') return o;
    return withTransform(o, { scale: [s[0], tidy(clamp(s[1] * factor[1], 0.1, 500)), s[2]] });
  }
  return withTransform(o, {
    scale: [0, 1, 2].map((i) => tidy(clamp(s[i] * factor[i], MIN_SCALE, MAX_SCALE))) as Vec3,
  });
}

/** Rotate around a world axis (Bryce's World Space option) or the object's own axis. */
export function rotateObject(o: SceneObject, axis: Axis, degrees: number, space: 'world' | 'object' = 'world'): SceneObject {
  if (isInfinitePlane(o.type) || !degrees) return o;
  const r = o.transform.rotation;
  const q = new Quaternion().setFromEuler(new Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'XYZ'));
  const ax = new Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
  const dq = new Quaternion().setFromAxisAngle(ax, degrees * DEG);
  const next = space === 'world' ? dq.multiply(q) : q.multiply(dq);
  const e = new Euler().setFromQuaternion(next, 'XYZ');
  return withTransform(o, { rotation: [tidy(e.x / DEG), tidy(e.y / DEG), tidy(e.z / DEG)] });
}

/** Translate; infinite planes only move vertically. */
export function moveObject(o: SceneObject, d: Vec3): SceneObject {
  const p = o.transform.position;
  if (isInfinitePlane(o.type)) return d[1] ? withTransform(o, { position: [p[0], tidy(p[1] + d[1]), p[2]] }) : o;
  return withTransform(o, { position: [tidy(p[0] + d[0]), tidy(p[1] + d[1]), tidy(p[2] + d[2])] });
}

/**
 * Align objects along an axis: 'min' lines up their low edges with the lowest one, 'max'
 * the high edges with the highest, 'center' their centers on the middle of the group.
 * A single object aligns to the world origin on that axis.
 */
export function alignObjects(objs: SceneObject[], axis: Axis, mode: AlignMode): SceneObject[] {
  const movable = objs.filter((o) => !isInfinitePlane(o.type) || axis === 1);
  if (!movable.length) return objs;
  const bounds = new Map(movable.map((o) => [o.id, worldBounds(o)]));
  const edge = (b: { min: Vec3; max: Vec3 }) => (mode === 'min' ? b.min[axis] : mode === 'max' ? b.max[axis] : (b.min[axis] + b.max[axis]) / 2);
  let target = 0;
  if (movable.length > 1) {
    const all = [...bounds.values()];
    if (mode === 'min') target = Math.min(...all.map((b) => b.min[axis]));
    else if (mode === 'max') target = Math.max(...all.map((b) => b.max[axis]));
    else target = (Math.min(...all.map((b) => b.min[axis])) + Math.max(...all.map((b) => b.max[axis]))) / 2;
  }
  return objs.map((o) => {
    const b = bounds.get(o.id);
    if (!b) return o;
    const d: Vec3 = [0, 0, 0];
    d[axis] = target - edge(b);
    return d[axis] ? moveObject(o, d) : o;
  });
}

/** Drop objects so their lowest point rests at groundY (Bryce "Land"). Planes are untouched. */
export function landObjects(objs: SceneObject[], groundY = 0): SceneObject[] {
  return objs.map((o) => {
    if (isInfinitePlane(o.type)) return o;
    const dy = groundY - worldBounds(o).min[1];
    return Math.abs(dy) > 1e-9 ? moveObject(o, [0, dy, 0]) : o;
  });
}

export interface RandomizeOptions {
  position: boolean;
  rotation: boolean;
  size: boolean;
}

/**
 * Scatter a selection: amount 0 returns the input unchanged, 1 is a strong shake. The
 * result depends only on (objects, amount, seed), so dragging the Randomize tool back and
 * forth scrubs smoothly through the same arrangement.
 */
export function randomizeObjects(objs: SceneObject[], amount: number, seed: number, opts: RandomizeOptions): SceneObject[] {
  if (amount <= 0) return objs;
  const solids = objs.filter((o) => !isInfinitePlane(o.type));
  if (!solids.length) return objs;
  const center = v3.scale(solids.reduce((acc, o) => v3.add(acc, o.transform.position), [0, 0, 0] as Vec3), 1 / solids.length);
  const groupRadius = Math.max(...solids.map((o) => v3.len(v3.sub(o.transform.position, center)) + Math.max(...o.transform.scale)));
  const spread = Math.max(3, groupRadius) * 0.8;
  const rnd = mulberry32(seed);
  return objs.map((o) => {
    const r = Array.from({ length: 7 }, () => rnd() * 2 - 1);
    if (isInfinitePlane(o.type) || o.locked) return o;
    let next = o;
    if (opts.position) next = moveObject(next, [r[0] * amount * spread, r[1] * amount * spread * 0.2, r[2] * amount * spread]);
    if (opts.rotation) {
      next = rotateObject(next, 1, r[4] * amount * 180);
      next = rotateObject(next, 0, r[3] * amount * 35);
      next = rotateObject(next, 2, r[5] * amount * 35);
    }
    if (opts.size) {
      const f = Math.max(0.2, 1 + r[6] * amount * 0.7);
      next = resizeObject(next, [f, f, f]);
    }
    return next;
  });
}

/** A displacement of `step` along one world axis. */
export function nudgeVector(axis: Axis, sign: 1 | -1, step: number): Vec3 {
  const d: Vec3 = [0, 0, 0];
  d[axis] = sign * step;
  return d;
}
