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

export function defaultSky(): Sky {
  return {
    mode: 'soft',
    horizonColor: [0.82, 0.86, 0.92],
    zenithColor: [0.24, 0.42, 0.78],
    skyDomeColor: [0.55, 0.68, 0.9],
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
    shadowIntensity: 75,
    ambient: 35,
    ambientColor: [0.62, 0.7, 0.85],
    stratus: makeCloudLayer({ cover: 25, height: 1800, frequency: 60, amplitude: 60, shading: 0.2 }),
    cumulus: makeCloudLayer({ cover: 38, height: 700, frequency: 120, amplitude: 160, shading: 0.6 }),
    rainbow: false,
  };
}
