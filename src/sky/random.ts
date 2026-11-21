/** Random sky generator ("dice"). NOTE: foundation stub; the sky owner replaces it. */
import { hsvToRgb, mulberry32, randomSeed } from '@/core/math';
import type { Sky } from '@/core/types';
import { defaultSky } from './defaults';

export function randomSky(seed: number = randomSeed()): Sky {
  const r = mulberry32(seed);
  const hue = r();
  return {
    ...defaultSky(),
    mode: 'custom',
    zenithColor: hsvToRgb(hue, 0.6, 0.6),
    horizonColor: hsvToRgb((hue + 0.1) % 1, 0.3, 0.95),
    sunAzimuth: r() * 360,
    sunAltitude: 5 + r() * 60,
  };
}
