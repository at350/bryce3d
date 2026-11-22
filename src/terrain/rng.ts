/**
 * Seeded randomness for terrain code. Self-contained (no three.js import) so the terrain
 * worker bundle stays small. Never use Math.random in generators or ops.
 */

/** mulberry32: a small, fast, deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash of (x, y, seed) to a uint32 (murmur-style finalizer). */
export function hash3(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** hash3 mapped to [0, 1). */
export function hash01(x: number, y: number, seed: number): number {
  return hash3(x, y, seed) / 4294967296;
}

/** Derive an independent seed for a sub-stream (e.g. the warp noise of a generator). */
export function subSeed(seed: number, salt: number): number {
  return hash3(seed, salt, 0x5bd1e995);
}
