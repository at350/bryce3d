/**
 * Camera uniforms (pure). Implements exactly the shared camera model (SPEC section 2):
 * basis from cameraBasis(), vertical fov, aspect = width / height, and for NDC x, y in
 * [-1, 1] the ray normalize(forward + x*tan(fov/2)*aspect*right + y*tan(fov/2)*up).
 */
import { DEG, cameraBasis, clamp, v3 } from '@/core/math';
import type { CameraState, Vec3 } from '@/core/types';

const finite3 = (v: Vec3 | undefined, def: Vec3): Vec3 =>
  Array.isArray(v) && v.length >= 3 && v.every((x) => Number.isFinite(x)) ? [v[0], v[1], v[2]] : def;

/** A camera with finite values and a non-degenerate view direction. */
export function sanitizeCamera(cam: CameraState): CameraState {
  const position = finite3(cam?.position, [0, 7, 48]);
  let target = finite3(cam?.target, [0, 4, 0]);
  if (v3.len(v3.sub(target, position)) < 1e-6) target = [position[0], position[1], position[2] - 1];
  const fov = Number.isFinite(cam?.fov) ? clamp(cam.fov, 1, 170) : 50;
  const roll = Number.isFinite(cam?.roll) ? cam.roll : 0;
  return { position, target, fov, roll };
}

/** uCam uniform block: [pos, tanHalf], [right, aspect], [up, radians per pixel], [forward, 0]. */
export function cameraUniforms(camera: CameraState, width: number, height: number): Float32Array {
  const cam = sanitizeCamera(camera);
  const { right, up, forward } = cameraBasis(cam);
  const tanHalf = Math.tan((cam.fov * DEG) / 2);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  return new Float32Array([
    cam.position[0], cam.position[1], cam.position[2], tanHalf,
    right[0], right[1], right[2], w / h,
    up[0], up[1], up[2], (2 * tanHalf) / h,
    forward[0], forward[1], forward[2], 0,
  ]);
}

/** CPU mirror of the shader's primary ray (used by tests to pin the camera model). */
export function primaryRay(camera: CameraState, width: number, height: number, ndcX: number, ndcY: number): Vec3 {
  const cam = sanitizeCamera(camera);
  const { right, up, forward } = cameraBasis(cam);
  const t = Math.tan((cam.fov * DEG) / 2);
  const a = width / height;
  return v3.norm(v3.add(forward, v3.add(v3.scale(right, ndcX * t * a), v3.scale(up, ndcY * t))));
}
