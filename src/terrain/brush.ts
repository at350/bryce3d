/**
 * Terrain paintbrush (pure). A stroke is a series of dabs; each dab edits the heights in
 * place inside a circle. Sizes are fractions of the terrain width and dabs are spaced by
 * the brush radius, so painting feels the same at every grid resolution.
 */
import { smoothstep } from './grid';
import { makeFbm, type Noise2 } from './noise';

export type BrushMode = 'raise' | 'lower' | 'smooth' | 'roughen' | 'plateau' | 'erase';

export interface BrushSettings {
  mode: BrushMode;
  /** Radius as a fraction of the terrain width (0.004..0.5). */
  size: number;
  /** 0 = hard edge, 1 = feathered all the way to the center. */
  softness: number;
  /** 0..1: strength of each dab. */
  flow: number;
  /** Target height for plateau mode (0..1). */
  level: number;
}

export interface DirtyRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export const BRUSH_MODES: { id: BrushMode; label: string; hint: string }[] = [
  { id: 'raise', label: 'Raise', hint: 'Build up height (Alt: lower)' },
  { id: 'lower', label: 'Lower', hint: 'Dig down (Alt: raise)' },
  { id: 'smooth', label: 'Smooth', hint: 'Soften bumps and creases' },
  { id: 'roughen', label: 'Roughen', hint: 'Add rocky texture' },
  { id: 'plateau', label: 'Plateau', hint: 'Flatten toward the picked level (Space or Alt-click picks a height)' },
  { id: 'erase', label: 'Erase', hint: 'Wipe down to the floor' },
];

/** Radius in grid cells for a brush on an n x n grid. */
export const brushRadiusPx = (size: number, n: number) => Math.max(0.75, size * (n - 1));

/** Distance between dabs along a stroke, in grid cells. */
export const dabSpacingPx = (size: number, n: number) => Math.max(0.5, brushRadiusPx(size, n) * 0.22);

const noiseCache = new Map<number, Noise2>();
function roughNoise(seed: number): Noise2 {
  let f = noiseCache.get(seed);
  if (!f) {
    if (noiseCache.size > 8) noiseCache.clear();
    f = makeFbm(seed, 4, 0.55);
    noiseCache.set(seed, f);
  }
  return f;
}

/** Box-blurred copy of the dab's region (with margin) used by the smooth mode. */
function regionBlur(h: Float32Array, n: number, x0: number, z0: number, x1: number, z1: number, r: number): Float32Array {
  const w = x1 - x0 + 1;
  const hgt = z1 - z0 + 1;
  const out = new Float32Array(w * hgt);
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      let s = 0;
      let c = 0;
      for (let dz = -r; dz <= r; dz++) {
        const zz = z + dz;
        if (zz < 0 || zz >= n) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= n) continue;
          s += h[zz * n + xx];
          c++;
        }
      }
      out[(z - z0) * w + (x - x0)] = s / c;
    }
  }
  return out;
}

/** Apply one dab centered at grid coordinates (cx, cz). Mutates h; returns the touched rect. */
export function brushDab(h: Float32Array, n: number, cx: number, cz: number, b: BrushSettings, seed = 1): DirtyRect | null {
  const r = brushRadiusPx(b.size, n);
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(n - 1, Math.ceil(cx + r));
  const z0 = Math.max(0, Math.floor(cz - r));
  const z1 = Math.min(n - 1, Math.ceil(cz + r));
  if (x0 > x1 || z0 > z1) return null;
  const core = 1 - Math.min(1, Math.max(0, b.softness));
  const flow = Math.min(1, Math.max(0, b.flow));
  const blur = b.mode === 'smooth' ? regionBlur(h, n, x0, z0, x1, z1, Math.max(1, Math.round(r * 0.18))) : null;
  const noise = b.mode === 'roughen' ? roughNoise(seed) : null;
  const w = x1 - x0 + 1;
  const invR = 1 / r;
  const step = flow * 0.035;
  const noiseFreq = 40 / (n - 1);
  for (let z = z0; z <= z1; z++) {
    const dz = z - cz;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const d = Math.sqrt(dx * dx + dz * dz) * invR;
      if (d >= 1) continue;
      const fall = d <= core ? 1 : smoothstep(1, core, d);
      if (fall <= 0) continue;
      const i = z * n + x;
      const v = h[i];
      let nv = v;
      switch (b.mode) {
        case 'raise': nv = v + step * fall; break;
        case 'lower': nv = v - step * fall; break;
        case 'plateau': nv = v + (b.level - v) * flow * fall * 0.45; break;
        case 'erase': nv = v - v * flow * fall * 0.5; break;
        case 'smooth': nv = v + (blur![(z - z0) * w + (x - x0)] - v) * flow * fall * 0.7; break;
        case 'roughen': nv = v + noise!(x * noiseFreq, z * noiseFreq) * flow * fall * 0.03; break;
      }
      h[i] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
    }
  }
  return { x0, z0, x1, z1 };
}

/** Grow a dirty rect to include another. */
export function unionRect(a: DirtyRect | null, b: DirtyRect | null): DirtyRect | null {
  if (!a) return b;
  if (!b) return a;
  return { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) };
}

/**
 * Dab positions along a segment, spaced `spacing` apart, continuing the spacing left over
 * from the previous segment (`carry` = distance already travelled since the last dab).
 */
export function strokePoints(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  spacing: number,
  carry: number,
): { points: [number, number][]; carry: number } {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const points: [number, number][] = [];
  if (len === 0) return { points, carry };
  let t = spacing - carry;
  while (t <= len) {
    const f = t / len;
    points.push([x0 + (x1 - x0) * f, z0 + (z1 - z0) * f]);
    t += spacing;
  }
  return { points, carry: len - (t - spacing) };
}
