/**
 * Compact scene encoding for share links (before lz-string compression):
 * - short keys, numbers rounded to 3 decimals (seeds and recipe numbers kept exact);
 * - fields equal to a FROZEN baseline are omitted. The baselines below are snapshots,
 *   deliberately not the live defaults: if defaultSky() is tuned later, old links still
 *   decode to exactly what their author saw;
 * - identical materials are stored once and referenced by index;
 * - terrains with a recipe store only the recipe; hand-made ones store 8-bit heights
 *   downsampled to at most `terrainDetail` squared;
 * - object ids are dropped (fresh ids are made on load).
 */
import { OBJECT_BASE_NAMES, isLight, isTerrainLike } from '@/core/objects';
import type { CameraState, Material, ObjectType, Scene, SceneObject, TerrainData, Vec3 } from '@/core/types';
import { resampleHeights } from '@/terrain';
import { decodeHeights8, encodeHeights8, type Heights8 } from './heights';
import { isObj } from './normalize';

export const SHARE_FORMAT = 1;

type Raw = Record<string, unknown>;

const SKY_BASE: Raw = {
  mode: 'soft', horizonColor: [0.82, 0.86, 0.92], zenithColor: [0.24, 0.42, 0.78], skyDomeColor: [0.55, 0.68, 0.9],
  sunColor: [1, 0.96, 0.88], sunSize: 30, sunGlow: 35, sunAzimuth: 215, sunAltitude: 38, linkSunToView: false,
  moonColor: [0.95, 0.95, 0.9], moonPhase: 0.5, moonSize: 30, stars: 0, haze: 18, hazeColor: [0.85, 0.88, 0.95],
  fogDensity: 0, fogHeight: 4, fogColor: [0.9, 0.9, 0.92], shadowIntensity: 75, ambient: 35, ambientColor: [0.62, 0.7, 0.85],
  rainbow: false,
};
// turbulence and glow came later; links without them merge to 0, which is what they rendered as.
const CLOUD_BASE: Raw = { enabled: true, cover: 40, height: 900, frequency: 100, amplitude: 100, color: [1, 1, 1], shading: 0.5, offset: [0, 0], turbulence: 0, glow: 0 };
const MATERIAL_BASE: Raw = {
  name: 'Default', diffuseColor: [0.78, 0.78, 0.78], ambientColor: [0.5, 0.5, 0.5], specularColor: [1, 1, 1],
  specularHaloColor: [1, 1, 1], transparentColor: [1, 1, 1], volumeColor: [1, 1, 1], diffusion: 80, ambience: 10,
  specularity: 20, specularHalo: 40, metallicity: 0, bumpHeight: 0, transparency: 0, reflection: 0, refraction: 100,
  blur: 0, mode: 'surface',
};
const COMPONENT_BASE: Raw = {
  type: 'fbm', mapping: 'world', scale: 4, octaves: 6, roughness: 0.5, warp: 0, contrast: 0.5, bias: 0, seed: 1,
  gradient: [{ at: 0, color: [0.2, 0.2, 0.2] }, { at: 1, color: [0.9, 0.9, 0.9] }], bump: 0.5,
};
// antialias and softness came later; links without them merge to the defaults ('full', 30).
const RENDER_BASE: Raw = { width: 800, height: 600, quality: 'normal', mosaic: true, maxBounces: 6, samples: 12, exposure: 1, antialias: 'full', softness: 30 };
const LIGHT_BASE: Raw = { color: [1, 0.95, 0.85], intensity: 100, falloff: 'squared', coneAngle: 45, softness: 0.3, visible: false, castShadows: true };
const TREE_BASE: Raw = { seed: 0, trunkHeight: 0.45, trunkWidth: 0.1, crown: 'round', crownNoise: 0.5, trunkColor: [0.32, 0.22, 0.14] };
const STONE_BASE: Raw = { seed: 0, lumpiness: 0.5, roughness: 0.5 };

const EXACT_KEYS = new Set(['seed']);

const rnd = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
};

function roundDeep(v: unknown, key = ''): unknown {
  if (typeof v === 'number') return EXACT_KEYS.has(key) || !Number.isFinite(v) ? v : rnd(v);
  if (Array.isArray(v)) return v.map((x) => roundDeep(x));
  if (isObj(v)) {
    const out: Raw = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = roundDeep(x, k);
    return out;
  }
  return v;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

/** The fields of `value` that differ from `base` (rounded); undefined when none do. */
function diff(value: object, base: Raw): Raw | undefined {
  const out: Raw = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const r = roundDeep(v, k);
    if (k in base && deepEqual(r, base[k])) continue;
    out[k] = r;
  }
  return Object.keys(out).length ? out : undefined;
}

const merge = (base: Raw, patch: unknown): Raw => ({ ...structuredClone(base), ...(isObj(patch) ? patch : {}) });

// --- materials -------------------------------------------------------------------------

function packMaterial(m: Material): Raw {
  const { components, drivers, ...rest } = m;
  const out: Raw = diff(rest, MATERIAL_BASE) ?? {};
  if (components.length) out.components = components.map((c) => diff(c, COMPONENT_BASE) ?? {});
  if (Object.keys(drivers).length) out.drivers = { ...drivers };
  return out;
}

function unpackMaterial(p: unknown): Raw {
  const m = merge(MATERIAL_BASE, p);
  m.components = Array.isArray(m.components) ? m.components.map((c) => merge(COMPONENT_BASE, c)) : [];
  if (!isObj(m.drivers)) m.drivers = {};
  return m;
}

// --- terrains ----------------------------------------------------------------------------

type PackedRecipe = [string, number, number, (Record<string, number> | null)?, ([string, Record<string, number>?][] | null)?];

interface PackedTerrain {
  /** Recipe: [generator, seed, resolution, params?, ops?]. */
  r?: PackedRecipe;
  /** 8-bit heights and the original resolution they are resampled back to. */
  q?: Heights8;
  R?: number;
  /** Clip bracket [low, high] when not [0, 1]. */
  c?: [number, number];
}

function packTerrain(t: TerrainData, detail: number): PackedTerrain {
  const lo = t.clipLow ?? 0;
  const hi = t.clipHigh ?? 1;
  const out: PackedTerrain = {};
  if (lo !== 0 || hi !== 1) out.c = [rnd(lo), rnd(hi)];
  if (t.recipe) {
    const { generator, seed, resolution, params, ops } = t.recipe;
    const r: PackedRecipe = [generator, seed, resolution, params ?? null, ops.length ? ops.map((o) => (o.params ? [o.op, o.params] : [o.op])) : null];
    while (r.length > 3 && r[r.length - 1] == null) r.pop();
    out.r = r;
    return out;
  }
  const n = Math.max(2, Math.min(detail, t.resolution));
  const h = n === t.resolution ? t.heights : resampleHeights(t.heights, t.resolution, n);
  out.q = encodeHeights8(h, n);
  out.R = t.resolution;
  return out;
}

function unpackTerrain(p: unknown): Raw {
  if (!isObj(p)) return {};
  const out: Raw = {};
  if (Array.isArray(p.c)) {
    out.clipLow = p.c[0];
    out.clipHigh = p.c[1];
  }
  if (Array.isArray(p.r)) {
    const [generator, seed, resolution, params, ops] = p.r as unknown[];
    out.recipe = {
      generator,
      seed,
      resolution,
      params: isObj(params) ? params : undefined,
      ops: Array.isArray(ops) ? ops.filter(Array.isArray).map((o) => ({ op: o[0], params: isObj(o[1]) ? o[1] : undefined })) : [],
    };
  } else if (isObj(p.q)) {
    const q = p.q as unknown as Heights8;
    let heights = decodeHeights8(q);
    const R = typeof p.R === 'number' && p.R >= 2 && p.R <= 1024 ? Math.round(p.R) : q.n;
    if (R !== q.n) heights = resampleHeights(heights, q.n, R);
    out.heights = heights;
    out.resolution = R;
  }
  return out;
}

// --- objects -------------------------------------------------------------------------------

interface PackedObject {
  t: ObjectType;
  n?: string;
  p: Vec3;
  r?: Vec3;
  s: Vec3 | number;
  /** Material index (-1 for lights). */
  m: number;
  f?: number;
  h?: 1;
  l?: 1;
  b?: 1;
  to?: number;
  st?: Raw;
  tr?: Raw;
  li?: Raw;
  te?: PackedTerrain;
}

const vec = (v: Vec3): Vec3 => [rnd(v[0]), rnd(v[1]), rnd(v[2])];

function packObject(o: SceneObject, materialIndex: (m: Material) => number, detail: number): PackedObject {
  const t = o.transform;
  const s = vec(t.scale);
  const out: PackedObject = { t: o.type, p: vec(t.position), s: s[0] === s[1] && s[1] === s[2] ? s[0] : s, m: isLight(o.type) ? -1 : materialIndex(o.material) };
  if (o.name !== OBJECT_BASE_NAMES[o.type]) out.n = o.name;
  if (t.rotation.some((v) => rnd(v) !== 0)) out.r = vec(t.rotation);
  if (o.family) out.f = o.family;
  if (o.hidden) out.h = 1;
  if (o.locked) out.l = 1;
  if (o.showAsBox) out.b = 1;
  if (o.torus) out.to = rnd(o.torus.minorRadius);
  if (o.stone) out.st = diff(o.stone, STONE_BASE) ?? {};
  if (o.tree) out.tr = diff(o.tree, TREE_BASE) ?? {};
  if (o.light) out.li = diff(o.light, LIGHT_BASE) ?? {};
  if (o.terrain && isTerrainLike(o.type)) out.te = packTerrain(o.terrain, detail);
  return out;
}

function unpackObject(p: unknown, materials: Raw[]): Raw | null {
  if (!isObj(p) || typeof p.t !== 'string') return null;
  const type = p.t as ObjectType;
  const s = typeof p.s === 'number' ? [p.s, p.s, p.s] : p.s;
  const o: Raw = {
    type,
    name: typeof p.n === 'string' ? p.n : OBJECT_BASE_NAMES[type] ?? 'Object',
    transform: { position: p.p, rotation: Array.isArray(p.r) ? p.r : [0, 0, 0], scale: s },
    family: p.f ?? 0,
  };
  if (typeof p.m === 'number' && p.m >= 0 && materials[p.m]) o.material = structuredClone(materials[p.m]);
  if (p.h) o.hidden = true;
  if (p.l) o.locked = true;
  if (p.b) o.showAsBox = true;
  if (typeof p.to === 'number') o.torus = { minorRadius: p.to };
  if (p.st !== undefined) o.stone = merge(STONE_BASE, p.st);
  if (p.tr !== undefined) o.tree = merge(TREE_BASE, p.tr);
  if (p.li !== undefined) o.light = merge(LIGHT_BASE, p.li);
  if (p.te !== undefined) o.terrain = unpackTerrain(p.te);
  return o;
}

// --- scene ------------------------------------------------------------------------------------

export interface PackOptions {
  /** Max grid size for hand-made terrain heights (default 128). */
  terrainDetail?: number;
}

export interface PackedScene {
  b: typeof SHARE_FORMAT;
  n: string;
  k?: Raw;
  c: number[];
  r?: Raw;
  m: Raw[];
  o: PackedObject[];
}

export function packScene(scene: Scene, options: PackOptions = {}): PackedScene {
  const detail = options.terrainDetail ?? 128;
  const materials: Raw[] = [];
  const index = new Map<string, number>();
  const materialIndex = (m: Material) => {
    const packed = packMaterial(m);
    const key = JSON.stringify(packed);
    let i = index.get(key);
    if (i === undefined) {
      i = materials.length;
      materials.push(packed);
      index.set(key, i);
    }
    return i;
  };
  const { stratus, cumulus, ...sky } = scene.sky;
  const k: Raw = diff(sky, SKY_BASE) ?? {};
  const st = diff(stratus, CLOUD_BASE);
  const cu = diff(cumulus, CLOUD_BASE);
  if (st) k.st = st;
  if (cu) k.cu = cu;
  const cam: CameraState = scene.camera;
  const out: PackedScene = {
    b: SHARE_FORMAT,
    n: scene.name,
    c: [...cam.position, ...cam.target, cam.roll, cam.fov].map(rnd),
    m: materials,
    o: scene.objects.map((o) => packObject(o, materialIndex, detail)),
  };
  if (Object.keys(k).length) out.k = k;
  const r = diff(scene.render, RENDER_BASE);
  if (r) out.r = r;
  return out;
}

export function isPackedScene(v: unknown): v is PackedScene {
  return isObj(v) && v.b === SHARE_FORMAT && Array.isArray(v.o);
}

/** Expand a packed scene into raw scene JSON for normalizeScene(). */
export function unpackScene(p: unknown): Raw {
  if (!isPackedScene(p)) throw new Error('This share link does not contain a scene.');
  const materials = Array.isArray(p.m) ? p.m.map(unpackMaterial) : [];
  const { st, cu, ...k } = isObj(p.k) ? p.k : ({} as Raw);
  const c = Array.isArray(p.c) ? p.c : [];
  return {
    version: 1,
    name: p.n,
    sky: { ...merge(SKY_BASE, k), stratus: merge(CLOUD_BASE, st), cumulus: merge(CLOUD_BASE, cu) },
    camera: { position: c.slice(0, 3), target: c.slice(3, 6), roll: c[6], fov: c[7] },
    render: merge(RENDER_BASE, p.r),
    objects: p.o.map((o) => unpackObject(o, materials)).filter((o): o is Raw => o !== null),
  };
}

/** How many terrains travel as recipes vs. as (heavier) height samples. */
export function terrainShareStats(scene: Scene): { recipe: number; sampled: number } {
  let recipe = 0;
  let sampled = 0;
  for (const o of scene.objects) {
    if (!o.terrain || !isTerrainLike(o.type)) continue;
    if (o.terrain.recipe) recipe++;
    else sampled++;
  }
  return { recipe, sampled };
}
