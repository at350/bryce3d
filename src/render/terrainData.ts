/** Pure heightfield preparation for the GPU: validation, downsampling, march bounds. */
import type { TerrainData } from '@/core/types';

export const MAX_TERRAIN_GRID = 512;

export interface PreparedTerrain {
  /** Grid size of `data` (<= MAX_TERRAIN_GRID). */
  n: number;
  data: Float32Array;
  /** Max |dy/dx| of the object-space surface y = 2h - 1 between neighboring samples. */
  lipschitz: number;
  maxHeight: number;
}

/** Validate and (if larger than MAX_TERRAIN_GRID) box-downsample a terrain. Null if unusable. */
export function prepareTerrain(t: TerrainData): PreparedTerrain | null {
  const h = t?.heights;
  if (!(h instanceof Float32Array) || h.length < 4) return null;
  let res = Math.round(Number(t.resolution));
  if (!(res >= 2) || res * res !== h.length) res = Math.round(Math.sqrt(h.length));
  if (res < 2 || res * res !== h.length) return null;
  let n = res;
  let data: Float32Array;
  if (res > MAX_TERRAIN_GRID) {
    const f = Math.ceil(res / MAX_TERRAIN_GRID);
    n = Math.floor((res - 1) / f) + 1;
    data = new Float32Array(n * n);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        let s = 0;
        let c = 0;
        for (let dz = 0; dz < f; dz++) {
          const zz = Math.min(res - 1, z * f + dz);
          for (let dx = 0; dx < f; dx++) {
            const xx = Math.min(res - 1, x * f + dx);
            s += h[zz * res + xx];
            c++;
          }
        }
        data[z * n + x] = s / c;
      }
    }
  } else {
    data = new Float32Array(h.length);
    for (let i = 0; i < h.length; i++) data[i] = h[i];
  }
  let maxH = 0;
  let maxD = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Number.isFinite(data[i]) ? Math.min(1, Math.max(0, data[i])) : 0;
    data[i] = v;
    if (v > maxH) maxH = v;
  }
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const v = data[z * n + x];
      if (x + 1 < n) maxD = Math.max(maxD, Math.abs(data[z * n + x + 1] - v));
      if (z + 1 < n) maxD = Math.max(maxD, Math.abs(data[(z + 1) * n + x] - v));
    }
  }
  return { n, data, lipschitz: Math.min(maxD * (n - 1), 256), maxHeight: maxH };
}
