/**
 * Painted preset thumbnails (CPU sky painter: sea + sky, sun / moon, clouds, haze, stars),
 * cached as data URLs for the session. Instant and free of GPU work, so a lab can show a
 * whole category while its own live preview keeps the renderer busy.
 */
import type { Sky } from '@/core/types';
import { paintSkyView } from './paint/skyView';

const painted = new Map<string, string>();

/** A painted thumbnail for a sky, cached by `id` and size. Returns '' without a 2D canvas. */
export function paintedSkyThumbnail(id: string, sky: Sky, width = 96, height = 72): string {
  const key = `${id}@${width}x${height}`;
  const hit = painted.get(key);
  if (hit !== undefined) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  let url = '';
  if (ctx) {
    paintSkyView(ctx, width, height, sky, { pitch: 6, fov: 62 });
    url = canvas.toDataURL();
  }
  painted.set(key, url);
  return url;
}
