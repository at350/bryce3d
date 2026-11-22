/**
 * Viewport-local editor state that is not part of the shared store: orthographic pan/zoom,
 * the depth-cue and rotate-mode toggles, the current frame layout (for overlays) and
 * whether a fresh render is being shown on its own ("bitmap" display).
 */
import { create } from 'zustand';
import type { OrthoState, OrthoView, Rect } from './projection';

const PREFS_KEY = 'bryce3d-web:viewport';

export interface ViewportState {
  /** Far wireframe lines fade toward the paper (Bryce depth cue). */
  depthCue: boolean;
  /** Dragging a selected object spins it around the world Y axis. */
  rotateMode: boolean;
  /** Pan/zoom per orthographic view; filled lazily (fit to the scene) the first time a view is shown. */
  ortho: Partial<Record<OrthoView, OrthoState>>;
  /** Document frame inside the working window, in CSS px (whole window in ortho views). */
  frame: Rect | null;
  size: { w: number; h: number };
  /** A fresh render is shown alone; wireframes return when the user selects or edits. */
  bitmap: boolean;
  setDepthCue(on: boolean): void;
  setRotateMode(on: boolean): void;
  setOrtho(view: OrthoView, state: OrthoState): void;
  setLayout(frame: Rect, size: { w: number; h: number }): void;
  setBitmap(on: boolean): void;
}

function loadDepthCue(): boolean {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return true;
    const p = JSON.parse(raw) as { depthCue?: unknown };
    return typeof p.depthCue === 'boolean' ? p.depthCue : true;
  } catch {
    return true;
  }
}

function saveDepthCue(depthCue: boolean) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ depthCue }));
  } catch {
    // storage unavailable: the toggle just does not persist
  }
}

const sameRect = (a: Rect | null, b: Rect) => !!a && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export const useViewport = create<ViewportState>()((set, get) => ({
  depthCue: loadDepthCue(),
  rotateMode: false,
  ortho: {},
  frame: null,
  size: { w: 0, h: 0 },
  bitmap: false,
  setDepthCue(on) {
    if (get().depthCue === on) return;
    set({ depthCue: on });
    saveDepthCue(on);
  },
  setRotateMode(on) {
    if (get().rotateMode !== on) set({ rotateMode: on });
  },
  setOrtho(view, state) {
    set((s) => ({ ortho: { ...s.ortho, [view]: state } }));
  },
  setLayout(frame, size) {
    const s = get();
    if (sameRect(s.frame, frame) && s.size.w === size.w && s.size.h === size.h) return;
    set({ frame, size });
  },
  setBitmap(on) {
    if (get().bitmap !== on) set({ bitmap: on });
  },
}));
