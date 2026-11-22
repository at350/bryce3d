/** A small canvas repainted (at most once per frame) whenever its paint function changes. */
import { useEffect, useRef } from 'react';

export type PaintFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export interface PaintCanvasProps {
  /** CSS size. */
  width: number;
  height: number;
  /** Draws into the canvas in device pixels. Memoize it: a new identity means "repaint". */
  paint: PaintFn;
  /** Cap on the device-pixel ratio (per-pixel painters use 1 to stay cheap). */
  maxDpr?: number;
  className?: string;
}

export function PaintCanvas({ width, height, paint, maxDpr = 2, className = '' }: PaintCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = Math.min(maxDpr, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const pw = Math.max(1, Math.round(width * dpr));
  const ph = Math.max(1, Math.round(height * dpr));
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      paint(ctx, pw, ph);
    });
    return () => cancelAnimationFrame(frame);
  }, [paint, pw, ph]);
  return <canvas ref={ref} className={`sky-paint ${className}`} width={pw} height={ph} style={{ width, height }} aria-hidden="true" />;
}
