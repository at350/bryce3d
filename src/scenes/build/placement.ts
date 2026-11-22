/**
 * World-space bounds of objects and group placement: used to drop library presets in front
 * of the camera, to frame object thumbnails and to check that presets rest on the ground.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import { DEG, clamp, objectMatrix, v3 } from '@/core/math';
import { isInfinitePlane, isLight } from '@/core/objects';
import type { CameraState, SceneObject, Vec3 } from '@/core/types';

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

/** The object-space y range a shape really occupies (tighter than the [-1, 1] cube). */
function localYRange(o: SceneObject): [number, number] {
  switch (o.type) {
    case 'disc':
    case 'square':
      return [0, 0];
    case 'torus': {
      const r = o.torus?.minorRadius ?? 0.3;
      return [-r, r];
    }
    case 'terrain':
    case 'lattice': {
      const t = o.terrain;
      if (!t) return [-1, 1];
      let hi = 0;
      for (let i = 0; i < t.heights.length; i++) if (t.heights[i] > hi) hi = t.heights[i];
      hi = Math.min(hi, t.clipHigh ?? 1);
      if (o.type === 'lattice') return [-hi, hi];
      return [2 * (t.clipLow ?? 0) - 1, 2 * hi - 1];
    }
    default:
      return [-1, 1];
  }
}

/** World AABB of one object; null for infinite planes. */
export function objectBounds(o: SceneObject): Bounds | null {
  if (isInfinitePlane(o.type)) return null;
  const p = o.transform.position;
  if (isLight(o.type)) {
    const r = 0.5;
    return { min: [p[0] - r, p[1] - r, p[2] - r], max: [p[0] + r, p[1] + r, p[2] + r] };
  }
  const m = objectMatrix(o.transform);
  const e = m.elements;
  if (o.type === 'sphere' || o.type === 'stone') {
    // exact AABB of an ellipsoid: half-extent along world axis i is the length of row i of R*S
    const hx = Math.hypot(e[0], e[4], e[8]);
    const hy = Math.hypot(e[1], e[5], e[9]);
    const hz = Math.hypot(e[2], e[6], e[10]);
    return { min: [p[0] - hx, p[1] - hy, p[2] - hz], max: [p[0] + hx, p[1] + hy, p[2] + hz] };
  }
  const [y0, y1] = localYRange(o);
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const c = new Vector3();
  for (const x of [-1, 1]) {
    for (const y of [y0, y1]) {
      for (const z of [-1, 1]) {
        c.set(x, y, z).applyMatrix4(m);
        const a = c.toArray();
        for (let i = 0; i < 3; i++) {
          if (a[i] < min[i]) min[i] = a[i];
          if (a[i] > max[i]) max[i] = a[i];
        }
      }
    }
  }
  return { min, max };
}

/** Union of the objects' bounds (infinite planes ignored); null when nothing is bounded. */
export function groupBounds(objects: SceneObject[]): Bounds | null {
  let out: Bounds | null = null;
  for (const o of objects) {
    const b = objectBounds(o);
    if (!b) continue;
    if (!out) out = { min: [...b.min] as Vec3, max: [...b.max] as Vec3 };
    else {
      for (let i = 0; i < 3; i++) {
        out.min[i] = Math.min(out.min[i], b.min[i]);
        out.max[i] = Math.max(out.max[i], b.max[i]);
      }
    }
  }
  return out;
}

export const boundsCenter = (b: Bounds): Vec3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
export const boundsRadius = (b: Bounds): number => v3.len(v3.sub(b.max, b.min)) / 2;

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** Pre-multiply a world-Y yaw onto an XYZ Euler rotation (degrees). */
function addYaw(rotation: Vec3, yawDeg: number): Vec3 {
  if (Math.abs(rotation[0]) < 1e-9 && Math.abs(rotation[2]) < 1e-9) return [0, round(wrap180(rotation[1] + yawDeg)), 0];
  const q = new Quaternion().setFromEuler(new Euler(rotation[0] * DEG, rotation[1] * DEG, rotation[2] * DEG, 'XYZ'));
  q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yawDeg * DEG));
  const e = new Euler().setFromQuaternion(q, 'XYZ');
  return [round(e.x / DEG), round(e.y / DEG), round(e.z / DEG)];
}

/**
 * Move a group so its footprint center lands on `ground` (x, z; y offsets the group) and
 * turn it by `yawDeg` around that point. Returns new objects; inputs are untouched.
 */
export function placeGroup(objects: SceneObject[], ground: Vec3, yawDeg = 0): SceneObject[] {
  const b = groupBounds(objects);
  if (!b) return objects;
  const cx = (b.min[0] + b.max[0]) / 2;
  const cz = (b.min[2] + b.max[2]) / 2;
  const c = Math.cos(yawDeg * DEG);
  const s = Math.sin(yawDeg * DEG);
  return objects.map((o) => {
    const p = o.transform.position;
    const dx = p[0] - cx;
    const dz = p[2] - cz;
    const position: Vec3 = [round(ground[0] + dx * c + dz * s), round(p[1] + ground[1]), round(ground[2] - dx * s + dz * c)];
    const rotation = yawDeg ? addYaw(o.transform.rotation, yawDeg) : o.transform.rotation;
    return { ...o, transform: { ...o.transform, position, rotation } };
  });
}

/**
 * A ground point (y = 0) in front of the camera where a group of the given radius reads
 * well: where the camera looks if that is at a sensible distance, else a point straight ahead.
 */
export function groundPointInView(cam: CameraState, radius: number): Vec3 {
  const pos = cam.position;
  const want = clamp(radius * 3.2, 6, 150);
  const forward = v3.norm(v3.sub(cam.target, pos));
  const ok = (p: Vec3) => {
    const d = Math.hypot(p[0] - pos[0], p[2] - pos[2]);
    const ahead = (p[0] - pos[0]) * forward[0] + (p[2] - pos[2]) * forward[2] > 0;
    return ahead && d >= want * 0.5 && d <= want * 2.2;
  };
  const target: Vec3 = [cam.target[0], 0, cam.target[2]];
  if (ok(target)) return target;
  if (forward[1] < -0.01 && pos[1] > 0) {
    const t = -pos[1] / forward[1];
    const hit: Vec3 = [pos[0] + forward[0] * t, 0, pos[2] + forward[2] * t];
    if (ok(hit)) return hit;
  }
  let h: Vec3 = [forward[0], 0, forward[2]];
  if (v3.len(h) < 1e-6) h = [0, 0, -1];
  h = v3.norm(h);
  return [pos[0] + h[0] * want, 0, pos[2] + h[2] * want];
}

/** Yaw (degrees) that turns a group's +Z front toward the camera from `ground`. */
export function yawToward(cam: CameraState, ground: Vec3): number {
  const dx = cam.position[0] - ground[0];
  const dz = cam.position[2] - ground[2];
  if (Math.hypot(dx, dz) < 1e-6) return 0;
  return Math.round(Math.atan2(dx, dz) / DEG);
}

/** Place a preset's objects on the ground in front of a camera, facing it (or at the origin without a camera). */
export function placeInView(objects: SceneObject[], cam: CameraState | null): SceneObject[] {
  const b = groupBounds(objects);
  if (!b) return objects;
  if (!cam) return placeGroup(objects, [0, 0, 0]);
  const ground = groundPointInView(cam, boundsRadius(b));
  return placeGroup(objects, ground, yawToward(cam, ground));
}
