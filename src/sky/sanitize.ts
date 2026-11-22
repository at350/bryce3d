/**
 * Sky validation, repair and copying. sanitizeSky() turns anything (an old save, a share
 * link, a hand-edited file) into a complete, in-range Sky; skyProblems() lists what is
 * wrong with a value (tests, dev checks).
 */
import type { CloudLayer, RGB, Sky } from '@/core/types';
import { defaultSky, makeCloudLayer } from './defaults';
import { CLOUD_OFFSET_LIMIT, CLOUD_RANGES, SKY_MODES, SKY_RANGES, clampTo, wrapDegrees, type CloudNumberKey, type SkyNumberKey } from './ranges';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const SKY_COLOR_KEYS = ['horizonColor', 'zenithColor', 'skyDomeColor', 'sunColor', 'moonColor', 'hazeColor', 'fogColor', 'ambientColor'] as const;
const SKY_NUMBER_KEYS = Object.keys(SKY_RANGES) as SkyNumberKey[];
const CLOUD_NUMBER_KEYS = Object.keys(CLOUD_RANGES) as CloudNumberKey[];

function sanitizeColor(v: unknown, fallback: RGB): RGB {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) return [...fallback] as RGB;
  return v.map((c) => Math.min(1, Math.max(0, c))) as RGB;
}

function sanitizeCloud(v: unknown, fallback: CloudLayer): CloudLayer {
  const src = isObj(v) ? v : {};
  const out = makeCloudLayer({ ...fallback, offset: [...fallback.offset] as [number, number], color: [...fallback.color] as RGB });
  if (typeof src.enabled === 'boolean') out.enabled = src.enabled;
  for (const k of CLOUD_NUMBER_KEYS) if (isNum(src[k])) out[k] = clampTo(CLOUD_RANGES[k], src[k]);
  out.color = sanitizeColor(src.color, fallback.color);
  if (Array.isArray(src.offset) && src.offset.length === 2 && src.offset.every(isNum)) {
    out.offset = [
      Math.max(-CLOUD_OFFSET_LIMIT, Math.min(CLOUD_OFFSET_LIMIT, src.offset[0])),
      Math.max(-CLOUD_OFFSET_LIMIT, Math.min(CLOUD_OFFSET_LIMIT, src.offset[1])),
    ];
  }
  return out;
}

/** A complete, in-range Sky built from any input; missing or invalid fields come from `fallback`. */
export function sanitizeSky(input: unknown, fallback: Sky = defaultSky()): Sky {
  const src = isObj(input) ? input : {};
  const out = cloneSky(fallback);
  if (typeof src.mode === 'string' && (SKY_MODES as string[]).includes(src.mode)) out.mode = src.mode as Sky['mode'];
  for (const k of SKY_COLOR_KEYS) out[k] = sanitizeColor(src[k], fallback[k]);
  for (const k of SKY_NUMBER_KEYS) if (isNum(src[k])) out[k] = clampTo(SKY_RANGES[k], src[k]);
  // Azimuth is circular: wrap instead of clamping (-30 means 330, not 0).
  out.sunAzimuth = wrapDegrees(isNum(src.sunAzimuth) ? src.sunAzimuth : out.sunAzimuth);
  if (typeof src.linkSunToView === 'boolean') out.linkSunToView = src.linkSunToView;
  if (typeof src.rainbow === 'boolean') out.rainbow = src.rainbow;
  out.stratus = sanitizeCloud(src.stratus, fallback.stratus);
  out.cumulus = sanitizeCloud(src.cumulus, fallback.cumulus);
  return out;
}

/** Deep copy (skies are plain data). */
export function cloneSky(s: Sky): Sky {
  const cloud = (c: CloudLayer): CloudLayer => ({ ...c, color: [...c.color] as RGB, offset: [...c.offset] as [number, number] });
  const out = { ...s, stratus: cloud(s.stratus), cumulus: cloud(s.cumulus) };
  for (const k of SKY_COLOR_KEYS) out[k] = [...s[k]] as RGB;
  return out;
}

function colorProblem(v: unknown): string | null {
  if (!Array.isArray(v) || v.length !== 3) return 'is not an RGB triple';
  if (!v.every(isNum)) return 'has a non-numeric channel';
  if (!v.every((c) => c >= 0 && c <= 1)) return 'has a channel outside 0..1';
  return null;
}

function cloudProblems(name: string, v: unknown): string[] {
  if (!isObj(v)) return [`${name} is missing`];
  const out: string[] = [];
  if (typeof v.enabled !== 'boolean') out.push(`${name}.enabled is not a boolean`);
  for (const k of CLOUD_NUMBER_KEYS) {
    const r = CLOUD_RANGES[k];
    const n = v[k];
    if (!isNum(n)) out.push(`${name}.${k} is not a number`);
    else if (n < r.min || n > r.max) out.push(`${name}.${k} = ${n} is outside ${r.min}..${r.max}`);
  }
  const cp = colorProblem(v.color);
  if (cp) out.push(`${name}.color ${cp}`);
  if (!Array.isArray(v.offset) || v.offset.length !== 2 || !v.offset.every(isNum)) out.push(`${name}.offset is not a finite [x, z] pair`);
  const extra = Object.keys(v).filter((k) => !(k in makeCloudLayer()));
  if (extra.length) out.push(`${name} has unknown fields: ${extra.join(', ')}`);
  return out;
}

/** Everything wrong with a value that should be a Sky (empty array = valid). */
export function skyProblems(v: unknown): string[] {
  if (!isObj(v)) return ['not an object'];
  const out: string[] = [];
  if (typeof v.mode !== 'string' || !(SKY_MODES as string[]).includes(v.mode)) out.push(`mode "${String(v.mode)}" is not a sky mode`);
  for (const k of SKY_COLOR_KEYS) {
    const cp = colorProblem(v[k]);
    if (cp) out.push(`${k} ${cp}`);
  }
  for (const k of SKY_NUMBER_KEYS) {
    const r = SKY_RANGES[k];
    const n = v[k];
    if (!isNum(n)) out.push(`${k} is not a number`);
    else if (n < r.min || n > r.max) out.push(`${k} = ${n} is outside ${r.min}..${r.max}`);
  }
  if (typeof v.linkSunToView !== 'boolean') out.push('linkSunToView is not a boolean');
  if (typeof v.rainbow !== 'boolean') out.push('rainbow is not a boolean');
  out.push(...cloudProblems('stratus', v.stratus), ...cloudProblems('cumulus', v.cumulus));
  const extra = Object.keys(v).filter((k) => !(k in defaultSky()));
  if (extra.length) out.push(`unknown fields: ${extra.join(', ')}`);
  return out;
}

/** Structural equality with a small tolerance on numbers (preset matching, "modified" marks). */
export function skiesEqual(a: Sky, b: Sky, eps = 1e-6): boolean {
  const eq = (x: unknown, y: unknown): boolean => {
    if (isNum(x) && isNum(y)) return Math.abs(x - y) <= eps;
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((xi, i) => eq(xi, y[i]));
    if (isObj(x) && isObj(y)) {
      const kx = Object.keys(x);
      return kx.length === Object.keys(y).length && kx.every((k) => eq(x[k], y[k]));
    }
    return x === y;
  };
  return eq(a, b);
}
