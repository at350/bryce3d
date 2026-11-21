/**
 * Camera manipulation shared by the Control palette (trackball, crosses, memory dots)
 * and the viewport's mouse navigation. Pure functions on CameraState plus helpers that
 * route to the camera the current view edits.
 */
import { DEG, cameraBasis, clamp, v3 } from './math';
import { useStore } from './store';
import type { CameraState, Vec3 } from './types';

/** The camera edited by the current view: the render camera, the director camera, or null for ortho views. */
export function getActiveCamera(): CameraState | null {
  const s = useStore.getState();
  if (s.ui.view === 'camera') return s.scene.camera;
  if (s.ui.view === 'director') return s.ui.directorCamera;
  return null;
}

/** Write a camera change to whichever camera the current view edits (no-op in ortho views). */
export function setActiveCamera(next: CameraState): void {
  const s = useStore.getState();
  if (s.ui.view === 'camera') s.setCamera(next);
  else if (s.ui.view === 'director') s.setUI({ directorCamera: next });
}

/** Apply fn to the active camera, if any. */
export function editActiveCamera(fn: (c: CameraState) => CameraState): void {
  const cam = getActiveCamera();
  if (cam) setActiveCamera(fn(cam));
}

/** Rotate the eye around the target (turntable: yaw around world Y, pitch around the camera's right axis). */
export function orbit(cam: CameraState, yawDeg: number, pitchDeg: number): CameraState {
  const offset = v3.sub(cam.position, cam.target);
  const r = v3.len(offset) || 1;
  let yaw = Math.atan2(offset[0], offset[2]);
  let pitch = Math.asin(clamp(offset[1] / r, -1, 1));
  yaw += yawDeg * DEG;
  pitch = clamp(pitch + pitchDeg * DEG, -89 * DEG, 89 * DEG);
  const position: Vec3 = [
    cam.target[0] + r * Math.cos(pitch) * Math.sin(yaw),
    cam.target[1] + r * Math.sin(pitch),
    cam.target[2] + r * Math.cos(pitch) * Math.cos(yaw),
  ];
  return { ...cam, position };
}

/** Turn the camera in place (rotate the target around the eye). */
export function look(cam: CameraState, yawDeg: number, pitchDeg: number): CameraState {
  const offset = v3.sub(cam.target, cam.position);
  const r = v3.len(offset) || 1;
  let yaw = Math.atan2(offset[0], offset[2]);
  let pitch = Math.asin(clamp(offset[1] / r, -1, 1));
  yaw += yawDeg * DEG;
  pitch = clamp(pitch + pitchDeg * DEG, -89 * DEG, 89 * DEG);
  const target: Vec3 = [
    cam.position[0] + r * Math.cos(pitch) * Math.sin(yaw),
    cam.position[1] + r * Math.sin(pitch),
    cam.position[2] + r * Math.cos(pitch) * Math.cos(yaw),
  ];
  return { ...cam, target };
}

/** Slide eye and target together in the view plane (dx right, dy up), in world units. */
export function pan(cam: CameraState, dx: number, dy: number): CameraState {
  const { right, up } = cameraBasis(cam);
  const d = v3.add(v3.scale(right, dx), v3.scale(up, dy));
  return { ...cam, position: v3.add(cam.position, d), target: v3.add(cam.target, d) };
}

/** Move the eye toward (positive) or away from the target; never passes through it. */
export function dolly(cam: CameraState, amount: number): CameraState {
  const offset = v3.sub(cam.target, cam.position);
  const dist = v3.len(offset);
  const nd = Math.max(0.5, dist - amount);
  const dir = v3.norm(offset);
  return { ...cam, position: v3.sub(cam.target, v3.scale(dir, nd)) };
}

/** Move eye and target together along the view direction (Bryce Z cross). */
export function advance(cam: CameraState, amount: number): CameraState {
  const { forward } = cameraBasis(cam);
  const d = v3.scale(forward, amount);
  return { ...cam, position: v3.add(cam.position, d), target: v3.add(cam.target, d) };
}

/** Translate eye and target along a world axis (Bryce camera crosses). */
export function moveAxis(cam: CameraState, axis: 0 | 1 | 2, amount: number): CameraState {
  const d: Vec3 = [0, 0, 0];
  d[axis] = amount;
  return { ...cam, position: v3.add(cam.position, d), target: v3.add(cam.target, d) };
}

/** Multiply the field of view (zoom), clamped to 5..120 degrees. */
export function zoomFov(cam: CameraState, factor: number): CameraState {
  return { ...cam, fov: clamp(cam.fov * factor, 5, 120) };
}

/** Bank the camera. */
export function bank(cam: CameraState, deltaDeg: number): CameraState {
  return { ...cam, roll: ((cam.roll + deltaDeg + 540) % 360) - 180 };
}

/** Aim at a point keeping the eye where it is. */
export function lookAt(cam: CameraState, point: Vec3): CameraState {
  return { ...cam, target: [...point] as Vec3 };
}

/** Move the eye so a sphere (center, radius) fills the view, keeping the viewing direction. */
export function frameSphere(cam: CameraState, center: Vec3, radius: number): CameraState {
  const dir = v3.norm(v3.sub(cam.position, cam.target));
  const dist = Math.max(radius * 1.2, radius / Math.sin((cam.fov * DEG) / 2)) * 1.1;
  return { ...cam, target: [...center] as Vec3, position: v3.add(center, v3.scale(dir, dist)) };
}

/** A sensible movement step for the current camera (scales with distance to the target). */
export function cameraStep(cam: CameraState): number {
  return Math.max(0.05, v3.len(v3.sub(cam.target, cam.position)) * 0.01);
}
