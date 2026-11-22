/** Per-pixel painting of a small view of a sky over a calm sea (swatches, thumbnails). */
import { DEG, clamp } from '@/core/math';
import type { Sky } from '@/core/types';
import { hash01 } from '../noise';
import { makeSkySampler, resolveSkyLook } from '../model';

export interface SkyViewOptions {
  /** Camera pitch in degrees (positive looks up). Default 6. */
  pitch?: number;
  /** Vertical field of view in degrees. Default 64. */
  fov?: number;
  /** Paint a sea below the horizon (default true). */
  sea?: boolean;
  clouds?: boolean;
  stars?: boolean;
}

/** Paint the sky as seen from just above the water, looking toward azimuth 0. */
export function paintSkyView(ctx: CanvasRenderingContext2D, w: number, h: number, sky: Sky, opts: SkyViewOptions = {}): void {
  if (w < 1 || h < 1) return;
  const pitch = (opts.pitch ?? 6) * DEG;
  const tanHalf = Math.tan(((opts.fov ?? 64) * DEG) / 2);
  const aspect = w / h;
  const sample = makeSkySampler(sky, { clouds: opts.clouds });
  const look = resolveSkyLook(sky);
  const fy = Math.sin(pitch);
  const fz = -Math.cos(pitch);
  const uy = Math.cos(pitch);
  const uz = Math.sin(pitch);
  const fog = sky.mode === 'off' ? 0 : sky.fogDensity / 100;
  const fogReach = 0.5 + sky.fogHeight / 20;
  const tallFog = fog * clamp((sky.fogHeight - 4) / 30, 0, 1) * 0.75;
  const starAmt = opts.stars === false || sky.mode === 'off' ? 0 : sky.stars / 100;
  const deep = [look.zenith[0] * 0.25 + 0.02, look.zenith[1] * 0.3 + 0.05, look.zenith[2] * 0.35 + 0.08];
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const c = [0, 0, 0];
  for (let j = 0; j < h; j++) {
    const ny = (1 - (2 * (j + 0.5)) / h) * tanHalf;
    for (let i = 0; i < w; i++) {
      const nx = ((2 * (i + 0.5)) / w - 1) * tanHalf * aspect;
      let dx = nx;
      let dy = fy + ny * uy;
      let dz = fz + ny * uz;
      const len = Math.hypot(dx, dy, dz);
      dx /= len;
      dy /= len;
      dz /= len;
      if (dy >= 0 || opts.sea === false) {
        sample(dx, Math.max(dy, 0), dz, c);
        if (starAmt > 0 && dy > 0.04 && c[0] + c[1] + c[2] < 0.6) {
          const s = hash01(i, j, 7);
          if (s > 1 - starAmt * 0.035) {
            const k = (0.5 + hash01(j, i, 3) * 0.5) * (1 - (c[0] + c[1] + c[2]) / 0.6);
            c[0] += k;
            c[1] += k;
            c[2] += k;
          }
        }
        if (tallFog > 0) {
          const f = tallFog * Math.exp(-dy * 4);
          c[0] += (sky.fogColor[0] - c[0]) * f;
          c[1] += (sky.fogColor[1] - c[1]) * f;
          c[2] += (sky.fogColor[2] - c[2]) * f;
        }
      } else {
        // Calm sea: reflection of the sky, darker and bluer close to the viewer.
        sample(dx, -dy, dz, c);
        const near = clamp(-dy * 3, 0, 1);
        const refl = 0.75 - 0.45 * near;
        c[0] = c[0] * refl + deep[0] * (1 - refl);
        c[1] = c[1] * refl + deep[1] * (1 - refl);
        c[2] = c[2] * refl + deep[2] * (1 - refl);
        if (sky.haze > 0 && sky.mode !== 'off') {
          const band = Math.min(1, Math.exp(dy * 30) * (sky.haze / 100) * 0.9);
          c[0] += (sky.hazeColor[0] - c[0]) * band;
          c[1] += (sky.hazeColor[1] - c[1]) * band;
          c[2] += (sky.hazeColor[2] - c[2]) * band;
        }
        if (fog > 0) {
          const f = Math.min(0.97, fog * Math.exp((dy * 8) / fogReach) + tallFog);
          c[0] += (sky.fogColor[0] - c[0]) * f;
          c[1] += (sky.fogColor[1] - c[1]) * f;
          c[2] += (sky.fogColor[2] - c[2]) * f;
        }
      }
      const o = (j * w + i) * 4;
      data[o] = clamp(c[0], 0, 1) * 255;
      data[o + 1] = clamp(c[1], 0, 1) * 255;
      data[o + 2] = clamp(c[2], 0, 1) * 255;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
