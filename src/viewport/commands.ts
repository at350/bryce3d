/**
 * Commands the UI can send to the Working window (Advanced Display palette, menus, keys).
 */
import { dolly, editActiveCamera, frameSphere } from '@/core/cameraOps';
import { v3 } from '@/core/math';
import { isInfinitePlane } from '@/core/objects';
import { useStore } from '@/core/store';
import type { CameraState, SceneObject, Vec3 } from '@/core/types';
import { boundsSphere, worldAABB } from './bounds';
import { ORTHO_BASIS, isOrthoView, type OrthoState, type OrthoView } from './projection';
import { useViewport } from './viewState';

/** The director camera a fresh session starts with (matches the store's initial UI state). */
const DEFAULT_DIRECTOR: CameraState = { position: [38, 34, 52], target: [0, 2, 0], roll: 0, fov: 50 };

const framable = (objects: SceneObject[]) => objects.filter((o) => !o.hidden && !isInfinitePlane(o.type));

/** Orthographic pan/zoom that fits a world box, for a viewport of the given aspect (w / h). */
export function fitOrtho(view: OrthoView, box: { min: Vec3; max: Vec3 } | null, aspect: number): OrthoState {
  if (!box) return { center: [0, 0, 0], halfHeight: 30 };
  const { right, up } = ORTHO_BASIS[view];
  const size = v3.sub(box.max, box.min);
  const extent = (axis: Vec3) => Math.abs(size[0] * axis[0]) + Math.abs(size[1] * axis[1]) + Math.abs(size[2] * axis[2]);
  const halfW = extent(right) / 2;
  const halfH = extent(up) / 2;
  const halfHeight = Math.max(halfH, halfW / Math.max(0.1, aspect), 1) * 1.18;
  return { center: v3.scale(v3.add(box.min, box.max), 0.5), halfHeight };
}

/** The current pan/zoom of an orthographic view (fitting the whole scene on first use). */
export function getOrthoState(view: OrthoView): OrthoState {
  const vp = useViewport.getState();
  const existing = vp.ortho[view];
  if (existing) return existing;
  const aspect = vp.size.h > 0 ? vp.size.w / vp.size.h : 4 / 3;
  const state = fitOrtho(view, worldAABB(framable(useStore.getState().scene.objects)), aspect);
  vp.setOrtho(view, state);
  return state;
}

/** Fit the selection (or the whole scene when nothing is selected) in the current view. */
export function frameSelection(): void {
  const s = useStore.getState();
  const visible = framable(s.scene.objects);
  const selected = visible.filter((o) => s.selection.includes(o.id));
  const box = worldAABB(selected.length ? selected : visible);
  if (!box) return;
  const view = s.ui.view;
  if (isOrthoView(view)) {
    const vp = useViewport.getState();
    vp.setOrtho(view, fitOrtho(view, box, vp.size.h > 0 ? vp.size.w / vp.size.h : 4 / 3));
    return;
  }
  const { center, radius } = boundsSphere(box);
  editActiveCamera((c) => frameSphere(c, center, radius));
}

/** Zoom the current view: factor > 1 zooms in. Ortho views scale; camera views dolly toward the target. */
export function zoomView(factor: number): void {
  if (!(factor > 0) || !Number.isFinite(factor)) return;
  const view = useStore.getState().ui.view;
  if (isOrthoView(view)) {
    const st = getOrthoState(view);
    useViewport.getState().setOrtho(view, { ...st, halfHeight: Math.min(1e5, Math.max(0.05, st.halfHeight / factor)) });
    return;
  }
  editActiveCamera((c) => {
    const d = v3.len(v3.sub(c.target, c.position));
    return dolly(c, d - d / factor);
  });
}

/** Reset the current view: ortho views refit the scene, the director camera returns home. */
export function resetView(): void {
  const s = useStore.getState();
  const view = s.ui.view;
  if (isOrthoView(view)) {
    const vp = useViewport.getState();
    vp.setOrtho(view, fitOrtho(view, worldAABB(framable(s.scene.objects)), vp.size.h > 0 ? vp.size.w / vp.size.h : 4 / 3));
  } else if (view === 'director') {
    s.setUI({ directorCamera: { ...DEFAULT_DIRECTOR } });
  }
}

/** Depth cue (far wireframe lines fade). */
export function setDepthCue(on: boolean): void {
  useViewport.getState().setDepthCue(on);
}

export function toggleDepthCue(): void {
  const vp = useViewport.getState();
  vp.setDepthCue(!vp.depthCue);
}

/** Rotate mode: dragging a selected object spins it around the vertical axis (also the R key). */
export function setRotateMode(on: boolean): void {
  useViewport.getState().setRotateMode(on);
}

export function toggleRotateMode(): void {
  const vp = useViewport.getState();
  vp.setRotateMode(!vp.rotateMode);
}

/** React hook for palettes that show the viewport toggles. */
export function useViewportSettings(): { depthCue: boolean; rotateMode: boolean } {
  const depthCue = useViewport((v) => v.depthCue);
  const rotateMode = useViewport((v) => v.rotateMode);
  return { depthCue, rotateMode };
}
