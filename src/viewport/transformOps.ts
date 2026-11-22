/**
 * Pure transform math for direct manipulation: moving on planes, axis constraints,
 * resizing in a box frame about an anchor, and rotating about a world axis.
 * Rotations are composed with quaternions and written back as three.js 'XYZ' Euler degrees.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import { DEG, clamp, v3 } from '@/core/math';
import type { Transform, Vec3 } from '@/core/types';

export const MIN_SCALE = 0.01;

export type AxisLock = 'x' | 'y' | 'z' | null;

/** Wrap degrees to (-180, 180]. */
export function wrapDeg(a: number): number {
  const w = ((((a + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
}

const clean = (a: number) => {
  const r = Math.round(a * 1e6) / 1e6;
  return r === 0 ? 0 : r;
};

/** Intersection of a ray with a plane, or null when parallel / behind the origin. */
export function rayPlane(origin: Vec3, dir: Vec3, point: Vec3, normal: Vec3): Vec3 | null {
  const denom = v3.dot(dir, normal);
  if (Math.abs(denom) < 1e-9) return null;
  const t = v3.dot(v3.sub(point, origin), normal) / denom;
  if (t < 0) return null;
  return v3.add(origin, v3.scale(dir, t));
}

/** Restrict a world-space move: to one locked axis, or (dominant) to its largest component. */
export function constrainDelta(delta: Vec3, lock: AxisLock, dominant: boolean): Vec3 {
  if (lock) {
    const k = lock === 'x' ? 0 : lock === 'y' ? 1 : 2;
    const out: Vec3 = [0, 0, 0];
    out[k] = delta[k];
    return out;
  }
  if (!dominant) return delta;
  let k = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(delta[i]) > Math.abs(delta[k])) k = i;
  const out: Vec3 = [0, 0, 0];
  out[k] = delta[k];
  return out;
}

export function translate(t: Transform, d: Vec3): Transform {
  return { ...t, position: v3.add(t.position, d) };
}

function quatOf(t: Transform): Quaternion {
  return new Quaternion().setFromEuler(new Euler(t.rotation[0] * DEG, t.rotation[1] * DEG, t.rotation[2] * DEG, 'XYZ'));
}

/** Rotate a vector about a unit axis by degrees. */
export function rotateVec(v: Vec3, axis: Vec3, deg: number): Vec3 {
  const q = new Quaternion().setFromAxisAngle(new Vector3(...v3.norm(axis)), deg * DEG);
  const r = new Vector3(...v).applyQuaternion(q);
  return [r.x, r.y, r.z];
}

/** Rotate a transform about a world axis through a pivot (orientation and position). */
export function rotateTransform(t: Transform, axis: Vec3, angleDeg: number, pivot: Vec3): Transform {
  const n = v3.norm(axis);
  const position = v3.add(pivot, rotateVec(v3.sub(t.position, pivot), n, angleDeg));
  const [rx, , rz] = t.rotation;
  // Pure yaw of an upright object: keep the numbers tidy for the Attributes dialog.
  if (Math.abs(n[0]) < 1e-9 && Math.abs(n[2]) < 1e-9 && Math.abs(rx) < 1e-9 && Math.abs(rz) < 1e-9) {
    return { ...t, position, rotation: [rx, clean(wrapDeg(t.rotation[1] + Math.sign(n[1]) * angleDeg)), rz] };
  }
  const q = new Quaternion().setFromAxisAngle(new Vector3(...n), angleDeg * DEG).multiply(quatOf(t));
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  return { ...t, position, rotation: [clean(e.x / DEG), clean(e.y / DEG), clean(e.z / DEG)] };
}

/**
 * Scale a transform about an anchor by per-axis ratios measured along a box frame's axes.
 * Exact when the object's axes line up with the frame (single object, or unrotated groups).
 */
export function scaleInFrame(t: Transform, axes: [Vec3, Vec3, Vec3], ratios: Vec3, anchor: Vec3): Transform {
  const apply = (v: Vec3): Vec3 => {
    let out: Vec3 = [0, 0, 0];
    for (let k = 0; k < 3; k++) out = v3.add(out, v3.scale(axes[k], ratios[k] * v3.dot(v, axes[k])));
    return out;
  };
  const position = v3.add(anchor, apply(v3.sub(t.position, anchor)));
  const q = quatOf(t);
  const scale = t.scale.map((s, j) => {
    const e = new Vector3(j === 0 ? 1 : 0, j === 1 ? 1 : 0, j === 2 ? 1 : 0).applyQuaternion(q);
    const f = v3.len(apply([e.x, e.y, e.z]));
    return Math.max(MIN_SCALE, s * f);
  }) as Vec3;
  return { ...t, position, scale };
}

/**
 * Resize ratio from a handle drag: the cursor's travel projected on the screen line from the
 * anchor to the handle, relative to that line's length. Null when the line is too short to use.
 */
export function dragRatio(
  anchor: { x: number; y: number },
  handle: { x: number; y: number },
  start: { x: number; y: number },
  cursor: { x: number; y: number },
): number | null {
  const dx = handle.x - anchor.x;
  const dy = handle.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len < 4) return null;
  const travel = ((cursor.x - start.x) * dx + (cursor.y - start.y) * dy) / len;
  return clamp(1 + travel / len, 0.02, 100);
}

/** Snap a resize ratio to quarter steps (Shift on corner handles). */
export const snapRatio = (r: number) => Math.max(0.25, Math.round(r * 4) / 4);

/**
 * Degrees about `axis` (through `pivot`) that move the grabbed point along a small screen drag,
 * linearized at the current position. Returns null when the point barely moves on screen.
 */
export function dragAngle(
  project: (p: Vec3) => { x: number; y: number } | null,
  pivot: Vec3,
  axis: Vec3,
  grab: Vec3,
  drag: { x: number; y: number },
): number | null {
  const eps = 2;
  const moved = v3.add(pivot, rotateVec(v3.sub(grab, pivot), axis, eps));
  const s0 = project(grab);
  const s1 = project(moved);
  if (!s0 || !s1) return null;
  const mx = s1.x - s0.x;
  const my = s1.y - s0.y;
  const m2 = mx * mx + my * my;
  if (m2 < 0.05) return null;
  return ((drag.x * mx + drag.y * my) / m2) * eps;
}
