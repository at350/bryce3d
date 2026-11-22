/**
 * Object extents: the drawn part of the canonical cube per type, oriented boxes in world
 * space (selection boxes, handles) and world bounds of selections (framing).
 */
import { Matrix4, Vector3 } from 'three';
import { objectMatrix, v3 } from '@/core/math';
import { isInfinitePlane } from '@/core/objects';
import type { SceneObject, Vec3 } from '@/core/types';

export interface LocalBounds {
  min: Vec3;
  max: Vec3;
}

/** An oriented box in world space: center, unit axes and half-extents along them. */
export interface BoxFrame {
  center: Vec3;
  axes: [Vec3, Vec3, Vec3];
  half: Vec3;
}

const FULL: LocalBounds = { min: [-1, -1, -1], max: [1, 1, 1] };

/** Object-space extents of what is drawn for an object (always inside [-1, 1]^3). */
export function localBounds(o: SceneObject): LocalBounds {
  if (o.showAsBox) return FULL;
  if (o.type === 'disc' || o.type === 'square') return { min: [-1, 0, -1], max: [1, 0, 1] };
  if (o.type === 'torus') {
    const r = o.torus?.minorRadius ?? 0.3;
    return { min: [-1, -r, -1], max: [1, r, 1] };
  }
  return FULL;
}

const _m = new Matrix4();
const _p = new Vector3();

/** The 8 world-space corners of an object's local bounds. */
export function worldCorners(o: SceneObject): Vec3[] {
  const { min, max } = localBounds(o);
  objectMatrix(o.transform, _m);
  const out: Vec3[] = [];
  for (let i = 0; i < 8; i++) {
    _p.set(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]).applyMatrix4(_m);
    out.push([_p.x, _p.y, _p.z]);
  }
  return out;
}

/** The oriented world box of one object (handles live on this box). */
export function objectBoxFrame(o: SceneObject): BoxFrame {
  const { min, max } = localBounds(o);
  objectMatrix(o.transform, _m);
  const e = _m.elements;
  const col = (i: number): Vec3 => [e[i * 4], e[i * 4 + 1], e[i * 4 + 2]];
  const cols = [col(0), col(1), col(2)];
  const lens = cols.map((c) => v3.len(c));
  const axes = cols.map((c, i) => (lens[i] > 1e-12 ? v3.scale(c, 1 / lens[i]) : ([0, 0, 0] as Vec3))) as [Vec3, Vec3, Vec3];
  const mid: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  _p.set(...mid).applyMatrix4(_m);
  return {
    center: [_p.x, _p.y, _p.z],
    axes,
    half: [((max[0] - min[0]) / 2) * lens[0], ((max[1] - min[1]) / 2) * lens[1], ((max[2] - min[2]) / 2) * lens[2]],
  };
}

/** Axis-aligned world bounds of objects (infinite planes are ignored), or null. */
export function worldAABB(objects: SceneObject[]): { min: Vec3; max: Vec3 } | null {
  let min: Vec3 | null = null;
  let max: Vec3 | null = null;
  for (const o of objects) {
    if (isInfinitePlane(o.type)) continue;
    for (const c of worldCorners(o)) {
      if (!min || !max) {
        min = [...c] as Vec3;
        max = [...c] as Vec3;
        continue;
      }
      for (let k = 0; k < 3; k++) {
        if (c[k] < min[k]) min[k] = c[k];
        if (c[k] > max[k]) max[k] = c[k];
      }
    }
  }
  return min && max ? { min, max } : null;
}

/** A world-aligned box frame around several objects (multi-selection box). */
export function groupBoxFrame(objects: SceneObject[]): BoxFrame | null {
  const b = worldAABB(objects);
  if (!b) return null;
  return {
    center: v3.scale(v3.add(b.min, b.max), 0.5),
    axes: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    half: v3.scale(v3.sub(b.max, b.min), 0.5),
  };
}

/** World point of a box at signed unit coordinates s (each -1..1). */
export function boxPoint(f: BoxFrame, s: Vec3): Vec3 {
  let p = f.center;
  for (let k = 0; k < 3; k++) p = v3.add(p, v3.scale(f.axes[k], s[k] * f.half[k]));
  return p;
}

/** Bounding sphere of an AABB. */
export function boundsSphere(b: { min: Vec3; max: Vec3 }): { center: Vec3; radius: number } {
  return { center: v3.scale(v3.add(b.min, b.max), 0.5), radius: Math.max(0.5, v3.len(v3.sub(b.max, b.min)) / 2) };
}
