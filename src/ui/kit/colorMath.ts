/** Color helpers for the picker (pure; unit tested). */
import { clamp, hsvToRgb, rgbToHex, rgbToHsv } from '@/core/math';
import type { RGB } from '@/core/types';

export type HSV = [number, number, number];

/** Parse "#abc", "abc", "#aabbcc" or "aabbcc". Returns null when invalid. */
export function parseHex(text: string): RGB | null {
  const m = text.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(m)) return null;
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** HSV for a color, keeping `prevHue` for grays (whose hue is undefined) so the picker doesn't jump. */
export function toHsv(c: RGB, prevHue = 0): HSV {
  const [h, s, v] = rgbToHsv(c);
  return [s === 0 || v === 0 ? prevHue : h, s, v];
}

export function fromHsv(hsv: HSV): RGB {
  const [h, s, v] = hsv;
  return hsvToRgb(clamp(h, 0, 0.99999), clamp(s, 0, 1), clamp(v, 0, 1));
}

export const hexOf = (c: RGB) => rgbToHex(c);

/** Perceived brightness 0..1 (to pick a readable text color over a swatch). */
export function luminance(c: RGB): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export const sameColor = (a: RGB, b: RGB) =>
  Math.abs(a[0] - b[0]) < 1 / 512 && Math.abs(a[1] - b[1]) < 1 / 512 && Math.abs(a[2] - b[2]) < 1 / 512;

/** Handy swatches: neutrals, Bryce sky/sea blues, earth and sunset tones. */
export const HANDY_SWATCHES: RGB[] = [
  [1, 1, 1],
  [0.75, 0.76, 0.78],
  [0.45, 0.46, 0.5],
  [0.12, 0.12, 0.14],
  [0.55, 0.72, 0.95],
  [0.15, 0.3, 0.85],
  [0.08, 0.55, 0.6],
  [0.25, 0.6, 0.3],
  [0.85, 0.75, 0.5],
  [0.6, 0.35, 0.2],
  [0.95, 0.55, 0.15],
  [0.92, 0.2, 0.12],
  [1, 0.85, 0.3],
  [0.95, 0.5, 0.7],
  [0.55, 0.3, 0.8],
  [0.3, 0.12, 0.45],
];
