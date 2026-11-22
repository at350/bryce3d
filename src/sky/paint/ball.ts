/** The sun / moon control ball and the moon phase icon. */
import { DEG, clamp, smoothstep, sunDirection } from '@/core/math';
import type { RGB, Sky } from '@/core/types';
import { mixRgb } from '../color';
import { resolveSkyLook } from '../model';

/**
 * Where a body at (azimuth, altitude) sits on the ball, in unit-disc coordinates (x right,
 * y down). The mapping is azimuthal-equidistant (zenith at the center, horizon on the
 * rim, angle from the zenith proportional to radius). That matches how rollSun() turns
 * pointer travel into rotation, so the highlight tracks the pointer.
 */
export function ballPosition(azimuth: number, altitude: number): { x: number; y: number } {
  const r = clamp((90 - altitude) / 90, 0, 2);
  const a = azimuth * DEG;
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
}

function spot(ctx: CanvasRenderingContext2D, x: number, y: number, core: number, halo: number, color: RGB, strength: number): void {
  const rgb = color.map((c) => Math.round(clamp(c, 0, 1) * 255)).join(',');
  const g = ctx.createRadialGradient(x, y, 0, x, y, halo);
  g.addColorStop(0, `rgba(${rgb},${0.7 * strength})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - halo, y - halo, halo * 2, halo * 2);
  const c = ctx.createRadialGradient(x - core * 0.25, y - core * 0.25, 0, x, y, core);
  c.addColorStop(0, `rgba(255,255,255,${strength})`);
  c.addColorStop(0.45, `rgba(${rgb},${strength})`);
  c.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = c;
  ctx.fillRect(x - core, y - core, core * 2, core * 2);
}

/**
 * A glossy ball showing the sky dome from above (center = zenith, rim = horizon,
 * 12 o'clock = azimuth 0, 3 o'clock = 90). The bright highlight is the sun; at night the
 * smaller, paler one is the moon (always opposite the sun) and the sun glows under the rim.
 */
export function paintSunBall(ctx: CanvasRenderingContext2D, size: number, sky: Sky): void {
  if (size < 2) return;
  const r = size / 2;
  const inner = r - 1;
  const day = sky.sunAltitude >= 0;
  const light = day ? sunDirection(sky.sunAzimuth, sky.sunAltitude) : sunDirection(sky.sunAzimuth + 180, -sky.sunAltitude);
  const lightColor = day ? sky.sunColor : mixRgb(sky.moonColor, [0.5, 0.6, 0.9], 0.3);
  const look = resolveSkyLook({ ...sky, sunAltitude: Math.max(sky.sunAltitude, 20) });
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5 - r) / inner;
      const v = (j + 0.5 - r) / inner;
      const q = u * u + v * v;
      if (q > 1.04) continue;
      const h = Math.sqrt(Math.max(0, 1 - q));
      // Broad light on the side of the ball facing the sun (or moon).
      const lit = Math.max(0, u * light[0] + h * light[1] + v * light[2]);
      const dome = mixRgb(look.horizon, look.zenith, Math.pow(h, 0.7));
      const rim = 0.7 + 0.3 * h;
      const o = (j * size + i) * 4;
      for (let k = 0; k < 3; k++) {
        const base = dome[k] * 0.38 + 0.035;
        const c = (base * (0.55 + lit * (day ? 1.1 : 0.6)) + lightColor[k] * lit * lit * (day ? 0.16 : 0.07)) * rim;
        data[o + k] = clamp(c, 0, 1) * 255;
      }
      data[o + 3] = smoothstep(1.04, 0.98, q) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, inner, 0, Math.PI * 2);
  ctx.clip();
  // Twilight: the sun glows just under the rim on its side of the sky.
  if (sky.sunAltitude > -12 && sky.sunAltitude < 8) {
    const p = ballPosition(sky.sunAzimuth, Math.max(0, sky.sunAltitude));
    const k = 1 - Math.abs(sky.sunAltitude - (-2)) / 10;
    spot(ctx, r + p.x * inner, r + p.y * inner, 0, inner * 0.7, mixRgb(sky.sunColor, [1, 0.55, 0.25], 0.5), clamp(k, 0, 1) * 0.8);
  }
  if (day) {
    const p = ballPosition(sky.sunAzimuth, sky.sunAltitude);
    const core = inner * (0.16 + (sky.sunSize / 100) * 0.14);
    const halo = core * (1.8 + (sky.sunGlow / 100) * 2.4);
    spot(ctx, r + p.x * inner * 0.97, r + p.y * inner * 0.97, core, halo, sky.sunColor, 1);
  } else {
    const p = ballPosition(sky.sunAzimuth + 180, -sky.sunAltitude);
    const core = inner * (0.11 + (sky.moonSize / 100) * 0.1);
    spot(ctx, r + p.x * inner * 0.97, r + p.y * inner * 0.97, core, core * 2.4, sky.moonColor, 0.9);
  }
  // Gloss: a soft window reflection on the upper left, as on Bryce's control balls.
  const gl = ctx.createRadialGradient(r * 0.72, r * 0.5, 0, r * 0.72, r * 0.5, r * 0.55);
  gl.addColorStop(0, 'rgba(255,255,255,0.28)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // Orientation tick at 12 o'clock ("ahead").
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(r - size * 0.05, size * 0.03);
  ctx.lineTo(r + size * 0.05, size * 0.03);
  ctx.lineTo(r, size * 0.1);
  ctx.closePath();
  ctx.fill();
}

/** A moon disc showing a phase (0 = new, 0.5 = full, 1 = new). */
export function paintMoonPhase(ctx: CanvasRenderingContext2D, size: number, phase: number, color: RGB): void {
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const r = size / 2 - 0.5;
  const c = Math.cos(phase * Math.PI * 2);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5 - size / 2) / r;
      const v = (j + 0.5 - size / 2) / r;
      const q = u * u + v * v;
      if (q > 1.05) continue;
      const w = Math.sqrt(Math.max(0, 1 - v * v));
      const lit = phase <= 0.5 ? u > c * w : u < -c * w;
      const shade = lit ? 0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - q)) : 0.12;
      const o = (j * size + i) * 4;
      for (let k = 0; k < 3; k++) data[o + k] = clamp(color[k] * shade, 0, 1) * 255;
      data[o + 3] = smoothstep(1.05, 0.95, q) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
