/**
 * UI zoom: palettes scale with the window (1024x700 up to 2560x1440) so the Working
 * window keeps as much room as possible. App writes it; icons read it to pick a sharp
 * render size.
 */
import { useSyncExternalStore } from 'react';

/** Zoom factor for a window size: 1 around 1360x860, 0.78 at the 1024x700 minimum, at most 1.5. */
export function computeUiZoom(width: number, height: number): number {
  const z = Math.min(width / 1360, height / 860);
  return Math.round(Math.min(1.5, Math.max(0.78, z)) * 100) / 100;
}

/** Narrow or tiny screens (phones) get a friendly notice instead of a cramped editor. */
export function isTooSmallForEditor(width: number, height: number): boolean {
  return width < 760 || height < 480;
}

let zoom = typeof window !== 'undefined' ? computeUiZoom(window.innerWidth, window.innerHeight) : 1;
const listeners = new Set<() => void>();

export function getUiZoom(): number {
  return zoom;
}

export function setUiZoom(z: number): void {
  if (z === zoom) return;
  zoom = z;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useUiZoom(): number {
  return useSyncExternalStore(subscribe, getUiZoom, getUiZoom);
}
