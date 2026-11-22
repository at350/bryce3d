import { describe, expect, it } from 'vitest';
import { cameraBasis, v3 } from '@/core/math';
import { isLight, isTerrainLike } from '@/core/objects';
import type { CameraState, Scene, SceneObject } from '@/core/types';
import { normalizeScene } from '@/io/serialize';
import { boundsCenter, groupBounds, placeInView } from '@/scenes/build/placement';
import { resolveGenerator, terrain } from '@/scenes/build/terrains';
import { createDefaultScene, emptyScene } from '@/scenes/defaultScene';
import { OBJECT_CATEGORIES, OBJECT_PRESETS } from '@/scenes/objectLibrary';
import { SAMPLE_SCENES, SCENE_CATEGORIES } from '@/scenes/samples';

function expectValidObjects(objects: SceneObject[]) {
  expect(new Set(objects.map((o) => o.id)).size).toBe(objects.length);
  for (const o of objects) {
    const t = o.transform;
    expect([...t.position, ...t.rotation, ...t.scale].every(Number.isFinite), `${o.name} transform`).toBe(true);
    expect(t.scale.every((v) => v > 0), `${o.name} scale`).toBe(true);
    expect(o.name.length).toBeGreaterThan(0);
    if (isTerrainLike(o.type)) {
      const d = o.terrain!;
      expect(d.heights.length).toBe(d.resolution * d.resolution);
      expect([16, 32, 64, 128, 256, 512, 1024]).toContain(d.resolution);
      expect(d.heights.every((h) => h >= 0 && h <= 1)).toBe(true);
    }
    if (isLight(o.type)) expect(o.light).toBeDefined();
    if (o.type === 'torus') expect(o.torus!.minorRadius).toBeGreaterThanOrEqual(0.05);
    if (o.type === 'stone') expect(o.stone).toBeDefined();
    if (o.type === 'tree') expect(o.tree).toBeDefined();
    for (const c of o.material.components) expect(c.gradient.length).toBeGreaterThanOrEqual(2);
    for (const d of Object.values(o.material.drivers)) expect(d === -1 || d! < o.material.components.length).toBe(true);
  }
}

function expectValidScene(scene: Scene) {
  expect(scene.version).toBe(1);
  expect(scene.objects.length).toBeGreaterThan(0);
  expectValidObjects(scene.objects);
  expect(v3.len(v3.sub(scene.camera.target, scene.camera.position))).toBeGreaterThan(1);
  // a well-formed scene passes validation untouched
  const n = normalizeScene(scene);
  expect(n.objects.map((o) => o.type)).toEqual(scene.objects.map((o) => o.type));
  expect(n.sky).toEqual(scene.sky);
  expect(n.camera).toEqual(scene.camera);
  expect(n.render).toEqual(scene.render);
  n.objects.forEach((o, i) => expect(o.material).toEqual(scene.objects[i].material));
}

describe('startup scene', () => {
  it('is a valid, populated poster scene', () => {
    const s = createDefaultScene();
    expectValidScene(s);
    expect(s.objects.some((o) => o.type === 'water')).toBe(true);
    expect(s.objects.some((o) => o.type === 'terrain')).toBe(true);
    expect(s.objects.some((o) => o.material.reflection > 80)).toBe(true);
  });

  it('builds fresh ids every time', () => {
    const a = createDefaultScene();
    const b = createDefaultScene();
    expect(a.objects.some((o) => b.objects.some((x) => x.id === o.id))).toBe(false);
  });

  it('File > New is a ground plane under the default sky', () => {
    const s = emptyScene();
    expect(s.objects.map((o) => o.type)).toEqual(['ground']);
  });
});

describe('sample scenes', () => {
  it('offers at least 12 named, described, categorized samples', () => {
    expect(SAMPLE_SCENES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(SAMPLE_SCENES.map((s) => s.id)).size).toBe(SAMPLE_SCENES.length);
    for (const s of SAMPLE_SCENES) {
      expect(s.description.length).toBeGreaterThan(30);
      expect(SCENE_CATEGORIES).toContain(s.category);
    }
  });

  for (const sample of SAMPLE_SCENES) {
    it(`${sample.name} builds a valid scene`, () => {
      const scene = sample.build();
      expectValidScene(scene);
      expect(scene.name).toBe(sample.name);
    });
  }
});

const FLOATING = new Set(['floating-island', 'orb-constellation', 'atom', 'ringed-planet', 'fireflies']);

describe('object library', () => {
  it('has 30+ presets with unique ids in known categories', () => {
    expect(OBJECT_PRESETS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(OBJECT_PRESETS.map((p) => p.id)).size).toBe(OBJECT_PRESETS.length);
    for (const p of OBJECT_PRESETS) expect(OBJECT_CATEGORIES).toContain(p.category);
    for (const c of OBJECT_CATEGORIES) expect(OBJECT_PRESETS.some((p) => p.category === c)).toBe(true);
  });

  for (const preset of OBJECT_PRESETS) {
    it(`${preset.name} builds objects resting on the ground near the origin`, () => {
      const objects = preset.build();
      expect(objects.length).toBeGreaterThan(0);
      expectValidObjects(objects);
      expect(objects.some((o) => o.type === 'water' || o.type === 'ground' || o.type === 'cloud')).toBe(false);
      const b = groupBounds(objects)!;
      expect(b.min[1]).toBeGreaterThanOrEqual(-0.5);
      if (!FLOATING.has(preset.id)) expect(b.min[1]).toBeLessThan(0.5);
      else expect(b.min[1]).toBeGreaterThan(0.5);
      const c = boundsCenter(b);
      expect(Math.abs(c[0])).toBeLessThan(20);
      expect(Math.abs(c[2])).toBeLessThan(20);
      const again = preset.build();
      expect(again.some((o) => objects.some((x) => x.id === o.id))).toBe(false);
    });
  }
});

describe('placement', () => {
  const arch = () => OBJECT_PRESETS.find((p) => p.id === 'arch')!.build();

  it('drops a preset on the ground in front of the camera, turned toward it', () => {
    const cam: CameraState = { position: [30, 10, 30], target: [0, 2, 0], roll: 0, fov: 50 };
    const before = groupBounds(arch())!;
    const placed = placeInView(arch(), cam);
    const b = groupBounds(placed)!;
    const c = boundsCenter(b);
    const { forward } = cameraBasis(cam);
    expect(v3.dot(v3.sub(c, cam.position), forward)).toBeGreaterThan(0);
    expect(b.min[1]).toBeCloseTo(before.min[1], 5);
    // the arch faces +Z when built; placed, every stone turned by the same yaw toward the camera
    const yaws = new Set(placed.map((o) => Math.round(o.transform.rotation[1])));
    expect(yaws.has(45)).toBe(true);
  });

  it('centers the group on the origin without a camera', () => {
    const c = boundsCenter(groupBounds(placeInView(arch(), null))!);
    expect(Math.abs(c[0])).toBeLessThan(1e-6);
    expect(Math.abs(c[2])).toBeLessThan(1e-6);
  });
});

describe('terrain helpers', () => {
  it('falls back to the fractal generator for kinds the terrain module lacks', () => {
    const g = resolveGenerator('volcano');
    expect(typeof g.id).toBe('string');
    const t = terrain({ kind: 'canyon', seed: 3, resolution: 32 });
    expect(t.heights.length).toBe(32 * 32);
    expect(t.recipe?.resolution).toBe(32);
  });
});
