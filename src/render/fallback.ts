/**
 * Canvas 2D stand-in used when WebGL2 or float render targets are unavailable (or the
 * shader failed): paints the sky gradient over a hazy ground so previews and the render
 * area still show the scene's mood instead of an empty box.
 */
import { rgbToHex } from '@/core/math';
import type { Scene } from '@/core/types';

export function paintFallback(scene: Scene, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const sky = scene.sky;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgbToHex(sky.zenithColor));
  g.addColorStop(0.5, rgbToHex(sky.horizonColor));
  g.addColorStop(0.52, rgbToHex(sky.hazeColor));
  g.addColorStop(1, '#2c3e48');
  ctx.globalCompositeOperation = 'copy';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}
