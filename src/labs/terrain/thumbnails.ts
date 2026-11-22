/** Small cached relief thumbnails (data URLs) for generator and pattern buttons. */
import { generateHeights, PATTERNS, renderPattern } from '@/terrain';
import { getRamp, rampLUT } from './ramps';

const SIZE = 56;
const cache = new Map<string, string>();
let lut: Uint8ClampedArray | null = null;

/** Relief-shaded, color-ramped image of a heightfield as a PNG data URL. */
export function heightsToDataURL(h: Float32Array, n: number, gray = false): string {
  if (typeof document === 'undefined') return '';
  lut ??= rampLUT(getRamp('earth'));
  const grayLut = rampLUT(getRamp('gray'));
  const table = gray ? grayLut : lut;
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(n, n);
  const k = (n - 1) * 0.3;
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const gx = (h[z * n + Math.min(n - 1, x + 1)] - h[z * n + Math.max(0, x - 1)]) * k;
      const gz = (h[Math.min(n - 1, z + 1) * n + x] - h[Math.max(0, z - 1) * n + x]) * k;
      const s = gray ? 1 : Math.min(1.35, Math.max(0.45, 1 + (gx + gz) * 0.6));
      const li = Math.round(Math.min(1, Math.max(0, h[i])) * 255) * 4;
      img.data[i * 4] = table[li] * s;
      img.data[i * 4 + 1] = table[li + 1] * s;
      img.data[i * 4 + 2] = table[li + 2] * s;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL();
}

export function generatorThumb(id: string): string {
  const key = `g:${id}`;
  let url = cache.get(key);
  if (url === undefined) {
    url = id === 'flat' ? '' : heightsToDataURL(generateHeights(id, 11, SIZE), SIZE);
    cache.set(key, url);
  }
  return url;
}

export function patternThumb(id: string): string {
  const key = `p:${id}`;
  let url = cache.get(key);
  if (url === undefined) {
    const def = PATTERNS.find((p) => p.id === id);
    url = def ? heightsToDataURL(renderPattern(def, SIZE, Object.fromEntries(def.params.map((s) => [s.key, s.default]))), SIZE, true) : '';
    cache.set(key, url);
  }
  return url;
}
