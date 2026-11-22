/**
 * The 2D layer over the wireframes: the document frame and its dimmed surroundings, the
 * horizon line, bounding-box handles, the little A / M / E buttons beside a selection,
 * the rubber-band marquee, the rotate ring and an axis tripod.
 */
import { SELECTED_COLOR } from '@/core/defaults';
import type { RGB } from '@/core/types';
import type { HandleDef } from '../handles';
import type { Rect, ScreenPoint } from '../projection';
import { HORIZON_CSS, cssRgb } from './palette';

export type TagId = 'attributes' | 'material' | 'edit' | 'family';

export interface Tag {
  id: TagId;
  label: string;
  hint: string;
  x: number;
  y: number;
  size: number;
  color?: RGB;
}

export interface OverlayModel {
  width: number;
  height: number;
  frame: Rect;
  /** Camera view: dim outside the frame and draw its border. */
  documentFrame: boolean;
  horizon: [[number, number], [number, number]] | null;
  /** Camera view: Bryce's little camera-center mark. */
  centerMark: boolean;
  handles: { points: (ScreenPoint | null)[]; defs: HandleDef[]; hover: number; rotating: boolean } | null;
  tags: Tag[];
  hoverTag: TagId | null;
  marquee: Rect | null;
  ring: ({ x: number; y: number } | null)[] | null;
  /** Screen directions (y down) of the world X, Y, Z axes for the tripod; null hides it. */
  axes: [number, number][] | null;
}

const TAG_SIZE = 17;

/** Place the selection's buttons in a column just right of its screen box (kept on canvas). */
export function layoutTags(
  rect: Rect,
  items: { id: TagId; label: string; hint: string; color?: RGB }[],
  width: number,
  height: number,
): Tag[] {
  const gap = 3;
  const colH = items.length * (TAG_SIZE + gap) - gap;
  let x = rect.x + rect.w + 8;
  if (x + TAG_SIZE > width - 4) x = rect.x - 8 - TAG_SIZE;
  x = Math.min(Math.max(4, x), width - TAG_SIZE - 4);
  const y0 = Math.min(Math.max(4, rect.y), Math.max(4, height - colH - 4));
  return items.map((it, i) => ({ ...it, x, y: y0 + i * (TAG_SIZE + gap), size: TAG_SIZE }));
}

export function hitTag(tags: Tag[], px: number, py: number): Tag | null {
  for (const t of tags) {
    if (px >= t.x - 2 && px <= t.x + t.size + 2 && py >= t.y - 2 && py <= t.y + t.size + 2) return t;
  }
  return null;
}

const crisp = (v: number) => Math.round(v) + 0.5;

export function drawOverlay(ctx: CanvasRenderingContext2D, m: OverlayModel, dpr: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, m.width, m.height);

  if (m.horizon) {
    ctx.strokeStyle = HORIZON_CSS;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m.horizon[0][0], crisp(m.horizon[0][1]));
    ctx.lineTo(m.horizon[1][0], crisp(m.horizon[1][1]));
    ctx.stroke();
  }

  if (m.centerMark) {
    const cx = m.frame.x + m.frame.w / 2;
    const cy = m.frame.y + m.frame.h / 2;
    ctx.strokeStyle = 'rgba(52, 96, 220, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(crisp(cx - 10), crisp(cy - 8), 20, 16);
    ctx.beginPath();
    ctx.moveTo(crisp(cx - 10), crisp(cy - 8));
    ctx.lineTo(crisp(cx + 10), crisp(cy + 8));
    ctx.moveTo(crisp(cx + 10), crisp(cy - 8));
    ctx.lineTo(crisp(cx - 10), crisp(cy + 8));
    ctx.stroke();
  }

  if (m.ring) drawRing(ctx, m.ring);
  if (m.handles) drawHandles(ctx, m.handles);
  m.tags.forEach((t) => drawTag(ctx, t, t.id === m.hoverTag));

  if (m.documentFrame) {
    const f = m.frame;
    ctx.fillStyle = 'rgba(48, 47, 42, 0.16)';
    ctx.beginPath();
    ctx.rect(0, 0, m.width, m.height);
    ctx.rect(f.x, f.y, f.w, f.h);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(28, 28, 30, 0.78)';
    ctx.lineWidth = 1;
    ctx.strokeRect(crisp(f.x) - 1, crisp(f.y) - 1, Math.round(f.w) + 1, Math.round(f.h) + 1);
  }

  if (m.marquee) {
    const r = m.marquee;
    ctx.fillStyle = 'rgba(52, 96, 220, 0.08)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(25, 25, 28, 0.85)';
    ctx.strokeRect(crisp(r.x), crisp(r.y), Math.round(r.w), Math.round(r.h));
    ctx.setLineDash([]);
  }

  if (m.axes) drawTripod(ctx, m.axes, 26, m.height - 26);
}

function drawHandles(ctx: CanvasRenderingContext2D, h: NonNullable<OverlayModel['handles']>) {
  h.points.forEach((p, i) => {
    if (!p) return;
    const hover = i === h.hover;
    const size = hover ? 8 : h.defs[i]?.kind === 'face' ? 6 : 5;
    ctx.fillStyle = hover ? cssRgb(SELECTED_COLOR) : '#1b1b1d';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    if (h.rotating) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, size / 2 + 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const x = Math.round(p.x - size / 2);
      const y = Math.round(p.y - size / 2);
      ctx.fillRect(x, y, size, size);
      ctx.strokeRect(x - 0.5, y - 0.5, size + 1, size + 1);
    }
  });
}

function drawTag(ctx: CanvasRenderingContext2D, t: Tag, hover: boolean) {
  const r = 3;
  ctx.beginPath();
  ctx.roundRect(t.x + 0.5, t.y + 0.5, t.size - 1, t.size - 1, r);
  const g = ctx.createLinearGradient(0, t.y, 0, t.y + t.size);
  g.addColorStop(0, hover ? '#ffffff' : '#f4f4f2');
  g.addColorStop(1, hover ? '#d6dcf0' : '#b9bab6');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = hover ? 'rgba(40, 80, 200, 0.95)' : 'rgba(40, 40, 44, 0.75)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (t.color) {
    ctx.beginPath();
    ctx.arc(t.x + t.size / 2, t.y + t.size / 2, t.size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = cssRgb(t.color);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.stroke();
    return;
  }
  ctx.fillStyle = hover ? '#1a3fb0' : '#26272b';
  ctx.font = '700 10px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.label, t.x + t.size / 2, t.y + t.size / 2 + 0.5);
}

function drawRing(ctx: CanvasRenderingContext2D, pts: ({ x: number; y: number } | null)[]) {
  ctx.strokeStyle = cssRgb(SELECTED_COLOR, 0.85);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i <= pts.length; i++) {
    const p = pts[i % pts.length];
    if (!p) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    pen = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const k = pts.find((p) => p);
  if (k) {
    ctx.fillStyle = cssRgb(SELECTED_COLOR);
    ctx.beginPath();
    ctx.arc(k.x, k.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

const AXIS_COLORS = ['#c8321e', '#2c8c3c', '#2f5fd0'];

function drawTripod(ctx: CanvasRenderingContext2D, axes: [number, number][], ox: number, oy: number) {
  ctx.lineWidth = 1.5;
  ctx.font = '600 9px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  axes.forEach(([dx, dy], i) => {
    const len = Math.hypot(dx, dy);
    // An axis pointing at the viewer collapses to a dot; label it beside the origin.
    const [ux, uy] = len > 0.2 ? [dx / len, dy / len] : [0.75, 0.65];
    ctx.strokeStyle = AXIS_COLORS[i];
    ctx.fillStyle = AXIS_COLORS[i];
    ctx.globalAlpha = len < 0.2 ? 0.4 : 0.9;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + dx * 15, oy + dy * 15);
    ctx.stroke();
    ctx.fillText('XYZ'[i], ox + dx * 15 + ux * 6, oy + dy * 15 + uy * 6);
  });
  ctx.globalAlpha = 1;
}
