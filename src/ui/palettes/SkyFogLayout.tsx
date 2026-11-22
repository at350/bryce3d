/**
 * Sizing and store helpers shared by the Sky & Fog palette cells. The palette measures its
 * own width and picks a size tier, so it fits the top shelf from 1024 px windows upward
 * whatever zoom the shell applies.
 */
import { useLayoutEffect, useState, type RefObject } from 'react';
import { useStore } from '@/core/store';
import type { Sky } from '@/core/types';

export type SkyFogTier = 'compact' | 'normal' | 'roomy';

export interface SkyFogMetrics {
  tier: SkyFogTier;
  /** Drag-pad thumbnail size (CSS px). */
  padW: number;
  padH: number;
  /** Sun ball diameter. */
  ball: number;
  /** Small round buttons next to the ball. */
  button: number;
}

/**
 * Size tier for the width the palette may use. Heights stay within the Create palette's
 * shelf (~48 px) so switching palettes never moves the Working window.
 */
export function metricsFor(width: number): SkyFogMetrics {
  if (width >= 1080) return { tier: 'roomy', padW: 60, padH: 38, ball: 48, button: 18 };
  if (width >= 820) return { tier: 'normal', padW: 54, padH: 36, ball: 46, button: 18 };
  return { tier: 'compact', padW: 46, padH: 34, ball: 44, button: 17 };
}

/**
 * Width available to the palette. The shelf around it shrink-wraps its content, so measure
 * the top palette container (or, failing that, the parent) instead of the palette itself.
 */
export function useAvailableWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(1000);
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.closest<HTMLElement>('.top-palette__zoom, .top-palette') ?? el?.parentElement;
    if (!host) return;
    setWidth(host.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Live store edits from palette drags: every drag is one undo step. */
export const skyGesture = {
  onStart: () => useStore.getState().beginGesture(),
  onEnd: () => useStore.getState().endGesture(),
};

export function patchSky(patch: Partial<Sky>, hint?: string): void {
  const s = useStore.getState();
  s.setSky(patch);
  if (hint) s.setHint(hint);
}

export const currentSky = (): Sky => useStore.getState().scene.sky;
