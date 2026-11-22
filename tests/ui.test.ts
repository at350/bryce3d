import { afterEach, describe, expect, it, vi } from 'vitest';
import { createObject } from '@/core/defaults';
import type { CameraState, ObjectType, SceneObject, Vec3 } from '@/core/types';
import { PRIMITIVE_TYPES, LIGHT_TYPES, INFINITE_PLANE_TYPES } from '@/core/objects';
import { placePopover } from '@/ui/kit/popoverMath';
import { formatNumber, keyIncrement, parseNumberInput, quantize } from '@/ui/kit/numberFormat';
import { fromHsv, parseHex, toHsv } from '@/ui/kit/colorMath';
import { isTopLayer, layerDepth, pushLayer } from '@/ui/kit/layers';
import { alignObjects, landObjects, moveObject, randomizeObjects, resizeObject, rotateObject, worldBounds } from '@/ui/edit/transformOps';
import { creationTransform, placementPoint } from '@/ui/edit/placement';
import { formatElapsed, formatPolygons, polygonEstimate } from '@/ui/edit/sceneStats';
import { resolveShortcut, type KeyLike } from '@/ui/shortcutKeys';
import { aspectLabel, constrainSize } from '@/ui/dialogs/renderSizes';
import { computeUiZoom, isTooSmallForEditor } from '@/ui/layoutScale';
import { iconBucket, iconKey } from '@/ui/icons/iconRenderer';
import { ALL_ICON_KINDS } from '@/ui/icons/iconKinds';
import { buildIcon } from '@/ui/icons/iconModels';
import { ICON_THEMES } from '@/ui/icons/iconTheme';
import { CREATE_ITEMS } from '@/ui/createItems';
import { ridgeLine } from '@/ui/splashArt';

const obj = (type: ObjectType, position: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1], rotation: Vec3 = [0, 0, 0], extra: Partial<SceneObject> = {}): SceneObject =>
  createObject(type, { transform: { position, rotation, scale }, ...extra });

const cam = (position: Vec3, target: Vec3): CameraState => ({ position, target, roll: 0, fov: 50 });

describe('popover placement', () => {
  const anchor = { left: 100, top: 100, right: 140, bottom: 120 };
  it('opens below, aligned to the anchor', () => {
    expect(placePopover(anchor, 200, 100, 1000, 800, 'down')).toMatchObject({ left: 100, top: 124, side: 'down' });
  });
  it('flips up when there is no room below, and clamps into the viewport', () => {
    const low = { left: 900, top: 700, right: 940, bottom: 720 };
    const p = placePopover(low, 200, 150, 1000, 800, 'down');
    expect(p.side).toBe('up');
    expect(p.top).toBe(700 - 4 - 150);
    expect(p.left).toBe(1000 - 200 - 6);
  });
  it('flips a right-side submenu to the left at the screen edge', () => {
    const edge = { left: 900, top: 50, right: 990, bottom: 70 };
    expect(placePopover(edge, 160, 100, 1000, 800, 'right').side).toBe('left');
  });
});

describe('number fields', () => {
  it('formats without negative zero', () => {
    expect(formatNumber(-0.0001, 2)).toBe('0.00');
    expect(formatNumber(-0.4, 0)).toBe('0');
    expect(formatNumber(12.345, 1)).toBe('12.3');
  });
  it('quantizes to the step and clamps', () => {
    expect(quantize(7.3, 0.5, 0, 10)).toBe(7.5);
    expect(quantize(0.1 + 0.2, 0, 0, 1)).toBe(0.3);
    expect(quantize(42, 1, 0, 10)).toBe(10);
  });
  it('parses typed values, units, commas and arithmetic', () => {
    expect(parseNumberInput(' 12.5 ')).toBe(12.5);
    expect(parseNumberInput('-3')).toBe(-3);
    expect(parseNumberInput('1e3')).toBe(1000);
    expect(parseNumberInput('12,5')).toBe(12.5);
    expect(parseNumberInput('45°')).toBe(45);
    expect(parseNumberInput('20 px')).toBe(20);
    expect(parseNumberInput('10+2.5')).toBe(12.5);
    expect(parseNumberInput('(3+1)*2')).toBe(8);
    expect(parseNumberInput('-(2*3)')).toBe(-6);
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('1/0')).toBeNull();
    expect(parseNumberInput('')).toBeNull();
  });
  it('picks sensible arrow-key increments', () => {
    expect(keyIncrement(5, 0)).toBe(5);
    expect(keyIncrement(0, 0)).toBe(1);
    expect(keyIncrement(0, 1)).toBeCloseTo(0.1);
    expect(keyIncrement(0, 2)).toBeCloseTo(0.1);
  });
});

describe('color picker math', () => {
  it('parses hex in short and long forms', () => {
    expect(parseHex('#fff')).toEqual([1, 1, 1]);
    expect(parseHex('0080ff')?.map((v) => Math.round(v * 255))).toEqual([0, 128, 255]);
    expect(parseHex('#12345')).toBeNull();
    expect(parseHex('zzzzzz')).toBeNull();
  });
  it('keeps the previous hue for grays and round-trips colors', () => {
    expect(toHsv([0.5, 0.5, 0.5], 0.6)[0]).toBe(0.6);
    const c: [number, number, number] = [0.2, 0.55, 0.9];
    const back = fromHsv(toHsv(c));
    back.forEach((v, i) => expect(v).toBeCloseTo(c[i], 5));
  });
});

describe('layer stack (Escape routing)', () => {
  it('routes Escape only to the top layer', () => {
    const calls: string[] = [];
    const a = pushLayer('dialog', () => calls.push('dialog'));
    const b = pushLayer('popover', () => calls.push('popover'));
    expect(layerDepth()).toBe(2);
    expect(isTopLayer(b.id)).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(calls).toEqual(['popover']);
    b.remove();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(calls).toEqual(['popover', 'dialog']);
    a.remove();
    expect(layerDepth()).toBe(0);
  });
});

describe('transform tools', () => {
  it('computes world bounds for rotated boxes, flat shapes and tori', () => {
    const b = worldBounds(obj('cube', [0, 2, 0], [2, 1, 1], [0, 90, 0]));
    expect(b.min[0]).toBeCloseTo(-1);
    expect(b.max[2]).toBeCloseTo(2);
    expect(b.min[1]).toBeCloseTo(1);
    expect(worldBounds(obj('disc', [0, 3, 0], [2, 1, 2])).min[1]).toBeCloseTo(3);
    const t = obj('torus', [0, 2, 0], [2, 2, 2], [0, 0, 0], { torus: { minorRadius: 0.25 } });
    expect(worldBounds(t).min[1]).toBeCloseTo(1.5);
  });
  it('resizes with clamping and leaves water/ground planes alone', () => {
    expect(resizeObject(obj('sphere', [0, 0, 0], [1, 2, 3]), [2, 0.5, 1]).transform.scale).toEqual([2, 1, 3]);
    expect(resizeObject(obj('sphere'), [0, 0, 0]).transform.scale).toEqual([0.01, 0.01, 0.01]);
    const water = obj('water');
    expect(resizeObject(water, [2, 2, 2])).toBe(water);
  });
  it('rotates around a world axis even when the object is already tilted', () => {
    const o = rotateObject(obj('cube', [0, 0, 0], [1, 1, 1], [90, 0, 0]), 1, 90);
    const again = rotateObject(rotateObject(o, 1, 90), 1, 180);
    again.transform.rotation.forEach((v, i) => expect(Math.abs(((v - [90, 0, 0][i] + 540) % 360) - 180)).toBeLessThan(1e-6));
  });
  it('moves infinite planes only vertically', () => {
    const g = moveObject(obj('ground', [0, 1, 0]), [5, 2, 5]);
    expect(g.transform.position).toEqual([0, 3, 0]);
  });
  it('aligns edges and centers', () => {
    const a = obj('cube', [0, 0, 0], [1, 1, 1]);
    const b = obj('cube', [10, 5, 0], [2, 2, 2]);
    const [a2, b2] = alignObjects([a, b], 1, 'min');
    expect(worldBounds(a2).min[1]).toBeCloseTo(-1);
    expect(worldBounds(b2).min[1]).toBeCloseTo(-1);
    const [c1, c2] = alignObjects([a, b], 0, 'center');
    expect(c1.transform.position[0]).toBeCloseTo(c2.transform.position[0]);
    expect(alignObjects([b], 0, 'center')[0].transform.position[0]).toBeCloseTo(0);
  });
  it('lands objects on the ground', () => {
    const [s] = landObjects([obj('sphere', [3, 7, 1], [2, 2, 2])]);
    expect(s.transform.position).toEqual([3, 2, 1]);
    // a rotated sphere still rests on its radius; a cone rests on its base
    const [r] = landObjects([obj('sphere', [0, 9, 0], [2, 2, 2], [45, 30, 0])]);
    expect(r.transform.position[1]).toBeCloseTo(2);
    const [c] = landObjects([obj('cone', [0, 5, 0], [1, 3, 1])]);
    expect(c.transform.position[1]).toBeCloseTo(3);
    const [upside] = landObjects([obj('cone', [0, 5, 0], [1, 3, 1], [180, 0, 0])]);
    expect(upside.transform.position[1]).toBeCloseTo(3);
  });
  it('bounds a tilted cylinder exactly', () => {
    const b = worldBounds(obj('cylinder', [0, 0, 0], [1, 2, 1], [90, 0, 0]));
    expect(b.max[1]).toBeCloseTo(1);
    expect(b.max[2]).toBeCloseTo(2);
  });
  it('randomizes deterministically and not at all with amount 0', () => {
    const objs = [obj('sphere', [0, 1, 0]), obj('cube', [4, 1, 0]), obj('water')];
    expect(randomizeObjects(objs, 0, 1, { position: true, rotation: true, size: true })).toBe(objs);
    const r1 = randomizeObjects(objs, 0.8, 7, { position: true, rotation: true, size: true });
    const r2 = randomizeObjects(objs, 0.8, 7, { position: true, rotation: true, size: true });
    expect(r1).toEqual(r2);
    expect(r1[2]).toBe(objs[2]);
    expect(r1[0].transform.position).not.toEqual(objs[0].transform.position);
    const sizeOnly = randomizeObjects(objs, 1, 3, { position: false, rotation: false, size: true });
    expect(sizeOnly[0].transform.position).toEqual(objs[0].transform.position);
  });
});

describe('create placement', () => {
  const c = cam([0, 7, 48], [0, 4, 0]);
  it('places in front of the camera on the ground', () => {
    const p = placementPoint(c);
    expect(p[1]).toBe(0);
    expect(p[2]).toBeLessThan(48);
    expect(p[2]).toBeGreaterThan(0);
  });
  it('uses the ground hit when looking down', () => {
    const p = placementPoint(cam([0, 30, 10], [0, 0, 0]));
    expect(p[0]).toBeCloseTo(0);
    expect(p[2]).toBeCloseTo(0);
  });
  it('rests objects on the ground and keeps planes and lights at their heights', () => {
    const s = creationTransform('sphere', c, [], [2, 3, 2]);
    expect(s.position[1]).toBe(3);
    expect(creationTransform('water', c).position[1]).toBe(0.5);
    expect(creationTransform('radialLight', c).position[1]).toBe(10);
    expect(creationTransform('disc', c).position[1]).toBeCloseTo(0.02);
  });
  it('lines repeated objects up instead of stacking them', () => {
    const first = creationTransform('cube', c);
    const existing = [obj('cube', first.position, first.scale)];
    const second = creationTransform('cube', c, existing);
    expect(Math.hypot(second.position[0] - first.position[0], second.position[2] - first.position[2])).toBeGreaterThan(3);
  });
  it('covers every creatable object type', () => {
    const types = new Set(CREATE_ITEMS.map((i) => i.type));
    for (const t of [...PRIMITIVE_TYPES, ...LIGHT_TYPES, ...INFINITE_PLANE_TYPES, 'terrain', 'lattice', 'stone', 'tree'] as ObjectType[]) expect(types.has(t)).toBe(true);
  });
});

describe('scene stats', () => {
  it('estimates polygons Bryce-style', () => {
    expect(polygonEstimate(obj('water'))).toBe(1);
    expect(polygonEstimate(obj('radialLight'))).toBe(0);
    expect(polygonEstimate(obj('cube'))).toBe(12);
    expect(formatPolygons(1)).toBe('1 polygon');
    expect(formatPolygons(9876)).toBe('9,876 polygons');
    expect(formatPolygons(123456)).toBe('123.5 K polygons');
    expect(formatPolygons(1_040_000)).toBe('1.04 mil polygons');
    expect(formatElapsed(83_000)).toBe('1:23');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
  });
});

describe('keyboard shortcuts', () => {
  const k = (key: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });
  it('maps the Bryce shortcuts', () => {
    expect(resolveShortcut(k('z', { metaKey: true }))).toEqual({ type: 'undo' });
    expect(resolveShortcut(k('Z', { ctrlKey: true, shiftKey: true }))).toEqual({ type: 'redo' });
    expect(resolveShortcut(k('r', { ctrlKey: true }))).toEqual({ type: 'render' });
    expect(resolveShortcut(k('r', { ctrlKey: true, altKey: true }))).toEqual({ type: 'clearRender' });
    expect(resolveShortcut(k('2', { metaKey: true }))).toEqual({ type: 'palette', palette: 'edit' });
    expect(resolveShortcut(k('e', { ctrlKey: true, altKey: true }))).toEqual({ type: 'attributes' });
    expect(resolveShortcut(k('s', { ctrlKey: true }))).toEqual({ type: 'save' });
    expect(resolveShortcut(k('Delete'))).toEqual({ type: 'delete' });
    expect(resolveShortcut(k('?', { shiftKey: true }))).toEqual({ type: 'shortcuts' });
    expect(resolveShortcut(k('x'))).toBeNull();
  });
  it('nudges with Shift for big and Alt for fine steps', () => {
    expect(resolveShortcut(k('ArrowLeft'))).toEqual({ type: 'nudge', dir: 'left', step: 1 });
    expect(resolveShortcut(k('ArrowUp', { shiftKey: true }))).toEqual({ type: 'nudge', dir: 'up', step: 5 });
    expect(resolveShortcut(k('PageDown', { altKey: true }))).toEqual({ type: 'nudge', dir: 'lower', step: 0.1 });
    expect(resolveShortcut(k('Tab', { shiftKey: true }))).toEqual({ type: 'cycle', delta: -1 });
  });
});

describe('render sizes', () => {
  it('keeps proportions when constrained', () => {
    expect(constrainSize('width', 1024, { width: 800, height: 600 }, 4 / 3)).toEqual({ width: 1024, height: 768 });
    expect(constrainSize('height', 1080, { width: 800, height: 600 }, 16 / 9)).toEqual({ width: 1920, height: 1080 });
    expect(constrainSize('width', 1000, { width: 800, height: 600 }, null)).toEqual({ width: 1000, height: 600 });
  });
  it('clamps to the allowed range without breaking the aspect', () => {
    const r = constrainSize('width', 9000, { width: 800, height: 600 }, 4 / 3);
    expect(r.width).toBe(4096);
    expect(r.height).toBe(3072);
    expect(constrainSize('height', 1, { width: 800, height: 600 }, null).height).toBe(16);
  });
  it('names common aspects', () => {
    expect(aspectLabel(800, 600)).toBe('4:3');
    expect(aspectLabel(1920, 1080)).toBe('16:9');
    expect(aspectLabel(1000, 300)).toBe('3.33:1');
  });
});

describe('layout scale', () => {
  it('scales palettes between 0.78 and 1.5', () => {
    expect(computeUiZoom(1024, 700)).toBe(0.78);
    expect(computeUiZoom(1440, 900)).toBeCloseTo(1.05, 2);
    expect(computeUiZoom(2560, 1440)).toBe(1.5);
  });
  it('flags phone-sized screens', () => {
    expect(isTooSmallForEditor(390, 844)).toBe(true);
    expect(isTooSmallForEditor(1024, 700)).toBe(false);
  });
});

describe('icons', () => {
  afterEach(() => vi.restoreAllMocks());
  it('buckets icon sizes for sharp rendering', () => {
    expect(iconBucket(30)).toBe(32);
    expect(iconBucket(33)).toBe(48);
    expect(iconBucket(70)).toBe(96);
    expect(iconBucket(500)).toBe(192);
    expect(iconKey('sphere', 'bryce5', 64)).toBe('bryce5:sphere:64');
  });
  it('has a model for every icon kind in every skin', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    for (const skin of ['bryce5', 'bryce2', 'bryce7'] as const) {
      for (const kind of ALL_ICON_KINDS) {
        const spec = buildIcon(kind, ICON_THEMES[skin]);
        let meshes = 0;
        spec.root.traverse((o) => {
          if ((o as { isMesh?: boolean }).isMesh) meshes++;
        });
        expect(meshes, `${skin}:${kind}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('splash art', () => {
  it('builds a normalized fractal ridge', () => {
    const line = ridgeLine(64, 3);
    expect(line).toHaveLength(65);
    expect(Math.min(...line)).toBeCloseTo(0);
    expect(Math.max(...line)).toBeCloseTo(1);
    expect(ridgeLine(64, 3)).toEqual(line);
  });
});
