/**
 * The Working window's light textured paper: a small seamless tile generated once
 * (soft mottling + fine grain + a few fibers), used as a CSS background.
 */
import { mulberry32 } from '@/core/math';
import { PAPER_CSS } from './palette';

let cached: string | null = null;

/** Data URL of a seamless 256 CSS-px paper tile (drawn at 2x for sharp grain). */
export function paperTexture(): string | null {
  if (cached !== null) return cached || null;
  cached = '';
  try {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(size, size);
    const rand = mulberry32(1994);
    // Low-frequency mottling from a tileable value-noise lattice.
    const cells = 8;
    const lattice = Array.from({ length: cells * cells }, () => rand());
    const at = (x: number, y: number) => lattice[((y % cells) + cells) % cells * cells + (((x % cells) + cells) % cells)];
    const smooth = (t: number) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const u = smooth(fx - ix);
        const v = smooth(fy - iy);
        const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * u;
        const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * u;
        const mottle = (a + (b - a) * v - 0.5) * 3.5;
        const grain = (rand() - 0.5) * 8;
        const base = 220 + mottle + grain;
        const i = (y * size + x) * 4;
        img.data[i] = base;
        img.data[i + 1] = base - 1;
        img.data[i + 2] = base - 6;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Faint fibers.
    ctx.lineWidth = 1;
    for (let i = 0; i < 140; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const a = rand() * Math.PI * 2;
      const len = 6 + rand() * 18;
      ctx.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,115,100,0.08)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.5, y + Math.sin(a + 0.6) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    cached = canvas.toDataURL('image/png');
    return cached;
  } catch {
    return null;
  }
}

export const PAPER_FALLBACK = PAPER_CSS;
