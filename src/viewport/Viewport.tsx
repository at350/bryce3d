/**
 * The Working window: Bryce-style wireframes on light paper (or a shaded preview), the
 * document frame, the render image, and direct manipulation of objects and cameras.
 * The three.js work lives in engine/Engine.ts; this component provides the DOM and the
 * small React overlays (view badge, render progress).
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { getRenderer } from '@/render';
import { ViewportEngine } from './engine/Engine';
import { VIEW_LABELS } from './projection';
import { useViewport } from './viewState';
import './viewport.css';

export function Viewport() {
  const rootRef = useRef<HTMLDivElement>(null);
  const glHostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const glHost = glHostRef.current;
    const overlay = overlayRef.current;
    const holder = holderRef.current;
    if (!root || !glHost || !overlay || !holder) return;
    // A fresh canvas per mount: a WebGL context that was released cannot be reused (StrictMode remounts).
    const glCanvas = document.createElement('canvas');
    glHost.appendChild(glCanvas);
    let engine: ViewportEngine | null = null;
    try {
      engine = new ViewportEngine({ root, glCanvas, overlay, renderHolder: holder });
      // Automation handle for scripted checks during development (window.__bryceViewport.engine).
      if (import.meta.env.DEV) (window as unknown as { __bryceViewport?: unknown }).__bryceViewport = { engine };
    } catch (err) {
      console.warn('Working window unavailable:', err);
      queueMicrotask(() => setError('This browser could not start WebGL, so the 3D working window is unavailable. Rendering may still work.'));
    }
    return () => {
      engine?.dispose();
      glCanvas.remove();
    };
  }, []);

  return (
    <div className="bv-root" ref={rootRef} aria-label="Working window" tabIndex={0}>
      <div className="bv-render" ref={holderRef} />
      <div className="bv-gl" ref={glHostRef} />
      <canvas className="bv-overlay" ref={overlayRef} />
      <ViewBadge />
      <RenderProgress />
      {error && <div className="bv-error">{error}</div>}
    </div>
  );
}

function ViewBadge() {
  const view = useStore((s) => s.ui.view);
  const width = useStore((s) => s.scene.render.width);
  const height = useStore((s) => s.scene.render.height);
  const rotateMode = useViewport((v) => v.rotateMode);
  const frame = useViewport((v) => v.frame);
  const left = view === 'camera' && frame ? Math.max(8, frame.x) : 10;
  const top = view === 'camera' && frame ? Math.max(4, frame.y - 16) : 8;
  return (
    <div className="bv-badge" style={{ left, top }}>
      {VIEW_LABELS[view]}
      {view === 'camera' && <span className="bv-badge__dim"> · {width} × {height}</span>}
      {rotateMode && <span className="bv-badge__mode"> · Rotate mode (R)</span>}
    </div>
  );
}

function RenderProgress() {
  const status = useStore((s) => s.render.status);
  const fraction = useStore((s) => s.render.fraction);
  const elapsed = useStore((s) => s.render.elapsedMs);
  const view = useStore((s) => s.ui.view);
  const frame = useViewport((v) => v.frame);
  const [flash, setFlash] = useState<string | null>(null);
  const prevStatus = useRef(status);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (status === 'done' && prev === 'rendering') {
      setFlash(elapsed > 0 ? `Rendered in ${(elapsed / 1000).toFixed(1)} s` : 'Render complete');
      const t = setTimeout(() => setFlash(null), 2600);
      return () => clearTimeout(t);
    }
    if (status === 'rendering') setFlash(null);
    return undefined;
  }, [status, elapsed]);

  const active = status === 'rendering' || status === 'paused';
  if (!frame || (!active && !flash)) return null;
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const style = view === 'camera' ? { left: frame.x + frame.w / 2, top: frame.y + frame.h - 10 } : { left: frame.x + frame.w / 2, top: frame.y + frame.h - 14 };
  return (
    <div className="bv-progress" style={style} role="status">
      {active ? (
        <>
          <div className="bv-progress__track" aria-hidden>
            <div className="bv-progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="bv-progress__pct">
            {status === 'paused' ? 'Paused ' : ''}
            {pct}%
          </span>
          {status === 'rendering' ? (
            <button type="button" onClick={() => getRenderer().stop()} onPointerDown={(e) => e.stopPropagation()}>
              Stop
            </button>
          ) : (
            <button type="button" onClick={() => getRenderer().resume()} onPointerDown={(e) => e.stopPropagation()}>
              Resume
            </button>
          )}
        </>
      ) : (
        <span className="bv-progress__pct">{flash}</span>
      )}
    </div>
  );
}
