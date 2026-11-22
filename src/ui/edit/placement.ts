/**
 * Where a newly created object goes: in front of the camera, resting on the ground, side by
 * side with anything just created there. Infinite planes keep their default heights.
 */
import { defaultTransform } from '@/core/defaults';
import { clamp, v3 } from '@/core/math';
import { isFlat, isInfinitePlane, isLight } from '@/core/objects';
import type { CameraState, ObjectType, SceneObject, Transform, Vec3 } from '@/core/types';

const round1 = (v: number) => Math.round(v * 10) / 10;

/** The ground point in front of the camera where new objects are placed. */
export function placementPoint(cam: CameraState, groundY = 0): Vec3 {
  const toTarget = v3.sub(cam.target, cam.position);
  const dist = v3.len(toTarget) || 1;
  const f = v3.scale(toTarget, 1 / dist);
  // Looking down steeply: use where the view ray meets the ground.
  if (f[1] < -0.35) {
    const t = (groundY - cam.position[1]) / f[1];
    if (t > 0 && t < 400) return [cam.position[0] + f[0] * t, groundY, cam.position[2] + f[2] * t];
  }
  const flat = Math.hypot(f[0], f[2]);
  if (flat < 1e-6) return [cam.target[0], groundY, cam.target[2]];
  const d = clamp(dist * 0.6, 6, 60);
  return [cam.position[0] + (f[0] / flat) * d, groundY, cam.position[2] + (f[2] / flat) * d];
}

/** Height of the object's center above its lowest point (for an unrotated transform). */
function restingLift(type: ObjectType, scale: Vec3, minorRadius = 0.3): number {
  if (isFlat(type)) return 0.02;
  if (type === 'torus') return scale[1] * minorRadius;
  return scale[1];
}

/**
 * Transform for a new object of `type`. `scale` overrides the default size (stretched
 * variants). `existing` lets repeated clicks line objects up instead of stacking them.
 */
export function creationTransform(type: ObjectType, cam: CameraState, existing: SceneObject[] = [], scale?: Vec3, groundY = 0): Transform {
  const base = defaultTransform(type);
  if (isInfinitePlane(type)) return base;
  const s: Vec3 = scale ? [...scale] : [...base.scale];
  const point = placementPoint(cam, groundY);
  // Shift sideways (camera right) past objects already sitting at the spot.
  const fwd = v3.sub(cam.target, cam.position);
  const right = v3.norm([-fwd[2], 0, fwd[0]]);
  const width = Math.max(s[0], s[2]) * 2;
  let p = point;
  for (let i = 0; i < 12; i++) {
    const crowded = existing.some((o) => !isInfinitePlane(o.type) && Math.hypot(o.transform.position[0] - p[0], o.transform.position[2] - p[2]) < width * 0.6);
    if (!crowded) break;
    const step = Math.ceil((i + 1) / 2) * (i % 2 === 0 ? 1 : -1) * width * 1.25;
    p = v3.add(point, v3.scale(right, step));
  }
  const y = isLight(type) ? groundY + base.position[1] : groundY + restingLift(type, s);
  return { position: [round1(p[0]), Number(y.toFixed(3)), round1(p[2])], rotation: [0, 0, 0], scale: s };
}
