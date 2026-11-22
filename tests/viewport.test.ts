import { beforeEach, describe, expect, it } from 'vitest';
import { Euler, Matrix4, OrthographicCamera, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { DEG, cameraBasis, objectMatrix, v3 } from '@/core/math';
import { useStore } from '@/core/store';
import type { CameraState, TerrainData, Transform, Vec3 } from '@/core/types';
import { createDefaultScene } from '@/scenes/defaultScene';
import { boxPoint, localBounds, objectBoxFrame, worldAABB } from '@/viewport/bounds';
import { fitOrtho, frameSelection, getOrthoState, resetView, zoomView } from '@/viewport/commands';
import { terrainLineLevel } from '@/viewport/engine/ObjectView';
import { hitTag, layoutTags } from '@/viewport/engine/overlay2d';
import { gridLineDistancePx, orthoGridLevel, perspectiveGridLevel } from '@/viewport/engine/planeGrid';
import { RefCache } from '@/viewport/engine/refCache';
import { handleAnchor, handlesFor, handleWorldPoint, hitHandle, visibleHandleMask } from '@/viewport/handles';
import {
  ORTHO_BASIS,
  ORTHO_VIEWS,
  applyViewToCamera,
  canvasToFrameNdc,
  fitFrame,
  horizonLine,
  orthoView,
  perspectiveView,
  pixelRay,
  projectPoint,
  worldPerPixel,
} from '@/viewport/projection';
import { sampleHeight, terrainGridMesh, terrainWire } from '@/viewport/terrainShapes';
import {
  constrainDelta,
  dragAngle,
  dragRatio,
  rayPlane,
  rotateTransform,
  scaleInFrame,
  snapRatio,
  wrapDeg,
} from '@/viewport/transformOps';
import { useViewport } from '@/viewport/viewState';
import {
  boxWire,
  coneWire,
  discWire,
  pyramidWire,
  sphereWire,
  squareWire,
  stoneRadius,
  stoneWire,
  torusWire,
  treeWire,
} from '@/viewport/wireShapes';

const points = (a: Float32Array): Vec3[] => {
  const out: Vec3[] = [];
  for (let i = 0; i < a.length; i += 3) out.push([a[i], a[i + 1], a[i + 2]]);
  return out;
};

/** The SPEC camera model: frame NDC of a world point (inverse of the render's primary ray). */
function specNdc(cam: CameraState, aspect: number, p: Vec3): [number, number] {
  const { right, up, forward } = cameraBasis(cam);
  const d = v3.sub(p, cam.position);
  const z = v3.dot(d, forward);
  const t = Math.tan((cam.fov * DEG) / 2);
  return [v3.dot(d, right) / z / (t * aspect), v3.dot(d, up) / z / t];
}

const CAMS: CameraState[] = [
  { position: [0, 3.2, 44], target: [0, 7, 0], roll: 0, fov: 50 },
  { position: [12, 30, -20], target: [-4, 2, 6], roll: 17, fov: 35 },
  { position: [-5, 1, 5], target: [3, 2, -8], roll: -40, fov: 90 },
];

describe('projection: camera view matches the render camera model', () => {
  it('fits the document frame inside the canvas with its aspect, centered', () => {
    const wide = fitFrame(1200, 600, 4 / 3, 20);
    expect(wide.h).toBeCloseTo(560);
    expect(wide.w / wide.h).toBeCloseTo(4 / 3);
    expect(wide.x).toBeCloseTo((1200 - wide.w) / 2);
    const tall = fitFrame(600, 1200, 16 / 9, 10);
    expect(tall.w).toBeCloseTo(580);
    expect(tall.w / tall.h).toBeCloseTo(16 / 9);
    expect(tall.y).toBeCloseTo((1200 - tall.h) / 2);
  });

  it('places points on the same frame pixel as the ray tracer, for any frame placement and roll', () => {
    const sizes = [
      [1000, 700, { x: 40, y: 30, w: 800, h: 600 }],
      [900, 900, fitFrame(900, 900, 16 / 9, 24)],
      [640, 360, { x: -100, y: 20, w: 500, h: 375 }],
    ] as const;
    for (const cam of CAMS) {
      for (const [w, h, frame] of sizes) {
        const aspect = frame.w / frame.h;
        const view = perspectiveView(cam, aspect, w, h, frame);
        for (const p of [
          [1, 2, 3],
          [-8, 0, -12],
          [20, 9, -40],
        ] as Vec3[]) {
          if (v3.dot(v3.sub(p, cam.position), cameraBasis(cam).forward) <= 0.1) continue;
          const s = projectPoint(view, p);
          const [nx, ny] = canvasToFrameNdc(frame, s.x, s.y);
          const [ex, ey] = specNdc(cam, aspect, p);
          expect(nx).toBeCloseTo(ex, 9);
          expect(ny).toBeCloseTo(ey, 9);
        }
      }
    }
  });

  it('enlarges the canvas vertical field of view when the frame is width-limited', () => {
    const cam = CAMS[0];
    const frame = fitFrame(800, 900, 4 / 3, 0); // width-limited: 800 x 600 centered
    const v = perspectiveView(cam, 4 / 3, 800, 900, frame);
    const t = Math.tan((cam.fov * DEG) / 2);
    expect(v.top).toBeCloseTo((t * 900) / 600);
    expect(v.bottom).toBeCloseTo((-t * 900) / 600);
    expect(v.right).toBeCloseTo(t * (4 / 3));
  });

  it('the three.js camera built from a view projects exactly like projectPoint', () => {
    const persp = new PerspectiveCamera();
    const ortho = new OrthographicCamera();
    const frame = { x: 70, y: 25, w: 640, h: 480 };
    const views = [
      perspectiveView(CAMS[1], 4 / 3, 800, 560, frame),
      orthoView('left', { center: [3, 4, 5], halfHeight: 20 }, 800, 560),
      orthoView('top', { center: [-2, 0, 7], halfHeight: 12 }, 640, 480),
    ];
    for (const v of views) {
      const cam = applyViewToCamera(v, persp, ortho);
      for (const p of [
        [0, 2, 0],
        [-6, 1, 9],
        [4, 8, -3],
      ] as Vec3[]) {
        const s = projectPoint(v, p);
        if (!v.ortho && s.depth <= 0) continue;
        const ndc = new Vector3(...p).project(cam);
        expect((ndc.x + 1) * 0.5 * v.width).toBeCloseTo(s.x, 6);
        expect((1 - ndc.y) * 0.5 * v.height).toBeCloseTo(s.y, 6);
      }
    }
  });

  it('pixel rays go back through the projected pixel', () => {
    const v = perspectiveView(CAMS[2], 1.5, 900, 600, fitFrame(900, 600, 1.5, 20));
    const ray = pixelRay(v, 123.5, 456.25);
    const p = v3.add(ray.origin, v3.scale(ray.dir, 17));
    const s = projectPoint(v, p);
    expect(s.x).toBeCloseTo(123.5, 6);
    expect(s.y).toBeCloseTo(456.25, 6);
    const o = orthoView('front', { center: [0, 5, 0], halfHeight: 10 }, 400, 300);
    const r2 = pixelRay(o, 100, 50);
    expect(r2.dir).toEqual([0, 0, -1]);
    const s2 = projectPoint(o, v3.add(r2.origin, v3.scale(r2.dir, 300)));
    expect(s2.x).toBeCloseTo(100, 6);
    expect(s2.y).toBeCloseTo(50, 6);
    expect(worldPerPixel(o, 1)).toBeCloseTo(20 / 300);
  });

  it('ortho views have orthonormal right-handed bases and center on their state', () => {
    for (const name of ORTHO_VIEWS) {
      const { right, up, forward } = ORTHO_BASIS[name];
      expect(v3.dot(right, up)).toBeCloseTo(0);
      expect(v3.dot(right, forward)).toBeCloseTo(0);
      v3.cross(right, up).forEach((c, i) => expect(c).toBeCloseTo(-forward[i]));
      const v = orthoView(name, { center: [4, -2, 9], halfHeight: 10 }, 500, 400);
      const s = projectPoint(v, [4, -2, 9]);
      expect(s.x).toBeCloseTo(250);
      expect(s.y).toBeCloseTo(200);
    }
  });

  it('draws the horizon through the eye level, tilted by roll', () => {
    const level: CameraState = { position: [0, 5, 10], target: [0, 5, 0], roll: 0, fov: 50 };
    const frame = { x: 0, y: 0, w: 800, h: 600 };
    const h = horizonLine(perspectiveView(level, 4 / 3, 800, 600, frame))!;
    expect(h[0][1]).toBeCloseTo(300);
    expect(h[1][1]).toBeCloseTo(300);
    const rolled = horizonLine(perspectiveView({ ...level, roll: 20 }, 4 / 3, 800, 600, frame))!;
    expect(Math.abs(rolled[0][1] - rolled[1][1])).toBeGreaterThan(50);
    expect((rolled[0][1] + rolled[1][1]) / 2).toBeCloseTo(300);
    expect(horizonLine(orthoView('top', { center: [0, 0, 0], halfHeight: 5 }, 800, 600))).toBeNull();
  });
});

describe('wire shapes follow the canonical object space', () => {
  it('sphere wire lies on the unit sphere', () => {
    for (const p of points(sphereWire())) expect(v3.len(p)).toBeCloseTo(1, 6);
  });

  it('torus wire lies on a tube of radius r around the major circle R = 1 - r', () => {
    const r = 0.25;
    for (const p of points(torusWire(r))) {
      const ring = Math.hypot(p[0], p[2]) - (1 - r);
      expect(Math.hypot(ring, p[1])).toBeCloseTo(r, 5);
      expect(Math.abs(p[1])).toBeLessThanOrEqual(r + 1e-9);
    }
  });

  it('cone and pyramid have their apex up and base at y = -1; flat shapes sit at y = 0', () => {
    const cone = points(coneWire());
    expect(cone.some((p) => v3.eq(p, [0, 1, 0], 1e-9))).toBe(true);
    expect(Math.max(...cone.filter((p) => p[1] === -1).map((p) => Math.hypot(p[0], p[2])))).toBeCloseTo(1);
    const pyr = points(pyramidWire());
    for (const c of [
      [-1, -1, -1],
      [1, -1, 1],
    ] as Vec3[]) expect(pyr.some((p) => v3.eq(p, c, 1e-9))).toBe(true);
    expect(pyr.some((p) => v3.eq(p, [0, 1, 0], 1e-9))).toBe(true);
    for (const p of [...points(discWire()), ...points(squareWire())]) expect(p[1]).toBe(0);
    expect(boxWire().length / 6).toBe(12);
  });

  it('stones are seeded lumpy spheres inside the cube', () => {
    const s = { seed: 7, lumpiness: 0.8, roughness: 0.6 };
    const dirs: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      v3.norm([1, -1, 0.5]),
    ];
    for (const d of dirs) {
      const r = stoneRadius(s, d);
      expect(r).toBeGreaterThanOrEqual(0.35);
      expect(r).toBeLessThanOrEqual(1);
      expect(stoneRadius(s, d)).toBe(r);
    }
    expect(stoneWire(s)).toEqual(stoneWire({ ...s }));
    expect(stoneWire(s)).not.toEqual(stoneWire({ ...s, seed: 8 }));
  });

  it('trees of every crown type stay inside the cube', () => {
    for (const crown of ['round', 'cone', 'palm', 'willow'] as const) {
      const pts = points(treeWire({ seed: 3, trunkHeight: 0.8, trunkWidth: 0.3, crown, crownNoise: 1, trunkColor: [0.3, 0.2, 0.1] }));
      expect(pts.length).toBeGreaterThan(20);
      for (const p of pts) for (const c of p) expect(Math.abs(c)).toBeLessThanOrEqual(1.25);
    }
  });
});

function flatTerrain(n: number, h: number, extra: Partial<TerrainData> = {}): TerrainData {
  return { resolution: n, heights: new Float32Array(n * n).fill(h), clipLow: 0, clipHigh: 1, ...extra };
}

describe('terrain wire grid', () => {
  it('maps height h to y = 2h - 1 and spans x, z in [-1, 1]', () => {
    const pts = points(terrainWire(flatTerrain(32, 0.75), false));
    expect(pts.length).toBeGreaterThan(100);
    for (const p of pts) {
      expect(p[1]).toBeCloseTo(0.5);
      expect(Math.abs(p[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(p[2])).toBeLessThanOrEqual(1);
    }
    expect(Math.min(...pts.map((p) => p[0]))).toBe(-1);
    expect(Math.max(...pts.map((p) => p[2]))).toBe(1);
  });

  it('mirrors lattices and flattens above clipHigh', () => {
    const pts = points(terrainWire(flatTerrain(16, 0.6, { clipHigh: 0.4 }), true));
    const ys = new Set(pts.map((p) => Math.round(p[1] * 1000) / 1000));
    expect([...ys].sort()).toEqual([-0.4, 0.4]);
  });

  it('cuts the surface below clipLow, ending lines at the cut height', () => {
    const n = 16;
    const heights = new Float32Array(n * n);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) heights[z * n + x] = x / (n - 1);
    const t: TerrainData = { resolution: n, heights, clipLow: 0.5, clipHigh: 1 };
    const pts = points(terrainWire(t, false));
    for (const p of pts) expect(p[1]).toBeGreaterThanOrEqual(2 * 0.5 - 1 - 1e-6);
    expect(Math.min(...pts.map((p) => p[0]))).toBeCloseTo(0, 6);
    const mesh = terrainGridMesh(t, false, 16);
    for (let i = 0; i < mesh.index.length; i++) expect(mesh.heights[mesh.index[i]]).toBeGreaterThanOrEqual(0.5 - 1e-6);
  });

  it('samples bilinearly', () => {
    const t = { resolution: 2, heights: new Float32Array([0, 1, 1, 0]) };
    expect(sampleHeight(t.heights, 2, 0, 0)).toBe(0);
    expect(sampleHeight(t.heights, 2, 1, 0)).toBe(1);
    expect(sampleHeight(t.heights, 2, 0.5, 0.5)).toBeCloseTo(0.5);
  });

  it('chooses fewer grid lines for terrains that are small on screen', () => {
    expect(terrainLineLevel(3)).toBe(8);
    expect(terrainLineLevel(13)).toBe(12);
    expect(terrainLineLevel(30)).toBe(24);
    expect(terrainLineLevel(500)).toBe(32);
  });
});

describe('bounds and handles', () => {
  const t: Transform = { position: [1, 2, 3], rotation: [0, 30, 0], scale: [2, 1, 3] };
  const obj = (type: 'cube' | 'disc' | 'torus') => ({ ...useStore.getState().scene.objects[0], type, transform: t, torus: { minorRadius: 0.2 } });

  it('uses the drawn extent of flat and toroidal shapes', () => {
    expect(localBounds(obj('disc'))).toEqual({ min: [-1, 0, -1], max: [1, 0, 1] });
    expect(localBounds(obj('torus')).max[1]).toBeCloseTo(0.2);
    const f = objectBoxFrame(obj('cube'));
    expect(f.half).toEqual([2, 1, 3]);
    const corner = boxPoint(f, [1, 1, 1]);
    const expected = new Vector3(1, 1, 1).applyMatrix4(objectMatrix(t));
    expect(corner[0]).toBeCloseTo(expected.x);
    expect(corner[2]).toBeCloseTo(expected.z);
  });

  it('offers 8 corners + 6 faces, fewer on flat boxes', () => {
    expect(handlesFor(objectBoxFrame(obj('cube'))).length).toBe(14);
    const flat = handlesFor(objectBoxFrame(obj('disc')));
    expect(flat.filter((h) => h.kind === 'corner').length).toBe(4);
    expect(flat.filter((h) => h.kind === 'face').length).toBe(4);
  });

  it('anchors resizing at the opposite face or the center', () => {
    const f = objectBoxFrame(obj('cube'));
    const top = handlesFor(f).find((h) => h.kind === 'face' && h.axis === 1 && h.s[1] === 1)!;
    expect(handleAnchor(f, top, false)[1]).toBeCloseTo(1);
    expect(handleAnchor(f, top, true)).toEqual(f.center);
    expect(handleWorldPoint(f, top)[1]).toBeCloseTo(3);
  });

  it('hit-tests the nearest handle, preferring faces, and hides collapsed face pairs', () => {
    const defs = handlesFor(objectBoxFrame(obj('cube')));
    const pts = defs.map((_, i) => ({ x: i * 20, y: 0 }));
    expect(hitHandle(pts, defs, 41, 2, 6)).toBe(2);
    expect(hitHandle(pts, defs, 500, 500, 6)).toBe(-1);
    const two = [defs[0], defs.find((d) => d.kind === 'face')!];
    expect(hitHandle([{ x: 0, y: 0 }, { x: 1, y: 0 }], two, 0.5, 0, 6)).toBe(1);
    const faces = defs.filter((d) => d.kind === 'face');
    const fp = faces.map((d) => (d.axis === 2 ? { x: 100 + d.s[2] * 3, y: 100 } : { x: 100 + d.s[0] * 60, y: 100 + d.s[1] * 60 }));
    const mask = visibleHandleMask(faces, fp, { w: 120, h: 120 });
    faces.forEach((d, i) => expect(mask[i]).toBe(d.axis !== 2));
  });

  it('measures world bounds without infinite planes', () => {
    const scene = createDefaultScene();
    const b = worldAABB(scene.objects)!;
    expect(b.min[1]).toBeGreaterThan(-1e3);
    expect(Number.isFinite(b.max[0])).toBe(true);
  });
});

describe('transform ops', () => {
  const base: Transform = { position: [2, 1, -3], rotation: [0, 0, 0], scale: [1, 2, 1] };

  it('intersects rays with planes and constrains moves', () => {
    expect(rayPlane([0, 10, 0], [0, -1, 0], [0, 2, 0], [0, 1, 0])).toEqual([0, 2, 0]);
    expect(rayPlane([0, 10, 0], [1, 0, 0], [0, 2, 0], [0, 1, 0])).toBeNull();
    expect(rayPlane([0, 10, 0], [0, 1, 0], [0, 2, 0], [0, 1, 0])).toBeNull();
    expect(constrainDelta([3, 0, -5], null, true)).toEqual([0, 0, -5]);
    expect(constrainDelta([3, 1, -5], 'x', false)).toEqual([3, 0, 0]);
    expect(constrainDelta([3, 1, -5], null, false)).toEqual([3, 1, -5]);
  });

  it('rotates upright objects around Y with tidy numbers', () => {
    const r = rotateTransform({ ...base, rotation: [0, 170, 0] }, [0, 1, 0], 30, base.position);
    expect(r.rotation).toEqual([0, -160, 0]);
    expect(r.position).toEqual(base.position);
    expect(wrapDeg(-180)).toBe(180);
  });

  it('composes rotations about any axis in world space (matches the object matrix)', () => {
    const t: Transform = { position: [1, 2, 3], rotation: [20, -35, 10], scale: [1, 2, 3] };
    const pivot: Vec3 = [0, 0, 0];
    const axis = v3.norm([1, 1, 0]);
    const r = rotateTransform(t, axis, 40, pivot);
    const q = new Quaternion().setFromAxisAngle(new Vector3(...axis), 40 * DEG);
    const expected = new Matrix4().makeRotationFromQuaternion(q).multiply(objectMatrix(t));
    const got = objectMatrix(r);
    for (let i = 0; i < 16; i++) expect(got.elements[i]).toBeCloseTo(expected.elements[i], 6);
  });

  it('scales about an anchor in the box frame (exact for the object itself)', () => {
    const t: Transform = { position: [0, 4, 0], rotation: [0, 45, 0], scale: [2, 3, 1] };
    const o = { ...useStore.getState().scene.objects[0], type: 'cube' as const, transform: t };
    const f = objectBoxFrame(o);
    const bottom = boxPoint(f, [0, -1, 0]);
    const r = scaleInFrame(t, f.axes, [1, 1.5, 1], bottom);
    expect(r.scale[1]).toBeCloseTo(4.5);
    expect(r.scale[0]).toBeCloseTo(2);
    expect(r.position[1] - r.scale[1]).toBeCloseTo(bottom[1]);
    const u = scaleInFrame(t, f.axes, [2, 2, 2], f.center);
    expect(u.scale).toEqual([4, 6, 2]);
    expect(u.position).toEqual(t.position);
    // rotated object inside a world-aligned group box keeps its proportions under uniform scaling
    const g = scaleInFrame(t, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.5, 0.5, 0.5], [0, 0, 0]);
    g.scale.forEach((s, i) => expect(s).toBeCloseTo(t.scale[i] * 0.5));
    expect(g.rotation).toEqual(t.rotation);
  });

  it('turns screen drags into resize ratios and rotation angles', () => {
    expect(dragRatio({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 10 })).toBeCloseTo(1.5);
    expect(dragRatio({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 50, y: 0 })).toBeNull();
    expect(dragRatio({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: -500, y: 0 })).toBe(0.02);
    expect(snapRatio(1.37)).toBe(1.25);
    expect(snapRatio(0.01)).toBe(0.25);
    // Looking down -Z at a point in front of the pivot: dragging right spins it positively around +Y.
    const v = perspectiveView({ position: [0, 0, 20], target: [0, 0, 0], roll: 0, fov: 50 }, 4 / 3, 800, 600, { x: 0, y: 0, w: 800, h: 600 });
    const project = (p: Vec3) => projectPoint(v, p);
    const a = dragAngle(project, [0, 0, 0], [0, 1, 0], [0, 0, 3], { x: 10, y: 0 })!;
    expect(a).toBeGreaterThan(0);
    expect(dragAngle(project, [0, 0, 0], [0, 1, 0], [0, 0, 0], { x: 10, y: 0 })).toBeNull();
    // the linearized step moves the grabbed point by about the dragged distance
    const before = project([0, 0, 3]);
    const q = new Quaternion().setFromEuler(new Euler(0, a * DEG, 0));
    const after = project(new Vector3(0, 0, 3).applyQuaternion(q).toArray() as Vec3);
    expect(after.x - before.x).toBeCloseTo(10, 0);
  });
});

describe('plane grid picking', () => {
  it('adapts spacing to height and finds grid lines in screen space', () => {
    const near = perspectiveGridLevel(2);
    const far = perspectiveGridLevel(200);
    expect(far.spacing).toBeGreaterThan(near.spacing);
    expect(orthoGridLevel(0.1).spacing).toBeLessThan(orthoGridLevel(1).spacing);
    const cam: CameraState = { position: [0, 10, 20], target: [0, 0, 0], roll: 0, fov: 50 };
    const v = perspectiveView(cam, 4 / 3, 800, 600, { x: 0, y: 0, w: 800, h: 600 });
    const lvl = perspectiveGridLevel(10);
    const s = lvl.blend > 0.5 ? lvl.spacing * 2 : lvl.spacing;
    expect(gridLineDistancePx(v, [s * 2, 0, 0.0], lvl, cam.position)).toBeCloseTo(0, 6);
    expect(gridLineDistancePx(v, [s * 0.5, 0, s * 0.5], lvl, cam.position)).toBeGreaterThan(4);
    expect(gridLineDistancePx(v, [0, 0, -5000], lvl, cam.position)).toBe(Infinity);
  });
});

describe('selection tags and caches', () => {
  it('lays tags out beside the box and keeps them on the canvas', () => {
    const items = [
      { id: 'attributes' as const, label: 'A', hint: 'a' },
      { id: 'material' as const, label: 'M', hint: 'm' },
    ];
    const tags = layoutTags({ x: 100, y: 50, w: 80, h: 60 }, items, 800, 600);
    expect(tags[0].x).toBeGreaterThan(180);
    expect(tags[1].y).toBeGreaterThan(tags[0].y);
    expect(hitTag(tags, tags[1].x + 5, tags[1].y + 5)?.id).toBe('material');
    expect(hitTag(tags, 0, 0)).toBeNull();
    const edge = layoutTags({ x: 760, y: 590, w: 30, h: 30 }, items, 800, 600);
    for (const t of edge) {
      expect(t.x + t.size).toBeLessThanOrEqual(800);
      expect(t.y + t.size).toBeLessThanOrEqual(600);
    }
  });

  it('reference-counts shared resources and disposes them at zero', () => {
    let disposed = 0;
    const cache = new RefCache<{ dispose(): void }>();
    const key = new Float32Array(4);
    const make = () => ({ dispose: () => disposed++ });
    const a = cache.acquire(key, 'x', make);
    const b = cache.acquire(key, 'x', make);
    expect(a).toBe(b);
    cache.release(key, 'x');
    expect(disposed).toBe(0);
    cache.release(key, 'x');
    expect(disposed).toBe(1);
    expect(cache.size).toBe(0);
  });
});

describe('commands', () => {
  beforeEach(() => {
    useStore.getState().loadScene(createDefaultScene());
    useStore.getState().setUI({ view: 'camera' });
    useViewport.setState({ ortho: {}, size: { w: 800, h: 600 } });
  });

  it('frames the selection in the camera view', () => {
    const s = useStore.getState();
    const target = s.scene.objects.find((o) => o.type === 'sphere')!;
    s.select(target.id);
    frameSelection();
    const cam = useStore.getState().scene.camera;
    const center = objectBoxFrame(target).center;
    expect(v3.len(v3.sub(cam.target, center))).toBeLessThan(1e-6);
  });

  it('zooms camera views by dollying and ortho views by scaling', () => {
    const before = useStore.getState().scene.camera;
    const d0 = v3.len(v3.sub(before.target, before.position));
    zoomView(2);
    const after = useStore.getState().scene.camera;
    expect(v3.len(v3.sub(after.target, after.position))).toBeCloseTo(d0 / 2);
    useStore.getState().setUI({ view: 'top' });
    const st = getOrthoState('top');
    zoomView(2);
    expect(useViewport.getState().ortho.top!.halfHeight).toBeCloseTo(st.halfHeight / 2);
    resetView();
    expect(useViewport.getState().ortho.top!.halfHeight).toBeCloseTo(st.halfHeight);
  });

  it('fits ortho views around a box for the window aspect', () => {
    const f = fitOrtho('front', { min: [-10, 0, -1], max: [10, 4, 1] }, 2);
    expect(f.center).toEqual([0, 2, 0]);
    expect(f.halfHeight * 2).toBeGreaterThanOrEqual(10);
  });
});
