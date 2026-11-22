/** Turning images and text into heightmaps in the browser (canvas 2D). */
import { rgbaToHeights } from '@/terrain';
import { blurHeights } from '@/terrain/grid';

export type PictureImage = ImageBitmap | HTMLImageElement;

export async function loadImageFile(file: File): Promise<PictureImage> {
  if (!file.type.startsWith('image/')) throw new Error('Not an image file');
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decoding (e.g. SVG files)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvas2d(n: number): CanvasRenderingContext2D {
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  return ctx;
}

/** Center-cropped square of the image, as heights at n x n. */
export function rasterizeImage(img: PictureImage, n: number): Float32Array {
  const ctx = canvas2d(n);
  const w = img.width;
  const h = img.height;
  const side = Math.min(w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, n, n);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, n, n);
  return rgbaToHeights(ctx.getImageData(0, 0, n, n).data, n * n);
}

/** White bold text on black, fitted to the square and softened so letters rise like mesas. */
export function rasterizeText(text: string, n: number): Float32Array {
  const ctx = canvas2d(n);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, n, n);
  const lines = text.trim().split(/\n/).slice(0, 4);
  const font = (px: number) => `900 ${px}px "Arial Black", Impact, system-ui, sans-serif`;
  let px = n * 0.5;
  ctx.font = font(px);
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  px = Math.min(px, (n * 0.86 * px) / widest, (n * 0.8) / (lines.length * 1.1));
  ctx.font = font(px);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, n / 2, n / 2 + (i - (lines.length - 1) / 2) * px * 1.1));
  const h = rgbaToHeights(ctx.getImageData(0, 0, n, n).data, n * n);
  return blurHeights(h, n, Math.max(1, n / 160), 2);
}
