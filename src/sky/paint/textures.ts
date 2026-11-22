/** Cloud-layer texture tiles, star fields and the Sky Lab button glyph. */
import { clamp } from '@/core/math';
import type { CloudLayer, Sky } from '@/core/types';
import { css, mixRgb } from '../color';
import { cloudDensityAt, cloudParams, resolveSkyLook } from '../model';
import { hash01 } from '../noise';

/** World units shown across a cloud texture tile (fixed, so frequency visibly changes the pattern). */
const TEXTURE_SPAN = 6000;

/** Top-down view of a cloud layer's pattern (Bryce's cloud texture thumbnail). */
export function paintCloudTexture(ctx: CanvasRenderingContext2D, w: number, h: number, layer: CloudLayer, kind: 'stratus' | 'cumulus', sky: Sky): void {
  const look = resolveSkyLook({ ...sky, sunAltitude: Math.max(sky.sunAltitude, 25) });
  const bg = mixRgb(look.zenith, [0.2, 0.62, 0.72], 0.35);
  const params = cloudParams({ ...layer, enabled: true, cover: Math.max(layer.cover, 1) }, kind);
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const fade = layer.enabled ? 1 : 0.35;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = (i / w - 0.5) * TEXTURE_SPAN;
      const z = (j / h - 0.5) * TEXTURE_SPAN * (h / w);
      let a = 0;
      let thick = 0;
      if (params) {
        const s = cloudDensityAt(params, x, z);
        a = s.density * fade;
        thick = s.thick;
      }
      const shade = 1 - layer.shading * 0.6 * thick;
      const o = (j * w + i) * 4;
      for (let k = 0; k < 3; k++) {
        const c = bg[k] + (layer.color[k] * shade - bg[k]) * a;
        data[o + k] = clamp(c, 0, 1) * 255;
      }
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** A night sky square with stars (amount 0..100). */
export function paintStarsArt(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#02040e');
  g.addColorStop(1, '#141c3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const n = Math.round((amount / 100) * (w * h) * 0.02);
  for (let i = 0; i < n; i++) {
    const x = hash01(i, 1, 41) * w;
    const y = hash01(i, 2, 41) * h;
    const b = 0.4 + 0.6 * hash01(i, 3, 41);
    const s = hash01(i, 4, 41) > 0.93 ? 1.6 : 1;
    ctx.fillStyle = `rgba(255,255,${230 + Math.round(25 * b)},${b})`;
    ctx.fillRect(x, y, s * Math.max(1, w / 80), s * Math.max(1, w / 80));
  }
}

/** Bryce's Sky Lab glyph re-imagined: a rainbow arc behind a cloud puff. */
export function paintSkyLabGlyph(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.clearRect(0, 0, s, s);
  const bands = ['#ff4a4a', '#ff9a3a', '#ffe24a', '#5ad65a', '#4aa2ff', '#7a5aff'];
  const cx = s * 0.5;
  const cy = s * 0.72;
  const bw = s * 0.045;
  bands.forEach((col, i) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = bw + 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.4 - i * bw, Math.PI, Math.PI * 2);
    ctx.stroke();
  });
  const puff = (x: number, y: number, r: number) => {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#c8d2e4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  puff(s * 0.36, s * 0.72, s * 0.15);
  puff(s * 0.52, s * 0.64, s * 0.19);
  puff(s * 0.68, s * 0.73, s * 0.14);
  ctx.fillStyle = css([0.85, 0.89, 0.95]);
  ctx.fillRect(s * 0.3, s * 0.72, s * 0.42, s * 0.14);
}
