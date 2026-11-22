/**
 * A tiny CPU ray tracer that renders a material on a sphere over a checker floor, on an
 * open plane receding to the horizon (water and ground looks), or on a tilted flat
 * swatch. It approximates the Bryce channel model (diffuse, ambient glow, specular +
 * halo, metallic reflection, refraction, bump, altitude blend, volumes) well enough for
 * instant preset tiles and the Materials Lab swatch, with no GPU involved. The WebGL
 * renderer remains the reference look.
 *
 * Units: "preview units" are object units of a 4-unit object (world = 2 x object), so
 * texture scales read the same as on the preview scene's sphere.
 */
import { linearToSrgb, srgbToLinear } from '@/core/math';
import type { Material, MaterialChannel, RGB } from '@/core/types';
import { noise3 } from './noise';
import { evalComponent, sampleGradient, type EvalOptions } from './texturePreview';

export type CpuPreviewShape = 'sphere' | 'plane' | 'swatch';

export interface CpuPreviewOptions {
  shape?: CpuPreviewShape;
  /** Cap on texture octaves (lower = faster; tiny tiles do not need fine detail). */
  maxOctaves?: number;
}

type Vec = [number, number, number];

const LIGHT = norm3(-0.5, 0.72, 0.48);
const SUN: RGB = [1, 0.95, 0.86];
const SKY_AMBIENT: RGB = [0.3, 0.34, 0.42];
const HORIZON: RGB = lin([0.8, 0.86, 0.94]);
const ZENITH: RGB = lin([0.16, 0.36, 0.76]);
const FLOOR_A: RGB = lin([0.38, 0.39, 0.42]);
const FLOOR_B: RGB = lin([0.8, 0.81, 0.82]);
const SEA_FLOOR: RGB = lin([0.62, 0.56, 0.42]);

/** Camera setups per shape (preview units). */
const CAMERAS: Record<'sphere' | 'plane', { pos: Vec; target: Vec; fov: number }> = {
  sphere: { pos: [0, 0.72, 4.3], target: [0, -0.05, 0], fov: 36 },
  plane: { pos: [0, 1.7, 4.8], target: [0, 0, -1.2], fov: 44 },
};

function norm3(x: number, y: number, z: number): Vec {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function lin(c: RGB): RGB {
  return [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-6));
  return t * t * (3 - 2 * t);
};

/** Per-render material data, resolved once (linear colors, channel drivers). */
interface Prepared {
  m: Material;
  opts: EvalOptions;
  /** World y of the object origin (world = 2 x object + this). */
  worldY: number;
  driver: (ch: MaterialChannel) => number;
  colors: Record<'diffuseColor' | 'ambientColor' | 'specularColor' | 'specularHaloColor' | 'transparentColor' | 'volumeColor', RGB>;
  altitude: RGB | null;
  bumpComponent: number;
  /** Component values and gradient colors at the current sample. */
  n: number[];
  c: RGB[];
}

function prepare(m: Material, maxOctaves: number, worldY: number): Prepared {
  const count = m.components.length;
  const driver = (ch: MaterialChannel) => {
    const d = m.drivers[ch];
    return d !== undefined && d >= 0 && d < count ? d : -1;
  };
  return {
    m,
    opts: { maxOctaves },
    worldY,
    driver,
    colors: {
      diffuseColor: lin(m.diffuseColor),
      ambientColor: lin(m.ambientColor),
      specularColor: lin(m.specularColor),
      specularHaloColor: lin(m.specularHaloColor),
      transparentColor: lin(m.transparentColor),
      volumeColor: lin(m.volumeColor),
    },
    altitude: m.altitude ? lin(m.altitude.color) : null,
    bumpComponent: driver('bumpHeight'),
    n: m.components.map(() => 0),
    c: m.components.map(() => [0, 0, 0] as RGB),
  };
}

function evalOne(P: Prepared, i: number, ox: number, oy: number, oz: number): number {
  return evalComponent(P.m.components[i], ox * 2, oy * 2 + P.worldY, oz * 2, ox, oy, oz, P.opts);
}

/** Evaluate every component (value and linear gradient color) at an object-space point. */
function evalAll(P: Prepared, ox: number, oy: number, oz: number) {
  const comps = P.m.components;
  for (let i = 0; i < comps.length; i++) {
    const v = evalOne(P, i, ox, oy, oz);
    P.n[i] = v;
    const c = sampleGradient(comps[i].gradient, v, P.c[i]);
    c[0] = srgbToLinear(c[0]);
    c[1] = srgbToLinear(c[1]);
    c[2] = srgbToLinear(c[2]);
  }
}

function colorOf(P: Prepared, ch: 'diffuseColor' | 'ambientColor' | 'specularColor' | 'transparentColor'): RGB {
  const d = P.driver(ch);
  return d >= 0 ? P.c[d] : P.colors[ch];
}

function valueOf(P: Prepared, ch: 'diffusion' | 'ambience' | 'specularity' | 'reflection' | 'transparency'): number {
  const d = P.driver(ch);
  const v = P.m[ch] / 100;
  return d >= 0 ? P.n[d] * v : v;
}

function sky(dx: number, dy: number, dz: number, blur: number, out: RGB): RGB {
  const g = Math.pow(Math.max(0, dy), 0.55);
  const sunDot = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + dz * LIGHT[2]);
  const sharp = blur > 0 ? Math.pow(sunDot, 24) * 0.6 : Math.pow(sunDot, 900) * 14 + Math.pow(sunDot, 60) * 0.5;
  for (let i = 0; i < 3; i++) out[i] = HORIZON[i] + (ZENITH[i] - HORIZON[i]) * g + SUN[i] * sharp;
  return out;
}

/** What a ray leaving (px, py, pz) sees: the checker floor at y = -1 (sphere scenes) or the sky. */
function environment(px: number, py: number, pz: number, dx: number, dy: number, dz: number, blur: number, out: RGB): RGB {
  if (dy < -1e-4) {
    const t = (-1 - py) / dy;
    if (t > 0) {
      const fx = px + dx * t;
      const fz = pz + dz * t;
      const check = (Math.floor(fx) + Math.floor(fz)) & 1;
      const fade = Math.exp(-t * 0.06);
      const k = blur > 0 ? 0.5 * blur + (1 - blur) * check : check;
      const shadow = floorShadow(fx, fz);
      for (let i = 0; i < 3; i++) {
        const base = (FLOOR_A[i] + (FLOOR_B[i] - FLOOR_A[i]) * k) * (0.35 + 0.65 * LIGHT[1] * shadow) * SUN[i] + 0.12 * SKY_AMBIENT[i];
        out[i] = base * fade + HORIZON[i] * (1 - fade);
      }
      return out;
    }
  }
  return sky(dx, dy, dz, blur, out);
}

/** Shadow of the unit sphere cast along the light onto y = -1, plus a soft contact darkening. */
function floorShadow(fx: number, fz: number): number {
  const t = 1 / LIGHT[1];
  const d = Math.hypot(fx + LIGHT[0] * t, fz + LIGHT[2] * t);
  const cast = smooth(0.75, 1.15, d / 1.25);
  const contact = 0.55 + 0.45 * smooth(0.3, 1.8, Math.hypot(fx, fz));
  return cast * contact;
}

const tmpA: RGB = [0, 0, 0];
const tmpB: RGB = [0, 0, 0];

type SurfaceKind = 'sphere' | 'plane' | 'swatch';

/**
 * Shade a surface point. (ox, oy, oz) = object-space point (also the preview-space
 * position), (nx, ny, nz) = geometric normal, (vx, vy, vz) = direction toward the eye.
 */
function shadeSurface(P: Prepared, kind: SurfaceKind, ox: number, oy: number, oz: number, nx: number, ny: number, nz: number, vx: number, vy: number, vz: number, out: RGB): RGB {
  const m = P.m;
  evalAll(P, ox, oy, oz);
  if (P.bumpComponent >= 0 && m.bumpHeight !== 0) {
    const comp = m.components[P.bumpComponent];
    // Slope = gradient in the texture's own units x its feature size, so bumps read the
    // same at any texture scale (world mappings measure in world units = 2 object units).
    const native = comp.mapping === 'world' || comp.mapping === 'worldTop' ? 2 : 1;
    const k = (m.bumpHeight / 100) * comp.bump * comp.scale * 0.35;
    if (k !== 0) {
      // Finite differences of the bump component along two surface tangents.
      let tx = -nz;
      let tz = nx;
      let tl = Math.hypot(tx, tz);
      if (tl < 1e-4) {
        tx = 1;
        tz = 0;
        tl = 1;
      }
      tx /= tl;
      tz /= tl;
      const bx = ny * tz;
      const by = nz * tx - nx * tz;
      const bz = -ny * tx;
      const eps = 0.012;
      const n0 = P.n[P.bumpComponent];
      const n1 = evalOne(P, P.bumpComponent, ox + tx * eps, oy, oz + tz * eps);
      const n2 = evalOne(P, P.bumpComponent, ox + bx * eps, oy + by * eps, oz + bz * eps);
      const d1 = ((n1 - n0) / (eps * native)) * k;
      const d2 = ((n2 - n0) / (eps * native)) * k;
      nx -= tx * d1 + bx * d2;
      ny -= by * d2;
      nz -= tz * d1 + bz * d2;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
    }
  }

  const base = colorOf(P, 'diffuseColor');
  let br = base[0];
  let bg = base[1];
  let bb = base[2];
  let diff = valueOf(P, 'diffusion');
  let spec = valueOf(P, 'specularity');
  let refl = valueOf(P, 'reflection');
  if (m.altitude && P.altitude) {
    // Same rule as the renderer: a jittered height threshold, bare on steep slopes; snow is matte.
    const a = m.altitude;
    const wx = ox * 2;
    const wy = oy * 2 + P.worldY;
    const wz = oz * 2;
    const jitter = (noise3(wx * 0.23 + 5.3, wy * 0.23 + 5.3, wz * 0.23 + 5.3) - 0.5) * 0.16 + (noise3(wx * 1.7 + 1.1, wy * 1.7 + 1.1, wz * 1.7 + 1.1) - 0.5) * 0.07;
    const slope = 1 - clamp01(ny);
    const t = smooth(a.start, a.start + Math.max(0.005, a.softness), (oy + 1) / 2 + jitter) * (1 - smooth(a.maxSlope, a.maxSlope + 0.12, slope + jitter * 0.5));
    if (t > 0) {
      br += (P.altitude[0] - br) * t;
      bg += (P.altitude[1] - bg) * t;
      bb += (P.altitude[2] - bb) * t;
      diff += (Math.max(diff, 0.85) - diff) * t;
      spec += (0.15 - spec) * t;
      refl *= 1 - t;
    }
  }

  const amb = valueOf(P, 'ambience');
  const trans = valueOf(P, 'transparency');
  const metal = m.metallicity / 100;
  const blur = m.blur / 100;
  const ambC = colorOf(P, 'ambientColor');
  const specC = colorOf(P, 'specularColor');
  const halo = P.colors.specularHaloColor;

  const ndl = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  let hx = LIGHT[0] + vx;
  let hy = LIGHT[1] + vy;
  let hz = LIGHT[2] + vz;
  const hl = Math.hypot(hx, hy, hz) || 1;
  hx /= hl;
  hy /= hl;
  hz /= hl;
  const nh = Math.max(0, nx * hx + ny * hy + nz * hz);
  const tight = m.specularHalo / 100;
  const exponent = 4 + tight * tight * 600;
  const hot = ndl > 0 ? Math.pow(nh, exponent) * (1 + tight * 2) : 0;
  const glow = ndl > 0 ? Math.pow(nh, Math.max(1.5, exponent * 0.08)) * 0.18 : 0;

  const ndv = Math.max(0, nx * vx + ny * vy + nz * vz);
  const fresnel = 0.04 + 0.96 * Math.pow(1 - ndv, 5);
  const fr = clamp01(refl + (1 - refl) * fresnel * Math.max(trans, Math.min(1, refl * 2)));

  let rx = 0;
  let ry = 0;
  let rz = 0;
  if (fr > 0.001) {
    const d = 2 * ndv;
    const up = ny * d - vy;
    // Bumps can tip a reflection below an open plane's horizon; it should still see sky.
    environment(ox, oy, oz, nx * d - vx, kind === 'plane' ? Math.abs(up) : up, nz * d - vz, blur, tmpA);
    rx = tmpA[0] * (1 + (br - 1) * metal);
    ry = tmpA[1] * (1 + (bg - 1) * metal);
    rz = tmpA[2] * (1 + (bb - 1) * metal);
  }

  let tr = 0;
  let tg = 0;
  let tb = 0;
  if (trans > 0.001) {
    if (kind === 'sphere') refractThrough(ox, oy, oz, -vx, -vy, -vz, nx, ny, nz, Math.max(1, m.refraction / 100), blur, tmpB);
    else if (kind === 'plane') seaFloor(P, ox, oz, -vx, -vy, -vz, tmpB);
    else environment(ox, oy, oz, -vx, -vy, -vz, blur, tmpB);
    const tc = colorOf(P, 'transparentColor');
    const vc = P.colors.volumeColor;
    tr = tmpB[0] * tc[0] * (0.7 + 0.3 * vc[0]);
    tg = tmpB[1] * tc[1] * (0.7 + 0.3 * vc[1]);
    tb = tmpB[2] * tc[2] * (0.7 + 0.3 * vc[2]);
  }

  for (let i = 0; i < 3; i++) {
    const lit = i === 0 ? br : i === 1 ? bg : bb;
    const surface = lit * diff * (ndl * SUN[i] + SKY_AMBIENT[i]) + ambC[i] * amb;
    const r = i === 0 ? rx : i === 1 ? ry : rz;
    const t = i === 0 ? tr : i === 1 ? tg : tb;
    const opaque = surface * (1 - trans) + t * trans;
    out[i] = opaque * (1 - fr) + r * fr + spec * (specC[i] * hot * SUN[i] + halo[i] * glow);
  }
  return out;
}

/** Seen through a transparent plane: a sandy bed below, fading into the volume color with depth. */
function seaFloor(P: Prepared, px: number, pz: number, dx: number, dy: number, dz: number, out: RGB): RGB {
  const ior = Math.max(1, P.m.refraction / 100);
  const down = Math.max(0.05, -dy * ior);
  const depth = 0.7 / down;
  const keep = Math.exp(-depth * 0.9);
  const sand = 0.75 + 0.25 * Math.sin((px + dx * depth) * 3.1) * Math.sin((pz + dz * depth) * 2.3);
  const vc = P.colors.volumeColor;
  for (let i = 0; i < 3; i++) out[i] = SEA_FLOOR[i] * sand * keep * (LIGHT[1] * SUN[i] + SKY_AMBIENT[i]) + vc[i] * 0.35 * (1 - keep);
  return out;
}

/** Refract a ray into the unit sphere at p and out the far side, then look up the environment. */
function refractThrough(px: number, py: number, pz: number, dx: number, dy: number, dz: number, nx: number, ny: number, nz: number, ior: number, blur: number, out: RGB) {
  const eta = 1 / ior;
  let cos = -(dx * nx + dy * ny + dz * nz);
  let k = 1 - eta * eta * (1 - cos * cos);
  if (k < 0) {
    environment(px, py, pz, dx + 2 * cos * nx, dy + 2 * cos * ny, dz + 2 * cos * nz, blur, out);
    return;
  }
  let sq = eta * cos - Math.sqrt(k);
  const ix = eta * dx + sq * nx;
  const iy = eta * dy + sq * ny;
  const iz = eta * dz + sq * nz;
  // Exit point: second intersection of the inner ray with the unit sphere.
  const b = px * ix + py * iy + pz * iz;
  const c = px * px + py * py + pz * pz - 1;
  const t = -b + Math.sqrt(Math.max(0, b * b - c));
  const qx = px + ix * t;
  const qy = py + iy * t;
  const qz = pz + iz * t;
  // The exit normal faces back into the sphere; refract out of the denser medium.
  const ex = -qx;
  const ey = -qy;
  const ez = -qz;
  cos = -(ix * ex + iy * ey + iz * ez);
  k = 1 - ior * ior * (1 - cos * cos);
  if (k < 0) {
    environment(qx, qy, qz, ix + 2 * cos * ex, iy + 2 * cos * ey, iz + 2 * cos * ez, blur, out);
    return;
  }
  sq = ior * cos - Math.sqrt(k);
  environment(qx, qy, qz, ior * ix + sq * ex, ior * iy + sq * ey, ior * iz + sq * ez, blur, out);
}

/**
 * March a volume through the unit sphere along a ray (t0..t1), like the renderer: density
 * grows with the square of Base Density, a component driving transparency carves it into
 * puffs, the diffuse color (times the volume color) scatters light and the ambient color
 * glows. A soft falloff toward the rim keeps tiles fluffy. Returns the remaining transmittance.
 */
function marchVolume(P: Prepared, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, t0: number, t1: number, out: RGB): number {
  const m = P.m;
  const steps = 18;
  const dt = (t1 - t0) / steps;
  const vd = (m.volumeDensity ?? 50) / 100;
  const base = vd * vd * 6;
  const densityDriver = P.driver('transparency');
  const vc = P.colors.volumeColor;
  let transmit = 1;
  out[0] = out[1] = out[2] = 0;
  for (let s = 0; s < steps && transmit > 0.01; s++) {
    const t = t0 + (s + 0.5) * dt;
    const x = ox + dx * t;
    const y = oy + dy * t;
    const z = oz + dz * t;
    const r = Math.hypot(x, y, z);
    evalAll(P, x, y, z);
    const tex = densityDriver >= 0 ? smooth(0.28, 0.72, P.n[densityDriver]) * Math.max(m.transparency / 100, 0.05) * 1.6 : 1;
    const sigma = base * tex * smooth(1, 0.7, r) * 2;
    if (sigma <= 0) continue;
    const alpha = 1 - Math.exp(-sigma * dt);
    const c = colorOf(P, 'diffuseColor');
    const a = colorOf(P, 'ambientColor');
    const facing = 0.55 + 0.45 * ((x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]) / (r || 1));
    const diff = valueOf(P, 'diffusion');
    const amb = valueOf(P, 'ambience');
    for (let i = 0; i < 3; i++) out[i] += transmit * alpha * (c[i] * vc[i] * diff * (facing * SUN[i] + SKY_AMBIENT[i]) + a[i] * amb * 1.5);
    transmit *= 1 - alpha;
  }
  return transmit;
}

interface Camera {
  pos: Vec;
  f: Vec;
  r: Vec;
  u: Vec;
  tanHalf: number;
  aspect: number;
}

function camera(kind: 'sphere' | 'plane', width: number, height: number): Camera {
  const c = CAMERAS[kind];
  const f = norm3(c.target[0] - c.pos[0], c.target[1] - c.pos[1], c.target[2] - c.pos[2]);
  const r = norm3(-f[2], 0, f[0]);
  const u: Vec = [-r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1]];
  return { pos: c.pos, f, r, u, tanHalf: Math.tan((c.fov * Math.PI) / 360), aspect: width / height };
}

function rayDir(cam: Camera, sx: number, sy: number): Vec {
  const a = sx * cam.tanHalf * cam.aspect;
  const b = sy * cam.tanHalf;
  return norm3(cam.f[0] + a * cam.r[0] + b * cam.u[0], cam.f[1] + a * cam.r[1] + b * cam.u[1], cam.f[2] + a * cam.r[2] + b * cam.u[2]);
}

function sphereSample(P: Prepared, cam: Camera, sx: number, sy: number, pixel: number, volume: boolean, col: RGB, bg: RGB) {
  const [dx, dy, dz] = rayDir(cam, sx, sy);
  const [ox, oy, oz] = cam.pos;
  environment(ox, oy, oz, dx, dy, dz, 0, bg);
  const b = ox * dx + oy * dy + oz * dz;
  const c = ox * ox + oy * oy + oz * oz - 1;
  const disc = b * b - c;
  // Distance of the ray from the sphere center gives an anti-aliased silhouette.
  const miss = Math.sqrt(Math.max(0, c + 1 - b * b)) - 1;
  const coverage = clamp01(0.5 - miss / (pixel * Math.sqrt(c + 1)));
  if (disc <= 0 && coverage <= 0) {
    col[0] = bg[0];
    col[1] = bg[1];
    col[2] = bg[2];
    return;
  }
  const sq = Math.sqrt(Math.max(0, disc));
  const t0 = -b - sq;
  if (volume) {
    const transmit = marchVolume(P, ox, oy, oz, dx, dy, dz, t0, -b + sq, col);
    for (let k = 0; k < 3; k++) col[k] += transmit * bg[k];
  } else {
    const px = ox + dx * t0;
    const py = oy + dy * t0;
    const pz = oz + dz * t0;
    const nl = Math.hypot(px, py, pz) || 1;
    shadeSurface(P, 'sphere', px / nl, py / nl, pz / nl, px / nl, py / nl, pz / nl, -dx, -dy, -dz, col);
  }
  if (coverage < 1) for (let k = 0; k < 3; k++) col[k] = bg[k] + (col[k] - bg[k]) * coverage;
}

function planeSample(P: Prepared, cam: Camera, sx: number, sy: number, col: RGB) {
  const [dx, dy, dz] = rayDir(cam, sx, sy);
  if (dy >= -1e-3) {
    sky(dx, dy, dz, 0, col);
    return;
  }
  const t = -cam.pos[1] / dy;
  const px = cam.pos[0] + dx * t;
  const pz = cam.pos[2] + dz * t;
  shadeSurface(P, 'plane', px, 0, pz, 0, 1, 0, -dx, -dy, -dz, col);
  // Distance haze toward the horizon.
  const fade = Math.exp(-t * 0.045);
  for (let k = 0; k < 3; k++) col[k] = col[k] * fade + HORIZON[k] * (1 - fade);
}

/** A flat square tilted 45 degrees toward the viewer (height and ground position both vary across it). */
function swatchSample(P: Prepared, sx: number, sy: number, col: RGB) {
  const s = Math.SQRT1_2;
  // Mild perspective so reflections sweep through the horizon.
  const vx = -sx * 0.25;
  const vy = s + sy * 0.15;
  const vz = s;
  const vl = Math.hypot(vx, vy, vz);
  shadeSurface(P, 'swatch', sx, sy * s, -sy * s, 0, s, s, vx / vl, vy / vl, vz / vl, col);
}

/** Render a material into RGBA pixels (sRGB, opaque). Volumes always render on the sphere. */
export function renderMaterialPixels(material: Material, width: number, height: number, options: CpuPreviewOptions = {}): Uint8ClampedArray<ArrayBuffer> {
  const data = new Uint8ClampedArray(width * height * 4);
  const volume = material.mode === 'volume';
  const shape: CpuPreviewShape = volume ? 'sphere' : options.shape ?? 'sphere';
  // On the plane the object sits at world y = 0; the sphere and swatch sit one radius up.
  const P = prepare(material, options.maxOctaves ?? 10, shape === 'plane' ? 0 : 2);
  const cam = camera(shape === 'plane' ? 'plane' : 'sphere', width, height);
  const pixel = (2 * cam.tanHalf) / height;
  const col: RGB = [0, 0, 0];
  const bg: RGB = [0, 0, 0];
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const sx = ((i + 0.5) / width) * 2 - 1;
      const sy = 1 - ((j + 0.5) / height) * 2;
      if (shape === 'swatch') swatchSample(P, sx, sy, col);
      else if (shape === 'plane') planeSample(P, cam, sx, sy, col);
      else sphereSample(P, cam, sx, sy, pixel, volume, col, bg);
      const o = (j * width + i) * 4;
      data[o] = linearToSrgb(clamp01(col[0])) * 255;
      data[o + 1] = linearToSrgb(clamp01(col[1])) * 255;
      data[o + 2] = linearToSrgb(clamp01(col[2])) * 255;
      data[o + 3] = 255;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Cached data URLs for preset tiles.

const urlCache = new Map<string, string>();

const cacheKey = (key: string, size: number, shape: CpuPreviewShape) => `${key}:${size}:${shape}`;

/** A PNG data URL of the material (cached by key). Returns null where canvas is unavailable. */
export function materialThumbnailURL(material: Material, size: number, key?: string, options: CpuPreviewOptions = {}): string | null {
  const shape = options.shape ?? 'sphere';
  const k = key ? cacheKey(key, size, shape) : null;
  const hit = k ? urlCache.get(k) : undefined;
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(renderMaterialPixels(material, size, size, { maxOctaves: 5, ...options }), size, size), 0, 0);
  const url = canvas.toDataURL('image/png');
  if (k) urlCache.set(k, url);
  return url;
}

/** Cached thumbnail lookup without rendering. */
export function cachedThumbnailURL(key: string, size: number, shape: CpuPreviewShape = 'sphere'): string | undefined {
  return urlCache.get(cacheKey(key, size, shape));
}
