/**
 * Skies for the startup scene and the sample gallery: the default sky with designed
 * overrides (cloud layers merge field by field). Built locally so each scene keeps its look.
 */
import type { CloudLayer, Sky } from '@/core/types';
import { defaultSky } from '@/sky/defaults';

export type SkySpec = Partial<Omit<Sky, 'stratus' | 'cumulus'>> & { stratus?: Partial<CloudLayer>; cumulus?: Partial<CloudLayer> };

export function makeSky(spec: SkySpec): Sky {
  const base = defaultSky();
  const { stratus, cumulus, ...rest } = spec;
  return { ...base, ...rest, stratus: { ...base.stratus, ...stratus }, cumulus: { ...base.cumulus, ...cumulus } };
}

const off = { enabled: false };

/** Startup poster: late-afternoon gold over a violet-blue dome, sun low on the left. */
export const posterSky = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.08, 0.12, 0.42],
    horizonColor: [1, 0.72, 0.42],
    skyDomeColor: [0.4, 0.42, 0.86],
    sunColor: [1, 0.84, 0.55],
    sunSize: 30,
    sunGlow: 72,
    sunAzimuth: 336,
    sunAltitude: 13,
    haze: 12,
    hazeColor: [1, 0.8, 0.58],
    ambient: 36,
    ambientColor: [0.66, 0.62, 0.86],
    shadowIntensity: 70,
    stratus: { enabled: true, cover: 30, height: 1800, frequency: 70, amplitude: 80, color: [1, 0.86, 0.8], shading: 0.25 },
    cumulus: { enabled: true, cover: 34, height: 650, frequency: 110, amplitude: 170, color: [1, 0.94, 0.9], shading: 0.65 },
  });

/** The reel's first frame: a teal-green dome over a pink horizon band. */
export const tealDream = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.06, 0.42, 0.36],
    horizonColor: [0.96, 0.62, 0.7],
    skyDomeColor: [0.3, 0.85, 0.66],
    sunColor: [1, 0.9, 0.85],
    sunSize: 20,
    sunGlow: 40,
    sunAzimuth: 40,
    sunAltitude: 24,
    haze: 30,
    hazeColor: [0.95, 0.7, 0.76],
    ambient: 42,
    ambientColor: [0.5, 0.85, 0.75],
    stratus: { enabled: true, cover: 55, height: 1500, frequency: 50, amplitude: 120, color: [0.55, 0.95, 0.8], shading: 0.45 },
    cumulus: { enabled: true, cover: 28, height: 700, frequency: 140, amplitude: 120, color: [0.95, 0.8, 0.88], shading: 0.5 },
  });

/** Cobalt dream: deep blue-violet, a pale sun and glowing yellow cloud edges. */
export const cobaltDream = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.1, 0.12, 0.42],
    horizonColor: [0.62, 0.66, 0.92],
    skyDomeColor: [0.42, 0.4, 0.85],
    sunColor: [1, 0.96, 0.8],
    sunSize: 26,
    sunGlow: 55,
    sunAzimuth: 12,
    sunAltitude: 20,
    moonColor: [0.92, 0.94, 1],
    moonSize: 55,
    moonPhase: 0.36,
    haze: 26,
    hazeColor: [0.7, 0.72, 0.95],
    ambient: 40,
    ambientColor: [0.55, 0.55, 0.95],
    stratus: { enabled: true, cover: 45, height: 1600, frequency: 60, amplitude: 110, color: [0.95, 0.92, 0.6], shading: 0.35 },
    cumulus: { enabled: true, cover: 40, height: 800, frequency: 100, amplitude: 180, color: [0.82, 0.82, 1], shading: 0.7 },
  });

export const tropicalNoon = () =>
  makeSky({
    mode: 'soft',
    zenithColor: [0.12, 0.38, 0.85],
    horizonColor: [0.78, 0.88, 0.98],
    skyDomeColor: [0.45, 0.68, 0.98],
    sunColor: [1, 0.98, 0.92],
    sunSize: 24,
    sunGlow: 30,
    sunAzimuth: 205,
    sunAltitude: 55,
    haze: 14,
    hazeColor: [0.85, 0.92, 1],
    ambient: 40,
    shadowIntensity: 70,
    stratus: { enabled: true, cover: 18, height: 2000, frequency: 60, amplitude: 50, shading: 0.15 },
    cumulus: { enabled: true, cover: 42, height: 650, frequency: 120, amplitude: 190, shading: 0.6 },
  });

export const infernalSky = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.12, 0.02, 0.03],
    horizonColor: [0.95, 0.35, 0.1],
    skyDomeColor: [0.7, 0.18, 0.08],
    sunColor: [1, 0.55, 0.25],
    sunSize: 30,
    sunGlow: 75,
    sunAzimuth: 345,
    sunAltitude: 9,
    haze: 45,
    hazeColor: [0.85, 0.3, 0.12],
    fogDensity: 18,
    fogHeight: 3,
    fogColor: [0.55, 0.18, 0.08],
    ambient: 30,
    ambientColor: [0.9, 0.4, 0.25],
    shadowIntensity: 80,
    stratus: { enabled: true, cover: 60, height: 1200, frequency: 70, amplitude: 140, color: [0.35, 0.12, 0.1], shading: 0.7 },
    cumulus: off,
  });

export const desertGold = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.18, 0.36, 0.72],
    horizonColor: [0.98, 0.78, 0.52],
    skyDomeColor: [0.6, 0.6, 0.75],
    sunColor: [1, 0.85, 0.6],
    sunSize: 30,
    sunGlow: 45,
    sunAzimuth: 300,
    sunAltitude: 18,
    haze: 34,
    hazeColor: [0.98, 0.82, 0.6],
    ambient: 36,
    ambientColor: [0.85, 0.72, 0.6],
    shadowIntensity: 78,
    stratus: { enabled: true, cover: 20, height: 2200, frequency: 50, amplitude: 60, color: [1, 0.85, 0.75], shading: 0.2 },
    cumulus: off,
  });

export const moonNight = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.01, 0.02, 0.07],
    horizonColor: [0.1, 0.15, 0.3],
    skyDomeColor: [0.1, 0.14, 0.32],
    sunColor: [0.8, 0.85, 1],
    // the moon is always opposite the sun: a sun below the horizon behind the camera
    // puts the moon up in front of it
    sunAzimuth: 196,
    sunAltitude: -24,
    moonColor: [0.95, 0.96, 1],
    moonSize: 45,
    moonPhase: 0.5,
    stars: 85,
    haze: 12,
    hazeColor: [0.2, 0.25, 0.4],
    fogDensity: 22,
    fogHeight: 4,
    fogColor: [0.35, 0.42, 0.6],
    ambient: 22,
    ambientColor: [0.4, 0.5, 0.85],
    shadowIntensity: 85,
    stratus: { enabled: true, cover: 22, height: 1600, frequency: 70, amplitude: 70, color: [0.55, 0.6, 0.75], shading: 0.5 },
    cumulus: off,
  });

export const deepSpace = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0, 0, 0.02],
    horizonColor: [0.05, 0.06, 0.2],
    skyDomeColor: [0.1, 0.1, 0.35],
    sunColor: [0.85, 0.9, 1],
    sunSize: 12,
    sunGlow: 70,
    sunAzimuth: 205,
    sunAltitude: -32,
    moonColor: [0.85, 0.9, 1],
    moonSize: 70,
    moonPhase: 0.62,
    stars: 100,
    haze: 0,
    ambient: 18,
    ambientColor: [0.4, 0.45, 0.9],
    shadowIntensity: 88,
    stratus: off,
    cumulus: off,
  });

export const clearBlue = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.05, 0.16, 0.55],
    horizonColor: [0.72, 0.84, 0.98],
    skyDomeColor: [0.4, 0.6, 0.95],
    sunColor: [1, 0.97, 0.9],
    sunSize: 22,
    sunGlow: 30,
    sunAzimuth: 225,
    sunAltitude: 42,
    haze: 10,
    ambient: 38,
    shadowIntensity: 75,
    stratus: off,
    cumulus: { enabled: true, cover: 25, height: 900, frequency: 110, amplitude: 150, shading: 0.5 },
  });

export const lavenderDream = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.35, 0.3, 0.7],
    horizonColor: [1, 0.78, 0.82],
    skyDomeColor: [0.8, 0.6, 0.9],
    sunColor: [1, 0.95, 0.85],
    sunSize: 26,
    sunGlow: 40,
    sunAzimuth: 235,
    sunAltitude: 32,
    haze: 20,
    hazeColor: [1, 0.85, 0.9],
    ambient: 44,
    ambientColor: [0.85, 0.75, 0.95],
    stratus: { enabled: true, cover: 25, height: 1900, frequency: 60, amplitude: 70, color: [1, 0.9, 0.95], shading: 0.2 },
    cumulus: { enabled: true, cover: 46, height: 700, frequency: 95, amplitude: 210, color: [1, 0.96, 1], shading: 0.7 },
  });

export const arcticOvercast = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.42, 0.5, 0.6],
    horizonColor: [0.86, 0.9, 0.94],
    skyDomeColor: [0.6, 0.68, 0.78],
    sunColor: [1, 0.95, 0.9],
    sunSize: 18,
    sunGlow: 35,
    sunAzimuth: 330,
    sunAltitude: 9,
    haze: 24,
    hazeColor: [0.85, 0.9, 0.95],
    fogDensity: 14,
    fogHeight: 2.5,
    fogColor: [0.85, 0.9, 0.95],
    ambient: 48,
    ambientColor: [0.75, 0.82, 0.92],
    shadowIntensity: 55,
    stratus: { enabled: true, cover: 72, height: 1400, frequency: 55, amplitude: 120, color: [0.88, 0.9, 0.95], shading: 0.55 },
    cumulus: off,
  });

export const vaporSunset = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.12, 0.02, 0.28],
    horizonColor: [1, 0.36, 0.6],
    skyDomeColor: [0.75, 0.2, 0.7],
    sunColor: [1, 0.6, 0.4],
    sunSize: 8,
    sunGlow: 35,
    sunAzimuth: 0,
    sunAltitude: 6,
    stars: 30,
    haze: 30,
    hazeColor: [1, 0.4, 0.7],
    ambient: 35,
    ambientColor: [0.8, 0.4, 0.9],
    stratus: { enabled: true, cover: 30, height: 1500, frequency: 40, amplitude: 90, color: [1, 0.55, 0.8], shading: 0.3 },
    cumulus: off,
  });

export const violetStorm = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.08, 0.06, 0.2],
    horizonColor: [0.62, 0.55, 0.82],
    skyDomeColor: [0.45, 0.35, 0.7],
    sunColor: [1, 0.85, 0.6],
    sunSize: 20,
    sunGlow: 60,
    sunAzimuth: 20,
    sunAltitude: 12,
    haze: 28,
    hazeColor: [0.6, 0.55, 0.85],
    ambient: 34,
    ambientColor: [0.6, 0.5, 0.9],
    shadowIntensity: 70,
    stratus: { enabled: true, cover: 68, height: 1300, frequency: 55, amplitude: 150, color: [0.32, 0.28, 0.42], shading: 0.75 },
    cumulus: off,
  });

export const pastelSwirl = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.4, 0.38, 0.85],
    horizonColor: [1, 0.72, 0.86],
    skyDomeColor: [0.85, 0.6, 0.95],
    sunColor: [1, 0.95, 0.95],
    sunSize: 18,
    sunGlow: 70,
    sunAzimuth: 15,
    sunAltitude: 8,
    haze: 24,
    hazeColor: [1, 0.85, 0.95],
    ambient: 46,
    ambientColor: [0.9, 0.75, 1],
    stratus: { enabled: true, cover: 50, height: 1500, frequency: 45, amplitude: 120, color: [1, 0.85, 0.95], shading: 0.25 },
    cumulus: off,
  });

export const azureSummer = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.06, 0.28, 0.7],
    horizonColor: [0.86, 0.92, 0.98],
    skyDomeColor: [0.45, 0.65, 0.95],
    sunColor: [1, 0.97, 0.9],
    sunSize: 22,
    sunGlow: 28,
    sunAzimuth: 215,
    sunAltitude: 40,
    haze: 18,
    hazeColor: [0.92, 0.95, 1],
    ambient: 40,
    stratus: { enabled: true, cover: 15, height: 2000, frequency: 60, amplitude: 50, shading: 0.15 },
    cumulus: { enabled: true, cover: 35, height: 600, frequency: 130, amplitude: 160, shading: 0.55 },
  });

/** Neutral daylight for object thumbnails. */
export const studioSky = () =>
  makeSky({
    mode: 'soft',
    sunAzimuth: 205,
    sunAltitude: 42,
    haze: 6,
    shadowIntensity: 60,
    ambient: 45,
    stratus: off,
    cumulus: off,
  });

/** Dusk for light-preset thumbnails, dark enough for lamps to read. */
export const studioDusk = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.03, 0.04, 0.12],
    horizonColor: [0.25, 0.22, 0.4],
    skyDomeColor: [0.2, 0.2, 0.4],
    sunAltitude: -10,
    stars: 40,
    haze: 4,
    ambient: 18,
    ambientColor: [0.4, 0.45, 0.7],
    shadowIntensity: 85,
    stratus: off,
    cumulus: off,
  });

/** Bryce 2 box homage: lavender-blue zenith, bright wispy horizon. */
export const lavenderNoon = () =>
  makeSky({
    mode: 'custom',
    zenithColor: [0.28, 0.3, 0.72],
    horizonColor: [0.86, 0.88, 0.96],
    skyDomeColor: [0.55, 0.58, 0.92],
    sunColor: [1, 0.98, 0.92],
    sunSize: 22,
    sunGlow: 30,
    sunAzimuth: 150,
    sunAltitude: 48,
    haze: 16,
    hazeColor: [0.88, 0.9, 1],
    ambient: 42,
    shadowIntensity: 72,
    stratus: { enabled: true, cover: 40, height: 1700, frequency: 45, amplitude: 90, color: [0.96, 0.96, 1], shading: 0.25 },
    cumulus: { enabled: true, cover: 20, height: 650, frequency: 130, amplitude: 120, shading: 0.5 },
  });
