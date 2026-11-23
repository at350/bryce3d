/**
 * Sky & atmosphere -> shader uniforms (pure). Derives the "Bryce soft sky" colors from the
 * sun position (sunset reddening, night, moon), converts everything to linear RGB and packs
 * it into a vec4 array the GLSL reads through the SKY_* defines.
 */
import { cameraBasis, clamp, directionToAzAlt, lerp, smoothstep, srgbToLinear, sunDirection } from '@/core/math';
import type { CameraState, CloudLayer, RGB, Sky, SkyMode, Vec3 } from '@/core/types';

export const SKY_SLOTS = [
  'SUN_DIR', // xyz toward the sun, w: direct sunlight factor 0..1
  'SUN_LIGHT', // rgb sunlight radiance on surfaces, w: cos(soft-shadow cone)
  'SUN_DISC', // rgb disc radiance, w: cos(disc radius)
  'GLOW', // rgb glow color * amount, w: unused
  'MOON_DIR', // xyz toward the moon, w: moon above horizon 0..1
  'MOON_LIGHT', // rgb moonlight radiance on surfaces, w: cos(disc radius)
  'MOON_COLOR', // rgb disc radiance, w: phase 0..1
  'ZENITH', // rgb, w: mode id (0 soft, 1 darker, 2 custom, 3 off)
  'HORIZON', // rgb, w: gradient exponent
  'HAZE', // rgb lit haze color, w: haze extinction per world unit
  'FOG', // rgb lit fog color, w: fog extinction per world unit
  'ATMO', // fog height, fog falloff, horizon haze band, stars 0..1
  'AMBIENT', // rgb ambient light, w: shadow intensity 0..1
  'STRATUS', // cover 0..1 (0 = off), height, frequency, amplitude
  'STRATUS_COLOR', // rgb, w: shading
  'CUMULUS',
  'CUMULUS_COLOR',
  'CLOUD_OFFSETS', // stratus offset xy, cumulus offset xy
  'SUNSET', // rgb sunset horizon color, w: amount 0..1
  'DOME', // rgb sky dome tint, w: rainbow strength
  'BELOW', // rgb below-horizon color, w: night 0..1
  'CLOUD_LIGHT', // rgb light reaching the clouds, w: unused
  'CLOUD_STYLE', // stratus turbulence, stratus glow, cumulus turbulence, cumulus glow (0..1; 0 when off)
] as const;

export type SkySlot = (typeof SKY_SLOTS)[number];
export const SKY_SLOT_COUNT = SKY_SLOTS.length;
const slotIndex = Object.fromEntries(SKY_SLOTS.map((s, i) => [s, i])) as Record<SkySlot, number>;

export function skyDefines(): string {
  return SKY_SLOTS.map((s, i) => `#define SKY_${s} uSky[${i}]`).join('\n') + `\n#define SKY_SLOT_COUNT ${SKY_SLOT_COUNT}`;
}

export const SKY_MODE_ID: Record<SkyMode, number> = { soft: 0, darker: 1, custom: 2, off: 3 };

/** Tuning constants for the painterly look. */
export const SUN_RADIANCE = 2.1;
export const AMBIENT_SCALE = 0.75;
const SUN_DISC_RADIANCE = 40;
const NIGHT_ZENITH: RGB = [0.003, 0.005, 0.018];
const NIGHT_HORIZON: RGB = [0.012, 0.017, 0.04];
const SUNSET_SKY: RGB = [1.0, 0.36, 0.11];
const SUNSET_SUN: RGB = [1.0, 0.5, 0.22];

const fin = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const lin = (c: RGB | undefined, def: RGB): RGB => {
  const s = Array.isArray(c) && c.length >= 3 ? c : def;
  return [srgbToLinear(clamp(fin(s[0], def[0]), 0, 1)), srgbToLinear(clamp(fin(s[1], def[1]), 0, 1)), srgbToLinear(clamp(fin(s[2], def[2]), 0, 1))];
};
const mul = (a: RGB, b: RGB): RGB => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const luma = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const saturate = (c: RGB, k: number): RGB => {
  const l = luma(c);
  return [Math.max(0, l + (c[0] - l) * k), Math.max(0, l + (c[1] - l) * k), Math.max(0, l + (c[2] - l) * k)];
};

export interface SkyDerived {
  sunDir: Vec3;
  /** Direct sunlight factor (0 below the horizon). */
  sunUp: number;
  moonDir: Vec3;
  moonUp: number;
  /** 0 at noon .. 1 at sunset. */
  sunset: number;
  /** 0 day .. 1 night. */
  night: number;
  sunLight: RGB;
  moonLight: RGB;
  ambient: RGB;
  zenith: RGB;
  horizon: RGB;
}

/** Effective sun azimuth, honoring "link sun to view". */
export function effectiveSunAzimuth(sky: Sky, camera: CameraState): number {
  const az = fin(sky.sunAzimuth, 215);
  if (!sky.linkSunToView) return az;
  const { forward } = cameraBasis(camera);
  return az + directionToAzAlt(forward).azimuth;
}

/** Derived lighting values (also used by tests and the preview fallback). */
export function deriveSky(sky: Sky, camera: CameraState): SkyDerived {
  const mode = sky.mode in SKY_MODE_ID ? sky.mode : 'soft';
  const alt = clamp(fin(sky.sunAltitude, 38), -90, 90);
  const sunDir = sunDirection(effectiveSunAzimuth(sky, camera), alt);
  const moonDir: Vec3 = [-sunDir[0], -sunDir[1], -sunDir[2]];
  const day = smoothstep(-7, 5, alt);
  const night = 1 - day;
  const sunUp = smoothstep(-1.5, 2.5, alt);
  const moonUp = smoothstep(-2, 3, -alt);
  const sunset = (1 - smoothstep(0, 22, alt)) * smoothstep(-9, -1, alt);
  const auto = mode !== 'custom';

  const sunTint = auto ? mix([1, 1, 1], SUNSET_SUN, Math.pow(1 - smoothstep(0, 24, Math.max(alt, 0)), 1.4)) : ([1, 1, 1] as RGB);
  const sunColor = lin(sky.sunColor, [1, 0.96, 0.88]);
  const sunLight = scale(mul(sunColor, sunTint), SUN_RADIANCE * sunUp);

  const phase = clamp(fin(sky.moonPhase, 0.5), 0, 1);
  const phaseLight = 1 - Math.abs(phase - 0.5) * 2;
  const moonLight = scale(lin(sky.moonColor, [0.95, 0.95, 0.9]), 0.2 * (0.08 + 0.92 * phaseLight) * moonUp);

  let zenith = lin(sky.zenithColor, [0.24, 0.42, 0.78]);
  let horizon = lin(sky.horizonColor, [0.82, 0.86, 0.92]);
  if (mode === 'soft' || mode === 'darker') {
    zenith = mix(zenith, mul(zenith, [0.62, 0.5, 0.86]), sunset * 0.75);
    horizon = mix(horizon, mul(horizon, [1.0, 0.78, 0.66]), sunset * 0.8);
    zenith = mix(NIGHT_ZENITH, zenith, day);
    horizon = mix(NIGHT_HORIZON, horizon, day);
    if (mode === 'darker') {
      zenith = scale(saturate(zenith, 1.35), 0.5);
      horizon = scale(saturate(horizon, 1.25), 0.72);
    }
  } else if (mode === 'off') {
    horizon = zenith;
  }
  if (mode !== 'off') {
    const dome = lin(sky.skyDomeColor, [0.55, 0.68, 0.9]);
    const l = Math.max(luma(dome), 0.02);
    const tint = mix([1, 1, 1], [clamp(dome[0] / l, 0, 3), clamp(dome[1] / l, 0, 3), clamp(dome[2] / l, 0, 3)], 0.22);
    zenith = mul(zenith, tint);
    horizon = mul(horizon, mix([1, 1, 1], tint, 0.5));
  }

  const amb = clamp(fin(sky.ambient, 35), 0, 100) / 100;
  const ambient: RGB = scale(lin(sky.ambientColor, [0.62, 0.7, 0.85]), amb * AMBIENT_SCALE * lerp(0.18, 1, day));
  const ambientWithMoon: RGB = [ambient[0] + moonLight[0] * 0.25, ambient[1] + moonLight[1] * 0.25, ambient[2] + moonLight[2] * 0.25];

  return { sunDir, sunUp, moonDir, moonUp, sunset: auto ? sunset : 0, night, sunLight, moonLight, ambient: ambientWithMoon, zenith, horizon };
}

function cloudSlots(layer: CloudLayer | undefined, light: number): { prm: number[]; color: number[]; offset: [number, number]; style: [number, number] } {
  if (!layer || !layer.enabled) return { prm: [0, 1000, 100, 100], color: [1, 1, 1, 0.5], offset: [0, 0], style: [0, 0] };
  const c = lin(layer.color, [1, 1, 1]);
  return {
    prm: [
      clamp(fin(layer.cover, 40), 0, 100) / 100,
      Math.max(10, fin(layer.height, 900)),
      clamp(fin(layer.frequency, 100), 1, 400),
      clamp(fin(layer.amplitude, 100), 0, 400),
    ],
    color: [c[0] * light, c[1] * light, c[2] * light, clamp(fin(layer.shading, 0.5), 0, 1)],
    offset: [fin(layer.offset?.[0], 0), fin(layer.offset?.[1], 0)],
    style: [clamp(fin(layer.turbulence, 0), 0, 100) / 100, clamp(fin(layer.glow, 0), 0, 100) / 100],
  };
}

/** The packed uniform array (SKY_SLOT_COUNT vec4s). */
export function computeSkyParams(sky: Sky, camera: CameraState): Float32Array {
  const out = new Float32Array(SKY_SLOT_COUNT * 4);
  const set = (slot: SkySlot, a: number, b: number, c: number, d: number) => out.set([a, b, c, d], slotIndex[slot] * 4);
  const d = deriveSky(sky, camera);
  const mode = sky.mode in SKY_MODE_ID ? sky.mode : 'soft';
  const auto = mode === 'soft' || mode === 'darker';
  const day = 1 - d.night;
  const deg = Math.PI / 180;

  const sunRadius = lerp(0.3, 4.0, clamp(fin(sky.sunSize, 30), 0, 100) / 100) * deg;
  const softCone = Math.max(sunRadius * 1.6, 0.6 * deg);
  const sunColor = lin(sky.sunColor, [1, 0.96, 0.88]);
  const discTint = auto ? mix([1, 1, 1], SUNSET_SUN, d.sunset * 0.8) : ([1, 1, 1] as RGB);
  const discVisible = mode === 'off' ? 0 : smoothstep(-sunRadius / deg - 0.5, 0.5, fin(sky.sunAltitude, 38));
  const disc = scale(mul(sunColor, discTint), SUN_DISC_RADIANCE * discVisible);
  const glowAmt = (clamp(fin(sky.sunGlow, 35), 0, 100) / 100) * (mode === 'off' ? 0 : smoothstep(-10, 0, fin(sky.sunAltitude, 38)));
  const glow = scale(mul(sunColor, mix([1, 1, 1], [1, 0.55, 0.3], d.sunset)), glowAmt);

  set('SUN_DIR', d.sunDir[0], d.sunDir[1], d.sunDir[2], d.sunUp);
  set('SUN_LIGHT', d.sunLight[0], d.sunLight[1], d.sunLight[2], Math.cos(softCone));
  set('SUN_DISC', disc[0], disc[1], disc[2], Math.cos(sunRadius));
  set('GLOW', glow[0], glow[1], glow[2], 0);

  const moonRadius = lerp(0.5, 5, clamp(fin(sky.moonSize, 30), 0, 100) / 100) * deg;
  const moonDisc = scale(lin(sky.moonColor, [0.95, 0.95, 0.9]), 1.5 * (mode === 'off' ? 0 : 1));
  set('MOON_DIR', d.moonDir[0], d.moonDir[1], d.moonDir[2], d.moonUp);
  set('MOON_LIGHT', d.moonLight[0], d.moonLight[1], d.moonLight[2], Math.cos(moonRadius));
  set('MOON_COLOR', moonDisc[0], moonDisc[1], moonDisc[2], clamp(fin(sky.moonPhase, 0.5), 0, 1));

  set('ZENITH', d.zenith[0], d.zenith[1], d.zenith[2], SKY_MODE_ID[mode]);
  set('HORIZON', d.horizon[0], d.horizon[1], d.horizon[2], mode === 'darker' ? 0.4 : 0.55);

  const lightLevel = lerp(0.05, 1, day) + luma(d.moonLight) * 1.5;
  const haze = clamp(fin(sky.haze, 18), 0, 100) / 100;
  const hazeColor = mix(scale(lin(sky.hazeColor, [0.85, 0.88, 0.95]), lightLevel), scale(SUNSET_SKY, 0.8 * lightLevel), d.sunset * 0.35);
  set('HAZE', hazeColor[0], hazeColor[1], hazeColor[2], Math.pow(haze, 1.4) * 0.02);

  const fogD = clamp(fin(sky.fogDensity, 0), 0, 100) / 100;
  const fogColor = scale(lin(sky.fogColor, [0.9, 0.9, 0.92]), lightLevel);
  set('FOG', fogColor[0], fogColor[1], fogColor[2], fogD > 0 ? fogD * fogD * 0.05 : 0);
  const fogHeight = fin(sky.fogHeight, 4);
  set('ATMO', fogHeight, Math.max(0.5, Math.abs(fogHeight) * 0.25), haze, clamp(fin(sky.stars, 0), 0, 100) / 100);

  set('AMBIENT', d.ambient[0], d.ambient[1], d.ambient[2], clamp(fin(sky.shadowIntensity, 75), 0, 100) / 100);

  const cloudLightLevel = lerp(0.07, 1, smoothstep(-7, 2, fin(sky.sunAltitude, 38)));
  const st = cloudSlots(sky.stratus, 1);
  const cu = cloudSlots(sky.cumulus, 1);
  const cloudsOn = mode === 'off' ? 0 : 1;
  set('STRATUS', st.prm[0] * cloudsOn, st.prm[1], st.prm[2], st.prm[3]);
  set('STRATUS_COLOR', st.color[0], st.color[1], st.color[2], st.color[3]);
  set('CUMULUS', cu.prm[0] * cloudsOn, cu.prm[1], cu.prm[2], cu.prm[3]);
  set('CUMULUS_COLOR', cu.color[0], cu.color[1], cu.color[2], cu.color[3]);
  set('CLOUD_OFFSETS', st.offset[0], st.offset[1], cu.offset[0], cu.offset[1]);
  set('CLOUD_STYLE', st.style[0], st.style[1], cu.style[0], cu.style[1]);

  const sunsetColor = scale(SUNSET_SKY, 1.05);
  set('SUNSET', sunsetColor[0], sunsetColor[1], sunsetColor[2], d.sunset);
  const domeLin = lin(sky.skyDomeColor, [0.55, 0.68, 0.9]);
  const rainbow = sky.rainbow && fin(sky.sunAltitude, 38) > 0 && fin(sky.sunAltitude, 38) < 42 && mode !== 'off' ? 0.3 * day : 0;
  set('DOME', domeLin[0], domeLin[1], domeLin[2], rainbow);
  const below = mode === 'off' ? d.zenith : mix(d.horizon, hazeColor, 0.3 * haze);
  set('BELOW', below[0] * 0.8, below[1] * 0.8, below[2] * 0.8, d.night);

  const sunOnClouds = scale(mul(sunColor, auto ? mix([1, 1, 1], SUNSET_SUN, Math.min(1, d.sunset * 1.2)) : [1, 1, 1]), SUN_RADIANCE * 0.62 * cloudLightLevel);
  set('CLOUD_LIGHT', sunOnClouds[0] + d.moonLight[0] * 2, sunOnClouds[1] + d.moonLight[1] * 2, sunOnClouds[2] + d.moonLight[2] * 2, 0);
  return out;
}
