/**
 * Solid display mode: shaded stand-in meshes with each material's base color, terrains with
 * altitude-tinted vertex colors, translucent water, and a sky-gradient dome.
 */
import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  IcosahedronGeometry,
  Mesh,
  MeshPhongMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Uint32BufferAttribute,
} from 'three';
import { clamp, lerp, rgbToLinear, smoothstep, v3 } from '@/core/math';
import type { Material, RGB, SceneObject, Sky, TerrainData, Vec3 } from '@/core/types';
import { terrainGridMesh } from '../terrainShapes';
import { stoneRadius, treeLayout } from '../wireShapes';

const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** The color that best represents a material in a flat preview. */
export function previewColor(m: Material): RGB {
  let c: RGB = m.diffuseColor;
  const drv = m.drivers.diffuseColor;
  const comp = drv !== undefined && drv >= 0 ? m.components[drv] : undefined;
  if (comp && comp.gradient.length) {
    const sum = comp.gradient.reduce<RGB>((acc, g) => [acc[0] + g.color[0], acc[1] + g.color[1], acc[2] + g.color[2]], [0, 0, 0]);
    c = [sum[0] / comp.gradient.length, sum[1] / comp.gradient.length, sum[2] / comp.gradient.length];
  }
  const refl = clamp(m.reflection / 100, 0, 1);
  if (refl > 0) c = mix(c, [0.78, 0.82, 0.88], refl * 0.6);
  if (m.ambience > 40) c = mix(c, m.ambientColor, ((m.ambience - 40) / 60) * 0.5);
  return c;
}

const srgb = (c: RGB) => new Color().setRGB(c[0], c[1], c[2], SRGBColorSpace);

/** A Phong material approximating a Bryce material. */
export function solidMaterial(m: Material, opts: { vertexColors?: boolean; flat?: boolean; doubleSided?: boolean } = {}): MeshPhongMaterial {
  const spec = clamp(m.specularity / 100, 0, 1) * 0.45;
  const transparency = m.mode === 'volume' ? 0.65 : clamp(m.transparency / 100, 0, 1) * 0.75;
  const glow = clamp(m.ambience / 100, 0, 1) * 0.55;
  return new MeshPhongMaterial({
    color: opts.vertexColors ? new Color(1, 1, 1) : srgb(previewColor(m)),
    vertexColors: !!opts.vertexColors,
    specular: srgb([m.specularColor[0] * spec, m.specularColor[1] * spec, m.specularColor[2] * spec]),
    shininess: 4 + clamp(m.specularHalo, 0, 100) * 0.9,
    emissive: srgb([m.ambientColor[0] * glow, m.ambientColor[1] * glow, m.ambientColor[2] * glow]),
    transparent: transparency > 0.02,
    opacity: 1 - transparency,
    depthWrite: transparency < 0.3,
    side: opts.doubleSided ? DoubleSide : FrontSide,
    flatShading: !!opts.flat,
  });
}

function pyramidGeometry(): BufferGeometry {
  const apex: Vec3 = [0, 1, 0];
  const c: Vec3[] = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, -1, 1],
    [-1, -1, 1],
  ];
  const tris: Vec3[] = [c[0], c[1], c[2], c[0], c[2], c[3]];
  for (let i = 0; i < 4; i++) tris.push(c[(i + 1) % 4], c[i], apex);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

/** Shared geometry for primitive shapes, keyed for caching. */
export function primitiveSolid(o: SceneObject): { key: string; build: () => BufferGeometry; doubleSided: boolean } | null {
  switch (o.showAsBox ? 'cube' : o.type) {
    case 'sphere':
      return { key: 'sphere', build: () => new SphereGeometry(1, 48, 32), doubleSided: false };
    case 'cube':
      return { key: 'cube', build: () => new BoxGeometry(2, 2, 2), doubleSided: false };
    case 'cylinder':
      return { key: 'cylinder', build: () => new CylinderGeometry(1, 1, 2, 48), doubleSided: false };
    case 'cone':
      return { key: 'cone', build: () => new ConeGeometry(1, 2, 48), doubleSided: false };
    case 'pyramid':
      return { key: 'pyramid', build: pyramidGeometry, doubleSided: false };
    case 'disc':
      return { key: 'disc', build: () => new CircleGeometry(1, 64).rotateX(-Math.PI / 2), doubleSided: true };
    case 'square':
      return { key: 'square', build: () => new PlaneGeometry(2, 2).rotateX(-Math.PI / 2), doubleSided: true };
    case 'torus': {
      const r = clamp(o.torus?.minorRadius ?? 0.3, 0.02, 0.5);
      return { key: `torus:${r.toFixed(4)}`, build: () => new TorusGeometry(1 - r, r, 24, 72).rotateX(Math.PI / 2), doubleSided: false };
    }
    case 'stone': {
      const s = o.stone ?? { seed: 1, lumpiness: 0.5, roughness: 0.5 };
      return {
        key: `stone:${s.seed}:${s.lumpiness}:${s.roughness}`,
        build: () => {
          const g = new IcosahedronGeometry(1, 5);
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const d = v3.norm([p.getX(i), p.getY(i), p.getZ(i)]);
            const r = stoneRadius(s, d);
            p.setXYZ(i, d[0] * r, d[1] * r, d[2] * r);
          }
          g.computeVertexNormals();
          return g;
        },
        doubleSided: false,
      };
    }
    default:
      return null;
  }
}

/** Tree stand-in: tapered trunk and a crown shaped by the crown type. */
export function treeSolidGeometries(o: SceneObject): { trunk: BufferGeometry; crown: BufferGeometry } {
  const t = o.tree ?? { seed: 1, trunkHeight: 0.45, trunkWidth: 0.1, crown: 'round' as const, crownNoise: 0.5, trunkColor: [0.3, 0.2, 0.1] as RGB };
  const { trunkTop, trunkRadius, crownBottom } = treeLayout(t);
  const trunkLen = trunkTop + 1;
  const trunk = new CylinderGeometry(trunkRadius * 0.7, trunkRadius * 1.3, trunkLen, 12).translate(0, -1 + trunkLen / 2, 0);
  let crown: BufferGeometry;
  if (t.crown === 'cone') {
    const h = 1 - crownBottom;
    crown = new ConeGeometry(0.95, h, 24, 3).translate(0, crownBottom + h / 2, 0);
  } else if (t.crown === 'palm') {
    crown = new SphereGeometry(0.9, 24, 12).scale(1, 0.22, 1).translate(0, Math.min(0.85, trunkTop + 0.05), 0);
  } else {
    const willow = t.crown === 'willow';
    const ry = (1 - crownBottom) / 2;
    crown = new SphereGeometry(0.95, 32, 20, 0, Math.PI * 2, 0, willow ? Math.PI * 0.62 : Math.PI)
      .scale(1, ry / 0.95, 1)
      .translate(0, crownBottom + ry, 0);
  }
  crown.computeVertexNormals();
  return { trunk, crown };
}

/**
 * A flat disc of radius 1 in the XZ plane whose rings crowd toward the center: placed under
 * the eye and scaled up, it keeps per-vertex fog and lighting accurate near the camera.
 */
export function polarPlaneGeometry(): BufferGeometry {
  const rings: number[] = [];
  for (let r = 1e-4; r < 1; r *= 1.22) rings.push(r);
  rings.push(1);
  const seg = 64;
  const pos: number[] = [0, 0, 0];
  for (const r of rings) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < seg; i++) idx.push(0, 1 + ((i + 1) % seg), 1 + i);
  for (let k = 0; k + 1 < rings.length; k++) {
    const a0 = 1 + k * seg;
    const b0 = a0 + seg;
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      idx.push(a0 + i, a0 + j, b0 + i, a0 + j, b0 + j, b0 + i);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

/** Altitude-tinted vertex colors for a terrain (linear RGB). */
export function terrainColors(heights: Float32Array, m: Material): Float32Array {
  const base = previewColor(m);
  const out = new Float32Array(heights.length * 3);
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    const shade = 0.6 + 0.55 * h;
    let c: RGB = [clamp(base[0] * shade, 0, 1), clamp(base[1] * shade, 0, 1), clamp(base[2] * shade, 0, 1)];
    if (m.altitude) {
      const soft = Math.max(0.02, m.altitude.softness);
      c = mix(c, m.altitude.color, smoothstep(m.altitude.start - soft / 2, m.altitude.start + soft / 2, h));
    }
    const lin = rgbToLinear(c);
    out[i * 3] = lin[0];
    out[i * 3 + 1] = lin[1];
    out[i * 3 + 2] = lin[2];
  }
  return out;
}

/** Shaded terrain / lattice mesh geometry. */
export function terrainSolidGeometry(t: TerrainData, lattice: boolean, m: Material): BufferGeometry {
  const grid = terrainGridMesh(t, lattice, clamp(t.resolution, 16, 160));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(grid.positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(terrainColors(grid.heights, m), 3));
  g.setIndex(new Uint32BufferAttribute(grid.index, 1));
  g.computeVertexNormals();
  return g;
}

/** Key for a material's preview look (to know when vertex colors must be rebuilt). */
export function materialLookKey(m: Material): string {
  const c = previewColor(m);
  const a = m.altitude;
  return `${c.map((x) => x.toFixed(3)).join(',')}|${a ? `${a.start},${a.softness},${a.color.join(',')}` : '-'}`;
}

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const skyFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBelow;
varying vec3 vDir;
void main() {
  float y = normalize(vDir).y;
  vec3 c = y >= 0.0 ? mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(uHorizon, uBelow, clamp(-y * 6.0, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/** A big gradient sphere around the eye: the sky-tinted background of solid mode. */
export class SkyDome {
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;

  constructor() {
    this.mesh = new Mesh(
      new SphereGeometry(1, 32, 16),
      new ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        uniforms: { uZenith: { value: new Color() }, uHorizon: { value: new Color() }, uBelow: { value: new Color() } },
      }),
    );
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  update(sky: Sky, eye: Vec3, radius: number): void {
    const u = this.mesh.material.uniforms;
    const zenith: RGB = sky.mode === 'off' ? sky.zenithColor : mix(sky.zenithColor, sky.skyDomeColor, 0.25);
    (u.uZenith.value as Color).setRGB(zenith[0], zenith[1], zenith[2], SRGBColorSpace);
    (u.uHorizon.value as Color).setRGB(sky.horizonColor[0], sky.horizonColor[1], sky.horizonColor[2], SRGBColorSpace);
    const below = mix(sky.horizonColor, [0.25, 0.24, 0.22], 0.55);
    (u.uBelow.value as Color).setRGB(below[0], below[1], below[2], SRGBColorSpace);
    this.mesh.position.set(eye[0], eye[1], eye[2]);
    this.mesh.scale.setScalar(radius);
    this.mesh.updateMatrixWorld(true);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
