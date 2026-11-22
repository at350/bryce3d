/**
 * A canvas painted from CPU-generated RGBA pixels. Repaints when `source` changes, after
 * `delay` ms (debounced) or on the next frame, so dragging a control never queues work.
 */
import { useEffect, useRef } from 'react';

export interface PixelCanvasProps<T> {
  source: T;
  width: number;
  height: number;
  /** Must be a stable (module-level) function. */
  paint: (source: T, width: number, height: number) => Uint8ClampedArray<ArrayBuffer>;
  delay?: number;
  className?: string;
  label?: string;
}

export function PixelCanvas<T>({ source, width, height, paint, delay = 0, className = '', label }: PixelCanvasProps<T>) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const canvas = ref.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;
      ctx.putImageData(new ImageData(paint(source, width, height), width, height), 0, 0);
    };
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(draw);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [source, width, height, paint, delay]);
  return <canvas ref={ref} width={width} height={height} className={className} role="img" aria-label={label} />;
}
