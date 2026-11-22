/**
 * Material validation and repair. validateMaterial lists every problem (used by tests
 * and dev checks); sanitizeMaterial turns any loosely shaped value (a pasted or loaded
 * material) into a valid Material, clamping ranges and dropping what cannot be used.
 */
import { defaultMaterial } from '@/core/materialUtils';
import type { ChannelDriver, Material, MaterialChannel, RGB, TextureComponent, TextureMapping, TextureType } from '@/core/types';
import {
  COLOR_KEYS,
  COMPONENT_RANGES,
  DEFAULT_VOLUME_DENSITY,
  DRIVABLE_CHANNELS,
  MAX_COMPONENTS,
  MAX_GRADIENT_STOPS,
  MIN_GRADIENT_STOPS,
  TEXTURE_MAPPINGS,
  TEXTURE_TYPES,
  VALUE_RANGES,
  type MaterialValueKey,
} from './channels';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isRGB(v: unknown): v is RGB {
  return Array.isArray(v) && v.length === 3 && v.every((c) => isNum(c) && c >= 0 && c <= 1);
}

const SURFACE_VALUE_KEYS: Exclude<MaterialValueKey, 'volumeDensity'>[] = [
  'diffusion',
  'ambience',
  'specularity',
  'specularHalo',
  'metallicity',
  'bumpHeight',
  'transparency',
  'reflection',
  'refraction',
  'blur',
];

function inRange(v: unknown, [lo, hi]: [number, number]): boolean {
  return isNum(v) && v >= lo && v <= hi;
}

/** Problems with a texture component (empty when valid). */
export function validateComponent(c: TextureComponent, label = 'component'): string[] {
  const errors: string[] = [];
  if (!TEXTURE_TYPES.includes(c.type)) errors.push(`${label}: unknown type ${String(c.type)}`);
  if (!TEXTURE_MAPPINGS.includes(c.mapping)) errors.push(`${label}: unknown mapping ${String(c.mapping)}`);
  if (!isNum(c.scale) || c.scale < COMPONENT_RANGES.scale[0] || c.scale > COMPONENT_RANGES.scale[1]) errors.push(`${label}: scale ${c.scale} out of range`);
  if (!Number.isInteger(c.octaves) || !inRange(c.octaves, COMPONENT_RANGES.octaves)) errors.push(`${label}: octaves ${c.octaves} must be an integer 1..10`);
  if (!inRange(c.roughness, COMPONENT_RANGES.roughness)) errors.push(`${label}: roughness ${c.roughness} out of 0..1`);
  if (!inRange(c.warp, COMPONENT_RANGES.warp)) errors.push(`${label}: warp ${c.warp} out of 0..1`);
  if (!inRange(c.contrast, COMPONENT_RANGES.contrast)) errors.push(`${label}: contrast ${c.contrast} out of 0..1`);
  if (!inRange(c.bias, COMPONENT_RANGES.bias)) errors.push(`${label}: bias ${c.bias} out of -1..1`);
  if (!inRange(c.bump, COMPONENT_RANGES.bump)) errors.push(`${label}: bump ${c.bump} out of -1..1`);
  if (!isNum(c.seed)) errors.push(`${label}: seed must be a finite number`);
  if (!Array.isArray(c.gradient) || c.gradient.length < MIN_GRADIENT_STOPS || c.gradient.length > MAX_GRADIENT_STOPS) {
    errors.push(`${label}: gradient needs ${MIN_GRADIENT_STOPS}..${MAX_GRADIENT_STOPS} stops`);
  } else {
    c.gradient.forEach((s, i) => {
      if (!inRange(s.at, [0, 1])) errors.push(`${label}: gradient stop ${i} at ${s.at} out of 0..1`);
      if (!isRGB(s.color)) errors.push(`${label}: gradient stop ${i} color invalid`);
      if (i > 0 && s.at < c.gradient[i - 1].at) errors.push(`${label}: gradient stops not sorted`);
    });
  }
  return errors;
}

/** Every problem found in a material (empty when valid). */
export function validateMaterial(m: Material): string[] {
  const errors: string[] = [];
  if (typeof m.name !== 'string' || !m.name.trim()) errors.push('name must be a non-empty string');
  for (const key of COLOR_KEYS) if (!isRGB(m[key])) errors.push(`${key} must be an sRGB triple in 0..1`);
  for (const key of SURFACE_VALUE_KEYS) if (!inRange(m[key], VALUE_RANGES[key])) errors.push(`${key} ${m[key]} out of range ${VALUE_RANGES[key].join('..')}`);
  if (m.mode !== 'surface' && m.mode !== 'volume') errors.push(`mode ${String(m.mode)} invalid`);
  if (m.volumeDensity !== undefined && !inRange(m.volumeDensity, VALUE_RANGES.volumeDensity)) errors.push(`volumeDensity ${m.volumeDensity} out of 0..100`);
  if (!Array.isArray(m.components) || m.components.length > MAX_COMPONENTS) errors.push(`at most ${MAX_COMPONENTS} components`);
  else m.components.forEach((c, i) => errors.push(...validateComponent(c, `component ${'ABC'[i]}`)));
  for (const [key, driver] of Object.entries(m.drivers ?? {})) {
    if (!DRIVABLE_CHANNELS.includes(key as MaterialChannel)) errors.push(`driver on unknown channel ${key}`);
    if (driver === undefined) continue;
    if (![-1, 0, 1, 2].includes(driver)) errors.push(`driver ${key} = ${driver} invalid`);
    else if (driver >= 0 && driver >= (m.components?.length ?? 0)) errors.push(`driver ${key} references missing component ${'ABC'[driver]}`);
  }
  if (m.altitude) {
    const a = m.altitude;
    if (!isRGB(a.color)) errors.push('altitude color invalid');
    if (!inRange(a.start, [0, 1])) errors.push(`altitude start ${a.start} out of 0..1`);
    if (!inRange(a.softness, [0, 1])) errors.push(`altitude softness ${a.softness} out of 0..1`);
    if (!inRange(a.maxSlope, [0, 1])) errors.push(`altitude maxSlope ${a.maxSlope} out of 0..1`);
  }
  return errors;
}

// ---------------------------------------------------------------------------

const clampTo = (v: unknown, [lo, hi]: [number, number], fallback: number) => (isNum(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

function sanitizeRGB(v: unknown, fallback: RGB): RGB {
  if (!Array.isArray(v) || v.length < 3) return [...fallback] as RGB;
  return [0, 1, 2].map((i) => clampTo(v[i], [0, 1], fallback[i])) as RGB;
}

function sanitizeComponent(raw: unknown): TextureComponent | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const type = TEXTURE_TYPES.includes(c.type as TextureType) ? (c.type as TextureType) : 'fbm';
  const mapping = TEXTURE_MAPPINGS.includes(c.mapping as TextureMapping) ? (c.mapping as TextureMapping) : 'object';
  let gradient = Array.isArray(c.gradient)
    ? (c.gradient as unknown[])
        .filter((s): s is { at: unknown; color: unknown } => !!s && typeof s === 'object')
        .map((s) => ({ at: clampTo(s.at, [0, 1], 0), color: sanitizeRGB(s.color, [0.5, 0.5, 0.5]) }))
        .sort((a, b) => a.at - b.at)
        .slice(0, MAX_GRADIENT_STOPS)
    : [];
  if (gradient.length === 0) gradient = [{ at: 0, color: [0.2, 0.2, 0.2] }, { at: 1, color: [0.9, 0.9, 0.9] }];
  if (gradient.length === 1) gradient = [gradient[0], { at: 1, color: [...gradient[0].color] as RGB }];
  return {
    type,
    mapping,
    scale: clampTo(c.scale, COMPONENT_RANGES.scale, 4),
    octaves: Math.round(clampTo(c.octaves, COMPONENT_RANGES.octaves, 5)),
    roughness: clampTo(c.roughness, COMPONENT_RANGES.roughness, 0.5),
    warp: clampTo(c.warp, COMPONENT_RANGES.warp, 0),
    contrast: clampTo(c.contrast, COMPONENT_RANGES.contrast, 0.5),
    bias: clampTo(c.bias, COMPONENT_RANGES.bias, 0),
    seed: isNum(c.seed) ? Math.floor(c.seed) : 1,
    gradient,
    bump: clampTo(c.bump, COMPONENT_RANGES.bump, 0.5),
  };
}

/** Coerce any value into a valid Material (missing or broken fields fall back to the defaults). */
export function sanitizeMaterial(raw: unknown): Material {
  const base = defaultMaterial();
  if (!raw || typeof raw !== 'object') return base;
  const m = raw as Record<string, unknown>;
  const components = (Array.isArray(m.components) ? m.components : [])
    .map(sanitizeComponent)
    .filter((c): c is TextureComponent => c !== null)
    .slice(0, MAX_COMPONENTS);
  const drivers: Partial<Record<MaterialChannel, ChannelDriver>> = {};
  if (m.drivers && typeof m.drivers === 'object') {
    for (const [key, d] of Object.entries(m.drivers as Record<string, unknown>)) {
      if (!DRIVABLE_CHANNELS.includes(key as MaterialChannel)) continue;
      if (d === 0 || d === 1 || d === 2) {
        if (d < components.length) drivers[key as MaterialChannel] = d;
      }
    }
  }
  const out: Material = {
    ...base,
    name: typeof m.name === 'string' && m.name.trim() ? m.name.trim().slice(0, 64) : base.name,
    components,
    drivers,
    mode: m.mode === 'volume' ? 'volume' : 'surface',
  };
  for (const key of COLOR_KEYS) out[key] = sanitizeRGB(m[key], base[key]);
  for (const key of SURFACE_VALUE_KEYS) out[key] = clampTo(m[key], VALUE_RANGES[key], base[key]);
  if (m.volumeDensity !== undefined || out.mode === 'volume') out.volumeDensity = clampTo(m.volumeDensity, VALUE_RANGES.volumeDensity, DEFAULT_VOLUME_DENSITY);
  if (m.altitude && typeof m.altitude === 'object') {
    const a = m.altitude as Record<string, unknown>;
    out.altitude = {
      color: sanitizeRGB(a.color, [0.95, 0.96, 1]),
      start: clampTo(a.start, [0, 1], 0.6),
      softness: clampTo(a.softness, [0, 1], 0.1),
      maxSlope: clampTo(a.maxSlope, [0, 1], 0.6),
    };
  }
  return out;
}
