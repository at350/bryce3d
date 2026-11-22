/**
 * ViewportEngine: owns the WebGL renderer and the three.js scenes of the Working window,
 * keeps them in sync with the store (diffing objects by identity), and renders on demand.
 * Input handling lives in Interaction; the React component only provides the DOM.
 */
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  HemisphereLight,
  Matrix4,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { SELECTED_COLOR } from '@/core/defaults';
import { DEG, cameraBasis, clamp, sunDirection, v3 } from '@/core/math';
import { isInfinitePlane, isLight } from '@/core/objects';
import { useStore, type AppState } from '@/core/store';
import type { SceneObject, Vec3 } from '@/core/types';
import { getRenderer } from '@/render';
import { boxPoint, groupBoxFrame, objectBoxFrame, type BoxFrame } from '../bounds';
import { getOrthoState } from '../commands';
import { handleWorldPoint, handlesFor, visibleHandleMask, type HandleDef } from '../handles';
import {
  applyViewToCamera,
  fitFrame,
  frameMargin,
  horizonLine,
  isOrthoView,
  orthoView,
  perspectiveView,
  pixelRay,
  projectPoint,
  worldPerPixel,
  type Rect,
  type ScreenPoint,
  type ViewInfo,
} from '../projection';
import { rayPlane } from '../transformOps';
import { useViewport, type ViewportState } from '../viewState';
import { boxWire, cameraGlyph, SegmentBuilder } from '../wireShapes';
import { Interaction } from './Interaction';
import { LineMaterials } from './lineMaterials';
import { ObjectView, type ViewDeps } from './ObjectView';
import { drawOverlay, layoutTags, type Tag, type TagId } from './overlay2d';
import { CAMERA_TINT, PAPER, PAPER_CSS, familyColor } from './palette';
import { paperTexture } from './paper';
import { gridLineDistancePx } from './planeGrid';
import { RefCache } from './refCache';
import { SkyDome } from './solid';

export interface EngineHost {
  root: HTMLDivElement;
  glCanvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  renderHolder: HTMLDivElement;
}

/** The selection's bounding box and handles as last drawn (also used for hit testing). */
export interface SelectionGizmo {
  ids: string[];
  primary: SceneObject;
  frame: BoxFrame;
  defs: HandleDef[];
  points: (ScreenPoint | null)[];
  /** Screen rectangle around the box (for the tag buttons). */
  rect: Rect | null;
  canTransform: boolean;
}

export interface PickHit {
  id: string;
  point: Vec3;
  plane: boolean;
  /** Director / ortho views: the render camera's body or its target cross. */
  camera?: 'body' | 'target';
}

/** Pick id of the render camera glyph (not a scene object). */
export const CAMERA_PICK = '__camera';

const _m = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _s = new Vector3();

export class ViewportEngine {
  readonly host: EngineHost;
  readonly renderer: WebGLRenderer;
  view: ViewInfo | null = null;
  gizmo: SelectionGizmo | null = null;
  tags: Tag[] = [];
  /** Transient overlay state driven by Interaction. */
  hoverId: string | null = null;
  hoverHandle = -1;
  hoverTag: TagId | null = null;
  marquee: Rect | null = null;
  rotatingHandles = false;
  dpr = 1;
  width = 0;
  height = 0;

  private wireScene = new Scene();
  private gizmoScene = new Scene();
  private solidScene = new Scene();
  private persp = new PerspectiveCamera();
  private ortho = new OrthographicCamera();
  private views = new Map<string, ObjectView>();
  private lines = new LineMaterials();
  private wireGeoms = new RefCache<LineSegmentsGeometry>();
  private solidGeoms = new RefCache<BufferGeometry>();
  private pickGeoms = new RefCache<BufferGeometry>();
  private pickMaterial = new MeshBasicMaterial({ side: DoubleSide });
  private raycaster = new Raycaster();
  private deps: ViewDeps;
  private boxGeometry = new LineSegmentsGeometry();
  private boxLines: LineSegments2;
  private cameraBody: LineSegments2;
  private cameraBodyGeometry = new LineSegmentsGeometry();
  private frustum: LineSegments2;
  private frustumGeometry = new LineSegmentsGeometry();
  private frustumKey = '';
  private sky = new SkyDome();
  private sun = new DirectionalLight(0xffffff, 2.4);
  private hemi = new HemisphereLight(0xbcd0ff, 0x4a4036, 1.1);
  private ambient = new AmbientLight(0xffffff, 0.3);
  /** A soft light from the eye so shapes always read in solid mode. */
  private headlight = new DirectionalLight(0xffffff, 0.55);
  private depthFog = new Fog(new Color().setRGB(PAPER[0], PAPER[1], PAPER[2], SRGBColorSpace), 30, 300);
  private hazeFog = new Fog(0xffffff, 150, 4000);
  private orthoBackground = new Color();
  private overlayCtx: CanvasRenderingContext2D | null;
  private interaction: Interaction;
  private raf = 0;
  private inFrame = false;
  private dirty = true;
  private unsubs: (() => void)[] = [];
  private resizeObserver: ResizeObserver;
  private outputCanvas: HTMLCanvasElement | null = null;
  private disposed = false;
  private rootBackground = '';

  constructor(host: EngineHost) {
    this.host = host;
    this.renderer = new WebGLRenderer({ canvas: host.glCanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.overlayCtx = host.overlay.getContext('2d');

    this.deps = {
      wireScene: this.wireScene,
      gizmoScene: this.gizmoScene,
      solidScene: this.solidScene,
      lines: this.lines,
      wireGeoms: this.wireGeoms,
      solidGeoms: this.solidGeoms,
      pickGeoms: this.pickGeoms,
      pickMaterial: this.pickMaterial,
    };

    this.boxGeometry.setPositions(boxWire());
    this.boxLines = new LineSegments2(this.boxGeometry, this.lines.get({ color: SELECTED_COLOR, width: 1, opacity: 0.55 }));
    this.boxLines.matrixAutoUpdate = false;
    this.boxLines.renderOrder = 10;
    this.cameraBodyGeometry.setPositions(cameraGlyph());
    this.cameraBody = new LineSegments2(this.cameraBodyGeometry, this.lines.get({ color: CAMERA_TINT, width: 1.25 }));
    this.cameraBody.matrixAutoUpdate = false;
    this.frustum = new LineSegments2(this.frustumGeometry, this.lines.get({ color: CAMERA_TINT, width: 1, opacity: 0.6 }));
    this.frustum.matrixAutoUpdate = false;
    this.gizmoScene.add(this.boxLines, this.cameraBody, this.frustum);

    this.solidScene.add(this.sky.mesh, this.sun, this.sun.target, this.hemi, this.ambient, this.headlight, this.headlight.target);
    this.solidScene.fog = this.hazeFog;

    this.attachOutputCanvas();
    this.syncObjects(useStore.getState().scene.objects);
    this.restyleAll();

    this.unsubs.push(useStore.subscribe((s, prev) => this.onStore(s, prev)));
    this.unsubs.push(useViewport.subscribe((v, prev) => this.onViewport(v, prev)));
    this.resizeObserver = new ResizeObserver(() => this.requestRender());
    this.resizeObserver.observe(host.root);
    this.interaction = new Interaction(this);
    this.requestRender();
  }

  // --- public API used by Interaction ---------------------------------------

  requestRender(): void {
    this.dirty = true;
    if (this.raf || this.inFrame || this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  get canvas(): HTMLCanvasElement {
    return this.host.overlay;
  }

  project(p: Vec3): ScreenPoint | null {
    if (!this.view) return null;
    const s = projectPoint(this.view, p);
    return this.view.ortho || s.depth > this.view.near ? s : null;
  }

  objectView(id: string): ObjectView | undefined {
    return this.views.get(id);
  }

  /** The object (or infinite plane grid line) under a canvas point. */
  pick(px: number, py: number): PickHit | null {
    const view = this.view;
    if (!view) return null;
    const s = useStore.getState();
    if (s.ui.view !== 'camera') {
      const cam = s.scene.camera;
      const body = this.project(cam.position);
      if (body && Math.hypot(body.x - px, body.y - py) <= 14) return { id: CAMERA_PICK, point: [...cam.position] as Vec3, plane: false, camera: 'body' };
      const aim = this.project(cam.target);
      if (aim && Math.hypot(aim.x - px, aim.y - py) <= 7) return { id: CAMERA_PICK, point: [...cam.target] as Vec3, plane: false, camera: 'target' };
    }
    const { origin, dir } = pixelRay(view, px, py);
    this.raycaster.set(_v.set(...origin), _s.set(...dir));
    const meshes = [];
    for (const v of this.views.values()) if (v.pick && !v.obj.hidden) meshes.push(v.pick);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      const h = hits[0];
      return { id: h.object.userData.objectId as string, point: [h.point.x, h.point.y, h.point.z], plane: false };
    }
    let best: PickHit | null = null;
    let bestT = Infinity;
    for (const v of this.views.values()) {
      if (!v.plane || v.obj.hidden) continue;
      const y = v.obj.transform.position[1];
      if (view.ortho && Math.abs(view.basis.forward[1]) < 0.5) {
        // Edge-on: the plane is a horizontal line; pick within a few pixels of it.
        const s = projectPoint(view, [origin[0], y, origin[2]]);
        if (Math.abs(s.y - py) <= 4) return { id: v.obj.id, point: [origin[0], y, origin[2]], plane: true };
        continue;
      }
      const hit = rayPlane(origin, dir, [0, y, 0], [0, 1, 0]);
      if (!hit) continue;
      const t = v3.len(v3.sub(hit, origin));
      if (t >= bestT) continue;
      if (gridLineDistancePx(view, hit, v.plane.level, view.eye) <= 4) {
        best = { id: v.obj.id, point: hit, plane: true };
        bestT = t;
      }
    }
    return best;
  }

  /** Ids of visible, non-plane objects whose center projects inside a canvas rectangle. */
  objectsInRect(r: Rect): string[] {
    const out: string[] = [];
    if (!this.view) return out;
    for (const v of this.views.values()) {
      const o = v.obj;
      if (o.hidden || v.plane) continue;
      const p = this.project(objectBoxFrame(o).center);
      if (p && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) out.push(o.id);
    }
    return out;
  }

  setHover(id: string | null): void {
    if (id === this.hoverId) return;
    const prev = this.hoverId;
    this.hoverId = id;
    if (prev) this.restyle(prev);
    if (id) this.restyle(id);
    this.requestRender();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.interaction.dispose();
    this.unsubs.forEach((u) => u());
    this.resizeObserver.disconnect();
    this.views.forEach((v) => v.dispose());
    this.views.clear();
    this.wireGeoms.dispose();
    this.solidGeoms.dispose();
    this.pickGeoms.dispose();
    this.lines.dispose();
    this.pickMaterial.dispose();
    this.boxGeometry.dispose();
    this.cameraBodyGeometry.dispose();
    this.frustumGeometry.dispose();
    this.sky.dispose();
    this.sun.dispose();
    this.hemi.dispose();
    this.ambient.dispose();
    this.headlight.dispose();
    if (this.outputCanvas && this.outputCanvas.parentElement === this.host.renderHolder) this.host.renderHolder.removeChild(this.outputCanvas);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // --- store sync ------------------------------------------------------------

  private onStore(s: AppState, prev: AppState): void {
    let changed = false;
    if (s.scene.objects !== prev.scene.objects) {
      this.syncObjects(s.scene.objects);
      changed = true;
    }
    if (s.selection !== prev.selection) {
      this.onSelectionChange(s, prev);
      changed = true;
    }
    if (s.render !== prev.render) {
      const started = s.render.status === 'rendering' && prev.render.status !== 'rendering' && prev.render.status !== 'paused';
      if (started) useViewport.getState().setBitmap(true);
      changed = true;
    }
    const ui = s.ui;
    const pui = prev.ui;
    if (
      changed ||
      s.scene !== prev.scene ||
      ui.view !== pui.view ||
      ui.display !== pui.display ||
      ui.directorCamera !== pui.directorCamera ||
      ui.showRenderUnderWireframe !== pui.showRenderUnderWireframe
    ) {
      if (ui.view !== pui.view) this.setHover(null);
      this.requestRender();
    }
  }

  private onSelectionChange(s: AppState, prev: AppState): void {
    const touched = new Set([...s.selection, ...prev.selection]);
    touched.forEach((id) => this.restyle(id));
    const vp = useViewport.getState();
    if (!s.selection.length) {
      if (s.render.visible && !s.render.stale) vp.setBitmap(true);
    } else {
      vp.setBitmap(false);
    }
  }

  private onViewport(v: ViewportState, prev: ViewportState): void {
    if (v.depthCue !== prev.depthCue) this.restyleAll();
    if (v.depthCue !== prev.depthCue || v.rotateMode !== prev.rotateMode || v.ortho !== prev.ortho || v.bitmap !== prev.bitmap) this.requestRender();
  }

  private syncObjects(objects: SceneObject[]): void {
    const seen = new Set<string>();
    const solidMode = useStore.getState().ui.display === 'solid';
    for (const o of objects) {
      seen.add(o.id);
      const existing = this.views.get(o.id);
      if (existing) {
        existing.update(o);
      } else {
        const view = new ObjectView(o, this.deps);
        this.views.set(o.id, view);
        this.restyle(o.id);
      }
      if (solidMode) this.views.get(o.id)!.ensureSolid();
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      v.dispose();
      this.views.delete(id);
      if (this.hoverId === id) this.hoverId = null;
    }
    for (const [id, v] of this.views) if (v.isPlane) this.restyle(id);
  }

  private restyle(id: string): void {
    const v = this.views.get(id);
    if (!v) return;
    v.setStyle({
      selected: useStore.getState().selection.includes(id),
      hovered: this.hoverId === id,
      depthCue: useViewport.getState().depthCue,
      submerged: v.isPlane && this.isSubmerged(v.obj),
    });
  }

  /** Where wireframe shadows fall: the highest visible water/ground plane, else y = 0. */
  private groundHeight(): number {
    let y = -Infinity;
    for (const v of this.views.values()) {
      if (!v.isPlane || v.obj.hidden || v.obj.type === 'cloud') continue;
      y = Math.max(y, v.obj.transform.position[1]);
    }
    return Number.isFinite(y) ? y : 0;
  }

  /** A water/ground plane with another one above it (a sea floor under the sea). */
  private isSubmerged(o: SceneObject): boolean {
    if (o.type === 'cloud') return false;
    const y = o.transform.position[1];
    for (const v of this.views.values()) {
      const p = v.obj;
      if (p === o || p.hidden || !v.isPlane || p.type === 'cloud') continue;
      if (p.transform.position[1] > y) return true;
    }
    return false;
  }

  private restyleAll(): void {
    for (const id of this.views.keys()) this.restyle(id);
  }

  // --- rendering -------------------------------------------------------------

  private frame = (): void => {
    this.raf = 0;
    if (this.disposed) return;
    this.inFrame = true;
    try {
      this.interaction.applyPendingDrag();
      if (this.dirty) {
        this.dirty = false;
        this.renderNow();
      }
    } finally {
      this.inFrame = false;
    }
    if (this.dirty) this.raf = requestAnimationFrame(this.frame);
  };

  private resize(): boolean {
    const w = Math.max(1, Math.round(this.host.root.clientWidth));
    const h = Math.max(1, Math.round(this.host.root.clientHeight));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.width && h === this.height && dpr === this.dpr) return false;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.host.overlay.width = Math.round(w * dpr);
    this.host.overlay.height = Math.round(h * dpr);
    return true;
  }

  private computeView(s: AppState): ViewInfo {
    const { width: w, height: h } = this;
    const doc = s.scene.render;
    const aspect = doc.width > 0 && doc.height > 0 ? doc.width / doc.height : 4 / 3;
    const mode = s.ui.view;
    if (isOrthoView(mode)) return orthoView(mode, getOrthoState(mode), w, h);
    const frame = fitFrame(w, h, aspect, frameMargin(w, h));
    const cam = mode === 'camera' ? s.scene.camera : s.ui.directorCamera;
    return perspectiveView(cam, aspect, w, h, frame);
  }

  private renderNow(): void {
    this.resize();
    const s = useStore.getState();
    const vp = useViewport.getState();
    const view = this.computeView(s);
    this.view = view;
    vp.setLayout(view.frame, { w: this.width, h: this.height });
    const camera = applyViewToCamera(view, this.persp, this.ortho);
    const solid = s.ui.display === 'solid';

    // Render image layer and whether wireframes are drawn over it.
    const r = s.render;
    const imageShown = s.ui.view === 'camera' && r.visible && r.status !== 'idle';
    const imageFresh = imageShown && !r.stale;
    const wires = !(imageFresh && vp.bitmap);
    this.updateRenderLayer(view, imageShown ? (r.stale ? (s.ui.showRenderUnderWireframe && !solid ? 0.35 : 0) : 1) : 0, r.status === 'rendering' && s.scene.render.mosaic);
    this.updateBackground(solid && wires);

    const ground = this.groundHeight();
    for (const v of this.views.values()) {
      if (solid) v.ensureSolid();
      v.updateForView(view, this.dpr);
      v.setShadowHeight(ground);
    }
    this.updateCameraGizmo(s, view);
    this.gizmo = wires ? this.computeGizmo(s) : null;
    this.updateSelectionBox();

    const dist = s.ui.view === 'camera' ? v3.len(v3.sub(s.scene.camera.target, s.scene.camera.position)) : s.ui.view === 'director' ? v3.len(v3.sub(s.ui.directorCamera.target, s.ui.directorCamera.position)) : 0;
    this.wireScene.fog = vp.depthCue && !view.ortho ? this.depthFog : null;
    if (dist > 0) {
      this.depthFog.near = dist * 0.8;
      this.depthFog.far = dist * 7 + 40;
    }

    this.renderer.clear();
    if (wires) {
      if (solid) {
        this.updateSolidLighting(s, view);
        this.renderer.render(this.solidScene, camera);
      } else {
        this.renderer.render(this.wireScene, camera);
      }
      this.renderer.render(this.gizmoScene, camera);
    }
    this.drawOverlay(s, view, wires, solid);
  }

  private updateRenderLayer(view: ViewInfo, opacity: number, pixelated: boolean): void {
    const holder = this.host.renderHolder;
    const f = view.frame;
    holder.style.display = opacity > 0 ? 'block' : 'none';
    if (opacity <= 0) return;
    holder.style.left = `${f.x}px`;
    holder.style.top = `${f.y}px`;
    holder.style.width = `${f.w}px`;
    holder.style.height = `${f.h}px`;
    holder.style.opacity = String(opacity);
    if (this.outputCanvas) this.outputCanvas.style.imageRendering = pixelated ? 'pixelated' : 'auto';
  }

  private updateBackground(solid: boolean): void {
    const bg = solid ? 'transparent' : 'paper';
    if (bg === this.rootBackground) return;
    this.rootBackground = bg;
    const root = this.host.root;
    if (solid) {
      root.style.backgroundImage = 'none';
      root.style.backgroundColor = '#9fb3cc';
      return;
    }
    const tex = paperTexture();
    root.style.backgroundColor = PAPER_CSS;
    root.style.backgroundImage = tex ? `url(${tex})` : 'none';
    root.style.backgroundSize = '256px 256px';
  }

  private updateSolidLighting(s: AppState, view: ViewInfo): void {
    const sky = s.scene.sky;
    const dir = sunDirection(sky.sunAzimuth, sky.sunAltitude);
    const day = sky.sunAltitude > -2;
    this.sun.position.set(dir[0] * 1000, Math.max(dir[1], 0.05) * 1000, dir[2] * 1000);
    this.sun.color.setRGB(sky.sunColor[0], sky.sunColor[1], sky.sunColor[2], SRGBColorSpace);
    this.sun.intensity = day ? 2.6 : 0.5;
    this.hemi.color.setRGB(sky.skyDomeColor[0], sky.skyDomeColor[1], sky.skyDomeColor[2], SRGBColorSpace);
    this.hemi.intensity = day ? 1.1 : 0.4;
    this.ambient.color.setRGB(sky.ambientColor[0], sky.ambientColor[1], sky.ambientColor[2], SRGBColorSpace);
    this.ambient.intensity = clamp(sky.ambient / 100, 0, 1) * 0.9;
    this.hazeFog.color.setRGB(sky.horizonColor[0], sky.horizonColor[1], sky.horizonColor[2], SRGBColorSpace);
    this.headlight.position.set(...view.eye);
    this.headlight.target.position.set(...v3.add(view.eye, view.basis.forward));
    this.headlight.target.updateMatrixWorld();
    this.hazeFog.near = 200;
    this.hazeFog.far = 6000 - clamp(sky.haze, 0, 100) * 40;
    if (view.ortho) {
      this.sky.mesh.visible = false;
      this.orthoBackground.setRGB(sky.horizonColor[0], sky.horizonColor[1], sky.horizonColor[2], SRGBColorSpace);
      this.solidScene.background = this.orthoBackground;
      this.solidScene.fog = null;
    } else {
      this.sky.mesh.visible = true;
      this.solidScene.background = null;
      this.solidScene.fog = this.hazeFog;
      this.sky.update(sky, view.eye, view.far * 0.8);
    }
  }

  /** The render camera as a little film camera with its view frustum (director and ortho views). */
  private updateCameraGizmo(s: AppState, view: ViewInfo): void {
    const show = s.ui.view !== 'camera';
    this.cameraBody.visible = this.frustum.visible = show;
    if (!show) return;
    const cam = s.scene.camera;
    const { right, up, forward } = cameraBasis(cam);
    _m.makeBasis(_v.set(...right), _s.set(...up), new Vector3(-forward[0], -forward[1], -forward[2]));
    _q.setFromRotationMatrix(_m);
    const depth = view.ortho ? 1 : Math.max(0.1, projectPoint(view, cam.position).depth);
    const size = worldPerPixel(view, depth) * 30;
    this.cameraBody.matrix.compose(_v.set(...cam.position), _q, _s.set(size, size, size));
    this.cameraBody.matrixWorldNeedsUpdate = true;

    const doc = s.scene.render;
    const aspect = doc.width > 0 && doc.height > 0 ? doc.width / doc.height : 4 / 3;
    const key = `${cam.fov}:${aspect}`;
    if (key !== this.frustumKey) {
      this.frustumKey = key;
      const t = Math.tan((cam.fov * DEG) / 2);
      const tx = t * aspect;
      const b = new SegmentBuilder();
      const corners: Vec3[] = [
        [-tx, -t, -1],
        [tx, -t, -1],
        [tx, t, -1],
        [-tx, t, -1],
      ];
      corners.forEach((c) => b.seg([0, 0, 0], c));
      b.polyline(corners, true);
      b.seg([0, 0, 0], [0, 0, -1]);
      b.seg([-0.04, 0, -1], [0.04, 0, -1]).seg([0, -0.04, -1], [0, 0.04, -1]);
      this.frustumGeometry.dispose();
      this.frustumGeometry = new LineSegmentsGeometry();
      this.frustumGeometry.setPositions(b.build());
      this.frustum.geometry = this.frustumGeometry;
    }
    const dist = Math.max(0.5, v3.len(v3.sub(cam.target, cam.position)));
    this.frustum.matrix.compose(_v.set(...cam.position), _q, _s.set(dist, dist, dist));
    this.frustum.matrixWorldNeedsUpdate = true;
  }

  private computeGizmo(s: AppState): SelectionGizmo | null {
    const selected = s.scene.objects.filter((o) => !o.hidden && s.selection.includes(o.id));
    const boxed = selected.filter((o) => !isInfinitePlane(o.type));
    if (!boxed.length) {
      this.tags = this.computeTags(selected, null);
      return null;
    }
    const primary = boxed[boxed.length - 1];
    const frame = boxed.length === 1 ? objectBoxFrame(primary) : groupBoxFrame(boxed);
    if (!frame) return null;
    const canTransform = boxed.every((o) => !o.locked);
    const resizable = canTransform && !boxed.every((o) => isLight(o.type));
    // Screen rectangle of the box corners in front of the eye.
    let rect: Rect | null = null;
    const pts: ScreenPoint[] = [];
    for (let i = 0; i < 8; i++) {
      const p = this.project(boxPoint(frame, [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]));
      if (p) pts.push(p);
    }
    if (pts.length) {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      rect = { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
    }
    const all = resizable ? handlesFor(frame) : [];
    const allPoints = all.map((d) => this.project(handleWorldPoint(frame, d)));
    const keep = visibleHandleMask(all, allPoints, rect);
    const defs = all.filter((_, i) => keep[i]);
    const points = allPoints.filter((_, i) => keep[i]);
    const gizmo: SelectionGizmo = { ids: boxed.map((o) => o.id), primary, frame, defs, points, rect, canTransform };
    this.tags = this.computeTags(selected, rect);
    return gizmo;
  }

  /** Bryce's little buttons beside a single selection: Attributes, Materials, Edit, Family. */
  private computeTags(selected: SceneObject[], rect: Rect | null): Tag[] {
    if (selected.length !== 1) return [];
    const o = selected[0];
    let r = rect;
    if (!r && isInfinitePlane(o.type) && this.view) {
      // Planes have no box: put the buttons near the top-right of the frame.
      const f = this.view.frame;
      r = { x: f.x + f.w - 40, y: f.y + 12, w: 0, h: 0 };
    }
    if (!r) return [];
    const items: { id: TagId; label: string; hint: string; color?: [number, number, number] }[] = [
      { id: 'attributes', label: 'A', hint: `Object Attributes: ${o.name}` },
    ];
    if (!isLight(o.type)) items.push({ id: 'material', label: 'M', hint: 'Materials Lab' });
    if (o.type === 'terrain' || o.type === 'lattice') items.push({ id: 'edit', label: 'E', hint: 'Edit Terrain' });
    items.push({ id: 'family', label: '', hint: `Family color: click to change`, color: familyColor(o) });
    return layoutTags(r, items, this.width, this.height);
  }

  private updateSelectionBox(): void {
    const g = this.gizmo;
    const show = !!g && !(g.ids.length === 1 && isLight(g.primary.type));
    this.boxLines.visible = show;
    if (!g || !show) return;
    const f = g.frame;
    _m.makeBasis(_v.set(...f.axes[0]), _s.set(...f.axes[1]), new Vector3(...f.axes[2]));
    _q.setFromRotationMatrix(_m);
    const half = f.half.map((h) => Math.max(h, 1e-4)) as Vec3;
    this.boxLines.matrix.compose(_v.set(...f.center), _q, _s.set(...half));
    this.boxLines.matrixWorldNeedsUpdate = true;
  }

  private drawOverlay(s: AppState, view: ViewInfo, wires: boolean, solid: boolean): void {
    const ctx = this.overlayCtx;
    if (!ctx) return;
    const g = this.gizmo;
    const rotateMode = useViewport.getState().rotateMode;
    const ring = wires && g && g.canTransform && rotateMode ? this.rotateRing(g.frame) : null;
    drawOverlay(
      ctx,
      {
        width: this.width,
        height: this.height,
        frame: view.frame,
        documentFrame: s.ui.view === 'camera',
        horizon: wires && !solid ? horizonLine(view) : null,
        centerMark: wires && !solid && s.ui.view === 'camera',
        handles: wires && g && g.defs.length && !rotateMode ? { points: g.points, defs: g.defs, hover: this.hoverHandle, rotating: this.rotatingHandles } : null,
        tags: wires ? this.tags : [],
        hoverTag: this.hoverTag,
        marquee: this.marquee,
        ring,
        axes: [
          [view.basis.right[0], -view.basis.up[0]],
          [view.basis.right[1], -view.basis.up[1]],
          [view.basis.right[2], -view.basis.up[2]],
        ],
      },
      this.dpr,
    );
  }

  /** Screen polyline of the rotate-mode ring (horizontal circle around the selection). */
  rotateRing(f: BoxFrame): ({ x: number; y: number } | null)[] {
    const r = Math.max(0.3, Math.hypot(f.half[0], f.half[2]) * 1.15, Math.max(...f.half) * 0.6);
    const pts: ({ x: number; y: number } | null)[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(this.project([f.center[0] + Math.cos(a) * r, f.center[1], f.center[2] + Math.sin(a) * r]));
    }
    return pts;
  }

  private attachOutputCanvas(): void {
    try {
      const out = getRenderer().outputCanvas;
      out.style.width = '100%';
      out.style.height = '100%';
      out.style.display = 'block';
      this.host.renderHolder.appendChild(out);
      this.outputCanvas = out;
    } catch {
      this.outputCanvas = null;
    }
  }
}
