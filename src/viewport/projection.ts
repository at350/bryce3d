/**
 * View and projection math for the Working window (pure, no DOM).
 *
 * Perspective views follow the SPEC camera model exactly: basis from cameraBasis(cam),
 * vertical fov, aspect = document width / height. The document frame is a rectangle inside
 * the canvas; the canvas frustum is the frame's frustum extended (off-axis) to the canvas
 * edges, so a point lands on the same frame pixel as in the ray-traced render.
 */
import { Matrix4, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { DEG, cameraBasis, clamp, v3 } from '@/core/math';
import type { CameraState, Vec3, ViewMode } from '@/core/types';

export type OrthoView = Exclude<ViewMode, 'camera' | 'director'>;
export const ORTHO_VIEWS: OrthoView[] = ['top', 'bottom', 'left', 'right', 'front', 'back'];
export const isOrthoView = (v: ViewMode): v is OrthoView => v !== 'camera' && v !== 'director';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** Distance along the view direction (perspective: from the eye; ortho: from the camera plane). */
  depth: number;
}

export interface Basis {
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

/** Pan/zoom state of an orthographic view: the world point at the canvas center and half the visible height. */
export interface OrthoState {
  center: Vec3;
  halfHeight: number;
}

/** Fixed axes of the orthographic views (forward = viewing direction). Right-handed: right x up = -forward. */
export const ORTHO_BASIS: Record<OrthoView, Basis> = {
  top: { right: [1, 0, 0], up: [0, 0, -1], forward: [0, -1, 0] },
  bottom: { right: [1, 0, 0], up: [0, 0, 1], forward: [0, 1, 0] },
  front: { right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, -1] },
  back: { right: [-1, 0, 0], up: [0, 1, 0], forward: [0, 0, 1] },
  left: { right: [0, 0, 1], up: [0, 1, 0], forward: [1, 0, 0] },
  right: { right: [0, 0, -1], up: [0, 1, 0], forward: [-1, 0, 0] },
};

export const VIEW_LABELS: Record<ViewMode, string> = {
  camera: 'Camera View',
  director: "Director's View",
  top: 'Top View',
  bottom: 'Bottom View',
  left: 'Left View',
  right: 'Right View',
  front: 'Front View',
  back: 'Back View',
};

/** Everything needed to project, unproject and build the three.js camera for one frame. */
export interface ViewInfo {
  ortho: boolean;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  /** The document frame (perspective views) or the whole canvas (ortho). */
  frame: Rect;
  /** Camera position (ortho: a point far behind the view center). */
  eye: Vec3;
  basis: Basis;
  /**
   * Canvas edges. Perspective: tangents at unit distance along forward (x right, y up).
   * Ortho: world offsets from the view center.
   */
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
}

const ORTHO_DEPTH = 20000;

/** Fit a frame of the given aspect (w / h) centered inside a canvas, leaving a margin. */
export function fitFrame(width: number, height: number, aspect: number, margin: number): Rect {
  const aw = Math.max(1, width - 2 * margin);
  const ah = Math.max(1, height - 2 * margin);
  let w = aw;
  let h = aw / aspect;
  if (h > ah) {
    h = ah;
    w = ah * aspect;
  }
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

/** Margin around the document frame in camera views (CSS px). */
export function frameMargin(width: number, height: number): number {
  return Math.round(clamp(Math.min(width, height) * 0.045, 10, 34));
}

/**
 * Perspective view for a camera. The document frame region of the canvas shows exactly the
 * render's frustum (vertical fov, aspect = docAspect); the rest of the canvas extends it.
 */
export function perspectiveView(
  cam: CameraState,
  docAspect: number,
  width: number,
  height: number,
  frame: Rect,
  near = 0.05,
  far = 30000,
): ViewInfo {
  const t = Math.tan((clamp(cam.fov, 1, 179) * DEG) / 2);
  const tx = t * docAspect;
  return {
    ortho: false,
    width,
    height,
    frame,
    eye: [...cam.position] as Vec3,
    basis: cameraBasis(cam),
    left: (-1 - (2 * frame.x) / frame.w) * tx,
    right: (-1 + (2 * (width - frame.x)) / frame.w) * tx,
    top: (1 + (2 * frame.y) / frame.h) * t,
    bottom: (1 - (2 * (height - frame.y)) / frame.h) * t,
    near,
    far,
  };
}

/** Orthographic view for one of the six fixed directions. */
export function orthoView(view: OrthoView, state: OrthoState, width: number, height: number): ViewInfo {
  const basis = ORTHO_BASIS[view];
  const hh = Math.max(1e-3, state.halfHeight);
  const hw = (hh * width) / Math.max(1, height);
  return {
    ortho: true,
    width,
    height,
    frame: { x: 0, y: 0, w: width, h: height },
    eye: v3.sub(state.center, v3.scale(basis.forward, ORTHO_DEPTH / 2)),
    basis,
    left: -hw,
    right: hw,
    top: hh,
    bottom: -hh,
    near: 0,
    far: ORTHO_DEPTH,
  };
}

/** Project a world point to canvas pixels. Points behind a perspective eye get depth <= 0. */
export function projectPoint(v: ViewInfo, p: Vec3): ScreenPoint {
  const d = v3.sub(p, v.eye);
  const { right, up, forward } = v.basis;
  const depth = v3.dot(d, forward);
  let xs = v3.dot(d, right);
  let ys = v3.dot(d, up);
  if (!v.ortho) {
    const z = Math.abs(depth) < 1e-9 ? 1e-9 : depth;
    xs /= z;
    ys /= z;
  }
  return {
    x: ((xs - v.left) / (v.right - v.left)) * v.width,
    y: ((v.top - ys) / (v.top - v.bottom)) * v.height,
    depth,
  };
}

/** The world-space ray through a canvas pixel. */
export function pixelRay(v: ViewInfo, px: number, py: number): { origin: Vec3; dir: Vec3 } {
  const xs = v.left + (px / v.width) * (v.right - v.left);
  const ys = v.top - (py / v.height) * (v.top - v.bottom);
  const { right, up, forward } = v.basis;
  if (v.ortho) {
    return { origin: v3.add(v.eye, v3.add(v3.scale(right, xs), v3.scale(up, ys))), dir: [...forward] as Vec3 };
  }
  return { origin: [...v.eye] as Vec3, dir: v3.norm(v3.add(forward, v3.add(v3.scale(right, xs), v3.scale(up, ys)))) };
}

/** World units covered by one CSS pixel at a given depth. */
export function worldPerPixel(v: ViewInfo, depth: number): number {
  const span = (v.top - v.bottom) / v.height;
  return v.ortho ? span : span * Math.max(1e-6, depth);
}

/** Frame-normalized device coordinates (the render's x, y in [-1, 1]) of a canvas pixel. */
export function canvasToFrameNdc(frame: Rect, px: number, py: number): [number, number] {
  return [((px - frame.x) / frame.w) * 2 - 1, 1 - ((py - frame.y) / frame.h) * 2];
}

/**
 * The horizon (directions with zero elevation) as a canvas line, or null when it is not
 * visible as a line (orthographic views, looking straight up/down).
 */
export function horizonLine(v: ViewInfo): [[number, number], [number, number]] | null {
  if (v.ortho) return null;
  const { right, up, forward } = v.basis;
  // Direction for tangent coords (xs, ys) is forward + xs*right + ys*up; the horizon is where its y is 0.
  const a = right[1];
  const b = up[1];
  const c = forward[1];
  const toPx = (xs: number, ys: number): [number, number] => [
    ((xs - v.left) / (v.right - v.left)) * v.width,
    ((v.top - ys) / (v.top - v.bottom)) * v.height,
  ];
  if (Math.abs(b) >= Math.abs(a)) {
    if (Math.abs(b) < 1e-6) return null;
    const y0 = -(c + a * v.left) / b;
    const y1 = -(c + a * v.right) / b;
    return [toPx(v.left, y0), toPx(v.right, y1)];
  }
  const x0 = -(c + b * v.top) / a;
  const x1 = -(c + b * v.bottom) / a;
  return [toPx(x0, v.top), toPx(x1, v.bottom)];
}

const _rot = new Matrix4();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
const _q = new Quaternion();

/** Configure a three.js camera so it renders exactly this view; returns the one to use. */
export function applyViewToCamera(v: ViewInfo, persp: PerspectiveCamera, ortho: OrthographicCamera): PerspectiveCamera | OrthographicCamera {
  const cam = v.ortho ? ortho : persp;
  const { right, up, forward } = v.basis;
  _rot.makeBasis(_x.set(...right), _y.set(...up), _z.set(-forward[0], -forward[1], -forward[2]));
  cam.position.set(v.eye[0], v.eye[1], v.eye[2]);
  cam.quaternion.copy(_q.setFromRotationMatrix(_rot));
  cam.near = v.near;
  cam.far = v.far;
  if (v.ortho) {
    ortho.left = v.left;
    ortho.right = v.right;
    ortho.top = v.top;
    ortho.bottom = v.bottom;
    ortho.zoom = 1;
    ortho.updateProjectionMatrix();
  } else {
    const n = v.near;
    persp.projectionMatrix.makePerspective(v.left * n, v.right * n, v.top * n, v.bottom * n, n, v.far);
    persp.projectionMatrixInverse.copy(persp.projectionMatrix).invert();
  }
  cam.updateMatrixWorld(true);
  return cam;
}
