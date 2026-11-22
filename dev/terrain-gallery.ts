/**
 * Dev-only gallery: every generator (and a few ops) as shaded relief maps, for tuning looks.
 * Query: ?res=256&seed=7&mode=gen|ops
 */
import { applyOp, createTerrainData, generateHeights, TERRAIN_GENERATORS, TERRAIN_OPS } from '@/terrain';

const q = new URLSearchParams(location.search);
const res = Number(q.get('res') ?? 256);
const seed = Number(q.get('seed') ?? 7);
const mode = q.get('mode') ?? 'gen';
const grid = document.getElementById('grid')!;

const RAMP: [number, number, number, number][] = [
  [0, 40, 70, 120], [0.12, 70, 130, 160], [0.16, 214, 200, 150], [0.3, 90, 140, 70],
  [0.55, 120, 110, 80], [0.78, 150, 140, 130], [0.9, 240, 240, 245], [1, 255, 255, 255],
];
function ramp(h: number): [number, number, number] {
  for (let i = 1; i < RAMP.length; i++) {
    if (h <= RAMP[i][0]) {
      const a = RAMP[i - 1];
      const b = RAMP[i];
      const t = (h - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
    }
  }
  return [255, 255, 255];
}

function tile(label: string, h: Float32Array, n: number, ms: number) {
  const fig = document.createElement('figure');
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(n, n);
  const k = (n - 1) * 0.35;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const gx = (h[z * n + Math.min(n - 1, x + 1)] - h[z * n + Math.max(0, x - 1)]) * k;
      const gz = (h[Math.min(n - 1, z + 1) * n + x] - h[Math.max(0, z - 1) * n + x]) * k;
      const len = Math.hypot(gx, gz, 1);
      const shade = Math.max(0.15, (gx * 0.6 + gz * 0.6 + 0.55) / len + 0.25);
      const c = ramp(h[i]);
      img.data[i * 4] = Math.min(255, c[0] * shade);
      img.data[i * 4 + 1] = Math.min(255, c[1] * shade);
      img.data[i * 4 + 2] = Math.min(255, c[2] * shade);
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const cap = document.createElement('figcaption');
  cap.textContent = `${label}  (${ms.toFixed(0)} ms)`;
  fig.append(cv, cap);
  grid.append(fig);
}

if (mode === 'gen') {
  for (const g of TERRAIN_GENERATORS) {
    const t0 = performance.now();
    const h = generateHeights(g.id, seed, res);
    tile(g.label, h, res, performance.now() - t0);
  }
} else {
  const base = createTerrainData('fractal', seed, res).heights;
  tile('base', base, res, 0);
  for (const o of TERRAIN_OPS) {
    const t0 = performance.now();
    const h = applyOp(base, res, o.id, {}, seed);
    tile(o.label, h, res, performance.now() - t0);
  }
}
(window as unknown as { __galleryDone: boolean }).__galleryDone = true;
