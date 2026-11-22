/**
 * Bryce bounding-box control points: one on every corner (resize all axes) and one at the
 * center of every face (resize along that axis). Layout and screen-space hit testing.
 */
import type { Vec3 } from '@/core/types';
import { boxPoint, type BoxFrame } from './bounds';

export interface HandleDef {
  kind: 'corner' | 'face';
  /** Signed unit position on the box (-1, 0 or 1 per axis). */
  s: Vec3;
  /** Face handles: the axis they resize (0 = X, 1 = Y, 2 = Z). Corners: -1. */
  axis: -1 | 0 | 1 | 2;
}

export const AXIS_NAMES = ['X', 'Y', 'Z'] as const;

const CORNERS: HandleDef[] = Array.from({ length: 8 }, (_, i) => ({
  kind: 'corner' as const,
  s: [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1] as Vec3,
  axis: -1 as const,
}));

const FACES: HandleDef[] = [0, 1, 2].flatMap((axis) =>
  [-1, 1].map((sign) => {
    const s: Vec3 = [0, 0, 0];
    s[axis] = sign;
    return { kind: 'face' as const, s, axis: axis as 0 | 1 | 2 };
  }),
);

/** Handles for a box; flat boxes (zero extent on an axis) drop the duplicates and the useless faces. */
export function handlesFor(frame: BoxFrame): HandleDef[] {
  const flat = frame.half.map((h) => h < 1e-6);
  const corners = CORNERS.filter((c) => c.s.every((v, k) => !flat[k] || v < 0));
  const faces = FACES.filter((f) => !flat[f.axis]);
  return [...corners, ...faces];
}

export function handleWorldPoint(frame: BoxFrame, h: HandleDef): Vec3 {
  return boxPoint(frame, h.s);
}

/** The point a handle resizes from: the opposite corner/face, or the center (Alt). */
export function handleAnchor(frame: BoxFrame, h: HandleDef, fromCenter: boolean): Vec3 {
  if (fromCenter) return frame.center;
  return boxPoint(frame, [-h.s[0], -h.s[1], -h.s[2]]);
}

/**
 * Index of the handle nearest to (px, py) within `radius` pixels, or -1. Face handles win ties
 * against corners so the single-axis handles stay reachable on small boxes.
 */
export function hitHandle(points: ({ x: number; y: number } | null)[], defs: HandleDef[], px: number, py: number, radius: number): number {
  let best = -1;
  let bestD = Infinity;
  points.forEach((p, i) => {
    if (!p) return;
    const d = Math.hypot(p.x - px, p.y - py) - (defs[i]?.kind === 'face' ? 1.5 : 0);
    if (d <= radius && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/**
 * Which handles to offer: a pair of face handles whose axis points at the viewer collapses
 * into the middle of the object on screen, where it would steal clicks meant for moving the
 * object (and its drag direction is unreadable), so such pairs are dropped.
 */
export function visibleHandleMask(
  defs: HandleDef[],
  points: ({ x: number; y: number } | null)[],
  rect: { w: number; h: number } | null,
): boolean[] {
  const diag = rect ? Math.hypot(rect.w, rect.h) : 0;
  const min = Math.max(14, diag * 0.22);
  return defs.map((d, i) => {
    if (d.kind !== 'face') return true;
    const ax = d.axis as 0 | 1 | 2;
    const j = defs.findIndex((e) => e.kind === 'face' && e.axis === ax && e.s[ax] === -d.s[ax]);
    const a = points[i];
    const b = j >= 0 ? points[j] : null;
    if (!a || !b) return !!a;
    return Math.hypot(a.x - b.x, a.y - b.y) > min;
  });
}

/** Hint text for a handle. */
export function handleHint(h: HandleDef, rotating: boolean): string {
  if (rotating) return h.kind === 'face' ? `Rotate around ${AXIS_NAMES[h.axis as 0 | 1 | 2]} · Shift snaps 15°` : 'Free rotate · Shift snaps 15°';
  if (h.kind === 'corner') return 'Resize all axes · Alt from center · Shift ¼ steps · ⌘/Ctrl rotates';
  return `Resize ${AXIS_NAMES[h.axis as 0 | 1 | 2]} · Shift uniform · Alt from center · ⌘/Ctrl rotates`;
}
