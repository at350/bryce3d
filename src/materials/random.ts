/** Random material generator ("dice"). NOTE: foundation stub; the materials owner replaces it. */
import { hsvToRgb, mulberry32, randomSeed } from '@/core/math';
import { makeMaterial } from '@/core/materialUtils';
import type { Material } from '@/core/types';

export function randomMaterial(seed: number = randomSeed()): Material {
  const r = mulberry32(seed);
  return makeMaterial({
    name: `Random ${seed % 1000}`,
    diffuseColor: hsvToRgb(r(), 0.3 + r() * 0.6, 0.4 + r() * 0.6),
    reflection: r() < 0.3 ? 40 + r() * 50 : 0,
    specularity: r() * 80,
  });
}
