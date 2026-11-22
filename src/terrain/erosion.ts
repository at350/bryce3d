/**
 * Erosion simulations.
 *
 * Hydraulic: particle ("droplet") erosion in the style described by H. T. Beyer (2015):
 * each droplet runs downhill with some inertia, picks up sediment while it is fast and
 * carries less than its capacity, and drops it where it slows or climbs. Thermal: material
 * on slopes steeper than a talus angle slides to the lowest neighbor.
 *
 * Both work on a working copy whose heights are scaled by n / 256 so slopes per cell (and
 * therefore the look) stay similar across grid resolutions.
 */
import { mulberry32 } from './rng';

export interface HydraulicOptions {
  /** Droplets per grid cell. */
  density: number;
  seed: number;
  /** Erosion brush radius in cells. */
  radius?: number;
  inertia?: number;
  capacity?: number;
  minCapacity?: number;
  erodeSpeed?: number;
  depositSpeed?: number;
  evaporate?: number;
  gravity?: number;
  maxSteps?: number;
  /** Vertical exaggeration: taller terrain erodes harder. */
  heightGain?: number;
  /** Called with 0..1 now and then (for progress bars). */
  onProgress?: (fraction: number) => void;
}

/** Returns a new eroded array (input untouched). */
export function hydraulicErosion(src: Float32Array, n: number, o: HydraulicOptions): Float32Array {
  if (n < 4) return src.slice();
  const scale = (n / 256) * (o.heightGain ?? 1);
  const map = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) map[i] = src[i] * scale;

  const inertia = o.inertia ?? 0.05;
  const capacityK = o.capacity ?? 4;
  const minCapacity = (o.minCapacity ?? 0.01) * Math.min(1, scale);
  const erodeSpeed = o.erodeSpeed ?? 0.3;
  const depositSpeed = o.depositSpeed ?? 0.3;
  const evaporate = o.evaporate ?? 0.012;
  const gravity = o.gravity ?? 4;
  const maxSteps = o.maxSteps ?? 36;
  const radius = Math.max(1, o.radius ?? 2.5);

  // Erosion brush: cells within the radius, weights falling off linearly, summing to 1.
  const ri = Math.ceil(radius);
  const bdx: number[] = [];
  const bdz: number[] = [];
  const bw: number[] = [];
  let wsum = 0;
  for (let dz = -ri; dz <= ri; dz++) {
    for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d >= radius) continue;
      const w = radius - d;
      bdx.push(dx);
      bdz.push(dz);
      bw.push(w);
      wsum += w;
    }
  }
  const bc = bw.length;
  const offIdx = new Int32Array(bc);
  const wts = new Float64Array(bc);
  for (let k = 0; k < bc; k++) {
    offIdx[k] = bdz[k] * n + bdx[k];
    wts[k] = bw[k] / wsum;
  }

  const rand = mulberry32(o.seed);
  const total = Math.max(0, Math.round(o.density * n * n));
  const last = n - 1;
  const progressEvery = 8192;
  for (let drop = 0; drop < total; drop++) {
    if (o.onProgress && drop % progressEvery === 0) o.onProgress(drop / total);
    let px = rand() * (last - 0.001);
    let pz = rand() * (last - 0.001);
    let dirX = 0;
    let dirZ = 0;
    let speed = 1;
    let water = 1;
    let sediment = 0;
    for (let step = 0; step < maxSteps; step++) {
      const nx = px | 0;
      const nz = pz | 0;
      const idx = nz * n + nx;
      const ox = px - nx;
      const oz = pz - nz;
      const hNW = map[idx];
      const hNE = map[idx + 1];
      const hSW = map[idx + n];
      const hSE = map[idx + n + 1];
      const gx = (hNE - hNW) * (1 - oz) + (hSE - hSW) * oz;
      const gz = (hSW - hNW) * (1 - ox) + (hSE - hNE) * ox;
      const height = hNW * (1 - ox) * (1 - oz) + hNE * ox * (1 - oz) + hSW * (1 - ox) * oz + hSE * ox * oz;

      dirX = dirX * inertia - gx * (1 - inertia);
      dirZ = dirZ * inertia - gz * (1 - inertia);
      const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
      if (len < 1e-10) break;
      dirX /= len;
      dirZ /= len;
      px += dirX;
      pz += dirZ;
      if (px < 0 || pz < 0 || px >= last || pz >= last) break;

      const mx = px | 0;
      const mz = pz | 0;
      const j = mz * n + mx;
      const qx = px - mx;
      const qz = pz - mz;
      const newHeight =
        map[j] * (1 - qx) * (1 - qz) + map[j + 1] * qx * (1 - qz) + map[j + n] * (1 - qx) * qz + map[j + n + 1] * qx * qz;
      const dh = newHeight - height;
      const cap = Math.max(-dh * speed * water * capacityK, minCapacity);

      if (sediment > cap || dh > 0) {
        // Deposit: fill the pit we climbed out of, or drop the excess load.
        const dep = dh > 0 ? Math.min(dh, sediment) : (sediment - cap) * depositSpeed;
        sediment -= dep;
        map[idx] += dep * (1 - ox) * (1 - oz);
        map[idx + 1] += dep * ox * (1 - oz);
        map[idx + n] += dep * (1 - ox) * oz;
        map[idx + n + 1] += dep * ox * oz;
      } else {
        const amount = Math.min((cap - sediment) * erodeSpeed, -dh);
        if (nx >= ri && nz >= ri && nx < n - ri && nz < n - ri) {
          for (let k = 0; k < bc; k++) {
            const c = idx + offIdx[k];
            const want = amount * wts[k];
            const cur = map[c];
            const take = cur < want ? cur : want;
            map[c] = cur - take;
            sediment += take;
          }
        } else {
          for (let k = 0; k < bc; k++) {
            const cx = nx + bdx[k];
            const cz = nz + bdz[k];
            if (cx < 0 || cz < 0 || cx > last || cz > last) continue;
            const c = cz * n + cx;
            const want = amount * wts[k];
            const cur = map[c];
            const take = cur < want ? cur : want;
            map[c] = cur - take;
            sediment += take;
          }
        }
      }
      speed = Math.sqrt(Math.max(0, speed * speed - dh * gravity));
      water *= 1 - evaporate;
    }
  }
  o.onProgress?.(1);
  const inv = 1 / scale;
  for (let i = 0; i < map.length; i++) map[i] *= inv;
  return map;
}

/**
 * Thermal weathering in place: wherever the drop to the lowest of the 8 neighbors exceeds
 * `talus` (height units per cell), part of the excess slides down. Border cells are fixed.
 */
export function thermalErosionInPlace(h: Float32Array, n: number, iterations: number, talus: number, rate = 0.5): void {
  if (n < 3) return;
  const offs = [-1, 1, -n, n, -n - 1, -n + 1, n - 1, n + 1];
  const dist = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
  for (let it = 0; it < iterations; it++) {
    const forward = (it & 1) === 0;
    for (let zz = 1; zz < n - 1; zz++) {
      const z = forward ? zz : n - 1 - zz;
      for (let xx = 1; xx < n - 1; xx++) {
        const x = forward ? xx : n - 1 - xx;
        const i = z * n + x;
        const hi = h[i];
        let best = -1;
        let bestExcess = 0;
        for (let k = 0; k < 8; k++) {
          const excess = (hi - h[i + offs[k]]) / dist[k] - talus;
          if (excess > bestExcess) {
            bestExcess = excess;
            best = k;
          }
        }
        if (best >= 0) {
          const move = rate * bestExcess * dist[best] * 0.5;
          h[i] -= move;
          h[i + offs[best]] += move;
        }
      }
    }
  }
}
