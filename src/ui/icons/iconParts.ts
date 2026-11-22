/** Building blocks for the icon models: materials, meshes, arrows, noise surfaces. */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  type ColorRepresentation,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type V3 = [number, number, number];

// --- materials --------------------------------------------------------------

export const glossy = (color: ColorRepresentation, extra: Partial<ConstructorParameters<typeof MeshPhysicalMaterial>[0]> = {}) =>
  new MeshPhysicalMaterial({ color, roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, ...extra });

export const metal = (color: ColorRepresentation, roughness = 0.22) => new MeshPhysicalMaterial({ color, metalness: 1, roughness });

export const chrome = (color: ColorRepresentation = '#f0f2f6') => new MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.04 });

export const matte = (color: ColorRepresentation, roughness = 0.85) => new MeshStandardMaterial({ color, roughness, metalness: 0 });

export const vertexColored = (roughness = 0.8, flat = true) =>
  new MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, flatShading: flat });

export const glow = (color: ColorRepresentation, opacity = 1) =>
  new MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

export const veil = (color: ColorRepresentation, opacity: number) =>
  new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: DoubleSide });

/** Tool body: polished metal or glossy plastic depending on the skin. */
export const toolMaterial = (color: string, isMetal: boolean) => (isMetal ? metal(color, 0.18) : glossy(color));

// --- meshes -----------------------------------------------------------------

export function mesh(geometry: BufferGeometry, material: Material, position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(rotation[0], rotation[1], rotation[2]);
  m.scale.set(...scale);
  return m;
}

export function group(children: Object3D[], position: V3 = [0, 0, 0], rotation: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): Group {
  const g = new Group();
  children.forEach((c) => g.add(c));
  g.position.set(...position);
  g.rotation.set(rotation[0], rotation[1], rotation[2]);
  g.scale.set(...scale);
  return g;
}

export const sphere = (r = 1, w = 48, h = 32) => new SphereGeometry(r, w, h);
export const box = (x: number, y: number, z: number) => new BoxGeometry(x, y, z);
export const rbox = (x: number, y: number, z: number, radius = 0.08) => new RoundedBoxGeometry(x, y, z, 4, radius);
export const cyl = (rt: number, rb: number, h: number, seg = 40, open = false) => new CylinderGeometry(rt, rb, h, seg, 1, open);
export const cone = (r: number, h: number, seg = 40) => new ConeGeometry(r, h, seg);
export const torus = (R: number, r: number, arc = Math.PI * 2) => new TorusGeometry(R, r, 20, 64, arc);
export const ico = (r: number, detail = 0) => new IcosahedronGeometry(r, detail);

/** Arrow along +Y starting at the origin: shaft + cone head. */
export function arrow(length: number, material: Material, shaft = 0.07, head = 0.18, headLen = 0.32): Group {
  const shaftLen = Math.max(0.01, length - headLen);
  return group([
    mesh(cyl(shaft, shaft, shaftLen, 20), material, [0, shaftLen / 2, 0]),
    mesh(cone(head, headLen, 28), material, [0, shaftLen + headLen / 2, 0]),
  ]);
}

/** A ring arc in the XY plane with an arrowhead at its end (rotation glyph). */
export function ringArrow(radius: number, tube: number, arc: number, material: Material): Group {
  const ring = mesh(torus(radius, tube, arc), material);
  const head = mesh(cone(tube * 2.6, tube * 5, 24), material);
  head.position.set(radius * Math.cos(arc), radius * Math.sin(arc), 0);
  head.rotation.z = arc;
  return group([ring, head]);
}

// --- noise -----------------------------------------------------------------

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x: number, y: number, seed = 1, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 17);
    amp *= 0.5;
    f *= 2.03;
  }
  return sum;
}

/** Deterministic pseudo-random numbers for scattered layouts. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- surfaces ---------------------------------------------------------------

/**
 * A square heightfield tile (size x size in XZ) with vertex colors, faceted.
 * height(u, v) gets u, v in -1..1 and returns a world height; color(h01) maps a 0..1 height to a color.
 */
export function heightTile(size: number, segments: number, height: (u: number, v: number) => number, color: (t: number, u: number, v: number) => Color): BufferGeometry {
  const g = new PlaneGeometry(size, size, segments, segments);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const hs: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) / size) * 2;
    const v = (pos.getZ(i) / size) * 2;
    const h = height(u, v);
    hs.push(h);
    pos.setY(i, h);
  }
  const lo = Math.min(...hs);
  const hi = Math.max(...hs);
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const t = hi > lo ? (hs[i] - lo) / (hi - lo) : 0;
    const c = color(t, (pos.getX(i) / size) * 2, (pos.getZ(i) / size) * 2);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}

/** Mix of colors along 0..1 stops. */
export function ramp(stops: [number, string][]): (t: number) => Color {
  const cols = stops.map(([at, c]) => [at, new Color(c)] as const);
  return (t: number) => {
    for (let i = 1; i < cols.length; i++) {
      if (t <= cols[i][0]) {
        const [a0, c0] = cols[i - 1];
        const [a1, c1] = cols[i];
        return c0.clone().lerp(c1, (t - a0) / Math.max(1e-6, a1 - a0));
      }
    }
    return cols[cols.length - 1][1].clone();
  };
}

/** Lumpy rock: an icosphere displaced by noise, flat shaded with mottled vertex colors. */
export function rockGeometry(seed: number, lump = 0.32, base = '#8a7a68', dark = '#55493d'): BufferGeometry {
  const g = new IcosahedronGeometry(1, 3); // polyhedra are already non-indexed (faceted)
  const pos = g.attributes.position;
  const colors: number[] = [];
  const cb = new Color(base);
  const cd = new Color(dark);
  const cache = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let n = cache.get(key);
    if (n === undefined) {
      n = fbm(x * 1.6 + z * 0.7 + 5, y * 1.6 - z * 0.5 + 5, seed, 4);
      cache.set(key, n);
    }
    const k = 1 - lump / 2 + n * lump;
    pos.setXYZ(i, x * k, y * k * 0.8, z * k);
    const c = cd.clone().lerp(cb, Math.min(1, Math.max(0, n * 1.6 - 0.2)));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Vertical gradient colors on a geometry (by y), for sky domes. */
export function paintVertical(g: BufferGeometry, bottom: string, top: string): BufferGeometry {
  const pos = g.attributes.position;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    lo = Math.min(lo, pos.getY(i));
    hi = Math.max(hi, pos.getY(i));
  }
  const cb = new Color(bottom);
  const ct = new Color(top);
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const t = hi > lo ? (pos.getY(i) - lo) / (hi - lo) : 0;
    const c = cb.clone().lerp(ct, Math.pow(t, 0.7));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

// --- textures ---------------------------------------------------------------

export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Soft round shadow texture for contact shadows (shared, never disposed). */
let shadowTex: CanvasTexture | null = null;
export function contactShadowTexture(): CanvasTexture {
  if (!shadowTex) {
    shadowTex = canvasTexture(64, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  }
  return shadowTex;
}

/** Release every geometry, material and texture under an object (except shared textures). */
export function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mat of mats) {
      const maybeMap = (mat as MeshStandardMaterial).map;
      if (maybeMap && maybeMap !== shadowTex) maybeMap.dispose();
      mat.dispose();
    }
  });
}
