import { describe, expect, it } from 'vitest';
import { defaultRenderSettings, createObject } from '@/core/defaults';
import { emptyScene } from '@/scenes/defaultScene';
import { MAX_OBJECTS, OBJ_TEXELS } from '@/render/layout';
import { packScene } from '@/render/pack';
import { PreviewQueue } from '@/render/previewQueue';
import { mainQuality } from '@/render/quality';
import { BandController, extendPasses, planPasses, regionToPixels, totalWork } from '@/render/scheduler';

describe('progressive render scheduling', () => {
  it('resolves the mosaic before accumulating full pixel samples, then resumes with new samples', () => {
    const passes = planPasses(true, 2);
    expect(passes.map(p => p.block)).toEqual([16, 8, 4, 2, 1, 1]);
    expect(extendPasses(passes, 2).slice(-2).map(p => p.sample)).toEqual([3, 4]);
    expect(totalWork(passes, { x: 0, y: 0, w: 16, h: 16 })).toBe(1 + 4 + 16 + 64 + 256 * 2);
  });

  it('converts top-origin crop regions into bounded bottom-origin GPU rectangles', () => {
    expect(regionToPixels({ x: 0.25, y: 0.1, w: 0.5, h: 0.4 }, 400, 300)).toEqual({ x: 100, y: 150, w: 200, h: 120 });
    expect(regionToPixels({ x: 1, y: 1, w: 2, h: 2 }, 400, 300)).toEqual({ x: 399, y: 0, w: 1, h: 1 });
  });

  it('shrinks bands when a costly scene exceeds the frame budget', () => {
    const controller = new BandController(12);
    const initial = controller.rowsFor(1000, 300);
    controller.record(120, initial * 1000);
    const adapted = controller.rowsFor(1000, 300);
    expect(adapted).toBeLessThan(initial);
    expect(adapted).toBeGreaterThanOrEqual(1);
    expect(controller.rowsFor(1000, 0)).toBe(0);
  });

  it('keeps draft fast and scales premium sampling within shader limits', () => {
    const defaults = defaultRenderSettings();
    expect(mainQuality({ ...defaults, quality: 'draft', samples: 64 }).samples).toBe(1);
    const premium = mainQuality({ ...defaults, quality: 'premium', samples: 8 });
    expect(premium.samples).toBe(32);
    expect(premium.maxRays).toBeLessThanOrEqual(16);
  });
});

describe('GPU scene packing', () => {
  it('reports object overflow while allocating exactly the uploaded rows', () => {
    const scene = emptyScene();
    scene.objects = Array.from({ length: MAX_OBJECTS + 2 }, () => createObject('sphere'));
    const packed = packScene(scene, () => null);
    expect(packed.objectCount).toBe(MAX_OBJECTS);
    expect(packed.dropped).toBe(2);
    expect(packed.objects.length).toBe(MAX_OBJECTS * OBJ_TEXELS * 4);
    expect([...packed.objects, ...packed.materials].every(Number.isFinite)).toBe(true);
  });

  it('omits hidden objects and geometry from sky-only previews', () => {
    const scene = emptyScene();
    scene.objects = [createObject('sphere', { hidden: true }), createObject('cube')];
    expect(packScene(scene, () => null).objectCount).toBe(1);
    expect(packScene(scene, () => null, { skyOnly: true }).objectCount).toBe(0);
  });
});

it('resolves superseded previews and serves interactive previews before thumbnails', () => {
  const queue = new PreviewQueue<string>();
  const resolved: string[] = [];
  const request = (payload: string, priority: number, key?: string) => ({ payload, priority, key, resolve: () => resolved.push(payload) });
  queue.push(request('thumbnail', 2));
  queue.push(request('old', 0, 'nano'));
  queue.push(request('latest', 0, 'nano'));
  expect(resolved).toEqual(['old']);
  expect(queue.shift()?.payload).toBe('latest');
  queue.flush();
  expect(resolved).toEqual(['old', 'thumbnail']);
  expect(queue.size).toBe(0);
});
