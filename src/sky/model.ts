/**
 * A small CPU approximation of how a Sky looks, used only for UI art (preset swatches,
 * palette thumbnails, Sky Lab textures) so they read instantly without the ray tracer.
 * It mirrors the Sky field semantics (modes, sun / moon, haze, clouds) loosely; the
 * renderer owns the real look.
 */
import { DEG, clamp, linearToSrgb, smoothstep, srgbToLinear, sunDirection } from '@/core/math';
import type { CloudLayer, RGB, Sky } from '@/core/types';
import { luma, mixRgb, mulRgb, scaleRgb } from './color';
import { fbm, valueNoise } from './noise';

export interface SkyLook {
  zenith: RGB;
  horizon: RGB;
  /** 0 = night .. 1 = full daylight (from the sun altitude). */
  daylight: number;
}

const NIGHT_ZENITH: RGB = [0.003, 0.005, 0.018];
const NIGHT_HORIZON: RGB = [0.012, 0.017, 0.04];

const toLinear = (c: RGB): RGB => [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])];
const toSrgb = (c: RGB): RGB => [linearToSrgb(clamp(c[0], 0, 1)), linearToSrgb(clamp(c[1], 0, 1)), linearToSrgb(clamp(c[2], 0, 1))];

function saturate(c: RGB, k: number): RGB {
  const l = luma(c);
  return [Math.max(0, l + (c[0] - l) * k), Math.max(0, l + (c[1] - l) * k), Math.max(0, l + (c[2] - l) * k)];
}

/**
 * Horizon and zenith colors the sky shows. Mirrors the renderer's reading of the Sky
 * fields: soft / darker start from horizonColor / zenithColor and redden at sunset and
 * darken at night (darker is deeper and more saturated), custom uses the colors as
 * given, off is one flat color; the sky dome color tints the hue of all but off.
 */
export function resolveSkyLook(sky: Sky): SkyLook {
  const alt = sky.sunAltitude;
  const day = smoothstep(-7, 5, alt);
  if (sky.mode === 'off') return { zenith: sky.zenithColor, horizon: sky.zenithColor, daylight: day };
  let zenith = toLinear(sky.zenithColor);
  let horizon = toLinear(sky.horizonColor);
  if (sky.mode === 'soft' || sky.mode === 'darker') {
    const sunset = (1 - smoothstep(0, 22, alt)) * smoothstep(-9, -1, alt);
    zenith = mixRgb(zenith, mulRgb(zenith, [0.62, 0.5, 0.86]), sunset * 0.75);
    horizon = mixRgb(horizon, mulRgb(horizon, [1, 0.78, 0.66]), sunset * 0.8);
    zenith = mixRgb(NIGHT_ZENITH, zenith, day);
    horizon = mixRgb(NIGHT_HORIZON, horizon, day);
    if (sky.mode === 'darker') {
      zenith = scaleRgb(saturate(zenith, 1.35), 0.5);
      horizon = scaleRgb(saturate(horizon, 1.25), 0.72);
    }
  }
  const dome = toLinear(sky.skyDomeColor);
  const l = Math.max(luma(dome), 0.02);
  const tint = mixRgb([1, 1, 1], [clamp(dome[0] / l, 0, 3), clamp(dome[1] / l, 0, 3), clamp(dome[2] / l, 0, 3)], 0.22);
  zenith = mulRgb(zenith, tint);
  horizon = mulRgb(horizon, mixRgb([1, 1, 1], tint, 0.5));
  return { zenith: toSrgb(zenith), horizon: toSrgb(horizon), daylight: day };
}

export interface CloudParams {
  height: number;
  scale: number;
  stretch: number;
  threshold: number;
  softness: number;
  color: RGB;
  shading: number;
  ox: number;
  oz: number;
  octaves: number;
  seed: number;
  /** 0..1 (CloudLayer turbulence / 100). */
  turbulence: number;
  /** 0..1 (CloudLayer glow / 100). */
  glow: number;
}

export function cloudParams(layer: CloudLayer, kind: 'stratus' | 'cumulus'): CloudParams | null {
  if (!layer.enabled || layer.cover <= 0) return null;
  return {
    height: Math.max(50, layer.height),
    scale: (layer.frequency + 20) / 60000,
    stretch: kind === 'stratus' ? 4 : 1,
    threshold: 1 - layer.cover / 100,
    softness: 0.02 + 0.3 * (1 - clamp(layer.amplitude, 0, 400) / 400),
    color: layer.color,
    shading: layer.shading,
    ox: layer.offset[0],
    oz: layer.offset[1],
    octaves: kind === 'stratus' ? 3 : 4,
    seed: kind === 'stratus' ? 11 : 29,
    turbulence: clamp(layer.turbulence, 0, 100) / 100,
    glow: clamp(layer.glow, 0, 100) / 100,
  };
}

/** Cloud density 0..1 of a layer at a point of its (horizontal) plane, plus a thickness term. */
export function cloudDensityAt(p: CloudParams, x: number, z: number): { density: number; thick: number } {
  let u = (x + p.ox) * p.scale / p.stretch;
  let v = (z + p.oz) * p.scale;
  let n: number;
  let swing = 0;
  if (p.turbulence > 0) {
    // Like the renderer's torn layers: a bending / breaking / fraying warp (stratus streaks run
    // along u, so they bend across and break along it; cumulus tears every way), a finer
    // octave, and dense and empty stretches.
    const t = p.turbulence * (2 - p.turbulence);
    const s = p.seed;
    const across = p.stretch > 1;
    const du = (valueNoise(u * 0.3, v * 0.3, s + 101) - 0.5) * (across ? 0.6 : 1.2) + (valueNoise(u * 1.1, v * 1.1, s + 103) - 0.5) * (across ? 1.4 : 0.6) + (valueNoise(u * 3.2, v * 3.2, s + 105) - 0.5) * 0.3;
    const dv = (valueNoise(u * 0.3, v * 0.3, s + 102) - 0.5) * (across ? 3 : 1.2) + (valueNoise(u * 1.1, v * 1.1, s + 104) - 0.5) * (across ? 0.5 : 0.6) + (valueNoise(u * 3.2, v * 3.2, s + 106) - 0.5) * 0.3;
    swing = (smoothstep(0.25, 0.75, valueNoise(u * 0.25, v * 0.6, s + 107)) - 0.6) * 0.8 * t;
    u += du * t;
    v += dv * t;
    n = fbm(u, v, p.octaves, 0.55, p.seed) + (valueNoise(u * 9.1, v * 9.1, s + 108) - 0.5) * 0.06 * t;
  } else {
    n = fbm(u, v, p.octaves, 0.55, p.seed);
  }
  const spread = clamp((n - 0.5) * 2.4 + 0.5 + swing, 0, 1);
  const density = smoothstep(p.threshold - p.softness, p.threshold + p.softness, spread);
  return { density, thick: smoothstep(p.threshold, p.threshold + 0.4, spread) };
}


export type SkySampleFn = (x: number, y: number, z: number, out: number[]) => void;

/**
 * A per-direction color function for painting the sky. Direction (x, y, z) must be
 * normalized and in the Bryce frame where azimuth 0 looks toward -Z (camera heading 0).
 */
export function makeSkySampler(sky: Sky, opts: { clouds?: boolean } = {}): SkySampleFn {
  const look = resolveSkyLook(sky);
  const sd = sunDirection(sky.sunAzimuth, sky.sunAltitude);
  const sunVis = smoothstep(-0.06, 0.02, sd[1]);
  const glowAmt = sky.sunGlow / 100;
  const glowW = 0.08 + 0.3 * glowAmt;
  const discR = (0.5 + sky.sunSize * 0.09) * DEG;
  const moonVis = smoothstep(-0.02, 0.05, -sd[1]);
  const moonR = (0.6 + sky.moonSize * 0.08) * DEG;
  const md = [-sd[0], -sd[1], -sd[2]];
  // Moon disc basis: right is horizontal, up completes the frame.
  const rl = Math.hypot(md[2], md[0]) || 1;
  const mr = [-md[2] / rl, 0, md[0] / rl];
  const mu = [mr[1] * md[2] - mr[2] * md[1], mr[2] * md[0] - mr[0] * md[2], mr[0] * md[1] - mr[1] * md[0]];
  const phaseC = Math.cos(sky.moonPhase * Math.PI * 2);
  const haze = sky.haze / 100;
  const hazeK = 12 - 8 * haze;
  const derived = sky.mode === 'soft' || sky.mode === 'darker';
  const nightDim = derived ? 0.3 + 0.7 * look.daylight : 1;
  const layers = opts.clouds === false || sky.mode === 'off'
    ? []
    : [cloudParams(sky.stratus, 'stratus'), cloudParams(sky.cumulus, 'cumulus')].filter((p): p is CloudParams => !!p);
  const off = sky.mode === 'off';

  return (x, y, z, out) => {
    const t = y > 0 ? y : 0;
    const g = Math.sqrt(t);
    let r = look.horizon[0] + (look.zenith[0] - look.horizon[0]) * g;
    let gr = look.horizon[1] + (look.zenith[1] - look.horizon[1]) * g;
    let b = look.horizon[2] + (look.zenith[2] - look.horizon[2]) * g;
    if (off) {
      out[0] = r;
      out[1] = gr;
      out[2] = b;
      return;
    }
    const cosA = x * sd[0] + y * sd[1] + z * sd[2];
    const ang = Math.acos(clamp(cosA, -1, 1));
    if (sunVis > 0) {
      const q = ang / glowW;
      const glow = glowAmt * Math.exp(-q * q) * sunVis;
      const wide = glowAmt * 0.35 * Math.exp(-(q * q) / 9) * (1 - g) * sunVis;
      r += sky.sunColor[0] * (glow + wide);
      gr += sky.sunColor[1] * (glow + wide);
      b += sky.sunColor[2] * (glow + wide);
    }
    for (const p of layers) {
      if (y < 0.01) break;
      const s = p.height / y;
      const { density, thick } = cloudDensityAt(p, x * s, z * s);
      const a = density * smoothstep(0.02, 0.3, y) * 0.95;
      if (a <= 0.001) continue;
      const shade = (1 - p.shading * 0.6 * thick) * nightDim;
      const lit = sunVis * 0.25 * look.daylight;
      let silver = glowAmt * 0.6 * Math.exp(-((ang / (glowW * 1.5)) ** 2)) * sunVis;
      if (p.glow > 0) {
        // The layer's own sun glow lighting (as in the renderer): smooth lobes around the sun,
        // added in the sun color, brightest in thin parts and at edges.
        const c = Math.max(cosA, 0);
        silver += p.glow * glowAmt * sunVis * (0.3 * c ** 8 + 1.4 * c ** 20 + 2.4 * c ** 200) * (1 - 0.85 * density) * 0.8;
      }
      const cr = p.color[0] * shade * (1 - lit + lit * sky.sunColor[0]) + sky.sunColor[0] * silver;
      const cg = p.color[1] * shade * (1 - lit + lit * sky.sunColor[1]) + sky.sunColor[1] * silver;
      const cb = p.color[2] * shade * (1 - lit + lit * sky.sunColor[2]) + sky.sunColor[2] * silver;
      r += (cr - r) * a;
      gr += (cg - gr) * a;
      b += (cb - b) * a;
    }
    if (sunVis > 0 && ang < discR * 1.2) {
      const k = smoothstep(discR, discR * 0.8, ang) * sunVis;
      r += (Math.min(1, sky.sunColor[0] * 1.2 + 0.25) - r) * k;
      gr += (Math.min(1, sky.sunColor[1] * 1.2 + 0.25) - gr) * k;
      b += (Math.min(1, sky.sunColor[2] * 1.2 + 0.25) - b) * k;
    }
    if (moonVis > 0 && sky.moonSize > 0) {
      const angM = Math.PI - ang;
      if (angM < moonR * 1.2) {
        const u = (x * mr[0] + y * mr[1] + z * mr[2]) / moonR;
        const v = (x * mu[0] + y * mu[1] + z * mu[2]) / moonR;
        const edge = smoothstep(1, 0.85, angM / moonR) * moonVis;
        const w = Math.sqrt(Math.max(0, 1 - v * v));
        const litSide = sky.moonPhase <= 0.5 ? u > phaseC * w : u < -phaseC * w;
        const lum = litSide ? 1 : 0.07;
        r += (sky.moonColor[0] * lum - r) * edge;
        gr += (sky.moonColor[1] * lum - gr) * edge;
        b += (sky.moonColor[2] * lum - b) * edge;
      }
    }
    if (haze > 0) {
      const band = Math.min(1, Math.exp(-t * hazeK) * haze * 1.1);
      r += (sky.hazeColor[0] - r) * band;
      gr += (sky.hazeColor[1] - gr) * band;
      b += (sky.hazeColor[2] - b) * band;
    }
    out[0] = r;
    out[1] = gr;
    out[2] = b;
  };
}

/** True when stars should show against this sky color. */
export const darkEnoughForStars = (c: RGB) => luma(c) < 0.22;
