/**
 * App commands shared by the menus, keyboard shortcuts and palettes. Each reads the store
 * fresh (safe to call from anywhere) and reports problems in the status line.
 */
import { getActiveCamera } from '@/core/cameraOps';
import { isInfinitePlane, isLight, isTerrainLike } from '@/core/objects';
import { selectPrimarySelection, useStore } from '@/core/store';
import type { CameraState, SceneObject, Skin, Vec3 } from '@/core/types';
import { downloadRenderPNG, downloadScene, openSceneFile } from '@/io/files';
import { getRenderer } from '@/render';
import type { CreateItem } from './createItems';
import { creationTransform } from './edit/placement';
import { alignObjects, landObjects, moveObject, resizeObject, type AlignMode, type Axis } from './edit/transformOps';

const store = () => useStore.getState();
const status = (text: string) => store().showStatus(text);

/** Selected objects that may be transformed (not locked). */
export function editableSelection(): SceneObject[] {
  const s = store();
  const ids = new Set(s.selection);
  return s.scene.objects.filter((o) => ids.has(o.id) && !o.locked);
}

/** Apply a per-object change to the editable selection as one store update. */
export function editSelection(fn: (objs: SceneObject[]) => SceneObject[]): boolean {
  const objs = editableSelection();
  if (!objs.length) {
    status(store().selection.length ? 'The selection is locked.' : 'Select an object first.');
    return false;
  }
  const next = new Map(fn(objs).map((o) => [o.id, o]));
  store().updateObjects([...next.keys()], (o) => next.get(o.id) ?? o);
  return true;
}

/** The camera new objects are placed in front of (the render camera in orthographic views). */
export function placementCamera(): CameraState {
  return getActiveCamera() ?? store().scene.camera;
}

// --- objects --------------------------------------------------------------------------

export function createFromItem(item: CreateItem): void {
  const s = store();
  const transform = creationTransform(item.type, placementCamera(), s.scene.objects, item.scale);
  const obj = s.createObject(item.type, { transform });
  document.querySelector<HTMLElement>('.bv-root')?.focus({ preventScroll: true });
  status(`Created ${obj.name}`);
}

export function duplicateSelection(): void {
  const s = store();
  if (!s.selection.length) return status('Select an object to duplicate.');
  const ids = s.duplicateObjects(s.selection);
  status(ids.length === 1 ? 'Duplicated 1 object' : `Duplicated ${ids.length} objects`);
}

export function deleteSelection(): void {
  const s = store();
  if (!s.selection.length) return;
  const n = s.selection.length;
  s.removeObjects(s.selection);
  status(n === 1 ? 'Deleted 1 object (Ctrl+Z to undo)' : `Deleted ${n} objects (Ctrl+Z to undo)`);
}

export function openMaterialsLab(): void {
  const s = store();
  const p = selectPrimarySelection(s);
  if (!p) return status('Select an object to edit its material.');
  if (isLight(p.type)) {
    s.openDialog('attributes');
    return status('Lights have no material: set their color in Attributes.');
  }
  s.openLab('material', p.id);
}

/** Bryce "Edit": terrains open the Terrain Editor, everything else the Attributes dialog. */
export function editSelected(): void {
  const s = store();
  const p = selectPrimarySelection(s);
  if (!p) return status('Select an object to edit.');
  if (isTerrainLike(p.type)) s.openLab('terrain', p.id);
  else s.openDialog('attributes');
}

export function openAttributes(): void {
  const s = store();
  if (!s.selection.length) return status('Select an object first.');
  s.openDialog('attributes');
}

export function alignSelection(axis: Axis, mode: AlignMode): void {
  editSelection((objs) => alignObjects(objs, axis, mode));
}

export function landSelection(): void {
  if (editSelection((objs) => landObjects(objs, 0))) status('Landed on the ground');
}

export function scaleSelection(factor: number): void {
  editSelection((objs) => objs.map((o) => resizeObject(o, [factor, factor, factor])));
}

/** The world axes closest to the view's forward and right directions (on the ground plane). */
export function viewAxes(): { fwd: Vec3; right: Vec3 } {
  const cam = placementCamera();
  const fx = cam.target[0] - cam.position[0];
  const fz = cam.target[2] - cam.position[2];
  const fwd: Vec3 = Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0, 0] : [0, 0, Math.sign(fz) || -1];
  return { fwd, right: [-fwd[2], 0, fwd[0]] };
}

/**
 * Arrow-key nudge, camera relative: up/down move along whichever world axis points most
 * "into" the view, left/right along the matching sideways axis; raise/lower move in Y.
 */
export function nudgeSelection(dir: 'left' | 'right' | 'up' | 'down' | 'raise' | 'lower', step: number): void {
  const { fwd, right } = viewAxes();
  const d: Vec3 =
    dir === 'up' ? fwd : dir === 'down' ? [-fwd[0], 0, -fwd[2]] : dir === 'right' ? right : dir === 'left' ? [-right[0], 0, -right[2]] : [0, dir === 'raise' ? 1 : -1, 0];
  editSelection((objs) => objs.map((o) => moveObject(o, [d[0] * step, d[1] * step, d[2] * step])));
}

/** Select the next/previous object (bracket keys leave Tab free for focus). */
export function cycleSelection(delta: 1 | -1): void {
  const s = store();
  const objs = s.scene.objects.filter((o) => !o.hidden);
  if (!objs.length) return;
  const cur = s.selection.length ? objs.findIndex((o) => o.id === s.selection[s.selection.length - 1]) : -1;
  const next = cur < 0 ? (delta > 0 ? 0 : objs.length - 1) : (cur + delta + objs.length) % objs.length;
  s.select(objs[next].id);
  s.setHint(objs[next].name);
}

export function selectNone(): void {
  store().select(null);
}

/** Objects that count for "select all" style commands (planes included, hidden excluded). */
export const visibleObjects = (objs: SceneObject[]) => objs.filter((o) => !o.hidden);
export const solidObjects = (objs: SceneObject[]) => objs.filter((o) => !isInfinitePlane(o.type));

// --- rendering --------------------------------------------------------------------------

function rendererOk(): boolean {
  const r = getRenderer();
  if (!r.supported) {
    status(r.error ?? 'Rendering needs WebGL2, which this browser does not offer.');
    return false;
  }
  return true;
}

export function startRender(): void {
  if (!rendererOk()) return;
  getRenderer().start(store().scene);
}

export function resumeRender(): void {
  if (!rendererOk()) return;
  const st = store().render.status;
  if (st === 'idle' || st === 'error') getRenderer().start(store().scene);
  else getRenderer().resume();
}

export function clearAndRender(): void {
  if (!rendererOk()) return;
  getRenderer().clear();
  getRenderer().start(store().scene);
}

export function stopRender(): void {
  getRenderer().stop();
}

export function toggleRender(): void {
  if (store().render.status === 'rendering') stopRender();
  else startRender();
}

// --- files --------------------------------------------------------------------------------

export function newScene(): void {
  store().newScene();
  status('New scene (Ctrl+Z brings the old one back)');
}

export function openScene(): void {
  openSceneFile()
    .then((scene) => {
      if (!scene) return;
      store().loadScene(scene, { keepHistory: true });
      status(`Opened ${scene.name}`);
    })
    .catch((e: unknown) => status(`Could not open that file: ${e instanceof Error ? e.message : String(e)}`));
}

export function saveScene(): void {
  const scene = store().scene;
  downloadScene(scene);
  status(`Saved ${scene.name || 'Untitled'}`);
}

export function exportRender(): void {
  void downloadRenderPNG().then((ok) => {
    if (!ok) status('Nothing rendered yet: press the render ball (Ctrl+R) first.');
  });
}

export function setSkin(skin: Skin): void {
  store().setUI({ skin });
}
