/**
 * Terrain and symmetrical-lattice geometry in object space: the Bryce wire grid that follows
 * the heights (honoring the clipping bracket) and triangle grids for picking / solid mode.
 *
 * terrain: height h -> y = 2h - 1.   lattice: the solid between y = -h and y = +h.
 * clipLow: heights below are cut away.   clipHigh: heights above are flattened to it.
 */
import { clamp } from '@/core/math';
import type { TerrainData } from '@/core/types';

/** Bilinear height sample at u, v in 0..1 (x, z from -1 to +1). */
export function sampleHeight(heights: Float32Array, n: number, u: number, v: number): number {
  const fx = clamp(u, 0, 1) * (n - 1);
  const fz = clamp(v, 0, 1) * (n - 1);
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(n - 1, x0 + 1);
  const z1 = Math.min(n - 1, z0 + 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const a = heights[z0 * n + x0];
  const b = heights[z0 * n + x1];
  const c = heights[z1 * n + x0];
  const d = heights[z1 * n + x1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

interface ClipInfo {
  /** Heights below this have no surface. */
  low: number;
  high: number;
}

function clipInfo(t: TerrainData, lattice: boolean): ClipInfo {
  const lo = clamp(t.clipLow ?? 0, 0, 1);
  const hi = clamp(t.clipHigh ?? 1, 0, 1);
  return { low: lattice ? Math.max(lo, 1e-3) : lo, high: Math.max(hi, lo) };
}

/** Number of grid lines per direction for a terrain resolution (Bryce shows ~32). */
export function wireLineCount(resolution: number): number {
  return clamp(Math.min(resolution, 32), 2, 64);
}

/**
 * The wire grid: `lines` lines along X and along Z, each sampled finely so its profile
 * follows the heights. Lattices get a mirrored top and bottom grid.
 */
export function terrainWire(t: TerrainData, lattice: boolean, lines = wireLineCount(t.resolution)): Float32Array {
  const n = t.resolution;
  const h = t.heights;
  if (!h || h.length < n * n || n < 2) return new Float32Array(0);
  const clip = clipInfo(t, lattice);
  const samples = clamp(Math.min(n - 1, 96), lines - 1, 128);
  const out: number[] = [];
  const ySurface = (hd: number, sign: number) => (lattice ? sign * hd : 2 * hd - 1);
  const layers = lattice ? [1, -1] : [1];

  for (const sign of layers) {
    for (let dir = 0; dir < 2; dir++) {
      for (let i = 0; i < lines; i++) {
        const fixed = i / (lines - 1);
        let pu = 0;
        let pv = 0;
        let ph = 0;
        for (let j = 0; j <= samples; j++) {
          const s = j / samples;
          const u = dir === 0 ? s : fixed;
          const v = dir === 0 ? fixed : s;
          const hh = sampleHeight(h, n, u, v);
          if (j > 0) emitClipped(out, pu, pv, ph, u, v, hh, clip, sign, ySurface);
          pu = u;
          pv = v;
          ph = hh;
        }
      }
    }
  }
  return new Float32Array(out);
}

function emitClipped(
  out: number[],
  u0: number,
  v0: number,
  h0: number,
  u1: number,
  v1: number,
  h1: number,
  clip: ClipInfo,
  sign: number,
  ySurface: (hd: number, sign: number) => number,
) {
  const in0 = h0 >= clip.low;
  const in1 = h1 >= clip.low;
  if (!in0 && !in1) return;
  let a = { u: u0, v: v0, h: h0 };
  let b = { u: u1, v: v1, h: h1 };
  if (in0 !== in1) {
    const c = (clip.low - h0) / (h1 - h0 || 1e-9);
    const cut = { u: u0 + (u1 - u0) * c, v: v0 + (v1 - v0) * c, h: clip.low };
    if (in0) b = cut;
    else a = cut;
  }
  out.push(
    a.u * 2 - 1,
    ySurface(Math.min(a.h, clip.high), sign),
    a.v * 2 - 1,
    b.u * 2 - 1,
    ySurface(Math.min(b.h, clip.high), sign),
    b.v * 2 - 1,
  );
}

export interface GridMesh {
  positions: Float32Array;
  /** Displayed (clipped) height 0..1 per vertex, for altitude tinting. */
  heights: Float32Array;
  index: Uint32Array;
}

/**
 * A triangle grid with `res` vertices per side (cells with a vertex below clipLow are cut).
 * Lattices get a top and a mirrored bottom sheet.
 */
export function terrainGridMesh(t: TerrainData, lattice: boolean, res: number): GridMesh {
  const n = t.resolution;
  const r = Math.max(2, Math.floor(res));
  const clip = clipInfo(t, lattice);
  const layers = lattice ? [1, -1] : [1];
  const perLayer = r * r;
  const positions = new Float32Array(perLayer * layers.length * 3);
  const heights = new Float32Array(perLayer * layers.length);
  const raw = new Float32Array(perLayer);
  for (let z = 0; z < r; z++) {
    for (let x = 0; x < r; x++) raw[z * r + x] = sampleHeight(t.heights, n, x / (r - 1), z / (r - 1));
  }
  const index: number[] = [];
  layers.forEach((sign, li) => {
    const base = li * perLayer;
    for (let z = 0; z < r; z++) {
      for (let x = 0; x < r; x++) {
        const k = z * r + x;
        const hd = Math.min(raw[k], clip.high);
        const o = (base + k) * 3;
        positions[o] = (x / (r - 1)) * 2 - 1;
        positions[o + 1] = lattice ? sign * hd : 2 * hd - 1;
        positions[o + 2] = (z / (r - 1)) * 2 - 1;
        heights[base + k] = hd;
      }
    }
    for (let z = 0; z + 1 < r; z++) {
      for (let x = 0; x + 1 < r; x++) {
        const a = z * r + x;
        const b = a + 1;
        const c = a + r;
        const d = c + 1;
        if (raw[a] < clip.low || raw[b] < clip.low || raw[c] < clip.low || raw[d] < clip.low) continue;
        // Counter-clockwise seen from above for the top sheet.
        if (sign > 0) index.push(base + a, base + c, base + b, base + b, base + c, base + d);
        else index.push(base + a, base + b, base + c, base + b, base + d, base + c);
      }
    }
  });
  return { positions, heights, index: new Uint32Array(index) };
}
