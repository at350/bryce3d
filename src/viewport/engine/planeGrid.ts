/**
 * Infinite planes in wireframe: a Bryce ground grid drawn by a shader on a large quad under
 * the eye. Lines stay one pixel wide, thin out where they crowd together and fade toward the
 * horizon; the spacing follows the eye's height with a smooth 2x level blend. Edge-on (side
 * ortho views) the plane is a single line instead.
 */
import { Color, DoubleSide, Mesh, PlaneGeometry, SRGBColorSpace, ShaderMaterial, Vector3 } from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { RGB, Vec3 } from '@/core/types';
import { projectPoint, worldPerPixel, type ViewInfo } from '../projection';

const vertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uSpacing;
uniform float uBlend;
uniform float uWidth;
uniform vec3 uEye;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uOrtho;
varying vec3 vWorld;

float gridLines(vec2 coord) {
  vec2 fw = max(fwidth(coord), vec2(1e-6));
  vec2 g = abs(fract(coord - 0.5) - 0.5) / fw;
  float d = min(g.x, g.y);
  float line = 1.0 - smoothstep(uWidth * 0.5 - 0.5, uWidth * 0.5 + 0.5, d);
  float cellPx = 1.0 / max(fw.x, fw.y);
  return line * smoothstep(3.5, 11.0, cellPx);
}

void main() {
  vec2 p = vWorld.xz;
  float fine = gridLines(p / uSpacing);
  float coarse = gridLines(p / (uSpacing * 2.0));
  float a = max(coarse, fine * (1.0 - uBlend));
  if (uOrtho < 0.5) {
    a *= 1.0 - smoothstep(uFadeNear, uFadeFar, length(p - uEye.xz));
  }
  a *= uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export interface GridLevel {
  spacing: number;
  /** 0..1: how far the fine lines have faded toward the next coarser level. */
  blend: number;
  fadeNear: number;
  fadeFar: number;
}

/** Grid spacing and fade for a plane seen from a given height above it (perspective views). */
export function perspectiveGridLevel(heightAbove: number): GridLevel {
  const h = Math.max(0.4, Math.abs(heightAbove));
  const level = Math.log2(h * 0.4);
  const fl = Math.floor(level);
  return { spacing: Math.pow(2, fl), blend: level - fl, fadeNear: h * 8 + 16, fadeFar: h * 34 + 110 };
}

/** Grid spacing for an orthographic view looking at the plane (about 26 px per cell). */
export function orthoGridLevel(worldPerPx: number): GridLevel {
  const level = Math.log2(Math.max(1e-4, worldPerPx * 26));
  const fl = Math.floor(level);
  return { spacing: Math.pow(2, fl), blend: level - fl, fadeNear: 1e9, fadeFar: 2e9 };
}

/**
 * Screen distance (px) from a point on the plane to the nearest visible grid line, or
 * Infinity where the grid is faded out. Used to pick planes by clicking their lines.
 */
export function gridLineDistancePx(view: ViewInfo, hit: Vec3, level: GridLevel, eye: Vec3): number {
  if (!view.ortho) {
    const d = Math.hypot(hit[0] - eye[0], hit[2] - eye[2]);
    if (d > level.fadeNear + (level.fadeFar - level.fadeNear) * 0.6) return Infinity;
  }
  const s = level.blend > 0.5 ? level.spacing * 2 : level.spacing;
  const p0 = projectPoint(view, hit);
  if (p0.depth <= 0) return Infinity;
  const eps = s * 0.02;
  const px = projectPoint(view, [hit[0] + eps, hit[1], hit[2]]);
  const pz = projectPoint(view, [hit[0], hit[1], hit[2] + eps]);
  const rateX = Math.hypot(px.x - p0.x, px.y - p0.y) / eps;
  const rateZ = Math.hypot(pz.x - p0.x, pz.y - p0.y) / eps;
  if (Math.min(rateX, rateZ) * s < 5) return Infinity;
  const fx = hit[0] / s;
  const fz = hit[2] / s;
  return Math.min(Math.abs(fx - Math.round(fx)) * s * rateX, Math.abs(fz - Math.round(fz)) * s * rateZ);
}

/** One infinite plane's wireframe: the grid quad plus an edge line for side views. */
export class PlaneGrid {
  readonly quad: Mesh<PlaneGeometry, ShaderMaterial>;
  readonly edge: LineSegments2;
  level: GridLevel = perspectiveGridLevel(10);
  private edgeGeometry = new LineSegmentsGeometry();

  constructor(edgeMaterial: LineMaterial) {
    const geom = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uColor: { value: new Color() },
        uOpacity: { value: 1 },
        uSpacing: { value: 1 },
        uBlend: { value: 0 },
        uWidth: { value: 1 },
        uEye: { value: new Vector3() },
        uFadeNear: { value: 100 },
        uFadeFar: { value: 400 },
        uOrtho: { value: 0 },
      },
    });
    this.quad = new Mesh(geom, mat);
    this.quad.frustumCulled = false;
    this.edgeGeometry.setPositions([-1, 0, 0, 1, 0, 0]);
    this.edge = new LineSegments2(this.edgeGeometry, edgeMaterial);
    this.edge.frustumCulled = false;
  }

  setStyle(color: RGB, opacity: number, edgeMaterial: LineMaterial): void {
    const u = this.quad.material.uniforms;
    (u.uColor.value as Color).setRGB(color[0], color[1], color[2], SRGBColorSpace);
    u.uOpacity.value = opacity;
    this.edge.material = edgeMaterial;
  }

  /** Place the grid for the current view. `height` is the plane's world y. */
  update(view: ViewInfo, height: number, pixelRatio: number): void {
    const u = this.quad.material.uniforms;
    u.uWidth.value = Math.max(1, pixelRatio);
    const edgeOn = view.ortho && Math.abs(view.basis.forward[1]) < 0.5;
    this.quad.visible = !edgeOn;
    this.edge.visible = edgeOn;
    if (edgeOn) {
      // A long horizontal segment through the view center at the plane's height.
      const c = view.eye;
      const r = view.basis.right;
      const span = (view.right - view.left) * 4 + 100;
      this.edge.position.set(c[0], height, c[2]);
      this.edge.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), new Vector3(r[0], 0, r[2]).normalize());
      this.edge.scale.set(span, 1, 1);
      this.edge.updateMatrixWorld(true);
      return;
    }
    if (view.ortho) {
      this.level = orthoGridLevel(worldPerPixel(view, 1));
      const size = Math.max(view.right - view.left, view.top - view.bottom) * 3;
      const center = v3center(view);
      this.quad.position.set(center[0], height, center[2]);
      this.quad.scale.set(size, 1, size);
      u.uOrtho.value = 1;
    } else {
      this.level = perspectiveGridLevel(view.eye[1] - height);
      const size = Math.min(view.far * 1.5, this.level.fadeFar * 2.4);
      this.quad.position.set(view.eye[0], height, view.eye[2]);
      this.quad.scale.set(size, 1, size);
      u.uOrtho.value = 0;
    }
    u.uSpacing.value = this.level.spacing;
    u.uBlend.value = this.level.blend;
    u.uFadeNear.value = this.level.fadeNear;
    u.uFadeFar.value = this.level.fadeFar;
    (u.uEye.value as Vector3).set(view.eye[0], view.eye[1], view.eye[2]);
    this.quad.updateMatrixWorld(true);
  }

  dispose(): void {
    this.quad.geometry.dispose();
    this.quad.material.dispose();
    this.edgeGeometry.dispose();
  }
}

/** The world point at the center of an ortho view (its eye sits far behind it). */
function v3center(view: ViewInfo): Vec3 {
  const f = view.basis.forward;
  const d = view.far / 2;
  return [view.eye[0] + f[0] * d, view.eye[1] + f[1] * d, view.eye[2] + f[2] * d];
}
