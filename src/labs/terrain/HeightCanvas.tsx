/**
 * The Terrain Canvas: a top view of the heightfield you can paint on. Rendering and painting
 * bypass React state (the HeightBus carries the pixels) so strokes stay smooth at 1024^2.
 */
import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react';
import {
  brushDab,
  dabSpacingPx,
  strokePoints,
  unionRect,
  type BrushSettings,
  type DirtyRect,
} from '@/terrain';
import { capturePointer } from './capture';
import { paintHeights, type CanvasLook } from './canvasPaint';
import type { HeightBus } from './heightBus';

interface Props {
  bus: HeightBus;
  look: CanvasLook;
  brush: BrushSettings;
  showBrush: boolean;
  /** True while the space bar is held: clicks pick a height instead of painting. */
  pickingRef: MutableRefObject<boolean>;
  /** Returns the array to paint into (a fresh copy of the terrain), or null if painting is blocked. */
  onStrokeStart(): Float32Array | null;
  onStrokeEnd(buffer: Float32Array): void;
  onPick(level: number): void;
  /** Element whose text shows the height under the pointer. */
  readoutRef: MutableRefObject<HTMLElement | null>;
  onDropFile?(file: File): void;
  children?: ReactNode;
}

export function HeightCanvas({ bus, look, brush, showBrush, pickingRef, onStrokeStart, onStrokeEnd, onPick, readoutRef, onDropFile, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<ImageData | null>(null);
  const lookRef = useRef(look);
  lookRef.current = look;
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const pendingRef = useRef<{ full: boolean; rect: DirtyRect | null; raf: number }>({ full: true, rect: null, raf: 0 });
  const scheduleRef = useRef<((rect: DirtyRect | null) => void) | null>(null);

  // Redraw scheduling: dirty rects from the bus are merged and painted once per frame.
  useEffect(() => {
    const pending = pendingRef.current;
    const draw = () => {
      pending.raf = 0;
      const cv = canvasRef.current;
      const ctx = cv?.getContext('2d');
      if (!cv || !ctx) return;
      const { heights, n } = bus.frame;
      if (cv.width !== n || cv.height !== n) {
        cv.width = n;
        cv.height = n;
        pending.full = true;
      }
      if (!imgRef.current || imgRef.current.width !== n) {
        imgRef.current = ctx.createImageData(n, n);
        pending.full = true;
      }
      const rect = pending.full ? null : pending.rect;
      paintHeights(imgRef.current, heights, n, lookRef.current, rect);
      if (rect) {
        const x0 = Math.max(0, rect.x0 - 1);
        const z0 = Math.max(0, rect.z0 - 1);
        ctx.putImageData(imgRef.current, 0, 0, x0, z0, Math.min(n, rect.x1 + 2) - x0, Math.min(n, rect.z1 + 2) - z0);
      } else ctx.putImageData(imgRef.current, 0, 0);
      pending.full = false;
      pending.rect = null;
    };
    const schedule = (rect: DirtyRect | null) => {
      if (rect) pending.rect = unionRect(pending.rect, rect);
      else pending.full = true;
      if (!pending.raf) pending.raf = requestAnimationFrame(draw);
    };
    let lastHeights = bus.frame.heights;
    scheduleRef.current = schedule;
    schedule(null);
    const unsub = bus.subscribe((f) => {
      schedule(f.heights === lastHeights ? f.dirty : null);
      lastHeights = f.heights;
    });
    return () => {
      unsub();
      scheduleRef.current = null;
      cancelAnimationFrame(pending.raf);
      pending.raf = 0;
    };
  }, [bus]);

  // Any change of the look repaints everything.
  useEffect(() => {
    scheduleRef.current?.(null);
  }, [look]);

  const toGrid = (e: { clientX: number; clientY: number }) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const n = bus.frame.n;
    return {
      x: ((e.clientX - r.left) / Math.max(1, r.width)) * (n - 1),
      z: ((e.clientY - r.top) / Math.max(1, r.height)) * (n - 1),
      px: e.clientX - r.left,
      py: e.clientY - r.top,
    };
  };

  const heightAt = (x: number, z: number) => {
    const { heights, n } = bus.frame;
    const xi = Math.min(n - 1, Math.max(0, Math.round(x)));
    const zi = Math.min(n - 1, Math.max(0, Math.round(z)));
    return heights[zi * n + xi];
  };

  const moveCursor = (px: number, py: number, x: number, z: number) => {
    const el = cursorRef.current;
    const cv = canvasRef.current;
    if (el && cv) {
      const b = brushRef.current;
      const d = b.size * 2 * cv.clientWidth;
      el.style.width = `${d}px`;
      el.style.height = `${d}px`;
      el.style.setProperty('--core', `${Math.max(0, 1 - b.softness) * 100}%`);
      el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
      el.style.opacity = showBrush ? '1' : '0';
      el.classList.toggle('is-picking', pickingRef.current);
    }
    const n = bus.frame.n;
    if (readoutRef.current && x >= 0 && z >= 0 && x <= n - 1 && z <= n - 1) {
      readoutRef.current.textContent = `x ${Math.round(x)}  z ${Math.round(z)}  height ${(heightAt(x, z) * 100).toFixed(1)}%`;
    }
  };

  const strokeRef = useRef<{ buf: Float32Array; lx: number; lz: number; ox: number; oz: number; carry: number; seed: number; alt: boolean; shift: boolean } | null>(null);
  const strokeCount = useRef(1);

  const settingsFor = (alt: boolean): BrushSettings => {
    const b = brushRef.current;
    if (!alt) return b;
    if (b.mode === 'raise') return { ...b, mode: 'lower' };
    if (b.mode === 'lower') return { ...b, mode: 'raise' };
    return b;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const g = toGrid(e);
    const pickWithAlt = e.altKey && brushRef.current.mode === 'plateau';
    if (pickingRef.current || pickWithAlt) {
      onPick(heightAt(g.x, g.z));
      return;
    }
    const buf = onStrokeStart();
    if (!buf) return;
    capturePointer(e.currentTarget, e.pointerId);
    const seed = strokeCount.current++;
    const n = bus.frame.n;
    const rect = brushDab(buf, n, g.x, g.z, settingsFor(e.altKey), seed);
    strokeRef.current = { buf, lx: g.x, lz: g.z, ox: g.x, oz: g.z, carry: 0, seed, alt: e.altKey, shift: e.shiftKey };
    bus.set(buf, n, rect);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = toGrid(e);
    moveCursor(g.px, g.py, g.x, g.z);
    const s = strokeRef.current;
    if (!s) return;
    let { x, z } = g;
    if (s.shift) {
      // Constrain to 45 degree steps from where the stroke started.
      const dx = x - s.ox;
      const dz = z - s.oz;
      const ang = Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const len = dx * Math.cos(ang) + dz * Math.sin(ang);
      x = s.ox + Math.cos(ang) * len;
      z = s.oz + Math.sin(ang) * len;
    }
    const n = bus.frame.n;
    const spacing = dabSpacingPx(brushRef.current.size, n);
    const { points, carry } = strokePoints(s.lx, s.lz, x, z, spacing, s.carry);
    s.carry = carry;
    s.lx = x;
    s.lz = z;
    if (!points.length) return;
    const settings = settingsFor(s.alt);
    let rect: DirtyRect | null = null;
    for (const [px, pz] of points) rect = unionRect(rect, brushDab(s.buf, n, px, pz, settings, s.seed));
    bus.set(s.buf, n, rect);
  };

  const endStroke = () => {
    const s = strokeRef.current;
    strokeRef.current = null;
    if (s) onStrokeEnd(s.buf);
  };

  const onPointerLeave = () => {
    if (cursorRef.current) cursorRef.current.style.opacity = '0';
    if (readoutRef.current) readoutRef.current.textContent = '';
  };

  return (
    <div
      className="te-canvas"
      onDragOver={(e) => {
        if (onDropFile && e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (file && onDropFile) {
          e.preventDefault();
          onDropFile(file);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className={`te-canvas__img ${showBrush ? '' : 'no-brush'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div ref={cursorRef} className="te-canvas__brush" aria-hidden />
      {children}
    </div>
  );
}
