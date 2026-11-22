/** Helpers shared by the generator implementations. */
import { smoothstep } from './grid';
import { makeFbm } from './noise';

/** Normalized coordinate (-1..1) of each grid column/row. */
export function gridCoords(n: number): Float64Array {
  const c = new Float64Array(n);
  const inv = n > 1 ? 2 / (n - 1) : 0;
  for (let i = 0; i < n; i++) c[i] = i * inv - 1;
  return c;
}

/** 1 inside, falling to 0 within `width` of the square's border (normalized units). */
export function squareEdgeFade(u: number, v: number, width = 0.06): number {
  const d = Math.min(1 - Math.abs(u), 1 - Math.abs(v));
  return smoothstep(0, width, d);
}

/**
 * Island mask: 1 in the middle, 0 at the border, with a noise-wobbled coastline so the
 * outline is not a circle. strength 0 = no mask, 1 = full island.
 */
export function makeIslandMask(seed: number, inner = 0.3, outer = 0.98) {
  const coast = makeFbm(seed, 3, 0.5);
  return (u: number, v: number, strength: number): number => {
    if (strength <= 0) return 1;
    const r = Math.sqrt(u * u + v * v) * (1 + 0.24 * coast(u * 1.7 + 3.1, v * 1.7 - 1.7));
    const m = (1 - smoothstep(inner, outer, r)) * squareEdgeFade(u, v);
    return 1 - strength + strength * m;
  };
}

/** Raise to a power after clamping to >= 0 (shapes peaks: >1 sharpens, <1 rounds). */
export function shapePow(h: Float32Array, power: number): Float32Array {
  if (Math.abs(power - 1) < 1e-6) return h;
  for (let i = 0; i < h.length; i++) h[i] = Math.pow(h[i] > 0 ? h[i] : 0, power);
  return h;
}

/** Map values in place from their current 0..1 range into lo..hi. */
export function remapRange(h: Float32Array, lo: number, hi: number): Float32Array {
  const k = hi - lo;
  for (let i = 0; i < h.length; i++) h[i] = lo + h[i] * k;
  return h;
}
