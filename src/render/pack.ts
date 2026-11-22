/**
 * Scene -> GPU data packing (pure, no WebGL). Produces the RGBA32F texel arrays the ray
 * tracer reads: one row per object, per material and per light (layouts in layout.ts).
 *
 * Packing is cheap but runs on every render start and preview, so the expensive parts are
 * cached by identity: matrices per Transform object and whole material records per
 * Material object (scene values are immutable, so identity implies equality).
 */
import { Matrix4 } from 'three';
import { clamp, mulberry32, objectMatrix, srgbToLinear } from '@/core/math';
import { isInfinitePlane, isLight } from '@/core/objects';
import type {
  ChannelDriver,
  LightParams,
  LightType,
  Material,
  MaterialChannel,
  RGB,
  Scene,
  SceneObject,
  TerrainData,
  TextureComponent,
  Transform,
} from '@/core/types';
import {
  COMP_TEXELS,
  FALLOFF_ID,
  LIGHT,
  LIGHT_TEXELS,
  LIGHT_TYPE_ID,
  MAPPING_ID,
  MAT,
  MAT_TEXELS,
  MAX_COMPONENTS,
  MAX_GRADIENT_STOPS,
  MAX_LIGHTS,
  MAX_MATERIALS,
  MAX_OBJECTS,
  OBJ,
  OBJ_FLAG,
  OBJ_TEXELS,
  TEXTURE_TYPE_ID,
  TYPE_ID,
} from './layout';

/** Where a terrain's heights live on the GPU (resolved by the terrain cache). */
export interface TerrainSlot {
  layer: number;
  /** uv = ((xz + 1) / 2) * uvScale + uvBias addresses the stored grid inside the layer. */
  uvScale: number;
  uvBias: number;
  /** Highest stored height (0..1). */
  maxHeight: number;
  /** Stored grid size (for normal finite differences). */
  resolution: number;
}

export type TerrainResolver = (terrain: TerrainData) => TerrainSlot | null;

export interface PackedScene {
  objects: Float32Array;
  objectCount: number;
  materials: Float32Array;
  materialCount: number;
  lights: Float32Array;
  lightCount: number;
  /** Objects or lights left out because a limit was reached. */
  dropped: number;
  hasVolumes: boolean;
}

export interface PackOptions {
  skyOnly?: boolean;
}

/** Characteristic size used for infinite water/ground planes (absorption, offsets). */
const PLANE_SIZE = 8;

const finite = (v: unknown, def: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const unit = (v: unknown, def: number) => clamp(finite(v, def), 0, 1);

/** sRGB 0..1 triple -> linear, sanitized. */
export function linearRGB(c: RGB | undefined, def: RGB = [0, 0, 0]): RGB {
  const src = Array.isArray(c) && c.length >= 3 ? c : def;
  return [srgbToLinear(unit(src[0], def[0])), srgbToLinear(unit(src[1], def[1])), srgbToLinear(unit(src[2], def[2]))];
}

/** Deterministic noise-domain offset for a seed (the shader's noise tiles every 32 units). */
export function seedOffset(seed: number): [number, number, number] {
  const r = mulberry32(Math.floor(finite(seed, 0)) ^ 0x5bd1e995);
  return [r() * 32, r() * 32, r() * 32];
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

interface TransformRecord {
  /** World->object 3x4 rows (12 floats). */
  inverse: Float32Array;
  /** World bounding sphere of the object's cube. */
  bounds: [number, number, number, number];
  /** Mean half-extent. */
  size: number;
  matrix: Matrix4;
}

const transformCache = new WeakMap<Transform, TransformRecord>();

function safeTransform(t: Transform): Transform {
  const v = (a: unknown, i: number, def: number) => finite(Array.isArray(a) ? a[i] : undefined, def);
  const s = (i: number) => {
    const x = Math.abs(v(t?.scale, i, 1));
    return x < 1e-6 ? 1e-6 : x;
  };
  return {
    position: [v(t?.position, 0, 0), v(t?.position, 1, 0), v(t?.position, 2, 0)],
    rotation: [v(t?.rotation, 0, 0), v(t?.rotation, 1, 0), v(t?.rotation, 2, 0)],
    scale: [s(0), s(1), s(2)],
  };
}

export function transformRecord(t: Transform): TransformRecord {
  const hit = transformCache.get(t);
  if (hit) return hit;
  const safe = safeTransform(t);
  const matrix = objectMatrix(safe);
  const inv = matrix.clone().invert();
  const e = inv.elements; // column-major
  const inverse = new Float32Array([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]]);
  const [sx, sy, sz] = safe.scale;
  const rec: TransformRecord = {
    inverse,
    bounds: [safe.position[0], safe.position[1], safe.position[2], Math.hypot(sx, sy, sz)],
    size: (sx + sy + sz) / 3,
    matrix,
  };
  if (t && typeof t === 'object') transformCache.set(t, rec);
  return rec;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const materialCache = new WeakMap<Material, Float32Array>();

const DRIVER_ROWS: MaterialChannel[][] = [
  ['diffuseColor', 'ambientColor', 'specularColor', 'transparentColor'],
  ['diffusion', 'ambience', 'specularity', 'reflection'],
  ['transparency', 'bumpHeight'],
];

function driverFor(m: Material, ch: MaterialChannel, count: number): ChannelDriver {
  const d = m.drivers?.[ch];
  return typeof d === 'number' && d >= 0 && d < count && Number.isInteger(d) ? (d as ChannelDriver) : -1;
}

/** Gradient stops sorted, linearized and padded to MAX_GRADIENT_STOPS. */
export function packGradient(gradient: TextureComponent['gradient'] | undefined): [number, RGB][] {
  const valid = (Array.isArray(gradient) ? gradient : [])
    .filter((g) => g && Array.isArray(g.color))
    .map((g) => [unit(g.at, 0), linearRGB(g.color)] as [number, RGB])
    .sort((a, b) => a[0] - b[0])
    .slice(0, MAX_GRADIENT_STOPS);
  if (valid.length === 0) {
    valid.push([0, [0, 0, 0]], [1, [1, 1, 1]]);
  }
  while (valid.length < MAX_GRADIENT_STOPS) {
    const last = valid[valid.length - 1];
    valid.push([last[0], last[1]]);
  }
  return valid;
}

function packComponent(out: Float32Array, base: number, c: TextureComponent) {
  const type = TEXTURE_TYPE_ID[c.type] ?? 0;
  const mapping = MAPPING_ID[c.mapping] ?? 0;
  const scale = Math.max(1e-3, Math.abs(finite(c.scale, 4)));
  const octaves = clamp(Math.round(finite(c.octaves, 6)), 1, 10);
  const contrastK = Math.pow(2, (unit(c.contrast, 0.5) - 0.5) * 4);
  const off = seedOffset(finite(c.seed, 1));
  out.set([type, mapping, 1 / scale, octaves], base);
  out.set([unit(c.roughness, 0.5), unit(c.warp, 0), contrastK, clamp(finite(c.bias, 0), -1, 1)], base + 4);
  out.set([off[0], off[1], off[2], clamp(finite(c.bump, 0), -1, 1)], base + 8);
  packGradient(c.gradient).forEach(([at, col], i) => out.set([at, col[0], col[1], col[2]], base + 12 + i * 4));
}

/** One material record (MAT_TEXELS * 4 floats). Cached by Material identity. */
export function packMaterial(m: Material): Float32Array {
  const hit = materialCache.get(m);
  if (hit) return hit;
  const out = new Float32Array(MAT_TEXELS * 4);
  const put = (texel: number, a: number, b: number, c: number, d: number) => out.set([a, b, c, d], texel * 4);
  const rgb = (c: RGB | undefined, def: RGB) => linearRGB(c, def);
  const pct = (v: unknown, def: number) => clamp(finite(v, def), 0, 100) / 100;

  const comps = (Array.isArray(m.components) ? m.components : []).slice(0, MAX_COMPONENTS);
  const count = comps.length;
  const d = rgb(m.diffuseColor, [0.78, 0.78, 0.78]);
  const a = rgb(m.ambientColor, [0.5, 0.5, 0.5]);
  const s = rgb(m.specularColor, [1, 1, 1]);
  const h = rgb(m.specularHaloColor, [1, 1, 1]);
  const t = rgb(m.transparentColor, [1, 1, 1]);
  const v = rgb(m.volumeColor, [1, 1, 1]);
  put(MAT.DIFFUSE, d[0], d[1], d[2], pct(m.diffusion, 80));
  put(MAT.AMBIENT, a[0], a[1], a[2], pct(m.ambience, 10));
  put(MAT.SPECULAR, s[0], s[1], s[2], pct(m.specularity, 20));
  put(MAT.HALO, h[0], h[1], h[2], pct(m.specularHalo, 40));
  put(MAT.TRANSPARENT, t[0], t[1], t[2], pct(m.transparency, 0));
  put(MAT.VOLUME, v[0], v[1], v[2], pct(m.volumeDensity, 50));
  put(
    MAT.MISC,
    pct(m.metallicity, 0),
    clamp(finite(m.bumpHeight, 0), -100, 100) / 100,
    pct(m.reflection, 0),
    clamp(finite(m.refraction, 100), 100, 300) / 100,
  );

  const drivers = DRIVER_ROWS.map((row) => row.map((ch) => driverFor(m, ch, count)));
  let used = 0;
  drivers.flat().forEach((dr) => {
    if (dr >= 0) used |= 1 << dr;
  });
  put(MAT.MISC2, pct(m.blur, 0), m.mode === 'volume' ? 1 : 0, count, used);

  const alt = m.altitude;
  if (alt && Array.isArray(alt.color)) {
    const c = rgb(alt.color, [1, 1, 1]);
    put(MAT.ALT0, c[0], c[1], c[2], unit(alt.start, 0.7));
    put(MAT.ALT1, Math.max(0.005, unit(alt.softness, 0.1)), unit(alt.maxSlope, 0.6), 1, 0);
  }
  drivers.forEach((row, i) => put(MAT.DRV0 + i, row[0] ?? -1, row[1] ?? -1, row[2] ?? -1, row[3] ?? -1));
  comps.forEach((c, i) => packComponent(out, (MAT.COMP0 + i * COMP_TEXELS) * 4, c));
  materialCache.set(m, out);
  return out;
}

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

const CROWN_ID = { round: 0, cone: 1, palm: 2, willow: 3 } as const;

function writeObjectRow(
  out: Float32Array,
  row: number,
  header: [number, number, number, number],
  bounds: [number, number, number, number],
  inverse: Float32Array,
  p0: number[] = [0, 0, 0, 0],
  p1: number[] = [0, 0, 0, 0],
  p2: number[] = [0, 0, 0, 0],
) {
  const base = row * OBJ_TEXELS * 4;
  out.set(header, base + OBJ.HEADER * 4);
  out.set(bounds, base + OBJ.BOUNDS * 4);
  out.set(inverse, base + OBJ.INV0 * 4);
  out.set(p0, base + OBJ.P0 * 4);
  out.set(p1, base + OBJ.P1 * 4);
  out.set(p2, base + OBJ.P2 * 4);
}

const IDENTITY_3x4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);

/** Returns false when the object cannot be packed (e.g. a terrain without data). */
function packObject(
  out: Float32Array,
  row: number,
  o: SceneObject,
  matRow: number,
  material: Material,
  resolveTerrain: TerrainResolver,
): boolean {
  const type = o.type;
  const typeId = TYPE_ID[type as keyof typeof TYPE_ID];
  if (!typeId) return false;
  const transparency = finite(material.transparency, 0);
  const volume = type === 'cloud' || (material.mode === 'volume' && !isInfinitePlane(type));
  let flags = 0;
  if (volume) flags |= OBJ_FLAG.VOLUME;
  if (!volume && transparency > 0) flags |= OBJ_FLAG.TRANSPARENT;
  if (type === 'disc' || type === 'square') flags |= OBJ_FLAG.FLAT;

  if (isInfinitePlane(type)) {
    const y = finite(o.transform?.position?.[1], 0);
    const half = Math.max(0.05, Math.abs(finite(o.transform?.scale?.[1], 1)));
    const size = type === 'cloud' ? half : PLANE_SIZE;
    writeObjectRow(out, row, [typeId, matRow, flags, size], [0, y, 0, -1], IDENTITY_3x4, [y, half, 0, 0]);
    return true;
  }

  const tr = transformRecord(o.transform);
  const header: [number, number, number, number] = [typeId, matRow, flags, tr.size];
  switch (type) {
    case 'torus': {
      const r = clamp(finite(o.torus?.minorRadius, 0.3), 0.05, 0.5);
      writeObjectRow(out, row, header, tr.bounds, tr.inverse, [r, 1 - r, 0, 0]);
      return true;
    }
    case 'stone': {
      const st = o.stone;
      const off = seedOffset(finite(st?.seed, 1));
      writeObjectRow(out, row, header, tr.bounds, tr.inverse, [off[0], off[1], off[2], unit(st?.lumpiness, 0.5)], [
        unit(st?.roughness, 0.5),
        0,
        0,
        0,
      ]);
      return true;
    }
    case 'tree': {
      const tp = o.tree;
      const off = seedOffset(finite(tp?.seed, 1));
      const trunk = linearRGB(tp?.trunkColor, [0.32, 0.22, 0.14]);
      writeObjectRow(
        out,
        row,
        header,
        tr.bounds,
        tr.inverse,
        [off[0], off[1], off[2], clamp(finite(tp?.trunkHeight, 0.45), 0.2, 0.8)],
        [clamp(finite(tp?.trunkWidth, 0.1), 0.03, 0.3), CROWN_ID[tp?.crown ?? 'round'] ?? 0, unit(tp?.crownNoise, 0.5), 0],
        [trunk[0], trunk[1], trunk[2], 0],
      );
      return true;
    }
    case 'terrain':
    case 'lattice': {
      if (!o.terrain) return false;
      const slot = resolveTerrain(o.terrain);
      if (!slot) return false;
      const lo = unit(o.terrain.clipLow, 0);
      const hi = Math.max(lo, unit(o.terrain.clipHigh, 1));
      writeObjectRow(
        out,
        row,
        header,
        tr.bounds,
        tr.inverse,
        [slot.layer, slot.uvScale, slot.uvBias, 0],
        [lo, hi, Math.min(slot.maxHeight, hi), slot.resolution],
      );
      return true;
    }
    default:
      writeObjectRow(out, row, header, tr.bounds, tr.inverse);
      return true;
  }
}

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------

const DEFAULT_LIGHT: LightParams = {
  color: [1, 0.95, 0.85],
  intensity: 100,
  falloff: 'squared',
  coneAngle: 45,
  softness: 0.3,
  visible: false,
  castShadows: true,
};

/** Radiance scale of a light: intensity 100 is "a typical lamp". */
export function lightRadiance(l: LightParams): RGB {
  const c = linearRGB(l.color, DEFAULT_LIGHT.color);
  const k = clamp(finite(l.intensity, 100), 0, 400) / 100;
  return [c[0] * k, c[1] * k, c[2] * k];
}

function packLight(out: Float32Array, row: number, o: SceneObject) {
  const l = { ...DEFAULT_LIGHT, ...(o.light ?? {}) };
  const tr = transformRecord(o.transform);
  const e = tr.matrix.elements;
  const yAxis = [e[4], e[5], e[6]];
  const yl = Math.hypot(yAxis[0], yAxis[1], yAxis[2]) || 1;
  const xAxis = [e[0], e[1], e[2]];
  const xl = Math.hypot(xAxis[0], xAxis[1], xAxis[2]) || 1;
  const half = (clamp(finite(l.coneAngle, 45), 2, 170) / 2) * (Math.PI / 180);
  const radiance = lightRadiance(l);
  const soft = unit(l.softness, 0.3);
  const safe = safeTransform(o.transform);
  const base = row * LIGHT_TEXELS * 4;
  const p = safe.position;
  out.set([LIGHT_TYPE_ID[o.type as LightType], p[0], p[1], p[2]], base + LIGHT.POS * 4);
  out.set([-yAxis[0] / yl, -yAxis[1] / yl, -yAxis[2] / yl, Math.cos(half)], base + LIGHT.DIR * 4);
  out.set([radiance[0], radiance[1], radiance[2], FALLOFF_ID[l.falloff] ?? 2], base + LIGHT.COLOR * 4);
  out.set([xAxis[0] / xl, xAxis[1] / xl, xAxis[2] / xl, Math.tan(half)], base + LIGHT.AXIS * 4);
  const beam = Math.max(safe.scale[0], safe.scale[2]) * 4;
  out.set([soft, l.castShadows === false ? 0 : 1, soft * 1.5 * Math.max(1, tr.size), beam], base + LIGHT.MISC * 4);
  out.set([l.visible ? 1 : 0, lightBallRadius(safe), 0, 0], base + LIGHT.EXTRA * 4);
}

function lightBallRadius(t: Transform): number {
  return Math.max(0.05, (t.scale[0] + t.scale[1] + t.scale[2]) / 3);
}

/** A visible light's glowing ball, packed as an emissive sphere row. */
function packLightBall(out: Float32Array, row: number, o: SceneObject) {
  const l = { ...DEFAULT_LIGHT, ...(o.light ?? {}) };
  const safe = safeTransform(o.transform);
  const r = lightBallRadius(safe);
  const [x, y, z] = safe.position;
  const inv = new Float32Array([1 / r, 0, 0, -x / r, 0, 1 / r, 0, -y / r, 0, 0, 1 / r, -z / r]);
  const rad = lightRadiance(l);
  const glow = 0.6 + clamp(finite(l.intensity, 100), 0, 400) / 100 * 2.4;
  const c = linearRGB(l.color, DEFAULT_LIGHT.color);
  writeObjectRow(out, row, [TYPE_ID.lightBall, -1, OBJ_FLAG.NO_SHADOW, r], [x, y, z, r], inv, [
    c[0] * glow,
    c[1] * glow,
    c[2] * glow,
    0,
  ], [rad[0], rad[1], rad[2], 0]);
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

/** Pack a scene into texel arrays. */
export function packScene(scene: Scene, resolveTerrain: TerrainResolver, options: PackOptions = {}): PackedScene {
  const all = options.skyOnly ? [] : (Array.isArray(scene.objects) ? scene.objects : []).filter((o) => o && !o.hidden);
  const lightsIn = all.filter((o) => isLight(o.type));
  const shapes = all.filter((o) => !isLight(o.type));
  let dropped = Math.max(0, shapes.length - MAX_OBJECTS) + Math.max(0, lightsIn.length - MAX_LIGHTS);
  const lightObjs = lightsIn.slice(0, MAX_LIGHTS);
  const visibleLights = lightObjs.filter((o) => o.light?.visible);

  const objects = new Float32Array((MAX_OBJECTS + visibleLights.length) * OBJ_TEXELS * 4);
  const materialRows = new Map<Material, number>();
  const materialList: Float32Array[] = [];
  let objectCount = 0;
  let hasVolumes = false;
  for (const o of shapes) {
    if (objectCount >= MAX_OBJECTS) break;
    const material = o.material && typeof o.material === 'object' ? o.material : null;
    if (!material) {
      dropped++;
      continue;
    }
    let matRow = materialRows.get(material);
    if (matRow === undefined) {
      if (materialList.length >= MAX_MATERIALS) {
        dropped++;
        continue;
      }
      matRow = materialList.length;
      materialRows.set(material, matRow);
      materialList.push(packMaterial(material));
    }
    if (packObject(objects, objectCount, o, matRow, material, resolveTerrain)) {
      const flags = objects[objectCount * OBJ_TEXELS * 4 + OBJ.HEADER * 4 + 2];
      if (flags & OBJ_FLAG.VOLUME) hasVolumes = true;
      objectCount++;
    } else {
      dropped++;
    }
  }
  for (const o of visibleLights) packLightBall(objects, objectCount++, o);

  const lights = new Float32Array(Math.max(1, lightObjs.length) * LIGHT_TEXELS * 4);
  lightObjs.forEach((o, i) => packLight(lights, i, o));

  const materials = new Float32Array(Math.max(1, materialList.length) * MAT_TEXELS * 4);
  materialList.forEach((m, i) => materials.set(m, i * MAT_TEXELS * 4));

  return {
    objects: objects.subarray(0, Math.max(1, objectCount) * OBJ_TEXELS * 4),
    objectCount,
    materials,
    materialCount: materialList.length,
    lights,
    lightCount: lightObjs.length,
    dropped,
    hasVolumes,
  };
}
