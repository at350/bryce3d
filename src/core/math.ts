/**
 * Shared math. The renderer and the viewport must build object matrices with
 * these helpers so a ray-traced object lands exactly on its wireframe.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { CameraState, RGB, Transform, Vec3 } from './types';

export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const v3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
  eq: (a: Vec3, b: Vec3, eps = 1e-9) =>
    Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps,
};

/** Object-to-world matrix for a transform (object space is the cube [-1, 1]^3). */
export function objectMatrix(t: Transform, out = new Matrix4()): Matrix4 {
  const q = new Quaternion().setFromEuler(new Euler(t.rotation[0] * DEG, t.rotation[1] * DEG, t.rotation[2] * DEG, 'XYZ'));
  return out.compose(new Vector3(...t.position), q, new Vector3(...t.scale));
}

/** World-to-object matrix. */
export function inverseObjectMatrix(t: Transform, out = new Matrix4()): Matrix4 {
  return objectMatrix(t, out).invert();
}

/** Unit direction toward the sun for an azimuth/altitude pair (degrees). 0 deg azimuth = -Z, 90 = +X. */
export function sunDirection(azimuthDeg: number, altitudeDeg: number): Vec3 {
  const az = azimuthDeg * DEG;
  const alt = altitudeDeg * DEG;
  return [Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)];
}

/** Inverse of sunDirection. */
export function directionToAzAlt(d: Vec3): { azimuth: number; altitude: number } {
  const n = v3.norm(d);
  const altitude = Math.asin(clamp(n[1], -1, 1)) / DEG;
  let azimuth = Math.atan2(n[0], -n[2]) / DEG;
  if (azimuth < 0) azimuth += 360;
  return { azimuth, altitude };
}

/** Orthonormal camera basis (right, up, forward) honoring roll. forward points from position to target. */
export function cameraBasis(cam: CameraState): { right: Vec3; up: Vec3; forward: Vec3 } {
  const forward = v3.norm(v3.sub(cam.target, cam.position));
  const worldUp: Vec3 = Math.abs(forward[1]) > 0.999 ? [0, 0, -1] : [0, 1, 0];
  let right = v3.norm(v3.cross(forward, worldUp));
  let up = v3.cross(right, forward);
  if (cam.roll) {
    const r = cam.roll * DEG;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const r2: Vec3 = v3.add(v3.scale(right, c), v3.scale(up, s));
    const u2: Vec3 = v3.add(v3.scale(up, c), v3.scale(right, -s));
    right = r2;
    up = u2;
  }
  return { right, up, forward };
}

export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export const rgbToLinear = (c: RGB): RGB => [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])];

export function rgbToHex(c: RGB): string {
  const h = (x: number) => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

export function hexToRgb(hex: string): RGB {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((ch) => ch + ch).join('') : m;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

export function rgbToHsv(c: RGB): [number, number, number] {
  const [r, g, b] = c;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

/** Small deterministic PRNG (mulberry32). Use it for anything seeded so results are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh random 31-bit seed (non-deterministic; use for "dice" buttons). */
export const randomSeed = () => Math.floor(Math.random() * 0x7fffffff);
