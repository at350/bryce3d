/** The default sky (Bryce "soft sky" with a few cumulus). Owned by the sky module. */
import type { CloudLayer, Sky } from '@/core/types';

export function makeCloudLayer(overrides: Partial<CloudLayer> = {}): CloudLayer {
  return {
    enabled: true,
    cover: 40,
    height: 900,
    frequency: 100,
    amplitude: 100,
    color: [1, 1, 1],
    shading: 0.5,
    offset: [0, 0],
    ...overrides,
  };
}

/** High, thin, wispy layer (Bryce stratus). */
export function defaultStratus(): CloudLayer {
  return makeCloudLayer({ cover: 22, height: 1800, frequency: 60, amplitude: 60, shading: 0.2 });
}

/** Low, puffy, self-shaded layer (Bryce cumulus). */
export function defaultCumulus(): CloudLayer {
  return makeCloudLayer({ cover: 36, height: 700, frequency: 120, amplitude: 160, shading: 0.6 });
}

export function defaultSky(): Sky {
  return {
    mode: 'soft',
    horizonColor: [0.8, 0.86, 0.94],
    zenithColor: [0.22, 0.42, 0.8],
    skyDomeColor: [0.6, 0.72, 0.92],
    sunColor: [1, 0.96, 0.88],
    sunSize: 30,
    sunGlow: 35,
    sunAzimuth: 215,
    sunAltitude: 38,
    linkSunToView: false,
    moonColor: [0.95, 0.95, 0.9],
    moonPhase: 0.5,
    moonSize: 30,
    stars: 0,
    haze: 18,
    hazeColor: [0.85, 0.88, 0.95],
    fogDensity: 0,
    fogHeight: 4,
    fogColor: [0.9, 0.9, 0.92],
    shadowIntensity: 72,
    ambient: 32,
    ambientColor: [0.62, 0.7, 0.85],
    stratus: defaultStratus(),
    cumulus: defaultCumulus(),
    rainbow: false,
  };
}
