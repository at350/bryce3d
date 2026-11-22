/**
 * Renders icon models with ONE shared offscreen three.js WebGLRenderer (PMREM room
 * environment, physical materials, soft key light) and caches each (skin, kind, size
 * bucket) as a PNG data URL. Work is queued and done a few icons per frame with
 * parallel shader compilation, so startup is never blocked.
 */
import {
  AmbientLight,
  CircleGeometry,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Skin } from '@/core/types';
import type { IconKind } from './iconKinds';
import { buildIcon, type IconSpec } from './iconModels';
import { contactShadowTexture, disposeTree } from './iconParts';
import { ICON_THEMES } from './iconTheme';

export const ICON_BUCKETS = [32, 48, 64, 96, 128, 192] as const;

/** Smallest cached pixel size that covers `px` device pixels. */
export function iconBucket(px: number): number {
  for (const b of ICON_BUCKETS) if (b >= px - 0.5) return b;
  return ICON_BUCKETS[ICON_BUCKETS.length - 1];
}

export const iconKey = (kind: IconKind, skin: Skin, bucket: number) => `${skin}:${kind}:${bucket}`;

interface Job {
  key: string;
  kind: IconKind;
  skin: Skin;
  bucket: number;
}

const cache = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
const pending = new Set<string>();
const queue: Job[] = [];
let renderer: WebGLRenderer | null = null;
let envTexture: Texture | null = null;
let failed = false;
let pumping = false;

export const iconRenderingFailed = () => failed;
export const getIconUrl = (key: string) => cache.get(key);

/** Any cached size of this icon (used while the exact size is still rendering). */
export function getAnyIconUrl(kind: IconKind, skin: Skin): string | undefined {
  for (let i = ICON_BUCKETS.length - 1; i >= 0; i--) {
    const u = cache.get(iconKey(kind, skin, ICON_BUCKETS[i]));
    if (u) return u;
  }
  return undefined;
}

function enqueue(job: Job, front = false) {
  if (failed || cache.has(job.key) || pending.has(job.key)) return;
  pending.add(job.key);
  if (front) queue.unshift(job);
  else queue.push(job);
  schedule();
}

/** Subscribe to an icon; it is rendered on demand. Returns an unsubscribe function. */
export function subscribeIcon(kind: IconKind, skin: Skin, bucket: number, listener: () => void): () => void {
  const key = iconKey(kind, skin, bucket);
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  enqueue({ key, kind, skin, bucket });
  return () => {
    set.delete(listener);
  };
}

/** Render icons ahead of time (e.g. the palettes that are not visible yet). */
export function prefetchIcons(kinds: IconKind[], skin: Skin, bucket: number): void {
  for (const kind of kinds) enqueue({ key: iconKey(kind, skin, bucket), kind, skin, bucket });
}

function notify(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function schedule() {
  if (pumping || !queue.length) return;
  pumping = true;
  const start = () => void pump();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(start);
  else setTimeout(start, 0);
}

const nextFrame = () =>
  new Promise<void>((resolve) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => resolve()) : setTimeout(resolve, 16)));

async function pump() {
  if (!ensureRenderer()) {
    failed = true;
    pending.clear();
    const keys = queue.splice(0).map((j) => j.key);
    keys.forEach(notify);
    pumping = false;
    return;
  }
  let frameStart = performance.now();
  while (queue.length) {
    const job = queue.shift()!;
    try {
      cache.set(job.key, await renderJob(job));
    } catch {
      // A model that fails to render keeps its placeholder; others continue.
    }
    pending.delete(job.key);
    notify(job.key);
    if (!renderer) break;
    if (performance.now() - frameStart > 8) {
      await nextFrame();
      frameStart = performance.now();
    }
  }
  pumping = false;
  if (queue.length) schedule();
}

function ensureRenderer(): boolean {
  if (renderer) return true;
  if (failed || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const r = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    r.setPixelRatio(1);
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    const pmrem = new PMREMGenerator(r);
    const room = new RoomEnvironment();
    envTexture = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      envTexture?.dispose();
      envTexture = null;
      renderer?.dispose();
      renderer = null;
    });
    renderer = r;
    return true;
  } catch {
    return false;
  }
}

function addLights(scene: Scene, lighting: IconSpec['lighting']) {
  if (lighting === 'moon') {
    const key = new DirectionalLight(0xffffff, 3.4);
    key.position.set(5, 1.2, -0.8);
    scene.add(key, new AmbientLight(0x8090b0, 0.08));
    return;
  }
  scene.environment = envTexture;
  scene.environmentIntensity = 0.9;
  const key = new DirectionalLight(0xffffff, 2.3);
  key.position.set(-2.6, 4, 3.2);
  const fill = new DirectionalLight(0xd6e4ff, 0.55);
  fill.position.set(3, 1, 2.5);
  const rim = new DirectionalLight(0xffffff, 1.1);
  rim.position.set(1.5, 3, -4);
  scene.add(key, fill, rim);
}

/** World-space vertex positions (sampled) for an exact silhouette fit. */
function samplePoints(root: Object3D): Vector3[] {
  const pts: Vector3[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as Mesh;
    const pos = m.isMesh ? m.geometry.attributes.position : undefined;
    if (!pos) return;
    const stride = Math.max(1, Math.floor(pos.count / 1500));
    for (let i = 0; i < pos.count; i += stride) pts.push(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m.matrixWorld));
  });
  return pts;
}

/** Place the camera on the (azimuth, elevation) direction so the model fills `fill` of the frame, centered. */
function frameCamera(camera: PerspectiveCamera, pts: Vector3[], azimuth: number, elevation: number, fill: number) {
  const center = new Vector3();
  pts.forEach((p) => center.add(p));
  center.multiplyScalar(1 / Math.max(1, pts.length));
  let radius = 0.1;
  for (const v of pts) radius = Math.max(radius, v.distanceTo(center));
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  if (Math.abs(dir.y) > 0.99) camera.up.set(0, 0, -Math.sign(dir.y));
  else camera.up.set(0, 1, 0);
  let dist = radius / Math.sin((camera.fov * Math.PI) / 360);
  const target = center.clone();
  const p = new Vector3();
  for (let iter = 0; iter < 3; iter++) {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.near = Math.max(0.01, dist - radius * 2);
    camera.far = dist + radius * 3;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const v of pts) {
      p.copy(v).project(camera);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const extent = Math.max(maxX - minX, maxY - minY) / 2;
    // re-center on the projected bounds, then rescale the distance
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * dist;
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, ((minX + maxX) / 2) * halfH).addScaledVector(up, ((minY + maxY) / 2) * halfH);
    dist *= extent / fill;
  }
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

async function renderJob(job: Job): Promise<string> {
  const r = renderer;
  if (!r) throw new Error('no renderer');
  const spec = buildIcon(job.kind, ICON_THEMES[job.skin]);
  const scene = new Scene();
  addLights(scene, spec.lighting);
  scene.add(spec.root);
  const pts = samplePoints(spec.root);
  let shadow: Mesh | null = null;
  if (spec.shadow !== false && pts.length) {
    let minY = Infinity;
    let maxR = 0;
    for (const v of pts) {
      minY = Math.min(minY, v.y);
      maxR = Math.max(maxR, Math.hypot(v.x, v.z));
    }
    shadow = new Mesh(new CircleGeometry(maxR * 1.05, 32), new MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = minY - 0.005;
    shadow.scale.set(1, 0.85, 1);
    scene.add(shadow);
  }
  const camera = new PerspectiveCamera(26, 1, 0.1, 100);
  frameCamera(camera, pts, spec.azimuth ?? 28, spec.elevation ?? 22, spec.fill ?? 0.84);
  r.setSize(job.bucket, job.bucket, false);
  await r.compileAsync(scene, camera);
  if (renderer !== r) throw new Error('context lost');
  r.render(scene, camera);
  const url = r.domElement.toDataURL('image/png');
  disposeTree(spec.root);
  if (shadow) {
    shadow.geometry.dispose();
    (shadow.material as MeshBasicMaterial).dispose();
  }
  return url;
}
