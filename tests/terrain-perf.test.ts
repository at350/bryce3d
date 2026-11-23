/**
 * Terrain performance smoke test. Logs timings for every generator and the heavy ops;
 * asserts only generous bounds so slow CI machines do not flake.
 */
import { describe, expect, it } from 'vitest';
import { applyOp, createTerrainData, generateHeights, TERRAIN_GENERATORS } from '@/terrain';

const time = (fn: () => void) => {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
};

describe('terrain performance', () => {
  // The loop benchmarks 15 generators at two resolutions; CI can take over 5 s in total
  // even when every generator meets the per-call limits below.
  it('generates every terrain quickly', { timeout: 20_000 }, () => {
    generateHeights('fractal', 1, 64); // warm up the JIT
    const rows: string[] = [];
    for (const g of TERRAIN_GENERATORS) {
      const t256 = time(() => generateHeights(g.id, 7, 256));
      const t512 = time(() => generateHeights(g.id, 7, 512));
      rows.push(`${g.id.padEnd(9)} 256: ${t256.toFixed(0).padStart(5)} ms   512: ${t512.toFixed(0).padStart(5)} ms`);
      if (!g.heavy && g.id !== 'random') expect(t256).toBeLessThan(400);
    }
    console.log(rows.join('\n'));
  });

  it('startup terrain is fast', () => {
    const t = time(() => createTerrainData('fractal', 1994));
    console.log(`createTerrainData default: ${t.toFixed(1)} ms`);
    expect(t).toBeLessThan(300);
  });

  it('erodes a 512 grid in reasonable time', () => {
    const h = generateHeights('fractal', 3, 512);
    const t = time(() => applyOp(h, 512, 'erode', {}, 5));
    console.log(`erode 512: ${t.toFixed(0)} ms`);
    expect(t).toBeLessThan(6000);
  });
});
