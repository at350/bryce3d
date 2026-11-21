/**
 * The app store (Zustand). One source of truth for the scene, the selection, editor UI
 * state, undo/redo and a mirror of the renderer's progress.
 *
 * React:      const sky = useStore((s) => s.scene.sky)
 * Non-React:  useStore.getState().setSky({...})
 *             useStore.subscribe((s) => s.scene, (scene, prev) => ...)   // selector subscriptions
 *
 * Every scene mutation goes through `commit`, which pushes the previous scene onto the
 * undo stack. Rapid repeated edits of the same kind (a drag, a wheel zoom, slider
 * scrubbing) coalesce into one undo step automatically; wrap longer interactions in
 * beginGesture()/endGesture() to force a single step.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createDefaultScene, emptyScene } from '@/scenes/defaultScene';
import { createObject as buildObject } from './defaults';
import { newId } from './ids';
import type {
  CameraState,
  DialogKind,
  DisplayMode,
  LabKind,
  LibraryKind,
  Material,
  ObjectType,
  PaletteTab,
  RenderProgress,
  RenderSettings,
  Scene,
  SceneObject,
  Skin,
  Sky,
  Transform,
  ViewMode,
} from './types';

export interface UIState {
  palette: PaletteTab;
  view: ViewMode;
  display: DisplayMode;
  lab: LabKind | null;
  /** Object id edited by the open lab (material / terrain). */
  labTarget: string | null;
  library: LibraryKind | null;
  dialog: DialogKind | null;
  /** Text in the hint bar: the name of whatever control is under the pointer. */
  hint: string;
  /** Transient status message (cleared automatically). */
  status: string;
  directorCamera: CameraState;
  skin: Skin;
  /** After a render, keep the image visible under the wireframes while editing. */
  showRenderUnderWireframe: boolean;
  /** Nano Preview: render the whole scene or just the sky. */
  nanoMode: 'scene' | 'sky';
  /** Nano Preview re-renders automatically after edits. */
  autoNano: boolean;
  /** Camera memory dots in the Control palette. */
  cameraMemories: (CameraState | null)[];
  /** Sky memory dots in the Sky & Fog palette. */
  skyMemories: (Sky | null)[];
  /** True while a modal text field/lab has keyboard focus (suppresses global shortcuts). */
  keyboardCaptured: boolean;
}

export interface RenderMirror extends RenderProgress {
  /** Show the render image in the viewport. */
  visible: boolean;
  /** The scene changed since the render started. */
  stale: boolean;
}

export type SelectMode = 'replace' | 'add' | 'toggle';

export interface AppState {
  scene: Scene;
  selection: string[];
  ui: UIState;
  render: RenderMirror;
  past: Scene[];
  future: Scene[];
  /** Increments on every scene change (cheap change detection for non-React code). */
  revision: number;

  // --- scene ---------------------------------------------------------------
  /** Build a new object of a type (default size/material/name), add it and select it. */
  createObject(type: ObjectType, overrides?: Partial<SceneObject>): SceneObject;
  /** Add ready-made objects (ids are re-generated if they collide). */
  addObjects(objects: SceneObject[], options?: { select?: boolean }): void;
  /** Shallow-merge fields into an object. */
  updateObject(id: string, patch: Partial<Omit<SceneObject, 'id'>>): void;
  /** Replace several objects through a mapping function. */
  updateObjects(ids: string[], fn: (o: SceneObject) => SceneObject): void;
  setTransform(id: string, patch: Partial<Transform>): void;
  setMaterial(ids: string[], material: Material): void;
  removeObjects(ids: string[]): void;
  /** Duplicate objects (offset slightly), select the copies and return their ids. */
  duplicateObjects(ids: string[]): string[];
  setSky(patch: Partial<Sky>): void;
  setCamera(patch: Partial<CameraState>): void;
  setRenderSettings(patch: Partial<RenderSettings>): void;
  setSceneName(name: string): void;
  /** Replace the whole scene (open file, sample scene, share link). Clears history by default. */
  loadScene(scene: Scene, options?: { keepHistory?: boolean }): void;
  newScene(): void;

  // --- history -------------------------------------------------------------
  undo(): void;
  redo(): void;
  beginGesture(): void;
  endGesture(): void;

  // --- selection -----------------------------------------------------------
  select(ids: string | string[] | null, mode?: SelectMode): void;
  selectAll(): void;
  selectByType(types: ObjectType[]): void;

  // --- ui ------------------------------------------------------------------
  setUI(patch: Partial<UIState>): void;
  setHint(text: string): void;
  showStatus(text: string): void;
  openLab(kind: LabKind, targetId?: string | null): void;
  closeLab(): void;
  openLibrary(kind: LibraryKind): void;
  closeLibrary(): void;
  openDialog(kind: DialogKind): void;
  closeDialog(): void;

  // --- renderer mirror -----------------------------------------------------
  setRenderProgress(progress: RenderProgress): void;
  setRenderVisible(visible: boolean): void;
}

const HISTORY_LIMIT = 80;
const COALESCE_MS = 700;

const PREFS_KEY = 'bryce3d-web:prefs';

function loadPrefs(): Partial<UIState> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    const out: Partial<UIState> = {};
    if (p.skin === 'bryce5' || p.skin === 'bryce2' || p.skin === 'bryce7') out.skin = p.skin;
    if (typeof p.showRenderUnderWireframe === 'boolean') out.showRenderUnderWireframe = p.showRenderUnderWireframe;
    if (typeof p.autoNano === 'boolean') out.autoNano = p.autoNano;
    return out;
  } catch {
    return {};
  }
}

function savePrefs(ui: UIState) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ skin: ui.skin, showRenderUnderWireframe: ui.showRenderUnderWireframe, autoNano: ui.autoNano }),
    );
  } catch {
    // storage unavailable (private mode): preferences just don't persist
  }
}

function initialUI(): UIState {
  return {
    palette: 'create',
    view: 'camera',
    display: 'wireframe',
    lab: null,
    labTarget: null,
    library: null,
    dialog: null,
    hint: '',
    status: '',
    directorCamera: { position: [38, 34, 52], target: [0, 2, 0], roll: 0, fov: 50 },
    skin: 'bryce5',
    showRenderUnderWireframe: true,
    nanoMode: 'scene',
    autoNano: true,
    cameraMemories: [null, null, null, null],
    skyMemories: [null, null, null, null],
    keyboardCaptured: false,
    ...loadPrefs(),
  };
}

const initialRender = (): RenderMirror => ({
  status: 'idle',
  pass: 0,
  passCount: 0,
  fraction: 0,
  samples: 0,
  elapsedMs: 0,
  visible: false,
  stale: false,
});

let statusTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => {
    // History bookkeeping kept outside React state (not needed for rendering).
    let lastKind = '';
    let lastTime = 0;
    let gestureStart: Scene | null = null;

    /** Apply a scene change, recording undo history. `kind` groups rapid edits into one step. */
    const commit = (next: Scene, kind: string, extra: Partial<AppState> = {}) => {
      const s = get();
      if (next === s.scene) return;
      const now = performance.now();
      let past = s.past;
      if (gestureStart) {
        // inside a gesture: history is pushed once in endGesture()
      } else if (!(kind === lastKind && now - lastTime < COALESCE_MS)) {
        past = [...past, s.scene].slice(-HISTORY_LIMIT);
      }
      lastKind = kind;
      lastTime = now;
      const render = s.render.status === 'idle' ? s.render : { ...s.render, stale: true };
      set({ scene: next, past, future: [], revision: s.revision + 1, render, ...extra });
    };

    const withObjects = (scene: Scene, objects: SceneObject[]): Scene => ({ ...scene, objects });

    return {
      scene: createDefaultScene(),
      selection: [],
      ui: initialUI(),
      render: initialRender(),
      past: [],
      future: [],
      revision: 0,

      createObject(type, overrides = {}) {
        const s = get();
        const obj = buildObject(type, overrides, s.scene.objects);
        commit(withObjects(s.scene, [...s.scene.objects, obj]), `create:${obj.id}`, { selection: [obj.id] });
        return obj;
      },

      addObjects(objects, options = {}) {
        if (!objects.length) return;
        const s = get();
        const taken = new Set(s.scene.objects.map((o) => o.id));
        const fresh = objects.map((o) => (taken.has(o.id) ? { ...o, id: newId() } : o));
        commit(withObjects(s.scene, [...s.scene.objects, ...fresh]), `add:${fresh[0].id}`, options.select === false ? {} : { selection: fresh.map((o) => o.id) });
      },

      updateObject(id, patch) {
        const s = get();
        let changed = false;
        const objects = s.scene.objects.map((o) => {
          if (o.id !== id) return o;
          changed = true;
          return { ...o, ...patch, id };
        });
        if (changed) commit(withObjects(s.scene, objects), `update:${id}:${Object.keys(patch).sort().join(',')}`);
      },

      updateObjects(ids, fn) {
        if (!ids.length) return;
        const s = get();
        const set_ = new Set(ids);
        const objects = s.scene.objects.map((o) => (set_.has(o.id) ? fn(o) : o));
        commit(withObjects(s.scene, objects), `updateMany:${ids.join(',')}`);
      },

      setTransform(id, patch) {
        const s = get();
        const objects = s.scene.objects.map((o) => (o.id === id ? { ...o, transform: { ...o.transform, ...patch } } : o));
        commit(withObjects(s.scene, objects), `transform:${id}:${Object.keys(patch).sort().join(',')}`);
      },

      setMaterial(ids, material) {
        const s = get();
        const set_ = new Set(ids);
        const objects = s.scene.objects.map((o) => (set_.has(o.id) ? { ...o, material } : o));
        commit(withObjects(s.scene, objects), `material:${ids.join(',')}`);
      },

      removeObjects(ids) {
        if (!ids.length) return;
        const s = get();
        const set_ = new Set(ids);
        commit(
          withObjects(s.scene, s.scene.objects.filter((o) => !set_.has(o.id))),
          `remove:${ids.join(',')}`,
          { selection: s.selection.filter((id) => !set_.has(id)) },
        );
      },

      duplicateObjects(ids) {
        const s = get();
        const src = s.scene.objects.filter((o) => ids.includes(o.id));
        if (!src.length) return [];
        const copies = src.map((o) => {
          const p = o.transform.position;
          return {
            ...o,
            id: newId(),
            name: `${o.name} copy`,
            transform: { ...o.transform, position: [p[0] + 1.5, p[1], p[2] + 1.5] as [number, number, number] },
          };
        });
        commit(withObjects(s.scene, [...s.scene.objects, ...copies]), `duplicate:${copies[0].id}`, { selection: copies.map((c) => c.id) });
        return copies.map((c) => c.id);
      },

      setSky(patch) {
        const s = get();
        commit({ ...s.scene, sky: { ...s.scene.sky, ...patch } }, `sky:${Object.keys(patch).sort().join(',')}`);
      },

      setCamera(patch) {
        const s = get();
        commit({ ...s.scene, camera: { ...s.scene.camera, ...patch } }, 'camera');
      },

      setRenderSettings(patch) {
        const s = get();
        commit({ ...s.scene, render: { ...s.scene.render, ...patch } }, `render:${Object.keys(patch).sort().join(',')}`);
      },

      setSceneName(name) {
        const s = get();
        commit({ ...s.scene, name }, 'name');
      },

      loadScene(scene, options = {}) {
        const s = get();
        lastKind = '';
        set({
          scene,
          selection: [],
          past: options.keepHistory ? [...s.past, s.scene].slice(-HISTORY_LIMIT) : [],
          future: [],
          revision: s.revision + 1,
          render: { ...s.render, stale: s.render.status !== 'idle' },
        });
      },

      newScene() {
        get().loadScene(emptyScene(), { keepHistory: true });
        set((s) => ({ ui: { ...s.ui, directorCamera: initialUI().directorCamera } }));
      },

      undo() {
        const s = get();
        if (!s.past.length) return;
        const prev = s.past[s.past.length - 1];
        lastKind = '';
        const ids = new Set(prev.objects.map((o) => o.id));
        set({
          scene: prev,
          past: s.past.slice(0, -1),
          future: [s.scene, ...s.future].slice(0, HISTORY_LIMIT),
          selection: s.selection.filter((id) => ids.has(id)),
          revision: s.revision + 1,
          render: s.render.status === 'idle' ? s.render : { ...s.render, stale: true },
        });
      },

      redo() {
        const s = get();
        if (!s.future.length) return;
        const next = s.future[0];
        lastKind = '';
        const ids = new Set(next.objects.map((o) => o.id));
        set({
          scene: next,
          past: [...s.past, s.scene].slice(-HISTORY_LIMIT),
          future: s.future.slice(1),
          selection: s.selection.filter((id) => ids.has(id)),
          revision: s.revision + 1,
          render: s.render.status === 'idle' ? s.render : { ...s.render, stale: true },
        });
      },

      beginGesture() {
        if (!gestureStart) gestureStart = get().scene;
      },

      endGesture() {
        const start = gestureStart;
        gestureStart = null;
        lastKind = '';
        if (!start) return;
        const s = get();
        if (start !== s.scene) set({ past: [...s.past, start].slice(-HISTORY_LIMIT) });
      },

      select(ids, mode = 'replace') {
        const s = get();
        const list = ids === null ? [] : Array.isArray(ids) ? ids : [ids];
        let selection: string[];
        if (mode === 'replace') selection = list;
        else if (mode === 'add') selection = Array.from(new Set([...s.selection, ...list]));
        else {
          const cur = new Set(s.selection);
          for (const id of list) {
            if (cur.has(id)) cur.delete(id);
            else cur.add(id);
          }
          selection = Array.from(cur);
        }
        set({ selection });
      },

      selectAll() {
        set((s) => ({ selection: s.scene.objects.filter((o) => !o.hidden && !o.locked).map((o) => o.id) }));
      },

      selectByType(types) {
        set((s) => ({ selection: s.scene.objects.filter((o) => types.includes(o.type) && !o.hidden).map((o) => o.id) }));
      },

      setUI(patch) {
        const ui = { ...get().ui, ...patch };
        set({ ui });
        if ('skin' in patch || 'showRenderUnderWireframe' in patch || 'autoNano' in patch) savePrefs(ui);
      },

      setHint(text) {
        if (get().ui.hint !== text) set((s) => ({ ui: { ...s.ui, hint: text } }));
      },

      showStatus(text) {
        set((s) => ({ ui: { ...s.ui, status: text } }));
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => set((s) => ({ ui: { ...s.ui, status: '' } })), 3500);
      },

      openLab(kind, targetId = null) {
        set((s) => ({ ui: { ...s.ui, lab: kind, labTarget: targetId, library: null, dialog: null } }));
      },

      closeLab() {
        set((s) => ({ ui: { ...s.ui, lab: null, labTarget: null } }));
      },

      openLibrary(kind) {
        set((s) => ({ ui: { ...s.ui, library: kind, dialog: null } }));
      },

      closeLibrary() {
        set((s) => ({ ui: { ...s.ui, library: null } }));
      },

      openDialog(kind) {
        set((s) => ({ ui: { ...s.ui, dialog: kind } }));
      },

      closeDialog() {
        set((s) => ({ ui: { ...s.ui, dialog: null } }));
      },

      setRenderProgress(progress) {
        set((s) => {
          const starting = progress.status === 'rendering' && s.render.status !== 'rendering' && s.render.status !== 'paused';
          return {
            render: {
              ...s.render,
              ...progress,
              visible: progress.status === 'idle' ? false : progress.status === 'rendering' ? true : s.render.visible,
              stale: starting ? false : s.render.stale,
            },
          };
        });
      },

      setRenderVisible(visible) {
        set((s) => ({ render: { ...s.render, visible } }));
      },
    };
  }),
);

/** Convenience selectors. */
export const selectSelectedObjects = (s: AppState): SceneObject[] =>
  s.scene.objects.filter((o) => s.selection.includes(o.id));

export const selectPrimarySelection = (s: AppState): SceneObject | undefined =>
  s.selection.length ? s.scene.objects.find((o) => o.id === s.selection[s.selection.length - 1]) : undefined;

export const getObject = (id: string | null | undefined): SceneObject | undefined =>
  id ? useStore.getState().scene.objects.find((o) => o.id === id) : undefined;
