/**
 * Pointer, wheel and key handling for the Working window.
 *
 * Left button: click selects (Shift adds, Cmd/Ctrl toggles), empty click deselects, drag on
 * empty space draws a selection marquee. Drag a selected object to move it on the ground plane
 * (Alt/Option = up/down, Shift = one axis, hold X/Y/Z = that axis). Drag box handles to resize
 * (faces: one axis, Shift uniform; corners: all axes; Alt = from center); Cmd/Ctrl-drag a
 * handle rotates (Bryce). R toggles rotate mode (drag spins around Y). Right-drag orbits,
 * middle / Space / Shift+right drag pans, the wheel dollies; ortho views pan and zoom.
 * Double-click opens the object's editor. Edits run inside beginGesture()/endGesture().
 */
import { dolly, editActiveCamera, getActiveCamera, orbit, pan, setActiveCamera } from '@/core/cameraOps';
import { v3 } from '@/core/math';
import { OBJECT_LABELS, isInfinitePlane, isLight, isTerrainLike } from '@/core/objects';
import { useStore } from '@/core/store';
import type { CameraState, SceneObject, Transform, Vec3 } from '@/core/types';
import { FAMILY_NAMES } from '@/core/defaults';
import type { BoxFrame } from '../bounds';
import { getOrthoState } from '../commands';
import { handleAnchor, handleHint, handleWorldPoint, hitHandle, type HandleDef } from '../handles';
import { isOrthoView, pixelRay, worldPerPixel, type OrthoState, type OrthoView } from '../projection';
import {
  constrainDelta,
  dragAngle,
  dragRatio,
  rayPlane,
  rotateTransform,
  rotateVec,
  scaleInFrame,
  snapRatio,
  translate,
  type AxisLock,
} from '../transformOps';
import { useViewport } from '../viewState';
import type { ViewportEngine } from './Engine';
import { hitTag, type Tag } from './overlay2d';

type DragKind = 'pending' | 'move' | 'resize' | 'rotate' | 'marquee' | 'orbit' | 'pan' | 'tag' | 'camera';

interface Drag {
  kind: DragKind;
  /** What a pending drag turns into once the pointer moves past the threshold. */
  armed: DragKind;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  lastAppliedX: number;
  lastAppliedY: number;
  hitId: string | null;
  /** Click (no drag) on an already-selected object narrows a multi-selection to it. */
  narrowOnClick: boolean;
  /** The press landed on a locked selection (dragging it explains why nothing moves). */
  lockedHit: boolean;
  gesture: boolean;
  ids: string[];
  starts: Map<string, Transform>;
  // move
  grab: Vec3;
  planeOnly: boolean;
  // resize
  handle: HandleDef | null;
  frame: BoxFrame | null;
  // rotate
  axis: Vec3;
  pivot: Vec3;
  angle: number;
  /** Free rotation (Cmd/Ctrl + corner): accumulated pitch around the view's right axis. */
  pitch: number;
  grabNow: Vec3;
  free: boolean;
  // camera (navigation start state, or the render camera being dragged)
  cam: CameraState | null;
  cameraPart: 'body' | 'target' | null;
  ortho: OrthoState | null;
  tag: Tag | null;
}

const DRAG_THRESHOLD = 3;
const HANDLE_RADIUS = 7;

function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export class Interaction {
  private engine: ViewportEngine;
  private drag: Drag | null = null;
  private keys = new Set<string>();
  private pointerInside = false;
  private hoverPending = false;
  private hoverX = 0;
  private hoverY = 0;
  private lastHint = '';
  private modifiers = { alt: false, shift: false, mod: false };
  private disposers: (() => void)[] = [];

  constructor(engine: ViewportEngine) {
    this.engine = engine;
    const el = engine.canvas;
    const on = <K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    on(el, 'pointerdown', (e) => this.onPointerDown(e));
    on(el, 'pointermove', (e) => this.onPointerMove(e));
    on(el, 'pointerup', (e) => this.onPointerUp(e, false));
    on(el, 'pointercancel', (e) => this.onPointerUp(e, true));
    on(el, 'pointerenter', () => (this.pointerInside = true));
    on(el, 'pointerleave', () => this.onPointerLeave());
    on(el, 'wheel', (e) => this.onWheel(e), { passive: false });
    on(el, 'dblclick', (e) => this.onDoubleClick(e));
    on(el, 'contextmenu', (e) => e.preventDefault());
    const onKeyDown = (e: KeyboardEvent) => this.onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => this.onKey(e, false);
    const onBlur = () => {
      this.keys.clear();
      this.updateCursor();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    });
  }

  dispose(): void {
    if (this.drag?.gesture) useStore.getState().endGesture();
    this.drag = null;
    this.disposers.forEach((d) => d());
    this.disposers = [];
    this.clearHint();
  }

  // --- pointer ---------------------------------------------------------------

  private local(e: PointerEvent | MouseEvent | WheelEvent): { x: number; y: number } {
    const r = this.engine.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private newDrag(e: PointerEvent, kind: DragKind, armed: DragKind = kind): Drag {
    const p = this.local(e);
    return {
      kind,
      armed,
      pointerId: e.pointerId,
      startX: p.x,
      startY: p.y,
      x: p.x,
      y: p.y,
      lastAppliedX: p.x,
      lastAppliedY: p.y,
      hitId: null,
      narrowOnClick: false,
      lockedHit: false,
      gesture: false,
      ids: [],
      starts: new Map(),
      grab: [0, 0, 0],
      planeOnly: false,
      handle: null,
      frame: null,
      axis: [0, 1, 0],
      pivot: [0, 0, 0],
      angle: 0,
      pitch: 0,
      grabNow: [0, 0, 0],
      free: false,
      cam: null,
      cameraPart: null,
      ortho: null,
      tag: null,
    };
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.drag) return;
    const engine = this.engine;
    if (!engine.view) return;
    const p = this.local(e);
    const store = useStore.getState();
    const mod = e.metaKey || e.ctrlKey;
    let d: Drag;

    if (e.button === 1 || (e.button === 0 && this.keys.has(' ')) || (e.button === 2 && e.shiftKey)) {
      d = this.cameraDrag(e, 'pan');
    } else if (e.button === 2) {
      d = this.cameraDrag(e, isOrthoView(store.ui.view) ? 'pan' : 'orbit');
    } else if (e.button !== 0) {
      return;
    } else {
      d = this.leftDown(e, p, mod);
    }
    this.drag = d;
    try {
      engine.canvas.setPointerCapture(e.pointerId);
    } catch {
      // synthetic or already-released pointers cannot be captured; dragging still works inside the canvas
    }
    if (d.kind !== 'pending' || d.armed !== 'marquee') useViewport.getState().setBitmap(false);
    this.updateCursor();
    e.preventDefault();
  }

  private leftDown(e: PointerEvent, p: { x: number; y: number }, mod: boolean): Drag {
    const engine = this.engine;
    const store = useStore.getState();
    const tag = hitTag(engine.tags, p.x, p.y);
    if (tag) {
      const d = this.newDrag(e, 'tag');
      d.tag = tag;
      return d;
    }
    const g = engine.gizmo;
    const rotateMode = useViewport.getState().rotateMode;
    if (g && g.canTransform && g.defs.length && !rotateMode) {
      const hi = hitHandle(g.points, g.defs, p.x, p.y, HANDLE_RADIUS);
      if (hi >= 0) return this.handleDrag(e, g.ids, g.frame, g.defs[hi], mod);
    }
    if (g && g.canTransform && rotateMode && this.onRing(p.x, p.y, g.frame)) {
      return this.rotateDrag(e, g.ids, g.frame, null);
    }
    const hit = engine.pick(p.x, p.y);
    if (!hit) {
      if (e.altKey) return this.cameraDrag(e, isOrthoView(store.ui.view) ? 'pan' : 'orbit');
      return this.newDrag(e, 'pending', 'marquee');
    }
    if (hit.camera) {
      // The render camera seen from outside: drag its body to move it, its target to aim it.
      const d = this.newDrag(e, 'pending', 'camera');
      d.hitId = hit.id;
      d.cam = store.scene.camera;
      d.cameraPart = hit.camera;
      d.grab = hit.point;
      return d;
    }
    const selected = store.selection.includes(hit.id);
    if (e.shiftKey) store.select(hit.id, 'add');
    else if (mod) store.select(hit.id, 'toggle');
    else if (!selected) store.select(hit.id, 'replace');
    const after = useStore.getState();
    const d = this.newDrag(e, 'pending', 'move');
    d.hitId = hit.id;
    d.narrowOnClick = selected && !e.shiftKey && !mod && after.selection.length > 1;
    if (!after.selection.includes(hit.id)) {
      d.armed = 'marquee';
      return d;
    }
    const objs = after.scene.objects.filter((o) => after.selection.includes(o.id) && !o.hidden);
    const movable = objs.filter((o) => !o.locked);
    if (!movable.length || movable.length !== objs.length) {
      d.armed = 'marquee';
      d.lockedHit = objs.some((o) => o.locked);
      return d;
    }
    d.ids = movable.map((o) => o.id);
    d.starts = new Map(movable.map((o) => [o.id, o.transform]));
    d.grab = hit.point;
    d.planeOnly = movable.every((o) => isInfinitePlane(o.type));
    if (rotateMode && !d.planeOnly && g) {
      d.armed = 'rotate';
      this.setupRotate(d, g.frame, [0, 1, 0], hit.point, false);
    }
    return d;
  }

  private cameraDrag(e: PointerEvent, kind: 'orbit' | 'pan'): Drag {
    const d = this.newDrag(e, kind);
    const view = useStore.getState().ui.view;
    if (isOrthoView(view)) {
      d.ortho = getOrthoState(view);
    } else {
      d.cam = getActiveCamera();
      this.beginEdit(d);
    }
    return d;
  }

  private handleDrag(e: PointerEvent, ids: string[], frame: BoxFrame, handle: HandleDef, rotate: boolean): Drag {
    const s = useStore.getState();
    const objs = s.scene.objects.filter((o) => ids.includes(o.id));
    if (rotate) {
      const axis: Vec3 = handle.kind === 'face' ? frame.axes[handle.axis as 0 | 1 | 2] : [0, 1, 0];
      return this.rotateDrag(e, ids, frame, { axis, grab: handleWorldPoint(frame, handle), free: handle.kind === 'corner' });
    }
    const d = this.newDrag(e, 'resize');
    d.ids = objs.map((o) => o.id);
    d.starts = new Map(objs.map((o) => [o.id, o.transform]));
    d.handle = handle;
    d.frame = frame;
    this.beginEdit(d);
    return d;
  }

  private rotateDrag(e: PointerEvent, ids: string[], frame: BoxFrame, opts: { axis: Vec3; grab: Vec3; free: boolean } | null): Drag {
    const s = useStore.getState();
    const objs = s.scene.objects.filter((o) => ids.includes(o.id));
    const d = this.newDrag(e, 'rotate');
    d.ids = objs.map((o) => o.id);
    d.starts = new Map(objs.map((o) => [o.id, o.transform]));
    const grab = opts?.grab ?? this.ringGrabPoint(frame);
    this.setupRotate(d, frame, opts?.axis ?? [0, 1, 0], grab, opts?.free ?? false);
    this.beginEdit(d);
    return d;
  }

  private setupRotate(d: Drag, frame: BoxFrame, axis: Vec3, grab: Vec3, free: boolean): void {
    d.axis = v3.norm(axis);
    d.pivot = frame.center;
    d.angle = 0;
    d.pitch = 0;
    d.grab = grab;
    d.grabNow = grab;
    d.free = free;
  }

  private beginEdit(d: Drag): void {
    if (d.gesture) return;
    d.gesture = true;
    useStore.getState().beginGesture();
  }

  private onPointerMove(e: PointerEvent): void {
    const p = this.local(e);
    const d = this.drag;
    if (!d || d.pointerId !== e.pointerId) {
      this.hoverX = p.x;
      this.hoverY = p.y;
      if (!this.hoverPending) {
        this.hoverPending = true;
        requestAnimationFrame(() => {
          this.hoverPending = false;
          if (!this.drag && this.pointerInside) this.updateHover(this.hoverX, this.hoverY, e);
        });
      }
      return;
    }
    d.x = p.x;
    d.y = p.y;
    if (d.kind === 'pending' && Math.hypot(p.x - d.startX, p.y - d.startY) > DRAG_THRESHOLD) {
      d.kind = d.armed;
      if (d.lockedHit) useStore.getState().showStatus('Locked objects cannot be moved (unlock them in Attributes)');
      if (d.kind === 'move' || d.kind === 'rotate' || d.kind === 'camera') this.beginEdit(d);
      useViewport.getState().setBitmap(false);
      this.updateCursor();
    }
    this.modifiers = { alt: e.altKey, shift: e.shiftKey, mod: e.metaKey || e.ctrlKey };
    this.engine.requestRender();
  }

  private onPointerUp(e: PointerEvent, cancelled: boolean): void {
    const d = this.drag;
    if (!d || d.pointerId !== e.pointerId) return;
    this.applyPendingDrag();
    this.drag = null;
    const engine = this.engine;
    if (engine.canvas.hasPointerCapture?.(e.pointerId)) engine.canvas.releasePointerCapture(e.pointerId);
    const store = useStore.getState();
    const mod = e.metaKey || e.ctrlKey;
    if (!cancelled) {
      if (d.kind === 'pending') {
        if (d.hitId && d.narrowOnClick) store.select(d.hitId, 'replace');
        else if (!d.hitId && !e.shiftKey && !mod) store.select(null);
      } else if (d.kind === 'marquee') {
        const ids = engine.marquee ? engine.objectsInRect(engine.marquee) : [];
        if (ids.length) store.select(ids, e.shiftKey ? 'add' : mod ? 'toggle' : 'replace');
        else if (!e.shiftKey && !mod) store.select(null);
      } else if (d.kind === 'tag' && d.tag) {
        const p = this.local(e);
        const t = hitTag(engine.tags, p.x, p.y);
        if (t && t.id === d.tag.id) this.runTag(t);
      }
    }
    if (d.gesture) store.endGesture();
    engine.marquee = null;
    engine.rotatingHandles = false;
    this.updateCursor();
    engine.requestRender();
  }

  private onPointerLeave(): void {
    this.pointerInside = false;
    if (this.drag) return;
    this.engine.setHover(null);
    this.engine.hoverHandle = -1;
    this.engine.hoverTag = null;
    this.clearHint();
    this.engine.requestRender();
  }

  private onDoubleClick(e: MouseEvent): void {
    const p = this.local(e);
    const hit = this.engine.pick(p.x, p.y);
    if (!hit || hit.camera) return;
    const s = useStore.getState();
    const o = s.scene.objects.find((x) => x.id === hit.id);
    if (!o) return;
    s.select(o.id, 'replace');
    if (isTerrainLike(o.type)) s.openLab('terrain', o.id);
    else if (isLight(o.type)) s.openDialog('attributes');
    else s.openLab('material', o.id);
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const engine = this.engine;
    const view = engine.view;
    if (!view) return;
    let dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    if (e.ctrlKey) dy *= 4; // trackpad pinch arrives as ctrl+wheel with small deltas
    dy = Math.max(-300, Math.min(300, dy));
    const factor = Math.exp(-dy * 0.0016);
    const mode = useStore.getState().ui.view;
    if (isOrthoView(mode)) {
      const st = getOrthoState(mode);
      const p = this.local(e);
      // Zoom about the cursor: the world point under it stays put.
      const { origin } = pixelRay(view, p.x, p.y);
      const center = st.center;
      const f = view.basis.forward;
      const along = v3.dot(v3.sub(origin, center), f);
      const under = v3.sub(origin, v3.scale(f, along));
      const nextCenter = v3.add(under, v3.scale(v3.sub(center, under), 1 / factor));
      useViewport.getState().setOrtho(mode, { center: nextCenter, halfHeight: Math.min(1e5, Math.max(0.05, st.halfHeight / factor)) });
      return;
    }
    useViewport.getState().setBitmap(false);
    editActiveCamera((c) => {
      const dist = v3.len(v3.sub(c.target, c.position));
      return dolly(c, dist - dist / factor);
    });
  }

  // --- applying drags (once per animation frame) -------------------------------

  applyPendingDrag(): void {
    const d = this.drag;
    if (!d || (d.x === d.lastAppliedX && d.y === d.lastAppliedY)) return;
    const engine = this.engine;
    const view = engine.view;
    if (!view) return;
    const dx = d.x - d.lastAppliedX;
    const dy = d.y - d.lastAppliedY;
    d.lastAppliedX = d.x;
    d.lastAppliedY = d.y;
    switch (d.kind) {
      case 'move':
        this.applyMove(d);
        break;
      case 'camera':
        this.applyCameraMove(d);
        break;
      case 'resize':
        this.applyResize(d);
        break;
      case 'rotate':
        this.applyRotate(d, dx, dy);
        break;
      case 'marquee':
        engine.marquee = {
          x: Math.min(d.startX, d.x),
          y: Math.min(d.startY, d.y),
          w: Math.abs(d.x - d.startX),
          h: Math.abs(d.y - d.startY),
        };
        engine.requestRender();
        break;
      case 'orbit':
        this.applyOrbit(d);
        break;
      case 'pan':
        this.applyPan(d);
        break;
      default:
        break;
    }
  }

  private axisLock(): AxisLock {
    if (this.keys.has('x')) return 'x';
    if (this.keys.has('y')) return 'y';
    if (this.keys.has('z')) return 'z';
    return null;
  }

  private applyMove(d: Drag): void {
    const delta = this.moveDelta(d, d.planeOnly);
    if (!delta) return;
    const starts = d.starts;
    useStore.getState().updateObjects(d.ids, (o) => {
      const t = starts.get(o.id);
      if (!t) return o;
      const next = isInfinitePlane(o.type) ? translate(t, [0, delta[1], 0]) : translate(t, delta);
      return { ...o, transform: next };
    });
  }

  private applyCameraMove(d: Drag): void {
    const cam = d.cam;
    const delta = cam ? this.moveDelta(d, false) : null;
    if (!cam || !delta) return;
    const s = useStore.getState();
    if (d.cameraPart === 'target') s.setCamera({ target: v3.add(cam.target, delta) });
    else s.setCamera({ position: v3.add(cam.position, delta), target: v3.add(cam.target, delta) });
  }

  /** World offset for dragging the grabbed point to the cursor (ground plane, or vertical with Alt/Y). */
  private moveDelta(d: Drag, verticalOnly: boolean): Vec3 | null {
    const view = this.engine.view!;
    const { origin, dir } = pixelRay(view, d.x, d.y);
    const lock = this.axisLock();
    const vertical = verticalOnly || this.modifiers.alt || lock === 'y';
    let delta: Vec3 | null = null;
    if (view.ortho) {
      const f = view.basis.forward;
      const hit = rayPlane(v3.sub(origin, v3.scale(f, 1e5)), f, d.grab, v3.scale(f, -1));
      if (hit) delta = v3.sub(hit, d.grab);
      if (delta && vertical && Math.abs(f[1]) > 0.5) {
        // Looking straight down/up: drag up the screen to raise.
        delta = [0, ((d.startY - d.y) * worldPerPixel(view, 1)), 0];
      }
    } else if (vertical) {
      const f = view.basis.forward;
      let n: Vec3 = [f[0], 0, f[2]];
      if (v3.len(n) < 1e-3) n = [view.basis.up[0], 0, view.basis.up[2]];
      const hit = rayPlane(origin, dir, d.grab, v3.norm(n));
      if (hit) delta = [0, hit[1] - d.grab[1], 0];
    } else {
      const hit = rayPlane(origin, dir, d.grab, [0, 1, 0]);
      if (hit) delta = v3.sub(hit, d.grab);
    }
    if (!delta) return null;
    if (vertical) delta = [0, delta[1], 0];
    else delta = constrainDelta(delta, lock, this.modifiers.shift);
    // Rays grazing the plane run off toward the horizon; keep moves sane.
    const maxMove = Math.max(50, v3.len(v3.sub(view.eye, d.grab)) * 8);
    const len = v3.len(delta);
    return len > maxMove ? v3.scale(delta, maxMove / len) : delta;
  }

  private applyResize(d: Drag): void {
    const h = d.handle;
    const f = d.frame;
    if (!h || !f) return;
    const alt = this.modifiers.alt;
    const shift = this.modifiers.shift;
    const anchor = handleAnchor(f, h, alt);
    const a = this.engine.project(anchor);
    const hp = this.engine.project(handleWorldPoint(f, h));
    let r: number | null = a && hp ? dragRatio(a, hp, { x: d.startX, y: d.startY }, { x: d.x, y: d.y }) : null;
    if (r === null) r = Math.max(0.02, 1 + (d.x - d.startX - (d.y - d.startY)) / 150);
    let ratios: Vec3;
    if (h.kind === 'corner') {
      const u = shift ? snapRatio(r) : r;
      ratios = [u, u, u];
    } else if (shift) {
      ratios = [r, r, r];
    } else {
      ratios = [1, 1, 1];
      ratios[h.axis as 0 | 1 | 2] = r;
    }
    const starts = d.starts;
    useStore.getState().updateObjects(d.ids, (o) => {
      const t = starts.get(o.id);
      return t ? { ...o, transform: scaleInFrame(t, f.axes, ratios, anchor) } : o;
    });
  }

  private applyRotate(d: Drag, dx: number, dy: number): void {
    const engine = this.engine;
    const view = engine.view!;
    if (d.free) {
      d.angle += dx * 0.5;
      d.pitch += dy * 0.5;
    } else {
      const step = dragAngle((p) => engine.project(p), d.pivot, d.axis, d.grabNow, { x: dx, y: dy });
      d.angle += step ?? dx * 0.5;
      d.grabNow = v3.add(d.pivot, rotateVec(v3.sub(d.grab, d.pivot), d.axis, d.angle));
    }
    const snap = (a: number) => (this.modifiers.shift ? Math.round(a / 15) * 15 : a);
    const yaw = snap(d.angle);
    const pitch = d.free ? snap(d.pitch) : 0;
    const right = view.basis.right;
    const starts = d.starts;
    useStore.getState().updateObjects(d.ids, (o) => {
      const t = starts.get(o.id);
      if (!t) return o;
      let next = rotateTransform(t, d.free ? [0, 1, 0] : d.axis, yaw, d.pivot);
      if (d.free && pitch) next = rotateTransform(next, right, pitch, d.pivot);
      return { ...o, transform: next };
    });
  }

  private applyOrbit(d: Drag): void {
    if (!d.cam) return;
    const dx = d.x - d.startX;
    const dy = d.y - d.startY;
    setActiveCamera(orbit(d.cam, -dx * 0.35, dy * 0.35));
  }

  private applyPan(d: Drag): void {
    const view = this.engine.view!;
    const dx = d.x - d.startX;
    const dy = d.y - d.startY;
    const mode = useStore.getState().ui.view;
    if (isOrthoView(mode) && d.ortho) {
      const wpp = worldPerPixel(view, 1);
      const { right, up } = view.basis;
      const c = v3.add(d.ortho.center, v3.add(v3.scale(right, -dx * wpp), v3.scale(up, dy * wpp)));
      useViewport.getState().setOrtho(mode as OrthoView, { ...d.ortho, center: c });
      return;
    }
    if (!d.cam) return;
    const dist = v3.len(v3.sub(d.cam.target, d.cam.position));
    const wpp = worldPerPixel(view, dist);
    setActiveCamera(pan(d.cam, -dx * wpp, dy * wpp));
  }

  // --- hover, hints, cursor ------------------------------------------------------

  private updateHover(x: number, y: number, e: PointerEvent): void {
    const engine = this.engine;
    const mod = e.metaKey || e.ctrlKey;
    const tag = hitTag(engine.tags, x, y);
    engine.hoverTag = tag?.id ?? null;
    const g = engine.gizmo;
    const rotateMode = useViewport.getState().rotateMode;
    const hi = !tag && g && g.canTransform && g.defs.length && !rotateMode ? hitHandle(g.points, g.defs, x, y, HANDLE_RADIUS) : -1;
    if (hi !== engine.hoverHandle || engine.rotatingHandles !== mod) {
      engine.hoverHandle = hi;
      engine.rotatingHandles = mod && hi >= 0;
      engine.requestRender();
    }
    if (tag) {
      engine.setHover(null);
      this.setHint(tag.hint);
      this.setCursor('pointer');
      engine.requestRender();
      return;
    }
    if (hi >= 0 && g) {
      engine.setHover(null);
      const def = g.defs[hi];
      this.setHint(handleHint(def, mod));
      this.setCursor(mod ? 'crosshair' : def.kind === 'corner' ? 'nwse-resize' : def.axis === 1 ? 'ns-resize' : 'ew-resize');
      return;
    }
    if (g && rotateMode && g.canTransform && this.onRing(x, y, g.frame)) {
      engine.setHover(null);
      this.setHint('Rotate around Y · Shift snaps 15°');
      this.setCursor('grab');
      return;
    }
    const hit = engine.pick(x, y);
    if (hit?.camera) {
      engine.setHover(null);
      this.setHint(hit.camera === 'body' ? 'Render camera: drag to move it · Alt up/down' : 'Camera target: drag to aim the camera');
      this.setCursor('grab');
      return;
    }
    engine.setHover(hit?.id ?? null);
    const s = useStore.getState();
    const o = hit ? s.scene.objects.find((x2) => x2.id === hit.id) : undefined;
    if (o) {
      this.setHint(objectHint(o, s.selection.includes(o.id), rotateMode));
      this.setCursor(s.selection.includes(o.id) && !o.locked ? (rotateMode && !isInfinitePlane(o.type) ? 'grab' : 'move') : 'pointer');
      return;
    }
    this.setHint(
      isOrthoView(s.ui.view)
        ? 'Drag: select box · Right-drag or Space-drag: pan · Wheel: zoom'
        : 'Drag: select box · Right-drag: orbit · Space-drag: pan · Wheel: dolly',
    );
    this.setCursor(this.keys.has(' ') ? 'grab' : 'default');
  }

  private setHint(text: string): void {
    this.lastHint = text;
    useStore.getState().setHint(text);
  }

  private clearHint(): void {
    if (this.lastHint && useStore.getState().ui.hint === this.lastHint) useStore.getState().setHint('');
    this.lastHint = '';
  }

  private setCursor(c: string): void {
    if (this.engine.canvas.style.cursor !== c) this.engine.canvas.style.cursor = c;
  }

  private updateCursor(): void {
    const d = this.drag;
    if (!d) {
      if (this.keys.has(' ') && this.pointerInside) this.setCursor('grab');
      return;
    }
    if (d.kind === 'pan' || d.kind === 'orbit' || d.kind === 'rotate' || d.kind === 'camera') this.setCursor('grabbing');
    else if (d.kind === 'marquee') this.setCursor('crosshair');
    else if (d.kind === 'move') this.setCursor('move');
  }

  // --- keys ------------------------------------------------------------------------

  private onKey(e: KeyboardEvent, down: boolean): void {
    const s = useStore.getState();
    const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
    if (!down) {
      this.keys.delete(k);
      if (k === ' ') this.updateCursor();
      if ((k === 'x' || k === 'y' || k === 'z') && this.drag) this.engine.requestRender();
      return;
    }
    if (typing(e) || s.ui.keyboardCaptured || s.ui.lab || s.ui.dialog || s.ui.library) return;
    const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (k === ' ' && (this.pointerInside || this.drag)) {
      e.preventDefault();
      this.keys.add(' ');
      this.updateCursor();
      return;
    }
    if ((k === 'x' || k === 'y' || k === 'z') && plain) {
      this.keys.add(k);
      if (this.drag) this.engine.requestRender();
      return;
    }
    if (k === 'r' && plain && !e.repeat) {
      const vp = useViewport.getState();
      vp.setRotateMode(!vp.rotateMode);
      s.showStatus(vp.rotateMode ? 'Rotate mode off' : 'Rotate mode: drag a selected object to spin it (R to exit)');
      this.engine.requestRender();
      return;
    }
    if (k === 'escape' && useViewport.getState().rotateMode) useViewport.getState().setRotateMode(false);
    if ((k === 'meta' || k === 'control') && this.engine.hoverHandle >= 0) {
      this.engine.rotatingHandles = true;
      this.engine.requestRender();
    }
  }

  // --- tags and rotate ring --------------------------------------------------------

  private runTag(t: Tag): void {
    const s = useStore.getState();
    const id = s.selection[s.selection.length - 1];
    const o = s.scene.objects.find((x) => x.id === id);
    if (!o) return;
    switch (t.id) {
      case 'attributes':
        s.openDialog('attributes');
        break;
      case 'material':
        s.openLab('material', o.id);
        break;
      case 'edit':
        s.openLab('terrain', o.id);
        break;
      case 'family': {
        const next = ((o.family ?? 0) + 1) % FAMILY_NAMES.length;
        s.updateObject(o.id, { family: next });
        s.showStatus(`Family: ${FAMILY_NAMES[next]}`);
        break;
      }
    }
  }

  private onRing(x: number, y: number, frame: BoxFrame): boolean {
    const pts = this.engine.rotateRing(frame);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (!a || !b) continue;
      if (distToSegment(x, y, a, b) <= 6) return true;
    }
    return false;
  }

  private ringGrabPoint(frame: BoxFrame): Vec3 {
    const r = Math.max(0.3, Math.hypot(frame.half[0], frame.half[2]) * 1.15);
    return [frame.center[0] + r, frame.center[1], frame.center[2]];
  }
}

function distToSegment(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2)) : 0;
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function objectHint(o: SceneObject, selected: boolean, rotateMode: boolean): string {
  const label = OBJECT_LABELS[o.type];
  if (!selected) return `${o.name} (${label})`;
  if (o.locked) return `${o.name} (${label}, locked)`;
  const who = `${o.name} (${label})`;
  if (isInfinitePlane(o.type)) return `${who}: drag to raise or lower`;
  if (rotateMode) return `${who}: drag to rotate around Y · Shift snaps 15°`;
  return `${who}: drag to move · Alt up/down · Shift one axis · R rotate`;
}
