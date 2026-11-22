/** Small RGB helpers for sky data and the 2D sky painters (sRGB 0..1 triples). */
import { clamp, hexToRgb, hsvToRgb } from '@/core/math';
import type { RGB } from '@/core/types';

/** '#rrggbb' -> RGB (readable preset authoring). */
export const hex = (h: string): RGB => hexToRgb(h);

export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const scaleRgb = (a: RGB, s: number): RGB => [a[0] * s, a[1] * s, a[2] * s];

export const mulRgb = (a: RGB, b: RGB): RGB => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];

export const addRgb = (a: RGB, b: RGB): RGB => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const clampRgb = (a: RGB): RGB => [clamp(a[0], 0, 1), clamp(a[1], 0, 1), clamp(a[2], 0, 1)];

/** Perceived brightness (Rec. 709 weights on sRGB values; good enough for UI decisions). */
export const luma = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** HSV -> RGB with hue wrapped and s/v clamped. */
export const hsv = (h: number, s: number, v: number): RGB =>
  clampRgb(hsvToRgb(((h % 1) + 1) % 1, clamp(s, 0, 1), clamp(v, 0, 1)));

/** CSS rgb() string for canvas drawing. */
export function css(c: RGB, alpha = 1): string {
  const r = Math.round(clamp(c[0], 0, 1) * 255);
  const g = Math.round(clamp(c[1], 0, 1) * 255);
  const b = Math.round(clamp(c[2], 0, 1) * 255);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}

export const copyRgb = (c: RGB): RGB => [c[0], c[1], c[2]];
