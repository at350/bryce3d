import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultRenderSettings } from '@/core/defaults';
import { deserializeScene, deserializeSceneReport, serializeScene } from '@/io/serialize';
import { base64ToF32, f32ToBase64 } from '@/io/heights';
import { decodeSharePayload, encodeShareLink, SHARE_LIMIT_CHARS } from '@/io/share';
import { loadAutosave, writeAutosave } from '@/io/autosave';
import { createDefaultScene } from '@/scenes/defaultScene';
import { SAMPLE_SCENES } from '@/scenes/samples';
import { make } from '@/scenes/build/kit';
import { shapedTerrain } from '@/scenes/build/terrains';
import { useStore } from '@/core/store';
import { hasUnsavedChanges, markClean } from '@/io/dirty';

const AUTOSAVE_KEY = 'bryce3d-web:autosave';

function paintedScene(resolution = 256) {
  const base = createDefaultScene();
  const terrain = make('terrain', {
    name: 'Stress Painted Terrain',
    at: [0, 2, 0],
    size: [8, 3, 8],
    terrain: shapedTerrain(resolution, (x, z) => Math.max(0, 0.5 + 0.45 * Math.sin(x * 43.1 + z * 17.7))),
  });
  return { ...base, name: 'IO Stress', objects: [...base.objects, terrain] };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('public IO stress', () => {
  it('round-trips every sample scene through file JSON and preserves terrain data', () => {
    for (const sample of SAMPLE_SCENES) {
      const before = sample.build();
      const after = deserializeScene(serializeScene(before));
      expect(after.name, sample.id).toBe(before.name);
      expect(after.objects.map((o) => o.type), sample.id).toEqual(before.objects.map((o) => o.type));
      expect(after.camera).toEqual(before.camera);
      expect(after.render).toEqual(before.render);
      for (let i = 0; i < before.objects.length; i++) {
        const a = before.objects[i], b = after.objects[i];
        expect(b.id, `${sample.id}/${i}`).toBe(a.id);
        expect(b.material.name, `${sample.id}/${i}`).toBe(a.material.name);
        if (a.terrain) {
          expect(b.terrain?.heights).toBeInstanceOf(Float32Array);
          expect(b.terrain?.resolution).toBe(a.terrain.resolution);
          for (let j = 0; j < a.terrain.heights.length; j += 997) expect(b.terrain!.heights[j]).toBeCloseTo(a.terrain.heights[j], 5);
        }
      }
    }
  });

  it('round-trips large painted terrain through lossless and compact share encodings', () => {
    const scene = paintedScene(512);
    const source = scene.objects.at(-1)!.terrain!.heights;
    const file = deserializeScene(serializeScene(scene));
    const fileHeights = file.objects.at(-1)!.terrain!.heights;
    expect(fileHeights).toBeInstanceOf(Float32Array);
    expect(fileHeights).not.toBe(source);
    let maxFileError = 0;
    for (let i = 0; i < source.length; i++) maxFileError = Math.max(maxFileError, Math.abs(source[i] - fileHeights[i]));
    expect(maxFileError).toBeLessThan(1 / 65535 + 1e-7);

    const link = encodeShareLink(scene, { base: 'https://example.test/' });
    const payload = link.slice(link.indexOf('#s=') + 3);
    const shared = decodeSharePayload(payload);
    expect('scene' in shared).toBe(true);
    if ('scene' in shared) {
      const shareHeights = shared.scene.objects.at(-1)!.terrain!.heights;
      expect(shareHeights.length).toBe(source.length);
      let maxShareError = 0;
      for (let i = 0; i < source.length; i++) maxShareError = Math.max(maxShareError, Math.abs(source[i] - shareHeights[i]));
      expect(maxShareError).toBeLessThan(0.08);
    }
  });

  it('repairs partial, malformed, and untrusted scene records without leaking invalid values', () => {
    const input = {
      name: '  Hostile partial  ',
      __proto__: { polluted: true },
      version: 999,
      camera: { position: [0, 0, 0], target: [0, 0, 0], fov: Infinity },
      render: { width: 1e100, samples: -4 },
      objects: [
        { id: 'same', type: 'sphere', transform: { scale: [NaN, 0, -2] } },
        { id: 'same', type: 'torus', torus: { minorRadius: 100 } },
        { type: 'nonsense', name: 'hostile unknown' },
        { type: 'terrain', terrain: { heights: [0.1, 0.2, 0.3], clipLow: 0.9, clipHigh: -0.5 } },
        null,
      ],
    };
    const { scene, warnings } = deserializeSceneReport(JSON.stringify(input));
    expect(scene.name).toBe('Hostile partial');
    expect(scene.camera.position).toEqual([0, 0, 0]);
    expect(scene.camera.target).toEqual([0, 0, -1]);
    expect(scene.camera.fov).toBe(50);
    expect(scene.render.width).toBe(4096);
    expect(scene.render.height).toBe(defaultRenderSettings().height);
    expect(scene.render.samples).toBe(1);
    expect(scene.objects.map((o) => o.type)).toEqual(['sphere', 'torus', 'terrain']);
    expect(scene.objects[0].transform.scale).toEqual([2, 2, 2]);
    expect(scene.objects[1].id).not.toBe('same');
    expect(scene.objects[1].torus?.minorRadius).toBe(0.5);
    expect(scene.objects[2].terrain?.heights.length).toBe(scene.objects[2].terrain!.resolution ** 2);
    expect(scene.objects[2].terrain?.clipLow).toBe(0);
    expect(scene.objects[2].terrain?.clipHigh).toBe(0.9);
    expect(warnings.length).toBeGreaterThan(0);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('caps huge object arrays and rejects malformed/truncated inputs', () => {
    const report = deserializeSceneReport(JSON.stringify({ objects: Array.from({ length: 2_050 }, () => ({ type: 'sphere' })) }));
    expect(report.scene.objects).toHaveLength(2_000);
    expect(report.warnings.some((w) => /first 2000/.test(w))).toBe(true);
    for (const text of ['', '{', 'null', '[]', '{"objects":null}']) expect(() => deserializeScene(text)).toThrow();
    expect(() => deserializeScene('{"objects":[{"type":"terrain","terrain":{"heights":{"f32":"abc"}}}]}')).not.toThrow();
  });

  it('bounds direct Float32 inputs and preserves Float32 endian roundtrips', () => {
    const values = Float32Array.from({ length: 257 * 257 }, (_, i) => i % 7 === 0 ? 1.25 : i % 11 === 0 ? -0.25 : (i % 251) / 250);
    const data = Float32Array.from({ length: 8_193 }, (_, i) => Math.fround(Math.sin(i * 0.17)));
    expect(Array.from(base64ToF32(f32ToBase64(data)))).toEqual(Array.from(data));
    const large = paintedScene(512);
    large.objects.at(-1)!.terrain!.heights = values;
    const back = deserializeScene(serializeScene(large));
    const heights = back.objects.at(-1)!.terrain!.heights;
    expect(heights.length).toBe(512 * 512);
    expect(heights.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
  });

  it('shares oversize payloads without truncating their encoded contents', () => {
    const scene = paintedScene(512);
    let seed = 20261121;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const terrain = scene.objects.at(-1)!.terrain!;
    terrain.heights = Float32Array.from({ length: 512 * 512 }, random);
    for (let t = 0; t < 3; t++) {
      const extra = make('terrain', {
        name: `Share stress ${t}`,
        at: [t * 14, 1, 0],
        size: [8, 2, 8],
        terrain: shapedTerrain(512, () => random()),
      });
      scene.objects.push(extra);
    }
    const link = encodeShareLink(scene, { base: 'https://example.test/', terrainDetail: 128 });
    expect(link.length).toBeGreaterThan(SHARE_LIMIT_CHARS);
    const roundtrip = decodeSharePayload(link.slice(link.indexOf('#s=') + 3));
    expect('scene' in roundtrip).toBe(true);
    if ('scene' in roundtrip) expect(roundtrip.scene.objects.at(-1)!.terrain!.resolution).toBe(512);
  });
});

describe('autosave and dirty-state stress', () => {
  it('restores a stored scene and treats corrupt or unavailable storage as empty', () => {
    const scene = paintedScene(256);
    expect(writeAutosave(scene)).toBe(true);
    expect(loadAutosave()?.name).toBe(scene.name);
    localStorage.setItem(AUTOSAVE_KEY, '{truncated');
    expect(loadAutosave()).toBeNull();
    localStorage.setItem(AUTOSAVE_KEY, 'lz1:corrupt');
    expect(loadAutosave()).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    expect(loadAutosave()).toBeNull();
  });

  it('survives quota and unavailable-storage failures after both encodings are attempted', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(writeAutosave(paintedScene(256))).toBe(false);
    expect(Storage.prototype.setItem).toHaveBeenCalledTimes(2);
  });

  it('marks loaded scenes clean, edits dirty, and undo-to-clean again', () => {
    const store = useStore.getState();
    store.loadScene(createDefaultScene());
    markClean();
    expect(hasUnsavedChanges()).toBe(false);
    useStore.getState().setSceneName('Dirty scene');
    expect(hasUnsavedChanges()).toBe(true);
    useStore.getState().undo();
    expect(hasUnsavedChanges()).toBe(false);
  });
});
