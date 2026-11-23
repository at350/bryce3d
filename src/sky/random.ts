/**
 * Random sky generator (the Sky & Fog "dice"). A seed picks a mood (day, golden hour,
 * night, alien, weather), then a harmonious palette and sun / cloud / fog values in
 * ranges that keep the result attractive; some rolls tear the clouds into streaks or let the
 * sun's glow light them. Deterministic for a given seed.
 */
import { mulberry32, randomSeed } from '@/core/math';
import type { CloudLayer, RGB, Sky } from '@/core/types';
import { hsv, mixRgb, scaleRgb } from './color';
import { defaultCumulus, defaultSky, defaultStratus } from './defaults';
import { sanitizeSky } from './sanitize';
import { wrapDegrees } from './ranges';

export type RandomSkyKind = 'day' | 'golden' | 'night' | 'alien' | 'weather';

export const RANDOM_SKY_KINDS: { id: RandomSkyKind; label: string }[] = [
  { id: 'day', label: 'Daytime' },
  { id: 'golden', label: 'Sunset / Sunrise' },
  { id: 'night', label: 'Night' },
  { id: 'alien', label: 'Alien' },
  { id: 'weather', label: 'Weather' },
];

const KIND_WEIGHTS: [RandomSkyKind, number][] = [
  ['day', 0.32],
  ['golden', 0.24],
  ['night', 0.1],
  ['alien', 0.2],
  ['weather', 0.14],
];

type Rand = () => number;

function tools(r: Rand) {
  const range = (a: number, b: number) => a + (b - a) * r();
  return {
    range,
    int: (a: number, b: number) => Math.floor(range(a, b + 1)),
    chance: (p: number) => r() < p,
    pick: <T>(items: readonly T[]): T => items[Math.floor(r() * items.length) % items.length],
    offset: (): [number, number] => [Math.round(range(-5000, 5000)), Math.round(range(-5000, 5000))],
  };
}

type Tools = ReturnType<typeof tools>;

const white: RGB = [1, 1, 1];

function cloud(t: Tools, base: CloudLayer, enabled: boolean, patch: Partial<CloudLayer>): CloudLayer {
  return { ...base, offset: t.offset(), ...patch, enabled };
}

function daySky(t: Tools): Partial<Sky> {
  const hue = t.range(0.57, 0.65);
  const zenith = hsv(hue, t.range(0.55, 0.85), t.range(0.55, 0.85));
  const horizon = hsv(hue + t.range(-0.02, 0.02), t.range(0.08, 0.3), t.range(0.88, 0.98));
  const mackerel = t.chance(0.15);
  return {
    mode: t.pick(['soft', 'soft', 'darker', 'custom', 'custom'] as const),
    zenithColor: zenith,
    horizonColor: horizon,
    skyDomeColor: mixRgb(mixRgb(zenith, horizon, 0.5), white, 0.2),
    sunColor: hsv(t.range(0.08, 0.13), t.range(0.03, 0.12), 1),
    sunSize: t.range(18, 36),
    sunGlow: t.range(20, 50),
    sunAzimuth: t.range(100, 260),
    sunAltitude: t.range(25, 70),
    haze: t.range(5, 35),
    hazeColor: mixRgb(horizon, white, 0.4),
    fogDensity: t.chance(0.3) ? t.range(15, 45) : 0,
    fogHeight: t.range(1.5, 5),
    fogColor: mixRgb(horizon, white, 0.5),
    shadowIntensity: t.range(60, 90),
    ambient: t.range(22, 40),
    ambientColor: mixRgb(zenith, white, 0.5),
    stratus: cloud(t, defaultStratus(), t.chance(0.5), {
      cover: t.range(10, mackerel ? 60 : 45),
      height: t.range(1500, 2800),
      frequency: mackerel ? t.range(250, 350) : t.range(30, 120),
      amplitude: t.range(40, 130),
      shading: t.range(0.1, 0.35),
    }),
    cumulus: cloud(t, defaultCumulus(), t.chance(0.75), {
      cover: t.range(15, 55),
      height: t.range(500, 1000),
      frequency: t.range(70, 200),
      amplitude: t.range(140, 320),
      shading: t.range(0.5, 0.8),
    }),
  };
}

function goldenSky(t: Tools): Partial<Sky> {
  const sunColor = hsv(t.range(0.03, 0.12), t.range(0.35, 0.75), 1);
  const horizon = hsv(t.range(0, 0.12), t.range(0.6, 0.9), t.range(0.95, 1));
  const zenith = t.chance(0.65)
    ? hsv(t.range(0.6, 0.8), t.range(0.5, 0.85), t.range(0.2, 0.55))
    : hsv(t.range(0.88, 0.98), t.range(0.6, 0.9), t.range(0.25, 0.5));
  const altitude = t.range(-2, 14);
  const cloudTint = mixRgb(horizon, white, t.range(0.2, 0.45));
  return {
    mode: t.chance(0.7) ? 'custom' : 'soft',
    linkSunToView: true,
    zenithColor: zenith,
    horizonColor: horizon,
    skyDomeColor: mixRgb(horizon, zenith, 0.5),
    sunColor,
    sunSize: t.range(25, 50),
    sunGlow: t.range(50, 90),
    sunAzimuth: wrapDegrees(t.range(-25, 25)),
    sunAltitude: altitude,
    stars: altitude < 2 ? t.range(5, 30) : 0,
    haze: t.range(20, 50),
    hazeColor: mixRgb(horizon, sunColor, 0.4),
    fogDensity: t.chance(0.35) ? t.range(10, 40) : 0,
    fogHeight: t.range(1.5, 5),
    fogColor: mixRgb(horizon, zenith, 0.3),
    shadowIntensity: t.range(60, 85),
    ambient: t.range(25, 45),
    ambientColor: mixRgb(horizon, zenith, 0.5),
    stratus: cloud(t, defaultStratus(), t.chance(0.6), {
      cover: t.range(15, 45),
      height: t.range(1600, 2600),
      frequency: t.range(30, 70),
      amplitude: t.range(50, 110),
      shading: t.range(0.2, 0.6),
      color: cloudTint,
    }),
    cumulus: cloud(t, defaultCumulus(), t.chance(0.45), {
      cover: t.range(15, 40),
      height: t.range(550, 900),
      frequency: t.range(90, 160),
      amplitude: t.range(160, 280),
      shading: t.range(0.5, 0.85),
      color: mixRgb(cloudTint, zenith, t.range(0, 0.5)),
    }),
  };
}

function nightSky(t: Tools): Partial<Sky> {
  const hue = t.range(0.58, 0.72);
  const zenith = hsv(hue, t.range(0.6, 0.9), t.range(0.03, 0.12));
  const horizon = hsv(hue + t.range(-0.05, 0.05), t.range(0.4, 0.7), t.range(0.12, 0.3));
  const moonInView = t.chance(0.6);
  const moonAz = moonInView ? t.range(-20, 20) : t.range(0, 360);
  const moonAlt = moonInView ? t.range(10, 25) : t.range(20, 60);
  return {
    mode: 'custom',
    linkSunToView: moonInView,
    zenithColor: zenith,
    horizonColor: horizon,
    skyDomeColor: mixRgb(zenith, horizon, 0.5),
    sunColor: hsv(0.1, 0.1, 1),
    sunAzimuth: wrapDegrees(moonAz + 180),
    sunAltitude: -moonAlt,
    moonColor: t.chance(0.25) ? hsv(t.range(0.06, 0.12), t.range(0.3, 0.6), 1) : hsv(t.range(0.55, 0.65), t.range(0, 0.1), 1),
    moonSize: t.range(22, 50),
    moonPhase: moonInView ? t.range(0.12, 0.88) : t.range(0, 1),
    stars: t.range(40, 100),
    haze: t.range(3, 20),
    hazeColor: scaleRgb(horizon, 1.2),
    shadowIntensity: t.range(40, 75),
    ambient: t.range(10, 25),
    ambientColor: mixRgb(horizon, hsv(0.62, 0.4, 0.6), 0.5),
    stratus: cloud(t, defaultStratus(), t.chance(0.35), {
      cover: t.range(10, 35),
      frequency: t.range(30, 80),
      amplitude: t.range(40, 90),
      shading: t.range(0.3, 0.6),
      color: mixRgb(horizon, white, 0.25),
    }),
    cumulus: cloud(t, defaultCumulus(), t.chance(0.25), {
      cover: t.range(10, 45),
      frequency: t.range(80, 150),
      amplitude: t.range(160, 260),
      shading: t.range(0.6, 0.85),
      color: mixRgb(horizon, white, 0.15),
    }),
  };
}

function alienSky(t: Tools): Partial<Sky> {
  const hue = t.range(0, 1);
  const pairing = t.pick([0.5, 1 / 3, -1 / 3, 0.1, -0.1, 0.15, -0.15]);
  const hue2 = hue + pairing;
  const zenith = hsv(hue, t.range(0.6, 0.95), t.range(0.3, 0.65));
  const horizon = hsv(hue2, t.range(0.35, 0.75), t.range(0.85, 1));
  const cloudTint = hsv(hue2, t.range(0.15, 0.4), 1);
  const linked = t.chance(0.5);
  return {
    mode: 'custom',
    linkSunToView: linked,
    zenithColor: zenith,
    horizonColor: horizon,
    skyDomeColor: mixRgb(zenith, horizon, 0.55),
    sunColor: hsv(t.range(0, 1), t.range(0.2, 0.7), 1),
    sunSize: t.range(20, 80),
    sunGlow: t.range(40, 95),
    sunAzimuth: linked ? wrapDegrees(t.range(-25, 25)) : t.range(0, 360),
    sunAltitude: t.range(10, 50),
    moonColor: hsv(hue + 0.5, t.range(0.3, 0.6), 1),
    moonSize: t.range(20, 70),
    moonPhase: t.range(0.1, 0.9),
    stars: t.chance(0.3) ? t.range(20, 60) : 0,
    haze: t.range(15, 50),
    hazeColor: mixRgb(horizon, white, 0.3),
    fogDensity: t.chance(0.3) ? t.range(10, 40) : 0,
    fogHeight: t.range(1.5, 5),
    fogColor: scaleRgb(horizon, 0.8),
    shadowIntensity: t.range(55, 85),
    ambient: t.range(30, 55),
    ambientColor: mixRgb(zenith, horizon, 0.5),
    rainbow: t.chance(0.08),
    stratus: cloud(t, defaultStratus(), t.chance(0.5), {
      cover: t.range(15, 50),
      frequency: t.range(25, 90),
      amplitude: t.range(50, 160),
      shading: t.range(0.1, 0.4),
      color: cloudTint,
    }),
    cumulus: cloud(t, defaultCumulus(), t.chance(0.5), {
      cover: t.range(15, 50),
      frequency: t.range(80, 200),
      amplitude: t.range(160, 320),
      shading: t.range(0.4, 0.8),
      color: mixRgb(cloudTint, zenith, 0.25),
    }),
  };
}

function weatherSky(t: Tools): Partial<Sky> {
  const kind = t.pick(['overcast', 'stormy', 'foggy', 'dusty', 'rainbow'] as const);
  const gray = (v: number, tint = 0.6): RGB => hsv(tint, t.range(0.04, 0.12), v);
  const base: Partial<Sky> = {
    mode: 'custom',
    sunColor: hsv(0.1, t.range(0.02, 0.1), 1),
    sunAzimuth: t.range(120, 240),
    sunAltitude: t.range(20, 50),
  };
  switch (kind) {
    case 'overcast':
      return {
        ...base,
        zenithColor: gray(t.range(0.5, 0.62)), horizonColor: gray(t.range(0.75, 0.85)), skyDomeColor: gray(0.68),
        sunSize: 10, sunGlow: 20, haze: t.range(30, 50), hazeColor: gray(0.8),
        shadowIntensity: t.range(15, 30), ambient: t.range(50, 70), ambientColor: gray(0.75),
        stratus: cloud(t, defaultStratus(), true, { cover: t.range(85, 100), height: t.range(1000, 1600), frequency: t.range(25, 45), amplitude: t.range(30, 60), shading: 0.4, color: gray(0.86) }),
        cumulus: cloud(t, defaultCumulus(), false, {}),
      };
    case 'stormy':
      return {
        ...base,
        mode: 'darker',
        zenithColor: gray(t.range(0.16, 0.24)), horizonColor: gray(t.range(0.35, 0.45)), skyDomeColor: gray(0.32),
        sunSize: 18, sunGlow: 12, haze: t.range(30, 50), hazeColor: gray(0.45),
        fogDensity: t.range(15, 35), fogHeight: t.range(2, 5), fogColor: gray(0.4),
        shadowIntensity: t.range(30, 45), ambient: t.range(30, 40), ambientColor: gray(0.45),
        stratus: cloud(t, defaultStratus(), true, { cover: t.range(50, 70), height: t.range(1300, 1700), frequency: t.range(35, 55), amplitude: t.range(50, 90), shading: 0.6, color: gray(0.45) }),
        cumulus: cloud(t, defaultCumulus(), true, { cover: t.range(65, 90), height: t.range(500, 700), frequency: t.range(70, 110), amplitude: t.range(250, 380), shading: 0.9, color: gray(0.35) }),
      };
    case 'foggy':
      return {
        ...base,
        zenithColor: hsv(0.6, t.range(0.15, 0.3), t.range(0.65, 0.8)), horizonColor: gray(0.92), skyDomeColor: gray(0.85),
        sunSize: 28, sunGlow: 45, sunAltitude: t.range(10, 25), haze: t.range(40, 60), hazeColor: gray(0.94),
        fogDensity: t.range(35, 60), fogHeight: t.range(3, 6), fogColor: gray(0.9),
        shadowIntensity: t.range(30, 45), ambient: t.range(45, 60), ambientColor: gray(0.86),
        stratus: cloud(t, defaultStratus(), t.chance(0.5), { cover: t.range(20, 40), color: gray(0.95) }),
        cumulus: cloud(t, defaultCumulus(), false, {}),
      };
    case 'dusty': {
      const dust = hsv(t.range(0.06, 0.1), t.range(0.35, 0.55), t.range(0.75, 0.9));
      return {
        ...base,
        linkSunToView: true, sunAzimuth: wrapDegrees(t.range(-20, 20)), sunAltitude: t.range(12, 30),
        zenithColor: scaleRgb(dust, 0.75), horizonColor: dust, skyDomeColor: scaleRgb(dust, 0.9),
        sunSize: 20, sunGlow: 30, haze: t.range(55, 85), hazeColor: dust,
        fogDensity: t.range(12, 25), fogHeight: t.range(4, 12), fogColor: scaleRgb(dust, 0.92),
        shadowIntensity: t.range(30, 50), ambient: t.range(40, 55), ambientColor: scaleRgb(dust, 0.9),
        stratus: cloud(t, defaultStratus(), false, {}),
        cumulus: cloud(t, defaultCumulus(), false, {}),
      };
    }
    default:
      return {
        ...base,
        mode: 'soft',
        linkSunToView: true, rainbow: true, sunAzimuth: 180, sunAltitude: t.range(12, 32),
        zenithColor: hsv(0.6, t.range(0.5, 0.7), t.range(0.6, 0.75)), horizonColor: hsv(0.58, 0.12, 0.92), skyDomeColor: hsv(0.6, 0.3, 0.82),
        sunSize: 28, sunGlow: 40, haze: t.range(5, 15), hazeColor: hsv(0.58, 0.08, 0.95),
        shadowIntensity: t.range(65, 80), ambient: t.range(28, 38), ambientColor: hsv(0.6, 0.25, 0.8),
        stratus: cloud(t, defaultStratus(), false, {}),
        cumulus: cloud(t, defaultCumulus(), true, { cover: t.range(35, 55), frequency: t.range(80, 130), amplitude: t.range(220, 300), shading: t.range(0.75, 0.9), color: gray(0.55) }),
      };
  }
}

/** Chances that a layer rolls torn (turbulence) or sun-lit (glow) clouds, by mood. */
const STYLE_CHANCE: Record<RandomSkyKind, { torn: number; glow: number }> = {
  day: { torn: 0.35, glow: 0.25 },
  golden: { torn: 0.5, glow: 0.7 },
  night: { torn: 0.3, glow: 0 },
  alien: { torn: 0.5, glow: 0.5 },
  weather: { torn: 0.45, glow: 0.15 },
};

function styleClouds(t: Tools, kind: RandomSkyKind, sky: Sky): Pick<Sky, 'stratus' | 'cumulus'> {
  const { torn, glow } = STYLE_CHANCE[kind];
  const style = (layer: CloudLayer, tornRange: [number, number]): CloudLayer => ({
    ...layer,
    turbulence: layer.enabled && t.chance(torn) ? t.range(...tornRange) : 0,
    glow: layer.enabled && t.chance(glow) ? t.range(30, 90) : 0,
  });
  return { stratus: style(sky.stratus, [25, 85]), cumulus: style(sky.cumulus, [15, 60]) };
}

const BUILDERS: Record<RandomSkyKind, (t: Tools) => Partial<Sky>> = {
  day: daySky,
  golden: goldenSky,
  night: nightSky,
  alien: alienSky,
  weather: weatherSky,
};

function pickKind(r: Rand): RandomSkyKind {
  let x = r();
  for (const [kind, w] of KIND_WEIGHTS) {
    if (x < w) return kind;
    x -= w;
  }
  return 'day';
}

/** A random but attractive sky. Same seed (and kind) -> same sky. */
export function randomSky(seed: number = randomSeed(), kind?: RandomSkyKind): Sky {
  const r = mulberry32(seed);
  const chosen = kind ?? pickKind(r);
  const t = tools(r);
  const sky: Sky = { ...defaultSky(), linkSunToView: false, rainbow: false, ...BUILDERS[chosen](t) };
  // Cloud style rolls from its own stream, so the rest of a seed's sky is what it always was.
  const styled = { ...sky, ...styleClouds(tools(mulberry32(seed ^ 0x2c1b3c6d)), chosen, sky) };
  return sanitizeSky(styled);
}
