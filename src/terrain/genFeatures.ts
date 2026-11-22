/**
 * Landscape generators built from distinctive features: river canyons, mesas, dunes, impact
 * craters, spikes, mounds and mosaic (basalt-column cell tiles).
 */
import { gridCoords, makeIslandMask, remapRange, squareEdgeFade } from './genShared';
import { normalizeInPlace, smoothstep } from './grid';
import { cellFeature, gradientNoise, makeFbm, octavesFor } from './noise';
import type { Params } from './params';
import { hash01, mulberry32, subSeed } from './rng';

export function genCanyons(seed: number, n: number, p: Params): Float32Array {
  const f = p.frequency;
  const river = makeFbm(seed, 4, 0.45);
  const plateau = makeFbm(subSeed(seed, 1), octavesFor(n, 2.5, 6), 0.5);
  const wall = makeFbm(subSeed(seed, 2), octavesFor(n, 9, 4), 0.55);
  const wx = makeFbm(subSeed(seed, 3), 3, 0.5);
  const layers = Math.max(1, Math.round(p.layers));
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const v = c[z];
    for (let x = 0; x < n; x++) {
      const u = c[x];
      const w = p.wander * wx(u * 1.1, v * 1.1);
      const d = Math.abs(river(u * f + w, v * f - w));
      let t = smoothstep(0, p.width, d + 0.025 * wall(u * 9, v * 9));
      const s = t * layers;
      const fl = Math.floor(s);
      t = ((fl + smoothstep(0.55, 1, s - fl)) / layers) * 0.75 + t * 0.25;
      const top = 0.9 - 0.12 * (plateau(u * 2.5, v * 2.5) * 0.5 + 0.5);
      const floor = 0.05 + 0.04 * (plateau(u * 6 + 9, v * 6) * 0.5 + 0.5);
      out[z * n + x] = top - p.depth * (1 - t) * (top - floor);
    }
  }
  return out;
}

export function genMesas(seed: number, n: number, p: Params): Float32Array {
  const f = p.frequency;
  const field = makeFbm(seed, 5, 0.5);
  const detail = makeFbm(subSeed(seed, 1), octavesFor(n, 8, 5), 0.5);
  const wx = makeFbm(subSeed(seed, 2), 3, 0.5);
  const tiers = Math.max(1, Math.round(p.tiers));
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const v = c[z];
    for (let x = 0; x < n; x++) {
      const u = c[x];
      const w = 0.45 * wx(u * 1.3, v * 1.3);
      const m = field(u * f + w, v * f + w) * 0.5 + 0.5 + 0.02 * detail(u * 8, v * 8);
      const dn = detail(u * 5 + 3, v * 5 - 7) * 0.5 + 0.5;
      let h = 0.04 + 0.05 * dn;
      for (let k = 0; k < tiers; k++) {
        const thr = p.level + k * 0.075;
        h += smoothstep(thr - p.cliff, thr + p.cliff, m) * (p.height / tiers) * (k === 0 ? 1 : 0.85);
      }
      out[z * n + x] = h + 0.015 * dn;
    }
  }
  return out;
}

export function genDunes(seed: number, n: number, p: Params): Float32Array {
  const f = p.frequency;
  const warp = makeFbm(seed, 3, 0.5);
  const ampN = makeFbm(subSeed(seed, 1), 3, 0.5);
  const base = makeFbm(subSeed(seed, 2), 4, 0.5);
  const ripple = gradientNoise(subSeed(seed, 3));
  const a = (p.angle * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const asym = p.asymmetry;
  const rippleFreq = f * 7;
  const showRipples = n / rippleFreq > 6;
  // A weaker second dune train crossing the first breaks the stripes into linked crests.
  const cb = Math.cos(a + 1.15);
  const sb = Math.sin(a + 1.15);
  const dune = (phase: number) => {
    const fr = phase - Math.floor(phase);
    const pr = fr < asym ? fr / asym : (1 - fr) / (1 - asym);
    return pr * pr * (3 - 2 * pr);
  };
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const v = c[z];
    for (let x = 0; x < n; x++) {
      const u = c[x];
      const s = u * ca + v * sa;
      const t = -u * sa + v * ca;
      const w = p.chaos * (1.8 * warp(t * 0.9 + 3, s * 0.5) + 0.7 * warp(u * 2.6 + 11, v * 2.6));
      const main = dune(s * f + w);
      const cross = dune((u * cb + v * sb) * f * 0.6 + 0.6 * w + 0.37);
      const amp = 0.25 + 0.75 * smoothstep(-0.35, 0.45, ampN(u * 1.7, v * 1.7));
      let h = 0.14 * (base(u * 1.2, v * 1.2) * 0.5 + 0.5) + (main * 0.8 + cross * 0.3 * p.chaos) * amp;
      if (showRipples) h += 0.01 * Math.sin((s * rippleFreq + 1.5 * ripple(u * 6, v * 6)) * Math.PI * 2) * (0.4 + main);
      out[z * n + x] = h;
    }
  }
  return remapRange(normalizeInPlace(out), 0, p.height);
}

export function genCraters(seed: number, n: number, p: Params): Float32Array {
  const plains = makeFbm(seed, octavesFor(n, 3, 6), 0.5);
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) out[z * n + x] = 0.42 + 0.1 * plains(c[x] * 3, c[z] * 3);
  }
  const rnd = mulberry32(subSeed(seed, 1));
  const count = Math.round(p.count);
  const toGrid = (n - 1) / 2;
  for (let k = 0; k < count; k++) {
    const rr = p.size * (0.06 + 0.94 * Math.pow(rnd(), 3));
    const cx = rnd() * 2.2 - 1.1;
    const cz = rnd() * 2.2 - 1.1;
    const deep = p.depth * rr * 1.1;
    const rim = deep * 0.42;
    const ext = rr * 2;
    const x0 = Math.max(0, Math.floor((cx - ext + 1) * toGrid));
    const x1 = Math.min(n - 1, Math.ceil((cx + ext + 1) * toGrid));
    const z0 = Math.max(0, Math.floor((cz - ext + 1) * toGrid));
    const z1 = Math.min(n - 1, Math.ceil((cz + ext + 1) * toGrid));
    const inv = 1 / rr;
    for (let z = z0; z <= z1; z++) {
      const dz = c[z] - cz;
      for (let x = x0; x <= x1; x++) {
        const dx = c[x] - cx;
        const d = Math.sqrt(dx * dx + dz * dz) * inv;
        if (d >= 2) continue;
        let delta: number;
        if (d < 1) delta = -deep * (1 - d * d) + rim * smoothstep(0.65, 1, d);
        else delta = rim * Math.exp(-((d - 1) * (d - 1)) / 0.12) * (1 - smoothstep(1.6, 2, d));
        out[z * n + x] += delta;
      }
    }
  }
  return remapRange(normalizeInPlace(out), 0, p.height);
}

/** Max over neighboring jittered cells of a per-cell bump profile (spikes, mounds). */
export function cellBumps(
  seed: number,
  n: number,
  freq: number,
  coverage: number,
  radius: [number, number],
  profile: (d: number) => number,
): Float32Array {
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  const pt = new Float64Array(2);
  const sh = subSeed(seed, 21);
  const sr = subSeed(seed, 22);
  const sc = subSeed(seed, 23);
  for (let z = 0; z < n; z++) {
    const gz = (c[z] * 0.5 + 0.5) * freq;
    const iz = Math.floor(gz);
    for (let x = 0; x < n; x++) {
      const gx = (c[x] * 0.5 + 0.5) * freq;
      const ix = Math.floor(gx);
      let best = 0;
      for (let oz = -1; oz <= 1; oz++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = ix + ox;
          const cz = iz + oz;
          if (hash01(cx, cz, sc) > coverage) continue;
          cellFeature(cx, cz, seed, 0.85, pt);
          const rad = radius[0] + (radius[1] - radius[0]) * hash01(cx, cz, sr);
          const dx = gx - pt[0];
          const dz = gz - pt[1];
          const d = Math.sqrt(dx * dx + dz * dz) / rad;
          if (d >= 1) continue;
          const b = profile(d) * (0.35 + 0.65 * hash01(cx, cz, sh));
          if (b > best) best = b;
        }
      }
      out[z * n + x] = best;
    }
  }
  return out;
}

export function genSpikes(seed: number, n: number, p: Params): Float32Array {
  const sharp = p.sharpness;
  const bumps = cellBumps(seed, n, p.frequency, p.coverage, [0.45, 0.95], (d) => Math.pow(1 - d, sharp));
  const base = makeFbm(subSeed(seed, 1), 4, 0.5);
  const mask = makeIslandMask(subSeed(seed, 2), 0.2, 0.95);
  const c = gridCoords(n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const m = mask(c[x], c[z], p.island);
      bumps[i] = (bumps[i] * 0.9 + 0.08 * (base(c[x] * 2, c[z] * 2) * 0.5 + 0.5)) * m;
    }
  }
  return remapRange(normalizeInPlace(bumps), 0, p.height);
}

export function genMounds(seed: number, n: number, p: Params): Float32Array {
  const bumps = cellBumps(seed, n, p.frequency, p.coverage, [0.5, 1.15], (d) => Math.sqrt(1 - d * d));
  const hills = makeFbm(subSeed(seed, 1), octavesFor(n, 2, 5), 0.45);
  const mask = makeIslandMask(subSeed(seed, 2), 0.2, 1);
  const c = gridCoords(n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const m = mask(c[x], c[z], p.island);
      bumps[i] = (bumps[i] * 0.75 + 0.35 * (hills(c[x] * 2, c[z] * 2) * 0.5 + 0.5)) * m;
    }
  }
  return remapRange(normalizeInPlace(bumps), 0, p.height);
}

export function genMosaic(seed: number, n: number, p: Params): Float32Array {
  const f = p.frequency;
  const field = makeFbm(subSeed(seed, 1), 4, 0.5);
  const mask = makeIslandMask(subSeed(seed, 2), 0.2, 0.95);
  const sv = subSeed(seed, 3);
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  const pt = new Float64Array(2);
  for (let z = 0; z < n; z++) {
    const gz = (c[z] * 0.5 + 0.5) * f;
    const iz = Math.floor(gz);
    for (let x = 0; x < n; x++) {
      const gx = (c[x] * 0.5 + 0.5) * f;
      const ix = Math.floor(gx);
      let d1 = Infinity;
      let d2 = Infinity;
      let fx = 0;
      let fz = 0;
      let bx = 0;
      let bz = 0;
      for (let oz = -1; oz <= 1; oz++) {
        for (let ox = -1; ox <= 1; ox++) {
          cellFeature(ix + ox, iz + oz, seed, p.jitter, pt);
          const dx = gx - pt[0];
          const dz = gz - pt[1];
          const d = dx * dx + dz * dz;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            fx = pt[0];
            fz = pt[1];
            bx = ix + ox;
            bz = iz + oz;
          } else if (d < d2) d2 = d;
        }
      }
      const fu = (fx / f) * 2 - 1;
      const fv = (fz / f) * 2 - 1;
      const cell =
        ((field(fu * 1.3, fv * 1.3) * 0.5 + 0.5) * (1 - p.variation) + p.variation * hash01(bx, bz, sv)) *
        mask(Math.max(-1, Math.min(1, fu)), Math.max(-1, Math.min(1, fv)), p.island);
      const edge = smoothstep(0, p.gap, Math.sqrt(d2) - Math.sqrt(d1));
      out[z * n + x] = (cell * (0.94 + 0.06 * edge) - (1 - edge) * 0.05) * squareEdgeFade(c[x], c[z], 0.02);
    }
  }
  return normalizeInPlace(out);
}
