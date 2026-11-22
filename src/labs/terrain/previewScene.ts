/**
 * The Terrain Editor's live 3D preview: an altitude-colored, lit heightfield mesh with skirts,
 * orbit by dragging, auto-rotation when idle. Owns its WebGL renderer; dispose() frees it all.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { capturePointer } from './capture';

export interface PreviewOptions {
  clipLow: number;
  clipHigh: number;
  /** 256-entry RGBA ramp. */
  lut: Uint8ClampedArray;
  /** Height of the terrain box relative to its width (object scale y / x). */
  aspect: number;
  /** Symmetrical lattice: mirror the surface below. */
  mirror: boolean;
  autoRotate: boolean;
}

export interface PreviewApi {
  setHeights(h: Float32Array, n: number): void;
  setOptions(o: Partial<PreviewOptions>): void;
  resetView(): void;
  dispose(): void;
}

const MAX_GRID = 256;
const UPDATE_INTERVAL_MS = 45;
const IDLE_BEFORE_SPIN_MS = 2500;

const vertexShader = /* glsl */ `
  attribute float aHeight;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vHeight = aHeight;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uRamp;
  uniform float uClipLow;
  uniform vec3 uLight;
  uniform vec3 uEye;
  uniform float uSkirt;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    if (uSkirt < 0.5 && vHeight < uClipLow - 0.0005) discard;
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    vec3 base = texture2D(uRamp, vec2(clamp(vHeight, 0.002, 0.998), 0.5)).rgb;
    if (uSkirt > 0.5) base *= 0.55;
    float diff = max(dot(n, uLight), 0.0);
    float sky = 0.5 + 0.5 * n.y;
    vec3 v = normalize(uEye - vWorld);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 col = base * (0.24 + 0.22 * sky + 0.78 * diff) + rim * vec3(0.16, 0.18, 0.24);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function gridGeometry(m: number): BufferGeometry {
  const g = new BufferGeometry();
  const pos = new Float32Array(m * m * 3);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const k = (j * m + i) * 3;
      pos[k] = (i / (m - 1)) * 2 - 1;
      pos[k + 2] = (j / (m - 1)) * 2 - 1;
    }
  }
  const idx = new Uint32Array((m - 1) * (m - 1) * 6);
  let t = 0;
  for (let j = 0; j < m - 1; j++) {
    for (let i = 0; i < m - 1; i++) {
      const a = j * m + i;
      const b = a + 1;
      const c = a + m;
      const d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b;
      idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
  }
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(m * m * 3), 3));
  g.setAttribute('aHeight', new BufferAttribute(new Float32Array(m * m), 1));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
}

/** Four walls from the terrain's border down to the base of its box. */
function skirtGeometry(m: number): BufferGeometry {
  const g = new BufferGeometry();
  const count = 4 * m * 2;
  g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aHeight', new BufferAttribute(new Float32Array(count), 1));
  const idx: number[] = [];
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < m - 1; i++) {
      const top = s * m * 2 + i * 2;
      idx.push(top, top + 1, top + 2, top + 2, top + 1, top + 3);
    }
  }
  g.setIndex(idx);
  return g;
}

export function createPreview(host: HTMLElement, initial: PreviewOptions): PreviewApi {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'te-preview3d__canvas';
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.05, 50);
  const opts: PreviewOptions = { ...initial };

  const ramp = new DataTexture(new Uint8Array(256 * 4), 256, 1, RGBAFormat);
  ramp.magFilter = LinearFilter;
  ramp.minFilter = LinearFilter;
  const uniforms = {
    uRamp: { value: ramp },
    uClipLow: { value: 0 },
    uLight: { value: new Vector3(-0.55, 0.62, 0.45).normalize() },
    uEye: { value: new Vector3() },
    uSkirt: { value: 0 },
  };
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: DoubleSide });
  const skirtMaterial = new ShaderMaterial({ uniforms: { ...uniforms, uSkirt: { value: 1 } }, vertexShader, fragmentShader, side: DoubleSide });

  let m = 2;
  let geom = gridGeometry(m);
  let skirt = skirtGeometry(m);
  const top = new Mesh(geom, material);
  const bottom = new Mesh(geom, material);
  bottom.scale.set(1, -1, 1);
  const walls = new Mesh(skirt, skirtMaterial);
  scene.add(top, bottom, walls);

  let heights: Float32Array = new Float32Array(4);
  let n = 2;
  let geomDirty = true;
  let lastGeom = 0;
  let needsRender = true;
  const homePitch = () => (opts.mirror ? 0.1 : 0.62);
  let yaw = 0.7;
  let pitch = homePitch();
  let dist = 4.4;
  let lastInteraction = performance.now();
  let raf = 0;
  let lastFrame = performance.now();

  const sample = (fx: number, fz: number) => {
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(n - 1, x0 + 1);
    const z1 = Math.min(n - 1, z0 + 1);
    const tx = fx - x0;
    const tz = fz - z0;
    const a = heights[z0 * n + x0];
    const b = heights[z0 * n + x1];
    const c = heights[z1 * n + x0];
    const d = heights[z1 * n + x1];
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  };

  function rebuildGeometry() {
    const want = Math.max(2, Math.min(MAX_GRID, n));
    if (want !== m) {
      m = want;
      geom.dispose();
      skirt.dispose();
      geom = gridGeometry(m);
      skirt = skirtGeometry(m);
      top.geometry = geom;
      bottom.geometry = geom;
      walls.geometry = skirt;
    }
    const aspect = opts.aspect;
    const hi = opts.clipHigh;
    const pos = geom.getAttribute('position') as BufferAttribute;
    const nor = geom.getAttribute('normal') as BufferAttribute;
    const hat = geom.getAttribute('aHeight') as BufferAttribute;
    const P = pos.array as Float32Array;
    const N = nor.array as Float32Array;
    const H = hat.array as Float32Array;
    const k = (n - 1) / (m - 1);
    const ys = new Float32Array(m * m);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const v = sample(i * k, j * k);
        const idx = j * m + i;
        H[idx] = v;
        const y = opts.mirror ? Math.min(v, hi) * aspect : (Math.min(v, hi) * 2 - 1) * aspect;
        ys[idx] = y;
        P[idx * 3 + 1] = y;
      }
    }
    const step = 2 / (m - 1);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const l = ys[j * m + (i > 0 ? i - 1 : i)];
        const r = ys[j * m + (i < m - 1 ? i + 1 : i)];
        const u = ys[(j > 0 ? j - 1 : j) * m + i];
        const d = ys[(j < m - 1 ? j + 1 : j) * m + i];
        const sx = i > 0 && i < m - 1 ? 2 * step : step;
        const sz = j > 0 && j < m - 1 ? 2 * step : step;
        let nx = (l - r) / sx;
        let nz = (u - d) / sz;
        let ny = 1;
        const len = Math.hypot(nx, ny, nz);
        nx /= len;
        ny /= len;
        nz /= len;
        const o = (j * m + i) * 3;
        N[o] = nx;
        N[o + 1] = ny;
        N[o + 2] = nz;
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    hat.needsUpdate = true;
    geom.computeBoundingSphere();
    rebuildSkirt(ys);
  }

  function rebuildSkirt(ys: Float32Array) {
    // Clipping the bottom away exposes the (hollow) terrain, so no base walls either.
    walls.visible = !opts.mirror && opts.clipLow <= 0.001;
    if (!walls.visible) return;
    const pos = skirt.getAttribute('position') as BufferAttribute;
    const nor = skirt.getAttribute('normal') as BufferAttribute;
    const hat = skirt.getAttribute('aHeight') as BufferAttribute;
    const P = pos.array as Float32Array;
    const N = nor.array as Float32Array;
    const H = hat.array as Float32Array;
    const baseY = -opts.aspect;
    // side order: z=-1 (north), x=+1 (east), z=+1 (south), x=-1 (west)
    const sides: [(t: number) => number, [number, number, number]][] = [
      [(t) => t, [0, 0, -1]],
      [(t) => t * m + (m - 1), [1, 0, 0]],
      [(t) => (m - 1) * m + t, [0, 0, 1]],
      [(t) => t * m, [-1, 0, 0]],
    ];
    const gp = (geom.getAttribute('position') as BufferAttribute).array as Float32Array;
    const gh = (geom.getAttribute('aHeight') as BufferAttribute).array as Float32Array;
    sides.forEach(([at, normal], s) => {
      for (let t = 0; t < m; t++) {
        const gi = at(t);
        const o = (s * m * 2 + t * 2) * 3;
        const x = gp[gi * 3];
        const z = gp[gi * 3 + 2];
        P[o] = x; P[o + 1] = ys[gi]; P[o + 2] = z;
        P[o + 3] = x; P[o + 4] = baseY; P[o + 5] = z;
        N.set(normal, o);
        N.set(normal, o + 3);
        const hv = Math.max(gh[gi], opts.clipLow);
        H[s * m * 2 + t * 2] = hv;
        H[s * m * 2 + t * 2 + 1] = 0;
      }
    });
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    hat.needsUpdate = true;
    skirt.computeBoundingSphere();
  }

  function applyOptions() {
    (ramp.image.data as Uint8Array).set(opts.lut);
    ramp.needsUpdate = true;
    // A lattice has no surface where h = 0.
    uniforms.uClipLow.value = opts.mirror ? Math.max(opts.clipLow, 0.004) : opts.clipLow;
    bottom.visible = opts.mirror;
    geomDirty = true;
    needsRender = true;
  }

  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (geomDirty && now - lastGeom >= UPDATE_INTERVAL_MS) {
      geomDirty = false;
      lastGeom = now;
      rebuildGeometry();
      needsRender = true;
    }
    if (opts.autoRotate && !dragging && now - lastInteraction > IDLE_BEFORE_SPIN_MS) {
      yaw += dt * 0.22;
      needsRender = true;
    }
    if (!needsRender) return;
    needsRender = false;
    const cy = 0.0;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, cy + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(0, opts.mirror ? 0 : -opts.aspect * 0.35, 0);
    uniforms.uEye.value.copy(camera.position);
    renderer.render(scene, camera);
  }

  // --- interaction ---------------------------------------------------------
  let dragging = false;
  let lx = 0;
  let ly = 0;
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    capturePointer(canvas, e.pointerId);
    lastInteraction = performance.now();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw -= (e.clientX - lx) * 0.01;
    pitch = Math.max(-0.2, Math.min(1.45, pitch + (e.clientY - ly) * 0.01));
    lx = e.clientX;
    ly = e.clientY;
    lastInteraction = performance.now();
    needsRender = true;
  };
  const onUp = () => {
    dragging = false;
    lastInteraction = performance.now();
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    dist = Math.max(2, Math.min(9, dist * Math.exp(e.deltaY * 0.0012)));
    lastInteraction = performance.now();
    needsRender = true;
  };
  const resetView = () => {
    yaw = 0.7;
    pitch = homePitch();
    dist = 4.4;
    lastInteraction = performance.now();
    needsRender = true;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', resetView);
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  applyOptions();
  resize();
  raf = requestAnimationFrame(frame);

  return {
    setHeights(h, size) {
      heights = h;
      n = size;
      geomDirty = true;
    },
    setOptions(o) {
      Object.assign(opts, o);
      applyOptions();
    },
    resetView,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', resetView);
      geom.dispose();
      skirt.dispose();
      material.dispose();
      skirtMaterial.dispose();
      ramp.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
