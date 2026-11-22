/** Pointer-drag helper shared by every drag-on-the-control widget. */
import { useCallback, useLayoutEffect, useRef } from 'react';

export interface PointerDragHandlers {
  onStart?: (e: React.PointerEvent) => void;
  /** Deltas in CSS px since the previous move event. */
  onMove: (dx: number, dy: number, e: PointerEvent) => void;
  /** `moved` is false for a plain click (less than 3 px of travel). */
  onEnd?: (info: { moved: boolean }) => void;
}

/**
 * Returns an onPointerDown handler that captures the pointer and reports movement deltas
 * until release. Only the primary button starts a drag. The default action is prevented
 * (no text selection), so focusable widgets should focus themselves in onStart.
 */
export function usePointerDrag(handlers: PointerDragHandlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });
  return useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // capture can fail for synthetic events; window listeners still work
    }
    let lx = e.clientX;
    let ly = e.clientY;
    let travel = 0;
    ref.current.onStart?.(e);
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - lx;
      const dy = ev.clientY - ly;
      lx = ev.clientX;
      ly = ev.clientY;
      travel += Math.abs(dx) + Math.abs(dy);
      if (dx || dy) ref.current.onMove(dx, dy, ev);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      ref.current.onEnd?.({ moved: travel > 3 });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }, []);
}
