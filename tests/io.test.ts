import { describe, expect, it } from 'vitest';
import { defaultCamera, defaultRenderSettings } from '@/core/defaults';
import { defaultMaterial } from '@/core/materialUtils';
import type { Scene, SceneObject } from '@/core/types';
import { decodeHeights8, encodeHeights8, base64ToF32, f32ToBase64 } from '@/io/heights';
import { NOT_A_SCENE } from '@/io/normalize';
import { deserializeScene, deserializeSceneReport, normalizeScene, normalizeSceneReport, serializeScene } from '@/io/serialize';
import { SHARE_WARN_CHARS, decodeShareHash, encodeShareLink, readShareHash } from '@/io/share';
import { packScene } from '@/io/shareCodec';
import { make } from '@/scenes/build/kit';
import { shapedTerrain } from '@/scenes/build/terrains';
import { createDefaultScene } from '@/scenes/defaultScene';
import { SAMPLE_SCENES } from '@/scenes/samples';
import { defaultSky } from '@/sky/defaults';
import { heightsFromRecipe } from '@/terrain';

const BASE = 'https://bryce.example/app/';
const hashOf = (link: string) => link.slice(link.indexOf('#'));

/** A scene with one recipe terrain and one hand-shaped (painted) terrain. */
function terrainScene(): Scene {
  const scene = createDefaultScene();
  const painted = make('terrain', {
    name: 'Painted Hill',
    at: [0, 4, 0],
    size: [10, 4, 10],
    terrain: shapedTerrain(256, (x, z) => Math.max(0, 1 - (x * x + z * z)) * (0.7 + 0.3 * Math.sin(x * 4) * Math.cos(z * 3))),
  });
  return { ...scene, objects: [...scene.objects, painted] };
}

describe('serialize', () => {
  it('round-trips a scene exactly, including Float32 terrain heights', () => {
    const scene = terrainScene();
    const back = deserializeScene(serializeScene(scene));
    expect(back.objects.length).toBe(scene.objects.length);
    scene.objects.forEach((o, i) => {
      const b = back.objects[i];
      expect(b.id).toBe(o.id);
      expect(b.transform).toEqual(o.transform);
      expect(b.material).toEqual(o.material);
      if (o.terrain) {
        expect(b.terrain!.heights).toBeInstanceOf(Float32Array);
        expect(Array.from(b.terrain!.heights)).toEqual(Array.from(o.terrain.heights));
        expect(b.terrain!.recipe).toEqual(o.terrain.recipe);
      }
    });
    expect(back.sky).toEqual(scene.sky);
    expect(back.camera).toEqual(scene.camera);
    expect(back.render).toEqual(scene.render);
  });

  it('writes a versioned format marker', () => {
    const doc = JSON.parse(serializeScene(createDefaultScene()));
    expect(doc.format).toBe('bryce3d-web-scene');
    expect(doc.fileVersion).toBe(2);
    expect(doc.version).toBe(1);
  });

  it('quantizes to Uint16 on request within 1/65535', () => {
    const scene = terrainScene();
    const back = deserializeScene(serializeScene(scene, { heights: 'u16' }));
    const a = scene.objects.find((o) => o.name === 'Painted Hill')!.terrain!.heights;
    const b = back.objects.find((o) => o.name === 'Painted Hill')!.terrain!.heights;
    let err = 0;
    for (let i = 0; i < a.length; i++) err = Math.max(err, Math.abs(a[i] - b[i]));
    expect(err).toBeLessThanOrEqual(1 / 65535);
  });

  it('can omit recipe terrains and rebuild them identically', () => {
    const scene = createDefaultScene();
    const text = serializeScene(scene, { heights: 'recipe' });
    expect(text.length).toBeLessThan(serializeScene(scene).length / 10);
    const back = deserializeScene(text);
    scene.objects.forEach((o, i) => {
      if (o.terrain) expect(Array.from(back.objects[i].terrain!.heights)).toEqual(Array.from(o.terrain.heights));
    });
  });

  it('opens foundation-format files (no marker)', () => {
    const scene = createDefaultScene();
    const legacy = JSON.stringify(scene, (k, v) => (k === 'heights' && v instanceof Float32Array ? { f32: f32ToBase64(v) } : v));
    expect(deserializeScene(legacy).objects.length).toBe(scene.objects.length);
  });

  it('rejects things that are not scenes with a readable error', () => {
    expect(() => deserializeScene('definitely not json')).toThrow(/not a Bryce 3D Web scene/);
    expect(() => deserializeScene('{"hello": "world"}')).toThrow(NOT_A_SCENE);
    expect(() => deserializeScene('[1, 2, 3]')).toThrow(NOT_A_SCENE);
    expect(() => normalizeScene(null)).toThrow(NOT_A_SCENE);
  });
});

describe('normalizeScene', () => {
  it('completes a minimal scene from defaults', () => {
    const s = normalizeScene({ objects: [{ type: 'sphere' }, { type: 'terrain', terrain: { recipe: { generator: 'fractal', seed: 9, resolution: 32, ops: [] } } }] });
    expect(s.version).toBe(1);
    expect(s.name).toBe('Untitled');
    expect(s.sky).toEqual(defaultSky());
    expect(s.camera).toEqual(defaultCamera());
    expect(s.render).toEqual(defaultRenderSettings());
    const [sphere, terrain] = s.objects;
    expect(sphere.id).toMatch(/\w+/);
    expect(sphere.name).toBe('Sphere 1');
    expect(sphere.transform.scale.every((v) => v > 0)).toBe(true);
    expect(sphere.material).toEqual(defaultMaterial());
    expect(terrain.terrain!.resolution).toBe(32);
    expect(Array.from(terrain.terrain!.heights)).toEqual(Array.from(heightsFromRecipe(terrain.terrain!.recipe!)));
  });

  it('fills partial fields, clamps ranges and repairs bad values', () => {
    const { scene, warnings } = normalizeSceneReport({
      name: 'Partial',
      sky: { haze: 400, sunAzimuth: -30, stratus: { cover: 10 } },
      camera: { position: [1, 2, 3], target: [1, 2, 3], fov: 500 },
      render: { width: 'wide', samples: 0 },
      objects: [
        { id: 'a', type: 'cube', transform: { position: [1, 2, 3], scale: [0, -2, 'x'] }, material: { diffuseColor: [2, -1, 0.5], reflection: 150, drivers: { diffuseColor: 2 } } },
        { id: 'a', type: 'torus', torus: { minorRadius: 9 } },
        { type: 'hyperboloid' },
        'garbage',
        { type: 'terrain', terrain: { heights: [0.1, 0.2, 0.3] } },
        { type: 'spotLight', light: { intensity: 50 } },
      ],
    });
    expect(scene.sky.haze).toBe(100);
    expect(scene.sky.sunAzimuth).toBe(330);
    expect(scene.sky.stratus.cover).toBe(10);
    expect(scene.sky.stratus.height).toBe(defaultSky().stratus.height);
    expect(scene.camera.fov).toBe(120);
    expect(scene.camera.target).not.toEqual(scene.camera.position);
    expect(scene.render.width).toBe(800);
    expect(scene.render.samples).toBe(1);
    expect(scene.objects.map((o) => o.type)).toEqual(['cube', 'torus', 'terrain', 'spotLight']);
    const [cube, torus, terrain, spot] = scene.objects;
    expect(cube.transform.scale).toEqual([2, 2, 2]);
    expect(cube.material.diffuseColor).toEqual([1, 0, 0.5]);
    expect(cube.material.reflection).toBe(100);
    expect(cube.material.drivers).toEqual({});
    expect(torus.id).not.toBe('a');
    expect(torus.torus!.minorRadius).toBe(0.5);
    expect(terrain.terrain!.heights.length).toBe(terrain.terrain!.resolution ** 2);
    expect(spot.light!.intensity).toBe(50);
    expect(spot.light!.coneAngle).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('hyperboloid'))).toBe(true);
    expect(warnings.some((w) => w.includes('damaged height data'))).toBe(true);
  });

  it('resamples terrains to a supported grid size', () => {
    const n = 100;
    const s = normalizeScene({ objects: [{ type: 'terrain', terrain: { heights: Array.from({ length: n * n }, (_, i) => (i % n) / n) } }] });
    expect(s.objects[0].terrain!.resolution).toBe(128);
  });

  it('reports corrupt base64 heights instead of failing the whole file', () => {
    const scene = createDefaultScene();
    const doc = JSON.parse(serializeScene(scene));
    const t = doc.objects.find((o: SceneObject) => o.type === 'terrain');
    t.terrain.heights = { f32: '%%%not base64%%%' };
    const { scene: back } = deserializeSceneReport(JSON.stringify(doc));
    expect(back.objects.length).toBe(scene.objects.length);
  });
});

describe('height codecs', () => {
  it('base64 Float32 round-trips exactly', () => {
    const a = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i) * 0.5 + 0.5);
    expect(Array.from(base64ToF32(f32ToBase64(a)))).toEqual(Array.from(a));
  });

  it('8-bit predictive codec stays within half a quantization step', () => {
    const n = 64;
    const h = Float32Array.from({ length: n * n }, (_, i) => 0.2 + 0.6 * Math.abs(Math.sin((i % n) / 9) * Math.cos(Math.floor(i / n) / 7)));
    const p = encodeHeights8(h, n);
    expect(p.d.length).toBe(n * n);
    expect(JSON.stringify(p.d)).toBe(`"${p.d}"`);
    const back = decodeHeights8(p);
    const step = (p.hi - p.lo) / 255;
    for (let i = 0; i < h.length; i++) expect(Math.abs(back[i] - h[i])).toBeLessThanOrEqual(step / 2 + 1e-6);
  });

  it('rejects damaged 8-bit data', () => {
    expect(() => decodeHeights8({ n: 4, lo: 0, hi: 1, d: 'abc' })).toThrow();
  });
});

describe('share links', () => {
  it('round-trips a scene with recipe terrains (heights rebuilt exactly)', () => {
    const scene = createDefaultScene();
    const link = encodeShareLink(scene, { base: BASE });
    expect(link.startsWith(`${BASE}#s=`)).toBe(true);
    expect(link.length).toBeLessThan(SHARE_WARN_CHARS);
    const back = decodeShareHash(hashOf(link))!;
    expect(back.name).toBe(scene.name);
    expect(back.objects.map((o) => o.name)).toEqual(scene.objects.map((o) => o.name));
    scene.objects.forEach((o, i) => {
      const b = back.objects[i];
      expect(b.type).toBe(o.type);
      for (let k = 0; k < 3; k++) {
        expect(b.transform.position[k]).toBeCloseTo(o.transform.position[k], 2);
        expect(b.transform.scale[k]).toBeCloseTo(o.transform.scale[k], 2);
      }
      expect(b.material.name).toBe(o.material.name);
      expect(b.material.reflection).toBeCloseTo(o.material.reflection, 2);
      expect(b.material.components.length).toBe(o.material.components.length);
      if (o.terrain) {
        expect(b.terrain!.recipe).toEqual(o.terrain.recipe);
        expect(Array.from(b.terrain!.heights)).toEqual(Array.from(o.terrain.heights));
      }
    });
    expect(back.sky.sunAzimuth).toBeCloseTo(scene.sky.sunAzimuth, 2);
    expect(back.sky.cumulus.cover).toBeCloseTo(scene.sky.cumulus.cover, 2);
    expect(back.camera.position[2]).toBeCloseTo(scene.camera.position[2], 2);
  });

  it('round-trips painted terrains as downsampled 8-bit heights', () => {
    const scene = terrainScene();
    const back = decodeShareHash(hashOf(encodeShareLink(scene, { base: BASE })))!;
    const a = scene.objects.find((o) => o.name === 'Painted Hill')!.terrain!;
    const b = back.objects.find((o) => o.name === 'Painted Hill')!.terrain!;
    expect(b.recipe).toBeUndefined();
    expect(b.resolution).toBe(a.resolution);
    let err = 0;
    for (let i = 0; i < a.heights.length; i++) err = Math.max(err, Math.abs(a.heights[i] - b.heights[i]));
    expect(err).toBeLessThan(0.04);
  });

  it('keeps every sample scene link reasonably short', () => {
    for (const sample of SAMPLE_SCENES) {
      const link = encodeShareLink(sample.build(), { base: BASE });
      expect(link.length, sample.name).toBeLessThan(32 * 1024);
      expect(decodeShareHash(hashOf(link))!.objects.length).toBe(sample.build().objects.length);
    }
  });

  it('stores identical materials once', () => {
    const packed = packScene(SAMPLE_SCENES.find((s) => s.id === 'tangerine-tide')!.build());
    expect(packed.m.length).toBe(2);
  });

  it('reports damaged links and ignores hashes without a scene', () => {
    expect(readShareHash('#view=top')).toBeNull();
    expect(decodeShareHash('#s=not-a-real-payload')).toBeNull();
    const r = readShareHash('#s=AAAA');
    expect(r && 'error' in r ? r.error : '').toMatch(/damaged|not/);
  });

  it('decodes links whose payload was percent-encoded by a chat app', () => {
    const link = encodeShareLink(createDefaultScene(), { base: BASE });
    const payload = link.split('#s=')[1];
    expect(decodeShareHash(`#s=${encodeURIComponent(payload)}`)).not.toBeNull();
  });
});
