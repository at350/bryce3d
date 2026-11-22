/**
 * 2D stand-in thumbnails for when the ray tracer is unavailable: a lit ball for materials,
 * a gradient with a sun for skies and scenes, flat silhouettes for object groups.
 */
import { rgbToHex } from '@/core/math';
import type { Material, RGB, SceneObject, Sky } from '@/core/types';
import { objectBounds } from '@/scenes/build/placement';

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, k: number): string => rgbToHex([Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)]);

/** The color a material mostly shows (its texture's middle stop when the diffuse channel is textured). */
export function materialSwatchColor(m: Material): RGB {
  const d = m.drivers.diffuseColor;
  const comp = d !== undefined && d >= 0 ? m.components[d] : undefined;
  if (comp?.gradient.length) return comp.gradient[Math.floor(comp.gradient.length / 2)].color;
  if (m.ambience > 70) return m.ambientColor;
  return m.diffuseColor;
}

export function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number, sky: Sky, horizon = 0.62, sea: RGB = [0.1, 0.2, 0.3]): void {
  const hy = Math.round(h * horizon);
  const g = ctx.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, rgbToHex(sky.zenithColor));
  g.addColorStop(1, rgbToHex(sky.horizonColor));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, hy);
  const s = ctx.createLinearGradient(0, hy, 0, h);
  s.addColorStop(0, rgbToHex(mix(sea, sky.horizonColor, 0.4)));
  s.addColorStop(1, shade(sea, 0.6));
  ctx.fillStyle = s;
  ctx.fillRect(0, hy, w, h - hy);
  if (sky.sunAltitude > -5) {
    const az = ((sky.sunAzimuth + 180) % 360) - 180;
    const x = w / 2 + (az / 60) * w;
    const y = hy - (Math.max(0, sky.sunAltitude) / 50) * hy;
    const r = 2 + sky.sunSize / 14;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
    glow.addColorStop(0, rgbToHex(sky.sunColor));
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
}

export function paintMaterialBall(ctx: CanvasRenderingContext2D, w: number, h: number, m: Material): void {
  const cell = Math.max(6, Math.round(w / 8));
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = (x / cell + y / cell) % 2 ? '#6b6d72' : '#a9abb0';
      ctx.fillRect(x, y, cell, cell);
    }
  }
  const c = materialSwatchColor(m);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;
  const reflective = m.reflection / 100;
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
  g.addColorStop(0, shade(mix(c, [1, 1, 1], 0.35 + reflective * 0.3), 1.15));
  g.addColorStop(0.55, shade(c, 0.95));
  g.addColorStop(1, shade(mix(c, [0.1, 0.12, 0.2], reflective * 0.5), 0.45));
  ctx.globalAlpha = 1 - (m.transparency / 100) * 0.6;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function paintObjects(ctx: CanvasRenderingContext2D, w: number, h: number, objects: SceneObject[]): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#9fb6dc');
  g.addColorStop(0.7, '#dfe6ef');
  g.addColorStop(0.7, '#a9aaa8');
  g.addColorStop(1, '#7f807e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const boxes = objects.map((o) => ({ o, b: objectBounds(o) })).filter((x) => x.b);
  if (!boxes.length) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { b } of boxes) {
    minX = Math.min(minX, b!.min[0]);
    maxX = Math.max(maxX, b!.max[0]);
    maxY = Math.max(maxY, b!.max[1]);
  }
  const span = Math.max(maxX - minX, maxY, 1);
  const k = (Math.min(w, h) * 0.8) / span;
  const ground = h * 0.85;
  boxes
    .sort((a, b) => a.b!.min[2] - b.b!.min[2])
    .forEach(({ o, b }) => {
      const x0 = w / 2 + (b!.min[0] - (minX + maxX) / 2) * k;
      const x1 = w / 2 + (b!.max[0] - (minX + maxX) / 2) * k;
      const y0 = ground - b!.max[1] * k;
      const y1 = ground - b!.min[1] * k;
      ctx.fillStyle = shade(materialSwatchColor(o.material), 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      if (o.type === 'sphere' || o.type === 'stone' || o.type === 'tree') ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.max(1, (x1 - x0) / 2), Math.max(1, (y1 - y0) / 2), 0, 0, Math.PI * 2);
      else ctx.rect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
      ctx.fill();
      ctx.stroke();
    });
}
