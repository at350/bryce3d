/**
 * The three.js representation of one scene object: its wireframe (or light glyph), an
 * invisible solid pick proxy, and (lazily) a shaded solid for solid mode. Infinite planes
 * get a shader grid instead. Rebuilds only what an edit actually changed.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  type Material as ThreeMaterial,
  Object3D,
  PlaneGeometry,
  type Scene as ThreeScene,
  SphereGeometry,
  TorusGeometry,
  Uint32BufferAttribute,
  Vector3,
  Quaternion,
  Euler,
  Color,
  SRGBColorSpace,
} from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { DEG, clamp, objectMatrix } from '@/core/math';
import { isInfinitePlane, isLight, isTerrainLike } from '@/core/objects';
import type { InfinitePlaneType, SceneObject, TerrainData } from '@/core/types';
import { projectPoint, worldPerPixel, type ViewInfo } from '../projection';
import { terrainGridMesh, terrainWire, wireLineCount } from '../terrainShapes';
import {
  coneWire,
  cubeWire,
  cylinderWire,
  discWire,
  parallelLightGlyph,
  pyramidWire,
  radialLightGlyph,
  sphereWire,
  spotLightGlyph,
  squareWire,
  stoneWire,
  torusWire,
  treeWire,
} from '../wireShapes';
import type { LineMaterials } from './lineMaterials';
import { PLANE_OPACITY, SHADOW_COLOR, SUBMERGED_PLANE_FACTOR, wireColor } from './palette';
import { PlaneGrid } from './planeGrid';
import type { RefCache } from './refCache';
import { materialLookKey, polarPlaneGeometry, previewColor, primitiveSolid, solidMaterial, terrainSolidGeometry, treeSolidGeometries } from './solid';

export interface ViewDeps {
  wireScene: ThreeScene;
  gizmoScene: ThreeScene;
  solidScene: ThreeScene;
  lines: LineMaterials;
  wireGeoms: RefCache<LineSegmentsGeometry>;
  solidGeoms: RefCache<BufferGeometry>;
  pickGeoms: RefCache<BufferGeometry>;
  pickMaterial: MeshBasicMaterial;
}

export interface ViewStyle {
  selected: boolean;
  hovered: boolean;
  depthCue: boolean;
  /** Infinite planes lying under another plane draw fainter. */
  submerged: boolean;
}

/** Minimum on-screen radius of light glyphs, in CSS px. */
const GLYPH_MIN_PX = 15;

type CacheRef = { key: unknown; sub: string };

function lineGeometry(positions: Float32Array): LineSegmentsGeometry {
  const g = new LineSegmentsGeometry();
  // An empty instanced geometry breaks bounding-sphere math; keep one degenerate segment.
  g.setPositions(positions.length ? positions : new Float32Array(6));
  return g;
}

function gridGeometry(t: TerrainData, lattice: boolean, res: number): BufferGeometry {
  const grid = terrainGridMesh(t, lattice, res);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(grid.positions, 3));
  g.setIndex(new Uint32BufferAttribute(grid.index, 1));
  g.computeBoundingSphere();
  return g;
}

/** Which wire shape an object uses (cache key + builder). */
function wireSpec(o: SceneObject, terrainLines: number): { ref: CacheRef; build: () => Float32Array } {
  if (o.showAsBox && !isLight(o.type)) return { ref: { key: 'cube', sub: '' }, build: cubeWire };
  switch (o.type) {
    case 'sphere':
      return { ref: { key: 'sphere', sub: '' }, build: sphereWire };
    case 'cube':
      return { ref: { key: 'cube', sub: '' }, build: cubeWire };
    case 'cylinder':
      return { ref: { key: 'cylinder', sub: '' }, build: cylinderWire };
    case 'cone':
      return { ref: { key: 'cone', sub: '' }, build: coneWire };
    case 'pyramid':
      return { ref: { key: 'pyramid', sub: '' }, build: pyramidWire };
    case 'disc':
      return { ref: { key: 'disc', sub: '' }, build: discWire };
    case 'square':
      return { ref: { key: 'square', sub: '' }, build: squareWire };
    case 'torus': {
      const r = o.torus?.minorRadius ?? 0.3;
      return { ref: { key: 'torus', sub: r.toFixed(4) }, build: () => torusWire(r) };
    }
    case 'stone': {
      const s = o.stone ?? { seed: 1, lumpiness: 0.5, roughness: 0.5 };
      return { ref: { key: 'stone', sub: `${s.seed}:${s.lumpiness}:${s.roughness}` }, build: () => stoneWire(s) };
    }
    case 'tree': {
      const t = o.tree ?? { seed: 1, trunkHeight: 0.45, trunkWidth: 0.1, crown: 'round' as const, crownNoise: 0.5, trunkColor: [0.3, 0.2, 0.1] as [number, number, number] };
      return { ref: { key: 'tree', sub: `${t.seed}:${t.trunkHeight}:${t.trunkWidth}:${t.crown}:${t.crownNoise}` }, build: () => treeWire(t) };
    }
    case 'terrain':
    case 'lattice': {
      const t = o.terrain;
      if (!t) return { ref: { key: 'cube', sub: '' }, build: cubeWire };
      const lines = Math.min(wireLineCount(t.resolution), terrainLines);
      return {
        ref: { key: t.heights, sub: `${o.type}:${t.resolution}:${t.clipLow ?? 0}:${t.clipHigh ?? 1}:${lines}` },
        build: () => terrainWire(t, o.type === 'lattice', lines),
      };
    }
    case 'radialLight':
      return { ref: { key: 'radialLight', sub: '' }, build: radialLightGlyph };
    case 'spotLight':
    case 'squareSpotLight': {
      const a = o.light?.coneAngle ?? 45;
      return { ref: { key: o.type, sub: a.toFixed(2) }, build: () => spotLightGlyph(a, o.type === 'squareSpotLight') };
    }
    case 'parallelLight':
      return { ref: { key: 'parallelLight', sub: '' }, build: parallelLightGlyph };
    default:
      return { ref: { key: 'cube', sub: '' }, build: cubeWire };
  }
}

/** Invisible solid proxy used for picking (thin wireframes are hard to hit). */
function pickSpec(o: SceneObject): { ref: CacheRef; build: () => BufferGeometry } {
  if (isLight(o.type)) return { ref: { key: 'pick:light', sub: '' }, build: () => new SphereGeometry(1.1, 10, 8) };
  if (o.showAsBox) return { ref: { key: 'pick:cube', sub: '' }, build: () => new BoxGeometry(2, 2, 2) };
  switch (o.type) {
    case 'sphere':
      return { ref: { key: 'pick:sphere', sub: '' }, build: () => new SphereGeometry(1, 16, 12) };
    case 'cylinder':
      return { ref: { key: 'pick:cylinder', sub: '' }, build: () => new CylinderGeometry(1, 1, 2, 16) };
    case 'cone':
      return { ref: { key: 'pick:cone', sub: '' }, build: () => new ConeGeometry(1, 2, 16) };
    case 'pyramid':
      return { ref: { key: 'pick:pyramid', sub: '' }, build: () => new ConeGeometry(Math.SQRT2, 2, 4, 1).rotateY(Math.PI / 4) };
    case 'disc':
      return { ref: { key: 'pick:disc', sub: '' }, build: () => new CircleGeometry(1, 24).rotateX(-Math.PI / 2) };
    case 'square':
      return { ref: { key: 'pick:square', sub: '' }, build: () => new PlaneGeometry(2, 2).rotateX(-Math.PI / 2) };
    case 'torus': {
      const r = clamp(o.torus?.minorRadius ?? 0.3, 0.02, 0.5);
      return { ref: { key: 'pick:torus', sub: r.toFixed(4) }, build: () => new TorusGeometry(1 - r, Math.max(r, 0.12), 8, 32).rotateX(Math.PI / 2) };
    }
    case 'stone':
      return { ref: { key: 'pick:stone', sub: '' }, build: () => new SphereGeometry(0.9, 12, 8) };
    case 'tree':
      return { ref: { key: 'pick:tree', sub: '' }, build: () => new CylinderGeometry(0.85, 0.6, 2, 10) };
    case 'terrain':
    case 'lattice': {
      const t = o.terrain;
      if (!t) break;
      return {
        ref: { key: t.heights, sub: `pick:${o.type}:${t.resolution}:${t.clipLow ?? 0}:${t.clipHigh ?? 1}` },
        build: () => gridGeometry(t, o.type === 'lattice', 33),
      };
    }
    default:
      break;
  }
  return { ref: { key: 'pick:cube', sub: '' }, build: () => new BoxGeometry(2, 2, 2) };
}

const TERRAIN_LINE_LEVELS = [8, 12, 16, 24, 32];

/** The largest grid density level not above the ideal line count. */
export function terrainLineLevel(ideal: number): number {
  let level = TERRAIN_LINE_LEVELS[0];
  for (const l of TERRAIN_LINE_LEVELS) if (l <= ideal) level = l;
  return level;
}

const shapeChanged = (a: SceneObject, b: SceneObject) =>
  a.type !== b.type ||
  a.showAsBox !== b.showAsBox ||
  a.terrain !== b.terrain ||
  a.torus !== b.torus ||
  a.stone !== b.stone ||
  a.tree !== b.tree ||
  (isLight(a.type) && a.light?.coneAngle !== b.light?.coneAngle);

const _m = new Matrix4();
const _m2 = new Matrix4();
const _flat = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

export class ObjectView {
  obj: SceneObject;
  readonly plane: PlaneGrid | null = null;
  private wire: LineSegments2 | null = null;
  private wireRef: CacheRef | null = null;
  /** Bryce's wireframe shadow: the selected object's wire flattened onto the ground. */
  private shadow: LineSegments2 | null = null;
  private shadowY = 0;
  pick: Mesh | null = null;
  private pickRef: CacheRef | null = null;
  private solid: Object3D | null = null;
  private solidRefs: CacheRef[] = [];
  private solidOwned: BufferGeometry[] = [];
  private solidMaterials: ThreeMaterial[] = [];
  private style: ViewStyle = { selected: false, hovered: false, depthCue: true, submerged: false };
  /** Terrain grid lines per direction, adapted to the terrain's size on screen. */
  private terrainLines = 32;
  private deps: ViewDeps;

  constructor(obj: SceneObject, deps: ViewDeps) {
    this.obj = obj;
    this.deps = deps;
    if (isInfinitePlane(obj.type)) {
      this.plane = new PlaneGrid(deps.lines.get({ color: wireColor(obj, false, false), width: 1 }));
      deps.wireScene.add(this.plane.quad, this.plane.edge);
    } else {
      this.buildWire();
      this.buildPick();
    }
    this.applyStyle();
    this.applyTransform();
  }

  get isLight(): boolean {
    return isLight(this.obj.type);
  }

  get isPlane(): boolean {
    return !!this.plane;
  }

  /** Bring the view up to date with a new version of its object. */
  update(next: SceneObject): void {
    const prev = this.obj;
    if (prev === next) return;
    this.obj = next;
    if (this.plane) {
      if (prev.family !== next.family || prev.type !== next.type) this.applyStyle();
      if (this.solid && prev.material !== next.material) this.rebuildSolid();
      return;
    }
    if (shapeChanged(prev, next)) {
      this.buildWire();
      this.buildPick();
      if (this.solid) this.rebuildSolid();
    } else if (this.solid && (prev.material !== next.material || (next.type === 'tree' && prev.tree !== next.tree))) {
      this.rebuildSolid();
    }
    if (prev.family !== next.family || prev.locked !== next.locked || prev.type !== next.type) this.applyStyle();
    if (prev.transform !== next.transform || shapeChanged(prev, next)) this.applyTransform();
    this.applyVisibility();
  }

  setStyle(style: ViewStyle): void {
    const s = this.style;
    if (s.selected === style.selected && s.hovered === style.hovered && s.depthCue === style.depthCue && s.submerged === style.submerged) return;
    this.style = style;
    this.applyStyle();
  }

  /** Per-frame placement that depends on the view (light glyph size, plane grids). */
  updateForView(view: ViewInfo, pixelRatio: number): void {
    if (this.plane) {
      const hidden = !!this.obj.hidden;
      if (!hidden) this.plane.update(view, this.obj.transform.position[1], pixelRatio);
      if (hidden) this.plane.quad.visible = this.plane.edge.visible = false;
      if (this.solid) {
        this.solid.visible = !hidden;
        placePlaneSolid(this.solid, view, this.obj.transform.position[1]);
      }
      return;
    }
    const t = this.obj.transform;
    if (isTerrainLike(this.obj.type) && !this.obj.showAsBox && this.obj.terrain) {
      this.adaptTerrainLines(view);
      return;
    }
    if (!this.isLight) return;
    const depth = view.ortho ? 1 : Math.max(0.1, projectPoint(view, t.position).depth);
    const minWorld = worldPerPixel(view, depth) * GLYPH_MIN_PX;
    const s = Math.max(minWorld, Math.max(...t.scale));
    _q.setFromEuler(_e.set(t.rotation[0] * DEG, t.rotation[1] * DEG, t.rotation[2] * DEG, 'XYZ'));
    _m.compose(_p.set(...t.position), _q, _s.set(s, s, s));
    for (const o of [this.wire, this.pick]) {
      if (!o) continue;
      o.matrix.copy(_m);
      o.matrixWorldNeedsUpdate = true;
    }
    this.pick?.updateMatrixWorld(true);
  }

  /** Fewer grid lines for terrains that are small on screen (Bryce draws ~32 when close). */
  private adaptTerrainLines(view: ViewInfo): void {
    const t = this.obj.transform;
    const depth = view.ortho ? 1 : projectPoint(view, t.position).depth;
    if (depth <= 0) return;
    const spanPx = (2 * Math.max(t.scale[0], t.scale[2])) / worldPerPixel(view, depth);
    const ideal = spanPx / 9;
    const cur = this.terrainLines;
    if (ideal >= cur * 0.75 && (ideal <= cur * 1.4 || cur >= 32)) return;
    const next = terrainLineLevel(ideal);
    if (next === cur) return;
    this.terrainLines = next;
    this.buildWire();
  }

  /** Build (or refresh) the shaded representation for solid mode. */
  ensureSolid(): void {
    if (!this.solid) this.rebuildSolid();
  }

  dispose(): void {
    this.disposeWire();
    this.disposePick();
    this.disposeSolid();
    if (this.plane) {
      this.plane.quad.removeFromParent();
      this.plane.edge.removeFromParent();
      this.plane.dispose();
    }
  }

  // --- internals ------------------------------------------------------------

  private buildWire(): void {
    this.disposeWire();
    const spec = wireSpec(this.obj, this.terrainLines);
    const geom = this.deps.wireGeoms.acquire(spec.ref.key, spec.ref.sub, () => lineGeometry(spec.build()));
    this.wireRef = spec.ref;
    this.wire = new LineSegments2(geom, this.deps.lines.get({ color: [0, 0, 0], width: 1 }));
    this.wire.matrixAutoUpdate = false;
    // Lights are drawn as glyphs in both display modes; other wires only in wireframe mode.
    (this.isLight ? this.deps.gizmoScene : this.deps.wireScene).add(this.wire);
    this.applyStyle();
    this.applyTransform();
  }

  private buildPick(): void {
    this.disposePick();
    const spec = pickSpec(this.obj);
    const geom = this.deps.pickGeoms.acquire(spec.ref.key, spec.ref.sub, spec.build);
    this.pickRef = spec.ref;
    this.pick = new Mesh(geom, this.deps.pickMaterial);
    this.pick.matrixAutoUpdate = false;
    this.pick.userData.objectId = this.obj.id;
  }

  private applyStyle(): void {
    const { selected, hovered, depthCue, submerged } = this.style;
    const color = wireColor(this.obj, selected, hovered);
    if (this.plane) {
      const opacity = selected ? 0.95 : (PLANE_OPACITY[this.obj.type as InfinitePlaneType] ?? 0.6) * (submerged ? SUBMERGED_PLANE_FACTOR : 1);
      this.plane.setStyle(color, hovered && !selected ? Math.min(1, opacity + 0.2) : opacity, this.deps.lines.get({ color, width: selected ? 1.5 : 1 }));
      this.plane.quad.renderOrder = selected ? 1 : 0;
      return;
    }
    if (this.wire) {
      this.wire.material = this.deps.lines.get({
        color,
        width: selected ? 1.5 : hovered ? 1.25 : 1,
        opacity: this.obj.locked && !selected ? 0.5 : 1,
        fog: depthCue && !selected && !this.isLight,
      });
      this.wire.renderOrder = selected ? 3 : hovered ? 2 : 1;
    }
    this.updateShadow();
  }

  /** Height of the ground the shadow falls on (set by the engine each frame). */
  setShadowHeight(y: number): void {
    if (y === this.shadowY && this.shadow) return;
    this.shadowY = y;
    this.placeShadow();
  }

  private updateShadow(): void {
    const want = this.style.selected && !this.isLight && !this.plane && !this.obj.hidden && !!this.wire;
    if (!want || !this.wire) {
      this.shadow?.removeFromParent();
      this.shadow = null;
      return;
    }
    if (!this.shadow || this.shadow.geometry !== this.wire.geometry) {
      this.shadow?.removeFromParent();
      this.shadow = new LineSegments2(this.wire.geometry as LineSegmentsGeometry, this.deps.lines.get({ color: SHADOW_COLOR, width: 1, opacity: 0.32 }));
      this.shadow.matrixAutoUpdate = false;
      this.shadow.renderOrder = 0;
      this.deps.wireScene.add(this.shadow);
    }
    this.placeShadow();
  }

  private placeShadow(): void {
    if (!this.shadow) return;
    // Flatten world y onto the ground plane: (x, y, z) -> (x, ground, z).
    _flat.set(1, 0, 0, 0, 0, 0, 0, this.shadowY + 0.01, 0, 0, 1, 0, 0, 0, 0, 1);
    this.shadow.matrix.multiplyMatrices(_flat, objectMatrix(this.obj.transform, _m2));
    this.shadow.matrixWorldNeedsUpdate = true;
  }

  private applyVisibility(): void {
    const hidden = !!this.obj.hidden;
    if (this.wire) this.wire.visible = !hidden;
    if (this.solid) this.solid.visible = !hidden;
    if (this.shadow) this.shadow.visible = !hidden;
  }

  private applyTransform(): void {
    if (this.plane) return;
    objectMatrix(this.obj.transform, _m);
    for (const o of [this.wire, this.pick, this.solid]) {
      if (!o) continue;
      o.matrix.copy(_m);
      o.matrixWorldNeedsUpdate = true;
    }
    if (this.pick) this.pick.updateMatrixWorld(true);
    this.applyVisibility();
    this.placeShadow();
  }

  private rebuildSolid(): void {
    this.disposeSolid();
    const o = this.obj;
    const d = this.deps;
    if (this.isLight) return;
    let root: Object3D;
    if (this.plane) {
      const mat = planeSolidMaterial(o);
      this.solidMaterials.push(mat);
      const geom = d.solidGeoms.acquire('polarPlane', '', polarPlaneGeometry);
      this.solidRefs.push({ key: 'polarPlane', sub: '' });
      root = new Mesh(geom, mat);
      root.renderOrder = o.type === 'cloud' ? 5 : o.type === 'water' ? 4 : 0;
      root.frustumCulled = false;
      d.solidScene.add(root);
      this.solid = root;
      return;
    }
    if (isTerrainLike(o.type) && o.terrain && !o.showAsBox) {
      const t = o.terrain;
      const look = materialLookKey(o.material);
      const ref = { key: t.heights, sub: `solid:${o.type}:${t.resolution}:${t.clipLow ?? 0}:${t.clipHigh ?? 1}:${look}` };
      const geom = d.solidGeoms.acquire(ref.key, ref.sub, () => terrainSolidGeometry(t, o.type === 'lattice', o.material));
      this.solidRefs.push(ref);
      const mat = solidMaterial(o.material, { vertexColors: true, doubleSided: true });
      this.solidMaterials.push(mat);
      root = new Mesh(geom, mat);
    } else if (o.type === 'tree' && !o.showAsBox) {
      const { trunk, crown } = treeSolidGeometries(o);
      this.solidOwned.push(trunk, crown);
      const trunkColor = o.tree?.trunkColor ?? [0.32, 0.22, 0.14];
      const trunkMat = new MeshPhongMaterial({ color: new Color().setRGB(trunkColor[0], trunkColor[1], trunkColor[2], SRGBColorSpace), shininess: 8 });
      const crownMat = solidMaterial(o.material);
      this.solidMaterials.push(trunkMat, crownMat);
      const g = new Group();
      g.add(new Mesh(trunk, trunkMat), new Mesh(crown, crownMat));
      root = g;
    } else {
      const spec = primitiveSolid(o) ?? primitiveSolid({ ...o, type: 'cube' })!;
      const geom = d.solidGeoms.acquire(spec.key, '', spec.build);
      this.solidRefs.push({ key: spec.key, sub: '' });
      const mat = solidMaterial(o.material, { doubleSided: spec.doubleSided });
      this.solidMaterials.push(mat);
      root = new Mesh(geom, mat);
    }
    root.matrixAutoUpdate = false;
    d.solidScene.add(root);
    this.solid = root;
    this.applyTransform();
  }

  private disposeWire(): void {
    this.shadow?.removeFromParent();
    this.shadow = null;
    if (this.wire) this.wire.removeFromParent();
    if (this.wireRef) this.deps.wireGeoms.release(this.wireRef.key, this.wireRef.sub);
    this.wire = null;
    this.wireRef = null;
  }

  private disposePick(): void {
    if (this.pickRef) this.deps.pickGeoms.release(this.pickRef.key, this.pickRef.sub);
    this.pick = null;
    this.pickRef = null;
  }

  private disposeSolid(): void {
    if (this.solid) this.solid.removeFromParent();
    this.solidRefs.forEach((r) => this.deps.solidGeoms.release(r.key, r.sub));
    this.solidOwned.forEach((g) => g.dispose());
    this.solidMaterials.forEach((m) => m.dispose());
    this.solid = null;
    this.solidRefs = [];
    this.solidOwned = [];
    this.solidMaterials = [];
  }
}

function planeSolidMaterial(o: SceneObject): MeshPhongMaterial | MeshBasicMaterial {
  const c = previewColor(o.material);
  if (o.type === 'cloud') {
    return new MeshBasicMaterial({ color: new Color(1, 1, 1), transparent: true, opacity: 0.32, depthWrite: false, side: DoubleSide });
  }
  if (o.type === 'water') {
    const tint: [number, number, number] = [c[0] * 0.6 + 0.08, c[1] * 0.75 + 0.14, c[2] * 0.8 + 0.24];
    return new MeshPhongMaterial({
      color: new Color().setRGB(tint[0], tint[1], tint[2], SRGBColorSpace),
      specular: new Color(0.55, 0.55, 0.55),
      shininess: 180,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: DoubleSide,
    });
  }
  return new MeshPhongMaterial({ color: new Color().setRGB(c[0], c[1], c[2], SRGBColorSpace), shininess: 6, side: DoubleSide });
}

function placePlaneSolid(mesh: Object3D, view: ViewInfo, height: number): void {
  // The polar plane has radius 1.
  const size = view.ortho ? Math.max(view.right - view.left, view.top - view.bottom) * 1.5 : Math.min(view.far * 0.75, 20000);
  const cx = view.ortho ? view.eye[0] + view.basis.forward[0] * (view.far / 2) : view.eye[0];
  const cz = view.ortho ? view.eye[2] + view.basis.forward[2] * (view.far / 2) : view.eye[2];
  mesh.position.set(cx, height, cz);
  mesh.scale.set(size, 1, size);
  mesh.updateMatrixWorld(true);
}
