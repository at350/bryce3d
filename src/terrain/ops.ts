/**
 * Terrain operations (the Elevation tab's Basic Tools and Special Effects, plus the filter
 * curve, picture patterns and generator blends). Each op maps heights to new heights; the
 * shared `amount` param (0..1) fades any op in gradually, like dragging a Bryce button.
 * Sizes are fractions of the grid so an op looks the same at every resolution.
 */
import { applyLUT, buildCurveLUT, paramsToCurve } from './curve';
import { hydraulicErosion, thermalErosionInPlace } from './erosion';
import { cellBumps } from './genFeatures';
import { gridCoords } from './genShared';
import { generatorByCode, runGenerator } from './generators';
import { blurHeights, clamp01, clampHeightsInPlace, heightStats, lerpHeights, smoothstep } from './grid';
import { makeFbm, octavesFor } from './noise';
import { blendAmount, resolveParams, type ParamSpec, type Params } from './params';
import { blendHeights, patternByCode, renderPattern } from './pictures';
import { subSeed } from './rng';

export type OpGroup = 'basic' | 'edges' | 'effects' | 'special';

export interface OpDef {
  id: string;
  label: string;
  hint: string;
  group: OpGroup;
  params: ParamSpec[];
  /** Slow at large grids: the editor runs it off the main thread with a busy state. */
  heavy?: boolean;
  /** Params are passed through untouched (curve, picture, generator blends encode data). */
  rawParams?: boolean;
  /** Hidden from the button grid (driven by other UI: filter curve, pictures, generator blends). */
  internal?: boolean;
  run(src: Float32Array, n: number, p: Params, seed: number, onProgress?: (fraction: number) => void): Float32Array;
}

const pct = (key: string, label: string, d: number, min: number, max: number, hint: string): ParamSpec => ({
  key, label, min, max, default: d, precision: 1, hint,
});

function mapEach(src: Float32Array, fn: (v: number) => number): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = fn(src[i]);
  return out;
}

/** Normalized slope magnitude per cell (central differences, ~1 = 45 degrees on a default terrain). */
function slopeField(h: Float32Array, n: number): Float32Array {
  const out = new Float32Array(h.length);
  const k = (n - 1) / 8;
  for (let z = 0; z < n; z++) {
    const zm = z > 0 ? z - 1 : 0;
    const zp = z < n - 1 ? z + 1 : n - 1;
    for (let x = 0; x < n; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x < n - 1 ? x + 1 : n - 1;
      const gx = (h[z * n + xp] - h[z * n + xm]) * k;
      const gz = (h[zp * n + x] - h[zm * n + x]) * k;
      out[z * n + x] = Math.sqrt(gx * gx + gz * gz);
    }
  }
  return out;
}

function addNoise(src: Float32Array, n: number, p: Params, seed: number, weight: (i: number) => number): Float32Array {
  const f = p.scale;
  const fbm = makeFbm(seed, octavesFor(n, f, 5), 0.5);
  const c = gridCoords(n);
  const out = new Float32Array(src.length);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      out[i] = src[i] + p.amount_ * weight(i) * fbm(c[x] * f, c[z] * f);
    }
  }
  return out;
}

const noiseParams = (amount: number): ParamSpec[] => [
  { key: 'amount_', label: 'Strength', min: 0, max: 0.4, default: amount, precision: 3, hint: 'How rough' },
  { key: 'scale', label: 'Scale', min: 2, max: 128, default: 24, precision: 0, hint: 'Grain size (higher = finer)' },
];

/** Distance to the nearest border in 0..0.5 (fraction of the width). */
function borderDistance(x: number, z: number, n: number): number {
  const inv = 1 / (n - 1);
  const u = x * inv;
  const v = z * inv;
  return Math.min(u, v, 1 - u, 1 - v);
}

export const OP_DEFS: OpDef[] = [
  // --- basic tools ---------------------------------------------------------
  {
    id: 'raiseLower', label: 'Raise / Lower', group: 'basic', hint: 'Lift or sink the whole terrain',
    params: [{ key: 'offset', label: 'Offset', min: -0.5, max: 0.5, default: 0.08, precision: 3, hint: 'Height added (negative lowers)' }],
    run: (src, _n, p) => mapEach(src, (v) => v + p.offset),
  },
  {
    id: 'invert', label: 'Invert', group: 'basic', hint: 'Mountains become canyons, canyons become mountains',
    params: [],
    run: (src) => mapEach(src, (v) => 1 - v),
  },
  {
    id: 'smooth', label: 'Smooth', group: 'basic', hint: 'Soften sharp transitions (great before eroding)',
    params: [pct('radius', 'Radius', 0.6, 0.1, 5, 'Blur radius, % of the width')],
    run: (src, n, p) => blurHeights(src, n, Math.max(1, (p.radius / 100) * n), 2),
  },
  {
    id: 'blur', label: 'Blur', group: 'basic', hint: 'Heavy blur: melts everything into soft swells',
    params: [pct('radius', 'Radius', 2.5, 0.5, 12, 'Blur radius, % of the width')],
    run: (src, n, p) => blurHeights(src, n, Math.max(1, (p.radius / 100) * n), 3),
  },
  {
    id: 'sharpen', label: 'Sharpen', group: 'basic', hint: 'Crisper ridges and deeper creases',
    params: [
      { key: 'strength', label: 'Strength', min: 0, max: 4, default: 1.2, precision: 2, hint: 'Sharpening strength' },
      pct('radius', 'Radius', 1, 0.2, 6, 'Detail size, % of the width'),
    ],
    run: (src, n, p) => {
      const b = blurHeights(src, n, Math.max(1, (p.radius / 100) * n), 2);
      const out = new Float32Array(src.length);
      for (let i = 0; i < src.length; i++) out[i] = src[i] + p.strength * (src[i] - b[i]);
      return out;
    },
  },
  {
    id: 'contrast', label: 'Contrast', group: 'basic', hint: 'Push heights toward the floor and the summit (negative: flatten)',
    params: [{ key: 'strength', label: 'Strength', min: -1, max: 1, default: 0.5, precision: 2, hint: 'Positive = steeper, negative = flatter' }],
    run: (src, _n, p) => {
      if (p.strength < 0) {
        const mean = heightStats(src).mean;
        const k = 1 + p.strength;
        return mapEach(src, (v) => mean + (v - mean) * k);
      }
      const k = 1 + p.strength * 9;
      const s = (x: number) => 1 / (1 + Math.exp(-k * (x - 0.5)));
      const lo = s(0);
      const span = s(1) - lo;
      return mapEach(src, (v) => (s(v) - lo) / span);
    },
  },
  {
    id: 'scale', label: 'Scale', group: 'basic', hint: 'Squash or stretch heights toward the ground',
    params: [{ key: 'factor', label: 'Factor', min: 0, max: 2, default: 0.75, precision: 2, hint: 'Height multiplier' }],
    run: (src, _n, p) => mapEach(src, (v) => v * p.factor),
  },
  {
    id: 'equalize', label: 'Equalize', group: 'basic', hint: 'Spread heights over the full range from floor to summit',
    params: [],
    run: (src) => {
      const bins = 1024;
      const hist = new Float64Array(bins);
      for (let i = 0; i < src.length; i++) hist[Math.round(clamp01(src[i]) * (bins - 1))]++;
      const cdf = new Float32Array(bins);
      let acc = 0;
      for (let b = 0; b < bins; b++) {
        acc += hist[b];
        cdf[b] = acc / src.length;
      }
      const first = cdf.find((v) => v > 0) ?? 0;
      const span = 1 - first || 1;
      for (let b = 0; b < bins; b++) cdf[b] = clamp01((cdf[b] - first) / span);
      return mapEach(src, (v) => cdf[Math.round(clamp01(v) * (bins - 1))]);
    },
  },
  {
    id: 'clip', label: 'Clip', group: 'basic', hint: 'Cut off the lows and highs, then stretch what is left',
    params: [
      { key: 'low', label: 'Low', min: 0, max: 0.95, default: 0.15, precision: 2, hint: 'Heights below become the floor' },
      { key: 'high', label: 'High', min: 0.05, max: 1, default: 1, precision: 2, hint: 'Heights above become the summit' },
    ],
    run: (src, _n, p) => {
      const lo = Math.min(p.low, p.high - 0.01);
      const span = Math.max(0.01, p.high - lo);
      return mapEach(src, (v) => (v - lo) / span);
    },
  },
  {
    id: 'posterize', label: 'Posterize', group: 'basic', hint: 'Hard stair steps: desert plateaus and paddy fields',
    params: [{ key: 'steps', label: 'Steps', min: 2, max: 32, default: 7, step: 1, hint: 'Number of levels' }],
    run: (src, _n, p) => mapEach(src, (v) => Math.floor(clamp01(v) * p.steps * 0.9999) / (p.steps - 1)),
  },
  // --- edges ---------------------------------------------------------------
  {
    id: 'squareEdges', label: 'Square Edges', group: 'edges', hint: 'Abrupt drop to the floor at the square border',
    params: [pct('width', 'Width', 3, 0.5, 30, 'Width of the drop, % of the width')],
    run: (src, n, p) => {
      const w = p.width / 100;
      const out = new Float32Array(src.length);
      for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) out[z * n + x] = src[z * n + x] * smoothstep(0, w, borderDistance(x, z, n));
      return out;
    },
  },
  {
    id: 'roundEdges', label: 'Round Edges', group: 'edges', hint: 'Circular base: everything outside the circle drops away',
    params: [
      { key: 'radius', label: 'Radius', min: 0.3, max: 1.4, default: 0.97, precision: 2, hint: 'Circle radius (1 touches the edges)' },
      pct('width', 'Width', 4, 0.5, 60, 'Width of the drop, % of the width'),
    ],
    run: (src, n, p) => {
      const c = gridCoords(n);
      const w = (p.width / 100) * 2;
      const out = new Float32Array(src.length);
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          const r = Math.sqrt(c[x] * c[x] + c[z] * c[z]);
          out[z * n + x] = src[z * n + x] * (1 - smoothstep(p.radius - w, p.radius, r));
        }
      }
      return out;
    },
  },
  {
    id: 'gaussianEdges', label: 'Gaussian Edges', group: 'edges', hint: 'Gentle ramp from the floor at the border: blends into a ground plane',
    params: [pct('width', 'Width', 30, 3, 50, 'Width of the ramp, % of the width')],
    run: (src, n, p) => {
      const w = p.width / 100;
      const out = new Float32Array(src.length);
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          const d = borderDistance(x, z, n) / w;
          out[z * n + x] = src[z * n + x] * (1 - Math.exp(-d * d * 4));
        }
      }
      return out;
    },
  },
  {
    id: 'raiseEdges', label: 'Raise Edges', group: 'edges', hint: 'Walls rising at the border: a bowl or a crater rim',
    params: [pct('width', 'Width', 6, 0.5, 40, 'Width of the wall, % of the width'), { key: 'level', label: 'Level', min: 0, max: 1, default: 1, precision: 2, hint: 'Wall height' }],
    run: (src, n, p) => {
      const w = p.width / 100;
      const out = new Float32Array(src.length);
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          const t = 1 - smoothstep(0, w, borderDistance(x, z, n));
          const v = src[z * n + x];
          out[z * n + x] = Math.max(v, v + (p.level - v) * t);
        }
      }
      return out;
    },
  },
  // --- special effects ------------------------------------------------------
  {
    id: 'erode', label: 'Erode', group: 'effects', hint: 'Rain carves gullies and fills valleys with sediment', heavy: true,
    params: [
      { key: 'iterations', label: 'Iterations', min: 0.1, max: 4, default: 1, precision: 2, hint: 'Amount of rain (droplets per cell)' },
      { key: 'strength', label: 'Strength', min: 0.3, max: 4, default: 1.4, precision: 2, hint: 'How hard the water cuts' },
      { key: 'thermal', label: 'Talus', min: 0, max: 30, default: 3, step: 1, hint: 'Rockfall passes that soften steep slopes' },
    ],
    run: (src, n, p, seed, onProgress) => {
      const pre = src.slice();
      thermalErosionInPlace(pre, n, p.thermal, 5 / n, 0.4);
      return hydraulicErosion(pre, n, {
        density: 0.6 * p.iterations,
        seed,
        radius: 2.5 * Math.max(1, n / 512),
        heightGain: p.strength,
        onProgress,
      });
    },
  },
  {
    id: 'noise', label: 'Noise', group: 'effects', hint: 'Basic noise: rough, rocky surface everywhere',
    params: noiseParams(0.05),
    run: (src, n, p, seed) => addNoise(src, n, p, seed, () => 1),
  },
  {
    id: 'slopeNoise', label: 'Slope Noise', group: 'effects', hint: 'Roughen only the slopes: craggy cliffs, smooth flats',
    params: noiseParams(0.08),
    run: (src, n, p, seed) => {
      const s = slopeField(src, n);
      return addNoise(src, n, p, seed, (i) => Math.min(1, s[i]));
    },
  },
  {
    id: 'heightNoise', label: 'Height Noise', group: 'effects', hint: 'Roughen the heights: smooth valleys, jagged summits',
    params: noiseParams(0.08),
    run: (src, n, p, seed) => addNoise(src, n, p, seed, (i) => src[i] * src[i]),
  },
  {
    id: 'spikes', label: 'Spikes', group: 'effects', hint: 'Sprinkle spiky needles (distant conifers)',
    params: [
      { key: 'density', label: 'Density', min: 4, max: 96, default: 28, precision: 0, hint: 'Spikes across the terrain' },
      { key: 'height', label: 'Height', min: 0, max: 0.6, default: 0.12, precision: 3, hint: 'Spike height' },
      { key: 'coverage', label: 'Coverage', min: 0.05, max: 1, default: 0.55, precision: 2, hint: 'Fraction of cells with a spike' },
    ],
    run: (src, n, p, seed) => {
      const b = cellBumps(seed, n, p.density, p.coverage, [0.25, 0.5], (d) => Math.pow(1 - d, 2.5));
      for (let i = 0; i < b.length; i++) b[i] = src[i] + b[i] * p.height;
      return b;
    },
  },
  {
    id: 'mounds', label: 'Mounds', group: 'effects', hint: 'Add rounded boulders and towers',
    params: [
      { key: 'density', label: 'Density', min: 2, max: 48, default: 10, precision: 0, hint: 'Mounds across the terrain' },
      { key: 'height', label: 'Height', min: 0, max: 0.5, default: 0.1, precision: 3, hint: 'Mound height' },
      { key: 'coverage', label: 'Coverage', min: 0.05, max: 1, default: 0.6, precision: 2, hint: 'Fraction of cells with a mound' },
    ],
    run: (src, n, p, seed) => {
      const b = cellBumps(seed, n, p.density, p.coverage, [0.4, 0.9], (d) => Math.sqrt(1 - d * d));
      for (let i = 0; i < b.length; i++) b[i] = src[i] + b[i] * p.height;
      return b;
    },
  },
  {
    id: 'subplateaus', label: 'Subplateaus', group: 'effects', hint: 'Natural, slightly wavy terraces and ledges',
    params: [
      { key: 'steps', label: 'Steps', min: 2, max: 32, default: 9, step: 1, hint: 'Number of ledges' },
      { key: 'softness', label: 'Softness', min: 0, max: 1, default: 0.35, precision: 2, hint: 'Soft (1) or sheer (0) risers' },
      { key: 'wobble', label: 'Wobble', min: 0, max: 1, default: 0.5, precision: 2, hint: 'Irregular ledge heights' },
    ],
    run: (src, n, p, seed) => {
      const fbm = makeFbm(seed, 4, 0.5);
      const c = gridCoords(n);
      const rise = 0.04 + 0.9 * p.softness;
      const out = new Float32Array(src.length);
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++) {
          const i = z * n + x;
          const v = src[i];
          const t = (v + (p.wobble * 0.6 * fbm(c[x] * 3, c[z] * 3)) / p.steps) * p.steps;
          const fl = Math.floor(t);
          const stepped = (fl + smoothstep(1 - rise, 1, t - fl)) / p.steps;
          out[i] = stepped * 0.85 + v * 0.15;
        }
      }
      return out;
    },
  },
  {
    id: 'mosaic', label: 'Mosaic', group: 'effects', hint: 'Pixelate into blocks: an instant cityscape',
    params: [
      { key: 'blocks', label: 'Blocks', min: 4, max: 128, default: 32, step: 1, hint: 'Blocks across the terrain' },
      { key: 'streets', label: 'Streets', min: 0, max: 0.45, default: 0.12, precision: 2, hint: 'Gap between blocks (share of a block)' },
    ],
    run: (src, n, p) => {
      const b = n / p.blocks;
      const cells = Math.ceil(p.blocks);
      const sums = new Float64Array(cells * cells);
      const counts = new Uint32Array(cells * cells);
      const cellOf = (i: number) => Math.min(cells - 1, Math.floor(i / b));
      for (let z = 0; z < n; z++) {
        const cz = cellOf(z);
        for (let x = 0; x < n; x++) {
          const k = cz * cells + cellOf(x);
          sums[k] += src[z * n + x];
          counts[k]++;
        }
      }
      const out = new Float32Array(src.length);
      for (let z = 0; z < n; z++) {
        const cz = cellOf(z);
        const fz = z / b - cz;
        for (let x = 0; x < n; x++) {
          const cx = cellOf(x);
          const fx = x / b - cx;
          const k = cz * cells + cx;
          const avg = counts[k] ? sums[k] / counts[k] : 0;
          const street = p.streets > 0 && (fx < p.streets || fz < p.streets);
          out[z * n + x] = street ? avg * 0.82 : avg;
        }
      }
      return out;
    },
  },
  {
    id: 'sawtooth', label: 'Sawtooth', group: 'effects', hint: 'Jagged scarps: desert canyons and icebergs',
    params: [{ key: 'teeth', label: 'Teeth', min: 1, max: 12, default: 3, step: 1, hint: 'Number of scarps' }],
    run: (src, _n, p) =>
      mapEach(src, (v) => {
        const t = v * p.teeth;
        return (t - Math.floor(t)) * 0.55 + v * 0.45;
      }),
  },
  // --- data-driven (internal) ------------------------------------------------
  {
    id: 'curve', label: 'Filter', group: 'special', hint: 'Remap heights through the filter curve', rawParams: true, internal: true,
    params: [],
    run: (src, _n, p) => applyLUT(src, buildCurveLUT(paramsToCurve(p), 2048)),
  },
  {
    id: 'picture', label: 'Picture', group: 'special', hint: 'Blend a picture pattern into the terrain', rawParams: true, internal: true,
    params: [],
    run: (src, n, p) => {
      const def = patternByCode(p.pattern ?? 1);
      if (!def) return src.slice();
      let pic = renderPattern(def, n, resolveParams(def.params, p));
      if (p.soften > 0) pic = blurHeights(pic, n, Math.max(1, (p.soften / 100) * n), 2);
      if (p.invert) pic = mapEach(pic, (v) => 1 - v);
      return blendHeights(src, pic, p.mode ?? 0, 1);
    },
  },
  {
    id: 'blendGen', label: 'Generator', group: 'special', hint: 'Blend in a freshly generated terrain', rawParams: true, internal: true, heavy: true,
    params: [],
    run: (src, n, p, _seed, onProgress) => {
      const def = generatorByCode(p.g ?? 1);
      if (!def) return src.slice();
      const genParams: Params = {};
      for (const k of Object.keys(p)) if (k.startsWith('p_')) genParams[k.slice(2)] = p[k];
      return runGenerator(def.id, (p.s ?? 1) >>> 0, n, genParams, onProgress);
    },
  },
];

const byId = new Map(OP_DEFS.map((o) => [o.id, o]));
export const getOp = (id: string): OpDef | undefined => byId.get(id);

/**
 * Run an op: resolves params, fades by `amount`, clamps to 0..1. Unknown ops return a copy.
 * `params.seed` overrides the seed (recipes otherwise derive one per op).
 */
export function runOp(
  heights: Float32Array,
  n: number,
  op: string,
  params: Params | undefined,
  seed: number,
  onProgress?: (fraction: number) => void,
): Float32Array {
  const def = byId.get(op);
  if (!def || heights.length !== n * n || n < 2) return heights.slice();
  const p = def.rawParams ? { ...params } : resolveParams(def.params, params);
  const s = (typeof params?.seed === 'number' ? params.seed : seed) >>> 0;
  // Clamp before fading so a faded op equals lerp(input, full op) exactly (gradual drags).
  const out = clampHeightsInPlace(def.run(heights, n, p, subSeed(s, 0x0b5), onProgress));
  const amount = blendAmount(params);
  return amount < 1 ? lerpHeights(heights, out, amount, out) : out;
}
