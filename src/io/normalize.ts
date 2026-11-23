/**
 * Scene validation: turns untrusted parsed JSON (files, share links, autosave, old versions)
 * into a well-formed Scene. Missing or invalid fields take their defaults, numbers are
 * clamped to their documented ranges, unknown object types are skipped with a warning.
 * Only data that is not a scene at all is rejected (with a readable Error).
 */
import { defaultCamera, defaultLight, defaultRenderSettings, defaultTransform } from '@/core/defaults';
import { newId } from '@/core/ids';
import { defaultMaterial, makeComponent } from '@/core/materialUtils';
import { clamp } from '@/core/math';
import { OBJECT_BASE_NAMES, isLight, isTerrainLike } from '@/core/objects';
import type {
  CameraState,
  CloudLayer,
  LightParams,
  Material,
  MaterialChannel,
  ObjectType,
  RenderSettings,
  RGB,
  Scene,
  SceneObject,
  Sky,
  TerrainData,
  TerrainRecipe,
  TextureComponent,
  Transform,
  Vec3,
} from '@/core/types';
import { defaultMaterialFor } from '@/materials/defaults';
import { defaultSky } from '@/sky/defaults';
import { createTerrainData, heightsFromRecipe, resampleHeights } from '@/terrain';

export const NOT_A_SCENE = 'This file is not a Bryce 3D Web scene.';

const OBJECT_TYPES: readonly ObjectType[] = [
  'sphere', 'cube', 'cylinder', 'cone', 'torus', 'pyramid', 'disc', 'square',
  'water', 'ground', 'cloud', 'terrain', 'lattice', 'stone', 'tree',
  'radialLight', 'spotLight', 'squareSpotLight', 'parallelLight',
];
const TEXTURE_TYPES = ['fbm', 'ridged', 'turbulence', 'voronoi', 'marble', 'strata', 'spots', 'granite', 'waves', 'checker', 'grid'] as const;
const MAPPINGS = ['world', 'object', 'worldTop', 'objectTop', 'spherical'] as const;
const CHANNELS: readonly MaterialChannel[] = [
  'diffuseColor', 'ambientColor', 'specularColor', 'transparentColor',
  'diffusion', 'ambience', 'specularity', 'reflection', 'transparency', 'bumpHeight',
];
export const TERRAIN_SIZES = [16, 32, 64, 128, 256, 512, 1024];
const MAX_OBJECTS = 2000;
const MAX_TERRAIN_OPS = 64;

type Raw = Record<string, unknown>;

export const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const num = (v: unknown, d: number, lo = -1e7, hi = 1e7) => (fin(v) ? clamp(v, lo, hi) : d);
const int = (v: unknown, d: number, lo: number, hi: number) => (fin(v) ? clamp(Math.round(v), lo, hi) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string, max = 120) => (typeof v === 'string' ? v.slice(0, max) : d);
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);
const wrap = (v: number, lo: number, hi: number) => {
  const span = hi - lo;
  return ((((v - lo) % span) + span) % span) + lo;
};

function rgb(v: unknown, d: RGB): RGB {
  if (Array.isArray(v) && v.length >= 3 && fin(v[0]) && fin(v[1]) && fin(v[2])) return [clamp(v[0], 0, 1), clamp(v[1], 0, 1), clamp(v[2], 0, 1)];
  return [d[0], d[1], d[2]];
}

function vec3(v: unknown, d: Vec3, lo = -1e6, hi = 1e6): Vec3 {
  if (Array.isArray(v) && v.length >= 3 && fin(v[0]) && fin(v[1]) && fin(v[2])) return [clamp(v[0], lo, hi), clamp(v[1], lo, hi), clamp(v[2], lo, hi)];
  return [d[0], d[1], d[2]];
}

/** Stable small integer from a string (seeds for objects that lost theirs). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 1e6;
}

// --- materials ---------------------------------------------------------------

function normalizeComponent(raw: unknown): TextureComponent {
  const d = makeComponent({});
  if (!isObj(raw)) return d;
  let gradient = Array.isArray(raw.gradient)
    ? raw.gradient
        .filter((g): g is Raw => isObj(g) && fin(g.at))
        .map((g) => ({ at: clamp(g.at as number, 0, 1), color: rgb(g.color, [0.5, 0.5, 0.5]) }))
        .sort((a, b) => a.at - b.at)
        .slice(0, 4)
    : d.gradient;
  if (gradient.length === 1) gradient = [{ at: 0, color: gradient[0].color }, { at: 1, color: [...gradient[0].color] as RGB }];
  if (gradient.length < 2) gradient = d.gradient;
  return {
    type: pick(raw.type, TEXTURE_TYPES, d.type),
    mapping: pick(raw.mapping, MAPPINGS, d.mapping),
    scale: fin(raw.scale) && raw.scale > 0 ? clamp(raw.scale, 1e-4, 1e5) : d.scale,
    octaves: int(raw.octaves, d.octaves, 1, 10),
    roughness: num(raw.roughness, d.roughness, 0, 1),
    warp: num(raw.warp, d.warp, 0, 1),
    contrast: num(raw.contrast, d.contrast, 0, 1),
    bias: num(raw.bias, d.bias, -1, 1),
    seed: num(raw.seed, d.seed),
    gradient,
    bump: num(raw.bump, d.bump, -1, 1),
  };
}

export function normalizeMaterial(raw: unknown, type: ObjectType): Material {
  if (!isObj(raw)) return defaultMaterialFor(type);
  const d = defaultMaterial();
  const components = Array.isArray(raw.components) ? raw.components.slice(0, 3).map(normalizeComponent) : [];
  const drivers: Material['drivers'] = {};
  if (isObj(raw.drivers)) {
    for (const ch of CHANNELS) {
      const v = raw.drivers[ch];
      if (v === -1 || ((v === 0 || v === 1 || v === 2) && v < components.length)) drivers[ch] = v;
    }
  }
  const m: Material = {
    name: str(raw.name, d.name, 80),
    diffuseColor: rgb(raw.diffuseColor, d.diffuseColor),
    ambientColor: rgb(raw.ambientColor, d.ambientColor),
    specularColor: rgb(raw.specularColor, d.specularColor),
    specularHaloColor: rgb(raw.specularHaloColor, d.specularHaloColor),
    transparentColor: rgb(raw.transparentColor, d.transparentColor),
    volumeColor: rgb(raw.volumeColor, d.volumeColor),
    diffusion: num(raw.diffusion, d.diffusion, 0, 100),
    ambience: num(raw.ambience, d.ambience, 0, 100),
    specularity: num(raw.specularity, d.specularity, 0, 100),
    specularHalo: num(raw.specularHalo, d.specularHalo, 0, 100),
    metallicity: num(raw.metallicity, d.metallicity, 0, 100),
    bumpHeight: num(raw.bumpHeight, d.bumpHeight, -100, 100),
    transparency: num(raw.transparency, d.transparency, 0, 100),
    reflection: num(raw.reflection, d.reflection, 0, 100),
    refraction: num(raw.refraction, d.refraction, 100, 300),
    blur: num(raw.blur, d.blur, 0, 100),
    components,
    drivers,
    mode: pick(raw.mode, ['surface', 'volume'] as const, 'surface'),
  };
  if (isObj(raw.altitude)) {
    const a = raw.altitude;
    m.altitude = { color: rgb(a.color, [1, 1, 1]), start: num(a.start, 0.7, 0, 1), softness: num(a.softness, 0.1, 0, 1), maxSlope: num(a.maxSlope, 0.6, 0, 1) };
  }
  if (fin(raw.volumeDensity) || m.mode === 'volume') m.volumeDensity = num(raw.volumeDensity, 40, 0, 100);
  return m;
}

// --- sky, camera, render --------------------------------------------------------

function normalizeCloud(raw: unknown, d: CloudLayer): CloudLayer {
  if (!isObj(raw)) return { ...d, color: [...d.color] as RGB, offset: [...d.offset] as [number, number] };
  const off = Array.isArray(raw.offset) && fin(raw.offset[0]) && fin(raw.offset[1]) ? ([raw.offset[0], raw.offset[1]] as [number, number]) : ([...d.offset] as [number, number]);
  return {
    enabled: bool(raw.enabled, d.enabled),
    cover: num(raw.cover, d.cover, 0, 100),
    height: num(raw.height, d.height, 0, 50000),
    frequency: num(raw.frequency, d.frequency, 1, 400),
    amplitude: num(raw.amplitude, d.amplitude, 0, 400),
    color: rgb(raw.color, d.color),
    shading: num(raw.shading, d.shading, 0, 1),
    offset: off,
    // Added later: files and links from before them read as 0 (the plain, unlit pattern).
    turbulence: num(raw.turbulence, 0, 0, 100),
    glow: num(raw.glow, 0, 0, 100),
  };
}

export function normalizeSky(raw: unknown): Sky {
  const d = defaultSky();
  if (!isObj(raw)) return d;
  return {
    mode: pick(raw.mode, ['soft', 'darker', 'custom', 'off'] as const, d.mode),
    horizonColor: rgb(raw.horizonColor, d.horizonColor),
    zenithColor: rgb(raw.zenithColor, d.zenithColor),
    skyDomeColor: rgb(raw.skyDomeColor, d.skyDomeColor),
    sunColor: rgb(raw.sunColor, d.sunColor),
    sunSize: num(raw.sunSize, d.sunSize, 0, 100),
    sunGlow: num(raw.sunGlow, d.sunGlow, 0, 100),
    sunAzimuth: fin(raw.sunAzimuth) ? wrap(raw.sunAzimuth, 0, 360) : d.sunAzimuth,
    sunAltitude: num(raw.sunAltitude, d.sunAltitude, -90, 90),
    linkSunToView: bool(raw.linkSunToView, d.linkSunToView),
    moonColor: rgb(raw.moonColor, d.moonColor),
    moonPhase: num(raw.moonPhase, d.moonPhase, 0, 1),
    moonSize: num(raw.moonSize, d.moonSize, 0, 100),
    stars: num(raw.stars, d.stars, 0, 100),
    haze: num(raw.haze, d.haze, 0, 100),
    hazeColor: rgb(raw.hazeColor, d.hazeColor),
    fogDensity: num(raw.fogDensity, d.fogDensity, 0, 100),
    fogHeight: num(raw.fogHeight, d.fogHeight, -1e4, 1e5),
    fogColor: rgb(raw.fogColor, d.fogColor),
    shadowIntensity: num(raw.shadowIntensity, d.shadowIntensity, 0, 100),
    ambient: num(raw.ambient, d.ambient, 0, 100),
    ambientColor: rgb(raw.ambientColor, d.ambientColor),
    stratus: normalizeCloud(raw.stratus, d.stratus),
    cumulus: normalizeCloud(raw.cumulus, d.cumulus),
    rainbow: bool(raw.rainbow, d.rainbow),
  };
}

export function normalizeCamera(raw: unknown): CameraState {
  const d = defaultCamera();
  if (!isObj(raw)) return d;
  const position = vec3(raw.position, d.position, -1e5, 1e5);
  let target = vec3(raw.target, d.target, -1e5, 1e5);
  if (Math.hypot(target[0] - position[0], target[1] - position[1], target[2] - position[2]) < 1e-6) target = [position[0], position[1], position[2] - 1];
  return { position, target, roll: fin(raw.roll) ? wrap(raw.roll, -180, 180) : 0, fov: num(raw.fov, d.fov, 5, 120) };
}

export function normalizeRender(raw: unknown): RenderSettings {
  const d = defaultRenderSettings();
  if (!isObj(raw)) return d;
  return {
    width: int(raw.width, d.width, 16, 4096),
    height: int(raw.height, d.height, 16, 4096),
    quality: pick(raw.quality, ['draft', 'normal', 'premium'] as const, d.quality),
    mosaic: bool(raw.mosaic, d.mosaic),
    maxBounces: int(raw.maxBounces, d.maxBounces, 1, 12),
    samples: int(raw.samples, d.samples, 1, 1024),
    exposure: num(raw.exposure, d.exposure, 0.5, 2),
    // Added later: files and links from before them take the defaults (edge-only AA, softness 30).
    antialias: pick(raw.antialias, ['edges', 'full'] as const, d.antialias),
    softness: num(raw.softness, d.softness, 0, 100),
  };
}

// --- objects --------------------------------------------------------------------

function normalizeTransform(raw: unknown, type: ObjectType): Transform {
  const d = defaultTransform(type);
  if (!isObj(raw)) return d;
  const s = Array.isArray(raw.scale) ? raw.scale : [];
  const scale = d.scale.map((dv, i) => (fin(s[i]) && s[i] !== 0 ? clamp(Math.abs(s[i]), 1e-4, 1e6) : dv)) as Vec3;
  return { position: vec3(raw.position, d.position), rotation: vec3(raw.rotation, d.rotation, -1e4, 1e4), scale };
}

function normalizeLight(raw: unknown, type: ObjectType): LightParams {
  const d = defaultLight(type);
  if (!isObj(raw)) return d;
  return {
    color: rgb(raw.color, d.color),
    intensity: num(raw.intensity, d.intensity, 0, 1000),
    falloff: pick(raw.falloff, ['none', 'linear', 'squared'] as const, d.falloff),
    coneAngle: num(raw.coneAngle, d.coneAngle, 1, 179),
    softness: num(raw.softness, d.softness, 0, 1),
    visible: bool(raw.visible, d.visible),
    castShadows: bool(raw.castShadows, d.castShadows),
  };
}

function normalizeRecipe(raw: unknown): TerrainRecipe | null {
  if (!isObj(raw) || typeof raw.generator !== 'string' || !raw.generator || raw.generator.length > 60) return null;
  const numbers = (v: unknown): Record<string, number> | undefined => {
    if (!isObj(v)) return undefined;
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v).slice(0, 32)) if (fin(val)) out[k] = val;
    return out;
  };
  const resolution = TERRAIN_SIZES.includes(raw.resolution as number) ? (raw.resolution as number) : 256;
  const ops = Array.isArray(raw.ops)
    ? raw.ops
        .slice(0, MAX_TERRAIN_OPS)
        .filter((o): o is Raw => isObj(o) && typeof o.op === 'string' && o.op.length > 0 && o.op.length <= 60)
        .map((o) => {
          const params = numbers(o.params);
          return params ? { op: o.op as string, params } : { op: o.op as string };
        })
    : [];
  const recipe: TerrainRecipe = { generator: raw.generator, seed: num(raw.seed, 1), resolution, ops };
  const params = numbers(raw.params);
  if (params) recipe.params = params;
  return recipe;
}

function nearestTerrainSize(n: number): number {
  return TERRAIN_SIZES.find((s) => s >= n) ?? TERRAIN_SIZES[TERRAIN_SIZES.length - 1];
}

function heightsFromArray(v: unknown): Float32Array | null {
  if (v instanceof Float32Array) return v;
  if (Array.isArray(v) && v.length <= 1024 * 1024 && v.every(fin)) return Float32Array.from(v as number[]);
  return null;
}

/** Heights clamped to 0..1 with NaNs zeroed (copied only when something needed fixing). */
function sanitizeHeights(h: Float32Array): Float32Array {
  for (let i = 0; i < h.length; i++) {
    const v = h[i];
    if (!(v >= 0 && v <= 1)) {
      const out = h.slice();
      for (let j = i; j < out.length; j++) out[j] = Number.isFinite(out[j]) ? clamp(out[j], 0, 1) : 0;
      return out;
    }
  }
  return h;
}

export function normalizeTerrain(raw: unknown, seedHint: number, warn: (w: string) => void): TerrainData {
  const r = isObj(raw) ? raw : {};
  const recipe = normalizeRecipe(r.recipe);
  let heights = heightsFromArray(r.heights);
  let n = heights ? Math.round(Math.sqrt(heights.length)) : 0;
  if (heights && (n < 2 || n * n !== heights.length)) {
    heights = null;
    warn('A terrain had damaged height data and was rebuilt.');
  }
  if (!heights && recipe) {
    try {
      heights = heightsFromRecipe(recipe);
      n = recipe.resolution;
    } catch {
      warn(`A terrain uses a generator this version does not know ("${recipe.generator}"); it was replaced.`);
    }
  }
  if (!heights) {
    if (raw !== undefined && !recipe) warn('A terrain was missing its heights and was regenerated.');
    const t = createTerrainData('fractal', seedHint, 128);
    heights = t.heights;
    n = t.resolution;
  }
  if (!TERRAIN_SIZES.includes(n)) {
    const to = nearestTerrainSize(n);
    heights = resampleHeights(heights, n, to);
    n = to;
  }
  heights = sanitizeHeights(heights);
  const a = num(r.clipLow, 0, 0, 1);
  const b = num(r.clipHigh, 1, 0, 1);
  const out: TerrainData = { resolution: n, heights, clipLow: Math.min(a, b), clipHigh: Math.max(a, b) };
  if (recipe && recipe.resolution === n) out.recipe = recipe;
  return out;
}

function normalizeObject(raw: unknown, index: number, usedIds: Set<string>, warn: (w: string) => void): SceneObject | null {
  if (!isObj(raw)) return null;
  if (typeof raw.type !== 'string' || !(OBJECT_TYPES as readonly string[]).includes(raw.type)) {
    warn(`Skipped an object of unknown type${typeof raw.type === 'string' ? ` "${raw.type.slice(0, 30)}"` : ''}.`);
    return null;
  }
  const type = raw.type as ObjectType;
  let id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 64 ? raw.id : '';
  if (!id || usedIds.has(id)) id = newId();
  usedIds.add(id);
  const name = str(raw.name, '', 80).trim() || `${OBJECT_BASE_NAMES[type]} ${index + 1}`;
  const o: SceneObject = { id, name, type, transform: normalizeTransform(raw.transform, type), material: normalizeMaterial(raw.material, type) };
  if (raw.hidden === true) o.hidden = true;
  if (raw.locked === true) o.locked = true;
  if (raw.showAsBox === true) o.showAsBox = true;
  o.family = int(raw.family, 0, 0, 7);
  const seed = hashSeed(id);
  if (type === 'torus') o.torus = { minorRadius: num(isObj(raw.torus) ? raw.torus.minorRadius : undefined, 0.3, 0.05, 0.5) };
  if (type === 'stone') {
    const s = isObj(raw.stone) ? raw.stone : {};
    o.stone = { seed: num(s.seed, seed), lumpiness: num(s.lumpiness, 0.5, 0, 1), roughness: num(s.roughness, 0.5, 0, 1) };
  }
  if (type === 'tree') {
    const t = isObj(raw.tree) ? raw.tree : {};
    o.tree = {
      seed: num(t.seed, seed),
      trunkHeight: num(t.trunkHeight, 0.45, 0.2, 0.8),
      trunkWidth: num(t.trunkWidth, 0.1, 0.03, 0.3),
      crown: pick(t.crown, ['round', 'cone', 'palm', 'willow'] as const, 'round'),
      crownNoise: num(t.crownNoise, 0.5, 0, 1),
      trunkColor: rgb(t.trunkColor, [0.32, 0.22, 0.14]),
    };
  }
  if (isLight(type)) o.light = normalizeLight(raw.light, type);
  if (isTerrainLike(type)) o.terrain = normalizeTerrain(raw.terrain, seed, warn);
  return o;
}

// --- scene ------------------------------------------------------------------------

export interface NormalizeReport {
  scene: Scene;
  /** Human-readable notes about anything that was repaired or skipped. */
  warnings: string[];
}

/** Validate and complete a parsed scene, collecting warnings. Throws only for non-scenes. */
export function normalizeSceneReport(raw: unknown): NormalizeReport {
  let src = raw;
  if (isObj(src) && !Array.isArray(src.objects) && isObj(src.scene)) src = src.scene;
  if (!isObj(src) || !Array.isArray(src.objects)) throw new Error(NOT_A_SCENE);
  const warnings = new Set<string>();
  const warn = (w: string) => {
    if (warnings.size < 12) warnings.add(w);
  };
  if (fin(src.version) && src.version > 1) warn('This scene comes from a newer version of Bryce 3D Web; some details may be missing.');
  if (src.objects.length > MAX_OBJECTS) warn(`Only the first ${MAX_OBJECTS} objects were loaded.`);
  const used = new Set<string>();
  const objects: SceneObject[] = [];
  src.objects.slice(0, MAX_OBJECTS).forEach((o, i) => {
    const obj = normalizeObject(o, i, used, warn);
    if (obj) objects.push(obj);
  });
  const scene: Scene = {
    version: 1,
    name: str(src.name, 'Untitled', 120).trim() || 'Untitled',
    objects,
    sky: normalizeSky(src.sky),
    camera: normalizeCamera(src.camera),
    render: normalizeRender(src.render),
  };
  return { scene, warnings: [...warnings] };
}

/** Validate and complete a parsed scene. Throws a readable Error when the input is not a scene. */
export function normalizeScene(raw: unknown): Scene {
  return normalizeSceneReport(raw).scene;
}
