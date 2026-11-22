import { describe, expect, it } from 'vitest';
import {
  applyOp,
  applyOpToTerrain,
  applyLUT,
  blendHeights,
  brushDab,
  buildCurveLUT,
  changeResolution,
  createTerrainData,
  CURVE_PRESETS,
  curveToParams,
  generateHeights,
  heightsFromRecipe,
  identityCurve,
  normalizeHeights,
  OP_DEFS,
  paramsToCurve,
  PATTERNS,
  randomTerrainData,
  renderPattern,
  resampleHeights,
  reseedTerrain,
  rgbaToHeights,
  strokePoints,
  TERRAIN_GENERATORS,
  TERRAIN_OPS,
  withEditedHeights,
  type BrushSettings,
} from '@/terrain';

const N = 64;

function stats(h: Float32Array) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sq = 0;
  for (const v of h) {
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
    sq += v * v;
  }
  const mean = sum / h.length;
  return { min, max, mean, variance: sq / h.length - mean * mean };
}

const allFinite = (h: Float32Array) => h.every((v) => Number.isFinite(v));
const maxDiff = (a: Float32Array, b: Float32Array) => a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i])), 0);

describe('generators', () => {
  it('lists every generator with a label, ending with random', () => {
    const ids = TERRAIN_GENERATORS.map((g) => g.id);
    for (const id of ['fractal', 'ridged', 'hills', 'canyons', 'mesas', 'volcano', 'islands', 'dunes', 'craters', 'spikes', 'mounds', 'terraces', 'mosaic', 'eroded', 'random']) {
      expect(ids).toContain(id);
    }
    expect(ids[ids.length - 1]).toBe('random');
    expect(TERRAIN_GENERATORS.every((g) => g.label.length > 0)).toBe(true);
  });

  it.each(TERRAIN_GENERATORS.map((g) => g.id))('%s: deterministic, finite, in 0..1, not flat', (id) => {
    const a = generateHeights(id, 1234, N);
    const b = generateHeights(id, 1234, N);
    expect(a.length).toBe(N * N);
    expect(allFinite(a)).toBe(true);
    expect(Array.from(a)).toEqual(Array.from(b));
    const s = stats(a);
    expect(s.min).toBeGreaterThanOrEqual(0);
    expect(s.max).toBeLessThanOrEqual(1);
    expect(s.variance).toBeGreaterThan(1e-4);
  });

  it('different seeds give different terrains', () => {
    expect(maxDiff(generateHeights('fractal', 1, N), generateHeights('fractal', 2, N))).toBeGreaterThan(0.05);
  });

  it('looks alike across resolutions (frequency is resolution independent)', () => {
    const lo = generateHeights('fractal', 99, 64);
    const hi = resampleHeights(generateHeights('fractal', 99, 256), 256, 64);
    let num = 0;
    let da = 0;
    let db = 0;
    const ma = stats(lo).mean;
    const mb = stats(hi).mean;
    for (let i = 0; i < lo.length; i++) {
      num += (lo[i] - ma) * (hi[i] - mb);
      da += (lo[i] - ma) ** 2;
      db += (hi[i] - mb) ** 2;
    }
    expect(num / Math.sqrt(da * db)).toBeGreaterThan(0.9);
  });

  it('default terrain is an island: low edges, high middle', () => {
    const t = createTerrainData();
    const n = t.resolution;
    let edge = 0;
    for (let i = 0; i < n; i++) edge = Math.max(edge, t.heights[i], t.heights[(n - 1) * n + i], t.heights[i * n], t.heights[i * n + n - 1]);
    expect(edge).toBeLessThan(0.05);
    expect(stats(t.heights).max).toBeGreaterThan(0.95);
    expect(t.recipe?.generator).toBe('fractal');
    expect(t.clipLow).toBe(0);
    expect(t.clipHigh).toBe(1);
  });

  it('unknown generators fall back to fractal; tiny grids do not crash', () => {
    expect(Array.from(generateHeights('nope', 5, 16))).toEqual(Array.from(generateHeights('fractal', 5, 16)));
    expect(generateHeights('fractal', 5, 1).length).toBe(1);
  });

  it('randomTerrainData is deterministic for a seed and records a concrete generator', () => {
    const a = randomTerrainData(42, 64);
    const b = randomTerrainData(42, 64);
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(a.recipe?.generator).not.toBe('random');
    expect(Array.from(heightsFromRecipe(a.recipe!))).toEqual(Array.from(a.heights));
  });
});

describe('ops', () => {
  const base = generateHeights('fractal', 7, N);

  it('lists the user-facing ops with labels', () => {
    const ids = TERRAIN_OPS.map((o) => o.id);
    for (const id of ['smooth', 'sharpen', 'erode', 'invert', 'raiseLower', 'spikes', 'mounds', 'subplateaus', 'mosaic', 'squareEdges', 'roundEdges', 'gaussianEdges', 'noise', 'clip', 'contrast', 'scale', 'blur', 'equalize']) {
      expect(ids).toContain(id);
    }
    expect(ids).not.toContain('curve');
  });

  it.each(OP_DEFS.map((o) => o.id))('%s: deterministic, in range, input untouched', (id) => {
    const before = base.slice();
    const a = applyOp(base, N, id, {}, 3);
    const b = applyOp(base, N, id, {}, 3);
    expect(Array.from(base)).toEqual(Array.from(before));
    expect(a).not.toBe(base);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(allFinite(a)).toBe(true);
    expect(stats(a).min).toBeGreaterThanOrEqual(0);
    expect(stats(a).max).toBeLessThanOrEqual(1);
  });

  it('invert twice is the identity', () => {
    expect(maxDiff(applyOp(applyOp(base, N, 'invert'), N, 'invert'), base)).toBeLessThan(1e-6);
  });

  it('smooth and blur reduce roughness; sharpen increases it', () => {
    const rough = (h: Float32Array) => {
      let s = 0;
      for (let z = 0; z < N; z++) for (let x = 1; x < N; x++) s += Math.abs(h[z * N + x] - h[z * N + x - 1]);
      return s;
    };
    expect(rough(applyOp(base, N, 'smooth'))).toBeLessThan(rough(base));
    expect(rough(applyOp(base, N, 'blur'))).toBeLessThan(rough(applyOp(base, N, 'smooth')));
    expect(rough(applyOp(base, N, 'sharpen'))).toBeGreaterThan(rough(base));
  });

  it('amount fades an op in linearly', () => {
    const full = applyOp(base, N, 'invert');
    const half = applyOp(base, N, 'invert', { amount: 0.5 });
    for (let i = 0; i < base.length; i += 97) expect(half[i]).toBeCloseTo((base[i] + full[i]) / 2, 5);
    expect(maxDiff(applyOp(base, N, 'invert', { amount: 0 }), base)).toBeLessThan(1e-7);
  });

  it('raise/lower offsets and clamps', () => {
    const flat = new Float32Array(N * N).fill(0.95);
    expect(stats(applyOp(flat, N, 'raiseLower', { offset: 0.2 })).max).toBe(1);
    expect(applyOp(flat, N, 'raiseLower', { offset: -0.25 })[10]).toBeCloseTo(0.7, 5);
  });

  it('edge ops bring the border to the floor', () => {
    const flat = new Float32Array(N * N).fill(0.8);
    for (const id of ['squareEdges', 'roundEdges', 'gaussianEdges']) {
      const h = applyOp(flat, N, id);
      expect(h[0]).toBeLessThan(0.01);
      expect(h[N * (N >> 1)]).toBeLessThan(0.01);
      expect(h[(N >> 1) * N + (N >> 1)]).toBeGreaterThan(0.7);
    }
  });

  it('clip stretches the kept range to 0..1 and equalize fills the range', () => {
    const c = stats(applyOp(base, N, 'clip', { low: 0.3, high: 0.7 }));
    expect(c.min).toBe(0);
    expect(c.max).toBe(1);
    const e = stats(applyOp(applyOp(base, N, 'scale', { factor: 0.4 }), N, 'equalize'));
    expect(e.max).toBeGreaterThan(0.99);
  });

  it('posterize produces few distinct levels; mosaic produces blocks', () => {
    expect(new Set(applyOp(base, N, 'posterize', { steps: 5 })).size).toBeLessThanOrEqual(5);
    const m = applyOp(base, N, 'mosaic', { blocks: 8, streets: 0 });
    expect(m[0]).toBe(m[7 * N + 7]);
    expect(new Set(m).size).toBeLessThanOrEqual(64);
  });

  it('erode changes the terrain but keeps its overall shape', () => {
    const e = applyOp(base, N, 'erode', {}, 11);
    expect(maxDiff(e, base)).toBeGreaterThan(0.001);
    expect(Math.abs(stats(e).mean - stats(base).mean)).toBeLessThan(0.05);
  });

  it('unknown ops return a copy', () => {
    const c = applyOp(base, N, 'nope');
    expect(c).not.toBe(base);
    expect(Array.from(c)).toEqual(Array.from(base));
  });
});

describe('recipes', () => {
  it('heightsFromRecipe reproduces generated heights after ops', () => {
    let t = createTerrainData('ridged', 321, N, { frequency: 2 });
    t = applyOpToTerrain(t, 'erode', { iterations: 0.5 });
    t = applyOpToTerrain(t, 'noise');
    t = applyOpToTerrain(t, 'spikes', { amount: 0.5 });
    t = applyOpToTerrain(t, 'curve', curveToParams(CURVE_PRESETS.find((c) => c.id === 'mesa')!.curve));
    t = applyOpToTerrain(t, 'picture', { pattern: 4, mode: 1, amount: 0.7 });
    t = applyOpToTerrain(t, 'blendGen', { g: 6, s: 9, amount: 0.4 });
    expect(t.recipe!.ops.map((o) => o.op)).toEqual(['erode', 'noise', 'spikes', 'curve', 'picture', 'blendGen']);
    expect(Array.from(heightsFromRecipe(t.recipe!))).toEqual(Array.from(t.heights));
  });

  it('hand edits drop the recipe; ops on recipe-less terrains stay recipe-less', () => {
    const t = createTerrainData('fractal', 5, N);
    const painted = withEditedHeights(t, t.heights.slice());
    expect(painted.recipe).toBeUndefined();
    expect(applyOpToTerrain(painted, 'smooth').recipe).toBeUndefined();
  });

  it('changing resolution regenerates from the recipe, or resamples without one', () => {
    const t = createTerrainData('volcano', 5, 64);
    const up = changeResolution(t, 128);
    expect(up.resolution).toBe(128);
    expect(up.heights.length).toBe(128 * 128);
    expect(up.recipe!.resolution).toBe(128);
    const plain = changeResolution(withEditedHeights(t, t.heights), 128);
    expect(plain.recipe).toBeUndefined();
    expect(plain.heights[0]).toBeCloseTo(t.heights[0], 5);
  });

  it('reseeding keeps the recipe ops and changes the heights', () => {
    const t = applyOpToTerrain(createTerrainData('fractal', 5, N), 'smooth');
    const r = reseedTerrain(t, 6)!;
    expect(r.recipe!.ops).toEqual(t.recipe!.ops);
    expect(maxDiff(r.heights, t.heights)).toBeGreaterThan(0.01);
    expect(reseedTerrain(withEditedHeights(t, t.heights), 1)).toBeNull();
  });
});

describe('resample', () => {
  const ramp = (n: number) => {
    const h = new Float32Array(n * n);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) h[z * n + x] = (x / (n - 1)) * 0.6 + (z / (n - 1)) * 0.3;
    return h;
  };

  it('same size is a copy', () => {
    const h = ramp(16);
    const r = resampleHeights(h, 16, 16);
    expect(r).not.toBe(h);
    expect(Array.from(r)).toEqual(Array.from(h));
  });

  it('upsampling a linear ramp is exact and keeps corners', () => {
    const r = resampleHeights(ramp(16), 16, 61);
    expect(maxDiff(r, ramp(61))).toBeLessThan(1e-5);
  });

  it('constant fields stay constant both ways', () => {
    const c = new Float32Array(64 * 64).fill(0.37);
    expect(stats(resampleHeights(c, 64, 16)).max).toBeCloseTo(0.37, 5);
    expect(stats(resampleHeights(c, 64, 256)).min).toBeCloseTo(0.37, 5);
  });

  it('down then up approximately round-trips a smooth terrain', () => {
    const h = generateHeights('hills', 3, 128);
    const back = resampleHeights(resampleHeights(h, 128, 64), 64, 128);
    expect(maxDiff(back, h)).toBeLessThan(0.08);
  });

  it('normalizeHeights fills 0..1 and copes with flat input', () => {
    const s = stats(normalizeHeights(new Float32Array([0.2, 0.4, 0.3, 0.25])));
    expect(s.min).toBe(0);
    expect(s.max).toBe(1);
    expect(stats(normalizeHeights(new Float32Array(9).fill(0.5))).max).toBe(0);
  });
});

describe('filter curves', () => {
  it('identity curve leaves heights unchanged', () => {
    const h = generateHeights('fractal', 1, 32);
    expect(maxDiff(applyLUT(h, buildCurveLUT(identityCurve())), h)).toBeLessThan(1e-3);
  });

  it('round-trips through recipe params', () => {
    for (const p of CURVE_PRESETS) {
      const c = paramsToCurve(curveToParams(p.curve));
      expect(c.points.length).toBe(p.curve.points.length);
      expect(c.smooth).toBe(p.curve.smooth);
    }
  });

  it('monotone smoothing never overshoots: plateaus stay flat', () => {
    const lut = buildCurveLUT({ points: [{ x: 0, y: 0 }, { x: 0.4, y: 0.8 }, { x: 0.6, y: 0.8 }, { x: 1, y: 1 }], smooth: true }, 256);
    for (const v of lut) expect(v).toBeLessThanOrEqual(1);
    for (let i = 103; i < 153; i++) expect(lut[i]).toBeCloseTo(0.8, 5);
  });

  it('invert preset maps 0 to 1 and 1 to 0', () => {
    const lut = buildCurveLUT(CURVE_PRESETS.find((c) => c.id === 'invert')!.curve, 128);
    expect(lut[0]).toBeCloseTo(1, 5);
    expect(lut[127]).toBeCloseTo(0, 5);
  });
});

describe('pictures', () => {
  it('converts RGBA luminance to heights (alpha over black, optional invert)', () => {
    const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 0, 128, 128, 128, 255]);
    const h = rgbaToHeights(px, 4);
    expect(h[0]).toBeCloseTo(1, 5);
    expect(h[1]).toBe(0);
    expect(h[2]).toBe(0);
    expect(h[3]).toBeCloseTo(128 / 255, 3);
    expect(rgbaToHeights(px, 4, true)[0]).toBeCloseTo(0, 5);
  });

  it('blend modes combine as described', () => {
    const a = new Float32Array([0.2, 0.8]);
    const b = new Float32Array([0.6, 0.4]);
    expect(Array.from(blendHeights(a, b, 0, 1))).toEqual(Array.from(b));
    expect(blendHeights(a, b, 3)[0]).toBeCloseTo(0.6);
    expect(blendHeights(a, b, 4)[1]).toBeCloseTo(0.4);
    expect(blendHeights(a, b, 0, 0.5)[0]).toBeCloseTo(0.4);
  });

  it('every pattern renders in range', () => {
    for (const p of PATTERNS) {
      const h = renderPattern(p, 32, Object.fromEntries(p.params.map((s) => [s.key, s.default])));
      expect(stats(h).min).toBeGreaterThanOrEqual(0);
      expect(stats(h).max).toBeLessThanOrEqual(1);
      expect(stats(h).variance).toBeGreaterThan(0);
    }
  });
});

describe('brush', () => {
  const brush = (mode: BrushSettings['mode'], extra: Partial<BrushSettings> = {}): BrushSettings => ({ mode, size: 0.1, softness: 0.5, flow: 1, level: 0.5, ...extra });

  it('raise only touches the dab circle and reports it', () => {
    const h = new Float32Array(N * N);
    const r = brushDab(h, N, 32, 32, brush('raise'))!;
    expect(h[32 * N + 32]).toBeGreaterThan(0);
    expect(h[0]).toBe(0);
    expect(r.x0).toBeGreaterThan(20);
    expect(r.x1).toBeLessThan(44);
  });

  it('plateau pulls toward the level; erase pulls to zero; values stay in range', () => {
    const h = new Float32Array(N * N).fill(0.9);
    for (let k = 0; k < 40; k++) brushDab(h, N, 32, 32, brush('plateau', { level: 0.3 }));
    expect(h[32 * N + 32]).toBeCloseTo(0.3, 2);
    for (let k = 0; k < 60; k++) brushDab(h, N, 10, 10, brush('erase'));
    expect(h[10 * N + 10]).toBeLessThan(0.01);
    const up = new Float32Array(N * N).fill(0.99);
    for (let k = 0; k < 10; k++) brushDab(up, N, 32, 32, brush('raise'));
    expect(stats(up).max).toBeLessThanOrEqual(1);
  });

  it('smooth reduces a spike; roughen adds variation', () => {
    const h = new Float32Array(N * N);
    h[32 * N + 32] = 1;
    brushDab(h, N, 32, 32, brush('smooth'));
    expect(h[32 * N + 32]).toBeLessThan(0.9);
    const flat = new Float32Array(N * N).fill(0.5);
    brushDab(flat, N, 32, 32, brush('roughen'), 9);
    expect(stats(flat).variance).toBeGreaterThan(0);
  });

  it('stroke points are evenly spaced and carry over between segments', () => {
    const a = strokePoints(0, 0, 10, 0, 3, 0);
    expect(a.points.map((p) => p[0])).toEqual([3, 6, 9]);
    const b = strokePoints(10, 0, 20, 0, 3, a.carry);
    expect(b.points[0][0]).toBeCloseTo(12);
  });
});
