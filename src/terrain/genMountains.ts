/**
 * Mountain-type generators: fractal, rugged (ridged), rolling hills, terraces, archipelago,
 * volcano and eroded alpine. Frequencies are in cycles across the terrain square, so a
 * 64^2 and a 1024^2 grid show the same landform (the bigger one with finer detail).
 */
import { hydraulicErosion, thermalErosionInPlace } from './erosion';
import { gridCoords, makeIslandMask, remapRange, shapePow, squareEdgeFade } from './genShared';
import { blurHeights, normalizeInPlace, smoothstep } from './grid';
import { gradientNoise, makeFbm, makeRidged, octavesFor } from './noise';
import type { Params } from './params';
import { mulberry32, subSeed } from './rng';

/** Shared mountain field: warped fBm blended with ridged noise, optionally shaped into an island. */
function mountainField(seed: number, n: number, p: Params): Float32Array {
  const f = p.frequency;
  const oct = octavesFor(n, f, p.octaves ?? 8);
  const fbm = makeFbm(seed, oct, p.roughness);
  const ridgeMix = p.ridges ?? 0;
  const rid = ridgeMix > 0 ? makeRidged(subSeed(seed, 1), oct, p.roughness) : null;
  const wx = makeFbm(subSeed(seed, 2), 3, 0.5);
  const wz = makeFbm(subSeed(seed, 3), 3, 0.5);
  const mask = makeIslandMask(subSeed(seed, 4));
  const rnd = mulberry32(subSeed(seed, 5));
  const cx = (rnd() - 0.5) * 0.35;
  const cz = (rnd() - 0.5) * 0.35;
  const island = p.island ?? 0;
  const warp = (p.warp ?? 0) * 1.4;
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const v = c[z];
    for (let x = 0; x < n; x++) {
      const u = c[x];
      const px = u * f + warp * wx(u * 1.4, v * 1.4);
      const pz = v * f + warp * wz(u * 1.4 + 5.2, v * 1.4 + 1.3);
      let h = fbm(px, pz) * 0.5 + 0.5;
      if (rid) h = h * (1 - ridgeMix) + rid(px * 0.85 + 7.7, pz * 0.85 - 3.1) * ridgeMix * 1.15;
      if (island > 0) {
        const dx = u - cx;
        const dz = v - cz;
        const dome = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / 1.1);
        h = h * (1 - 0.5 * island) + dome * dome * island * 0.62;
        h *= mask(u, v, island);
      }
      out[z * n + x] = h;
    }
  }
  return out;
}

export function genFractal(seed: number, n: number, p: Params): Float32Array {
  const out = mountainField(seed, n, p);
  return shapePow(normalizeInPlace(out), p.sharpness);
}

export function genRidged(seed: number, n: number, p: Params): Float32Array {
  const f = p.frequency;
  const oct = octavesFor(n, f, p.octaves);
  const rid = makeRidged(seed, oct, p.roughness);
  const soft = makeFbm(subSeed(seed, 1), Math.min(oct, 5), 0.5);
  const wx = makeFbm(subSeed(seed, 2), 3, 0.5);
  const wz = makeFbm(subSeed(seed, 3), 3, 0.5);
  const mask = makeIslandMask(subSeed(seed, 4), 0.25, 0.98);
  const warp = p.warp * 1.4;
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const v = c[z];
    for (let x = 0; x < n; x++) {
      const u = c[x];
      const px = u * f + warp * wx(u * 1.3, v * 1.3);
      const pz = v * f + warp * wz(u * 1.3 + 4.1, v * 1.3 - 2.6);
      let h = rid(px, pz) * 0.85 + (soft(px * 0.5, pz * 0.5) * 0.5 + 0.5) * 0.3;
      if (p.island > 0) {
        const dome = Math.max(0, 1 - Math.sqrt(u * u + v * v) / 1.15);
        h = h * (1 - 0.35 * p.island) + dome * p.island * 0.45;
        h *= mask(u, v, p.island);
      }
      out[z * n + x] = h;
    }
  }
  return shapePow(normalizeInPlace(out), p.sharpness);
}

export function genHills(seed: number, n: number, p: Params): Float32Array {
  const f = p.frequency;
  const fbm = makeFbm(seed, octavesFor(n, f, 5), p.roughness);
  const wx = makeFbm(subSeed(seed, 2), 2, 0.5);
  const mask = makeIslandMask(subSeed(seed, 4), 0.2, 1.05);
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const v = c[z];
    for (let x = 0; x < n; x++) {
      const u = c[x];
      const w = 0.6 * wx(u, v);
      const h = fbm(u * f + w, v * f - w) * 0.5 + 0.5;
      out[z * n + x] = h * mask(u, v, p.island);
    }
  }
  normalizeInPlace(out);
  // Rounded crests, broad valleys.
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    out[i] = t * t * (3 - 2 * t);
  }
  return remapRange(out, 0, p.height);
}

export function genTerraces(seed: number, n: number, p: Params): Float32Array {
  const base = mountainField(seed, n, { ...p, octaves: 6, ridges: 0.15, warp: 0.4 });
  normalizeInPlace(base);
  const steps = Math.max(2, Math.round(p.steps));
  const flat = Math.min(0.97, Math.max(0.05, p.flatness));
  for (let i = 0; i < base.length; i++) {
    const t = base[i] * steps;
    const fl = Math.floor(t);
    base[i] = (fl + smoothstep(flat, 1, t - fl)) / steps;
  }
  return base;
}

export function genIslands(seed: number, n: number, p: Params): Float32Array {
  const f = p.frequency;
  const fbm = makeFbm(seed, octavesFor(n, f, 8), 0.52);
  const wx = makeFbm(subSeed(seed, 2), 3, 0.5);
  const wz = makeFbm(subSeed(seed, 3), 3, 0.5);
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  const reach = 0.6 + p.spread * 0.7;
  for (let z = 0; z < n; z++) {
    const v = c[z];
    for (let x = 0; x < n; x++) {
      const u = c[x];
      const px = u * f + 0.6 * wx(u * 1.2, v * 1.2);
      const pz = v * f + 0.6 * wz(u * 1.2 + 3.3, v * 1.2 + 8.1);
      const r = Math.sqrt(u * u + v * v);
      const cluster = 1 - smoothstep(0.05, reach, r);
      out[z * n + x] = (fbm(px, pz) * 0.5 + 0.5) * (0.55 + 0.45 * cluster);
    }
  }
  normalizeInPlace(out);
  const sea = p.sea;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const t = out[i];
      const h = t < sea ? (t / sea) * 0.14 : 0.14 + Math.pow((t - sea) / (1 - sea), 0.85) * 0.86;
      out[i] = h * squareEdgeFade(c[x], c[z], 0.25);
    }
  }
  return normalizeInPlace(out);
}

export function genVolcano(seed: number, n: number, p: Params): Float32Array {
  const oct = octavesFor(n, 3, 7);
  const gullies = makeRidged(seed, oct, 0.55);
  const coast = makeFbm(subSeed(seed, 1), 4, 0.5);
  const streak = gradientNoise(subSeed(seed, 2));
  const fine = makeFbm(subSeed(seed, 3), oct, 0.5);
  const R = p.radius;
  const rc = Math.min(p.crater, R * 0.8);
  const rimHeight = Math.pow(Math.max(0, 1 - rc / R), 1.45);
  const c = gridCoords(n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    const v = c[z];
    for (let x = 0; x < n; x++) {
      const u = c[x];
      const r0 = Math.sqrt(u * u + v * v);
      const r = r0 * (1 + 0.1 * coast(u * 1.6, v * 1.6));
      const cone = Math.pow(Math.max(0, 1 - r / R), 1.45);
      let h = Math.min(cone, rimHeight);
      if (r < rc) {
        const t = r / rc;
        h -= p.depth * (1 - t * t) * (1 - t * t * 0.3);
      }
      h += 0.035 * Math.exp(-((r - rc) * (r - rc)) / 0.0025);
      // Radial lava channels and rough flanks.
      const ca = r0 > 1e-6 ? u / r0 : 1;
      const sa = r0 > 1e-6 ? v / r0 : 0;
      const s = 1 - Math.abs(streak(ca * 4.5 + 9, sa * 4.5 + r * 1.2));
      const flank = Math.sqrt(Math.max(0, cone)) * (r > rc ? 1 : 0.3);
      h += p.ruggedness * flank * (0.16 * (gullies(u * 3, v * 3) - 0.45) + 0.06 * s * s);
      h += 0.1 * smoothstep(R * 1.35, R * 0.4, r) * (0.6 + 0.4 * fine(u * 4, v * 4));
      out[z * n + x] = h * squareEdgeFade(u, v, 0.08);
    }
  }
  return remapRange(normalizeInPlace(out), 0, p.height);
}

export function genEroded(seed: number, n: number, p: Params, onProgress?: (f: number) => void): Float32Array {
  const base = mountainField(seed, n, {
    frequency: p.frequency,
    roughness: p.roughness,
    octaves: 8,
    warp: 0.3,
    ridges: 0.45,
    island: p.island,
  });
  normalizeInPlace(base);
  shapePow(base, 1.15);
  thermalErosionInPlace(base, n, 4, 5 / n, 0.4);
  const eroded = hydraulicErosion(base, n, {
    density: 1.6 * p.erosion,
    seed: subSeed(seed, 9),
    radius: 2.5 * Math.max(1, n / 512),
    heightGain: 2.6,
    erodeSpeed: 0.4,
    maxSteps: 48,
    onProgress,
  });
  const soft = blurHeights(eroded, n, Math.max(1, n / 512), 1);
  return normalizeInPlace(soft);
}
