/**
 * Little live illustrations for the Sky & Fog palette thumbnails. Each painter draws
 * proportionally into a w x h device-pixel area so it works at any size / DPR.
 */
import { DEG, clamp, smoothstep, sunDirection } from '@/core/math';
import type { CloudLayer, RGB, Sky } from '@/core/types';
import { css, mixRgb, scaleRgb } from '../color';
import { resolveSkyLook } from '../model';
import { fbm } from '../noise';

function skyBackdrop(ctx: CanvasRenderingContext2D, w: number, sky: Sky, horizonY: number): void {
  const look = resolveSkyLook(sky);
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, css(look.zenith));
  g.addColorStop(1, css(look.horizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizonY + 1);
}

/** Rolling hills silhouette across the width (deterministic). */
function hills(ctx: CanvasRenderingContext2D, w: number, baseY: number, amp: number, seed: number, color: string, bottom: number): void {
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const n = fbm(i * 0.35 + seed, seed * 1.7, 3, 0.5, seed);
    ctx.lineTo(x, baseY - (n - 0.3) * amp);
  }
  ctx.lineTo(w, bottom);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Shadows (x) and ambient light (y): a ball on the ground lit by the actual sun direction. */
export function paintShadowsArt(ctx: CanvasRenderingContext2D, w: number, h: number, sky: Sky): void {
  const horizonY = h * 0.42;
  skyBackdrop(ctx, w, sky, horizonY);
  const look = resolveSkyLook(sky);
  const ground = mixRgb([0.72, 0.7, 0.64], look.horizon, 0.25);
  const gg = ctx.createLinearGradient(0, horizonY, 0, h);
  gg.addColorStop(0, css(scaleRgb(ground, 0.85)));
  gg.addColorStop(1, css(ground));
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // Light direction (day: sun, night: moon). The view looks toward -Z, so world axes are
  // view axes: x right, y up, z toward the viewer.
  const night = sky.sunAltitude < 0;
  const L = sunDirection(sky.sunAzimuth + (night ? 180 : 0), Math.abs(sky.sunAltitude));
  const lightColor: RGB = night ? scaleRgb(sky.moonColor, 0.55) : sky.sunColor;
  const r = Math.min(w, h) * 0.26;
  const cx = w * 0.5;
  const cy = h * 0.62;
  const shadowK = sky.shadowIntensity / 100;
  const ambientK = sky.ambient / 100;

  // Cast shadow on the ground, away from the light, longer when the light is low.
  const altR = Math.max(4, Math.abs(sky.sunAltitude)) * DEG;
  const len = clamp(1 / Math.tan(altR), 0, 3.2) * r * 0.8;
  const hx = -L[0];
  const hz = -L[2];
  const sx = cx + hx * len * 0.5;
  const sy = cy + r * 0.85 + hz * len * 0.18;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.atan2(hz * 0.35, hx || 1e-6));
  ctx.scale(1 + (len / r) * 0.45, 0.32);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  sg.addColorStop(0, `rgba(10,12,24,${0.85 * shadowK})`);
  sg.addColorStop(1, 'rgba(10,12,24,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Shaded ball (per pixel: Lambert + ambient fill + a highlight), drawn on a scratch
  // canvas with an alpha edge and composited, so the main canvas is never read back.
  const size = Math.ceil(r * 2) + 2;
  const ball = scratchCanvas(size);
  const bctx = ball.getContext('2d');
  if (!bctx) return;
  const img = bctx.createImageData(size, size);
  const data = img.data;
  const base: RGB = [0.82, 0.8, 0.78];
  const fill = (1 - shadowK) * 0.35 + ambientK * 0.55;
  const c0 = size / 2;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5 - c0) / r;
      const v = (j + 0.5 - c0) / r;
      const q = u * u + v * v;
      if (q > 1) continue;
      const nz = Math.sqrt(1 - q);
      const lam = Math.max(0, u * L[0] - v * L[1] + nz * L[2]);
      const spec = Math.pow(lam, 30) * 0.6;
      const o = (j * size + i) * 4;
      for (let k = 0; k < 3; k++) data[o + k] = clamp(base[k] * (lightColor[k] * lam * 0.95 + sky.ambientColor[k] * fill) + spec * lightColor[k], 0, 1) * 255;
      data[o + 3] = smoothstep(1, 0.92, q) * 255;
    }
  }
  bctx.putImageData(img, 0, 0);
  ctx.drawImage(ball, 0, 0, size, size, cx - c0, cy - c0, size, size);
}

let scratch: HTMLCanvasElement | null = null;

/** A reusable offscreen canvas at least `size` square, cleared. */
function scratchCanvas(size: number): HTMLCanvasElement {
  scratch ??= document.createElement('canvas');
  if (scratch.width < size || scratch.height < size) {
    scratch.width = size;
    scratch.height = size;
  } else {
    scratch.getContext('2d')?.clearRect(0, 0, scratch.width, scratch.height);
  }
  return scratch;
}

/** Fog: density (x) as opacity, height (y) as how far up the hills it climbs. */
export function paintFogArt(ctx: CanvasRenderingContext2D, w: number, h: number, sky: Sky): void {
  const horizonY = h * 0.55;
  skyBackdrop(ctx, w, sky, horizonY);
  const look = resolveSkyLook(sky);
  hills(ctx, w, horizonY, h * 0.5, 3, css(mixRgb(scaleRgb(look.horizon, 0.55), [0.3, 0.36, 0.42], 0.5)), h);
  hills(ctx, w, h * 0.78, h * 0.45, 9, css(mixRgb(scaleRgb(look.horizon, 0.35), [0.2, 0.26, 0.2], 0.6)), h);
  const density = sky.fogDensity / 100;
  if (density <= 0) return;
  const top = h - h * (0.1 + 0.85 * Math.sqrt(sky.fogHeight / 100));
  const g = ctx.createLinearGradient(0, top - h * 0.08, 0, h);
  g.addColorStop(0, css(sky.fogColor, 0));
  g.addColorStop(0.25, css(sky.fogColor, 0.75 * density));
  g.addColorStop(1, css(sky.fogColor, Math.min(1, 1.05 * density)));
  ctx.fillStyle = g;
  ctx.fillRect(0, top - h * 0.08, w, h - top + h * 0.08);
}

/** Haze: a glowing band of hazeColor along the horizon, wider and stronger with the value. */
export function paintHazeArt(ctx: CanvasRenderingContext2D, w: number, h: number, sky: Sky): void {
  const horizonY = h * 0.6;
  skyBackdrop(ctx, w, sky, horizonY);
  const look = resolveSkyLook(sky);
  const sea = ctx.createLinearGradient(0, horizonY, 0, h);
  sea.addColorStop(0, css(mixRgb(look.horizon, [0.1, 0.25, 0.35], 0.45)));
  sea.addColorStop(1, css(mixRgb(look.zenith, [0.02, 0.08, 0.14], 0.6)));
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizonY, w, h - horizonY);
  // A far island so the haze has something to swallow.
  ctx.fillStyle = css(mixRgb(look.zenith, [0.15, 0.2, 0.25], 0.6));
  ctx.beginPath();
  ctx.moveTo(w * 0.52, horizonY);
  ctx.quadraticCurveTo(w * 0.68, horizonY - h * 0.2, w * 0.86, horizonY);
  ctx.fill();
  const haze = sky.haze / 100;
  if (haze <= 0) return;
  const band = h * (0.08 + 0.45 * haze);
  const g = ctx.createLinearGradient(0, horizonY - band, 0, horizonY + band * 0.6);
  g.addColorStop(0, css(sky.hazeColor, 0));
  g.addColorStop(0.62, css(sky.hazeColor, Math.min(1, 0.25 + haze * 0.85)));
  g.addColorStop(1, css(sky.hazeColor, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, horizonY - band, w, band * 1.6);
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: RGB, shading: number): void {
  const blobs: [number, number, number][] = [[-0.55, 0.1, 0.42], [0, -0.15, 0.6], [0.55, 0.05, 0.45], [0.2, 0.2, 0.45], [-0.25, 0.22, 0.4]];
  for (const [bx, by, br] of blobs) {
    const g = ctx.createRadialGradient(x + bx * s, y + (by - 0.15) * s, 0, x + bx * s, y + by * s, br * s);
    g.addColorStop(0, css(color));
    g.addColorStop(1, css(scaleRgb(color, 1 - shading * 0.45)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + bx * s, y + by * s, br * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Cloud height: the layers drawn at their altitude (higher = smaller and further up). */
export function paintCloudHeightArt(ctx: CanvasRenderingContext2D, w: number, h: number, sky: Sky): void {
  const groundY = h * 0.86;
  skyBackdrop(ctx, w, sky, groundY);
  const look = resolveSkyLook(sky);
  ctx.fillStyle = css(mixRgb(look.horizon, [0.25, 0.3, 0.28], 0.6));
  ctx.fillRect(0, groundY, w, h - groundY);
  const yFor = (height: number) => groundY - h * (0.12 + 0.72 * Math.sqrt(clamp((height - 100) / 2900, 0, 1)));
  const st = sky.stratus;
  if (st.enabled) {
    const y = yFor(st.height);
    ctx.strokeStyle = css(st.color, 0.85);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, h * 0.05);
    for (let i = 0; i < 3; i++) {
      const x = w * (0.12 + i * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, y + (i % 2) * h * 0.06);
      ctx.lineTo(x + w * 0.22, y + (i % 2) * h * 0.06 - h * 0.02);
      ctx.stroke();
    }
  }
  const cu = sky.cumulus;
  if (cu.enabled) {
    const y = yFor(cu.height);
    const s = h * (0.2 - 0.09 * clamp((cu.height - 100) / 2900, 0, 1));
    puff(ctx, w * 0.3, y, s, cu.color, cu.shading);
    puff(ctx, w * 0.72, y + h * 0.04, s * 0.85, cu.color, cu.shading);
  }
}

/**
 * Frequency (x) and amplitude (y): a cross-section of the cloud field. More frequency =
 * more, narrower bumps; more amplitude = taller, sharper ones.
 */
export function paintFreqAmpArt(ctx: CanvasRenderingContext2D, w: number, h: number, sky: Sky, layer: CloudLayer): void {
  const look = resolveSkyLook(sky);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(look.zenith));
  g.addColorStop(1, css(look.horizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const base = h * 0.82;
  const f = 0.6 + (layer.frequency / 400) * 9;
  const amp = clamp(layer.amplitude / 400, 0, 1);
  const sharp = 1 + amp * 2.5;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const steps = Math.max(24, Math.floor(w / 2));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const n = fbm(u * f + 3.1, 0.7, 3, 0.45, 5);
    const bump = Math.pow(clamp((n - 0.3) / 0.5, 0, 1), sharp);
    ctx.lineTo(u * w, base - bump * h * (0.15 + 0.65 * amp));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = css(layer.color, 0.95);
  ctx.fill();
  ctx.strokeStyle = css(scaleRgb(layer.color, 0.6), 0.8);
  ctx.lineWidth = Math.max(1, h / 40);
  ctx.stroke();
}
