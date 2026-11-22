/** Draws heights into an ImageData: color ramp, optional relief shading, contours and clip tints. */
import type { DirtyRect } from '@/terrain';

export interface CanvasLook {
  lut: Uint8ClampedArray;
  contours: boolean;
  relief: boolean;
  clipLow: number;
  clipHigh: number;
  /** Contour color, RGB 0..255. */
  contourColor: [number, number, number];
}

const CONTOUR_LEVELS = 20;
const LOW_TINT = [214, 44, 52];
const HIGH_TINT = [246, 206, 40];

export function paintHeights(img: ImageData, h: Float32Array, n: number, look: CanvasLook, rect: DirtyRect | null): void {
  const d = img.data;
  const x0 = rect ? Math.max(0, rect.x0 - 1) : 0;
  const x1 = rect ? Math.min(n - 1, rect.x1 + 1) : n - 1;
  const z0 = rect ? Math.max(0, rect.z0 - 1) : 0;
  const z1 = rect ? Math.min(n - 1, rect.z1 + 1) : n - 1;
  const { lut, contours, relief, clipLow, clipHigh, contourColor } = look;
  const shadeK = (n - 1) * 0.18;
  const lowOn = clipLow > 0.0005;
  const highOn = clipHigh < 0.9995;
  for (let z = z0; z <= z1; z++) {
    const row = z * n;
    const up = (z > 0 ? z - 1 : z) * n;
    const down = (z < n - 1 ? z + 1 : z) * n;
    for (let x = x0; x <= x1; x++) {
      const i = row + x;
      const v = h[i];
      const li = (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0) * 4;
      let r = lut[li];
      let g = lut[li + 1];
      let b = lut[li + 2];
      if (relief) {
        const xl = x > 0 ? x - 1 : x;
        const xr = x < n - 1 ? x + 1 : x;
        const gx = (h[row + xr] - h[row + xl]) * shadeK;
        const gz = (h[down + x] - h[up + x]) * shadeK;
        let s = 1 + (gx + gz) * 0.6;
        s = s < 0.45 ? 0.45 : s > 1.35 ? 1.35 : s;
        r *= s;
        g *= s;
        b *= s;
      }
      if (contours && x < n - 1 && z < n - 1) {
        const c = Math.floor(v * CONTOUR_LEVELS);
        if (c !== Math.floor(h[i + 1] * CONTOUR_LEVELS) || c !== Math.floor(h[i + n] * CONTOUR_LEVELS)) {
          r = r * 0.35 + contourColor[0] * 0.65;
          g = g * 0.35 + contourColor[1] * 0.65;
          b = b * 0.35 + contourColor[2] * 0.65;
        }
      }
      if (lowOn && v < clipLow) {
        r = r * 0.45 + LOW_TINT[0] * 0.55;
        g = g * 0.45 + LOW_TINT[1] * 0.55;
        b = b * 0.45 + LOW_TINT[2] * 0.55;
      } else if (highOn && v > clipHigh) {
        r = r * 0.45 + HIGH_TINT[0] * 0.55;
        g = g * 0.45 + HIGH_TINT[1] * 0.55;
        b = b * 0.45 + HIGH_TINT[2] * 0.55;
      }
      const o = i * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
}
