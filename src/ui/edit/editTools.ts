/** What each Edit-palette drag tool does to the dragged objects (pure, from the drag-start snapshot). */
import { cameraStep } from '@/core/cameraOps';
import type { SceneObject, Vec3 } from '@/core/types';
import { placementCamera, viewAxes } from '../actions';
import type { DragDelta, ToolMode } from './DragTool';
import { moveObject, randomizeObjects, resizeObject, rotateObject, type Axis, type RandomizeOptions } from './transformOps';

const AXIS: Record<Exclude<ToolMode, 'all'>, Axis> = { x: 0, y: 1, z: 2 };

/** Drag right to grow, left to shrink (exponential, so it feels even). Shift snaps to 50% steps. */
export function resizeTool(base: SceneObject[], mode: ToolMode, d: DragDelta) {
  let f = Math.exp(d.dx * (d.alt ? 0.002 : 0.01));
  if (d.shift) f = Math.max(0.5, Math.round(f * 2) / 2);
  const factor: Vec3 = mode === 'all' ? [f, f, f] : mode === 'x' ? [f, 1, 1] : mode === 'y' ? [1, f, 1] : [1, 1, f];
  return { objects: base.map((o) => resizeObject(o, factor)), readout: `${Math.round(f * 100)}%` };
}

/** Drag to spin around a world axis (the icon itself spins around Y). Shift snaps to 45 degrees like Bryce. */
export function rotateTool(base: SceneObject[], mode: ToolMode, d: DragDelta) {
  let deg = d.dx * (d.alt ? 0.1 : 0.6);
  if (d.shift) deg = Math.round(deg / 45) * 45;
  const axis = mode === 'all' ? 1 : AXIS[mode];
  return { objects: base.map((o) => rotateObject(o, axis, deg)), readout: `${deg > 0 ? '+' : ''}${Math.round(deg)}°` };
}

/** Drag along one world axis, or (icon) left/right + up/down across the ground relative to the view. */
export function repositionTool(base: SceneObject[], mode: ToolMode, d: DragDelta) {
  const unit = cameraStep(placementCamera()) * 0.3 * (d.alt ? 0.1 : 1);
  let delta: Vec3;
  if (mode === 'all') {
    const { fwd, right } = viewAxes();
    delta = [right[0] * d.dx * unit + fwd[0] * d.dy * unit, 0, right[2] * d.dx * unit + fwd[2] * d.dy * unit];
  } else {
    delta = [0, 0, 0];
    delta[AXIS[mode]] = (mode === 'y' ? d.dx + d.dy : d.dx) * unit;
  }
  if (d.shift) delta = delta.map((v) => Math.round(v)) as Vec3;
  const len = Math.hypot(delta[0], delta[1], delta[2]);
  const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;
  const readout = mode === 'all' ? `${len.toFixed(1)} units` : fmt(delta[AXIS[mode]]);
  return { objects: base.map((o) => moveObject(o, delta)), readout };
}

/** Drag right to shake the selection harder; left to calm it back down. */
export function randomizeTool(seed: number, opts: RandomizeOptions) {
  return (base: SceneObject[], _mode: ToolMode, d: DragDelta) => {
    const amount = Math.max(0, Math.min(1.5, d.dx / 220));
    return { objects: randomizeObjects(base, amount, seed, opts), readout: `${Math.round(amount * 100)}%` };
  };
}
