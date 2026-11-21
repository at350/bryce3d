import { beforeEach, describe, expect, it } from 'vitest';
import { cameraBasis, directionToAzAlt, inverseObjectMatrix, objectMatrix, sunDirection } from '@/core/math';
import { useStore } from '@/core/store';
import { createDefaultScene } from '@/scenes/defaultScene';
import { Vector3 } from 'three';

describe('math', () => {
  it('object matrix maps the unit cube corner to the scaled, moved corner', () => {
    const m = objectMatrix({ position: [1, 2, 3], rotation: [0, 0, 0], scale: [2, 3, 4] });
    const p = new Vector3(1, 1, 1).applyMatrix4(m);
    expect(p.toArray()).toEqual([3, 5, 7]);
  });

  it('inverse matrix round-trips with rotation', () => {
    const t = { position: [5, -1, 2] as [number, number, number], rotation: [30, 45, -10] as [number, number, number], scale: [1, 2, 0.5] as [number, number, number] };
    const p = new Vector3(0.3, -0.7, 0.9).applyMatrix4(objectMatrix(t)).applyMatrix4(inverseObjectMatrix(t));
    expect(p.x).toBeCloseTo(0.3);
    expect(p.y).toBeCloseTo(-0.7);
    expect(p.z).toBeCloseTo(0.9);
  });

  it('sun direction conventions: azimuth 0 points to -Z, 90 to +X', () => {
    const a = sunDirection(0, 0);
    expect(a[2]).toBeCloseTo(-1);
    const b = sunDirection(90, 0);
    expect(b[0]).toBeCloseTo(1);
    const c = directionToAzAlt(sunDirection(215, 38));
    expect(c.azimuth).toBeCloseTo(215);
    expect(c.altitude).toBeCloseTo(38);
  });

  it('camera basis is orthonormal and forward points at the target', () => {
    const { right, up, forward } = cameraBasis({ position: [0, 0, 10], target: [0, 0, 0], roll: 0, fov: 50 });
    expect(forward[2]).toBeCloseTo(-1);
    expect(right[0]).toBeCloseTo(1);
    expect(up[1]).toBeCloseTo(1);
  });
});

describe('store', () => {
  beforeEach(() => {
    useStore.getState().loadScene(createDefaultScene());
  });

  it('creates, selects, undoes and redoes', () => {
    const s = useStore.getState();
    const n = s.scene.objects.length;
    const obj = s.createObject('sphere');
    expect(useStore.getState().scene.objects.length).toBe(n + 1);
    expect(useStore.getState().selection).toEqual([obj.id]);
    useStore.getState().undo();
    expect(useStore.getState().scene.objects.length).toBe(n);
    expect(useStore.getState().selection).toEqual([]);
    useStore.getState().redo();
    expect(useStore.getState().scene.objects.length).toBe(n + 1);
  });

  it('coalesces a gesture into one undo step', () => {
    const s = useStore.getState();
    const id = s.scene.objects[0].id;
    const before = s.scene;
    s.beginGesture();
    for (let i = 0; i < 10; i++) useStore.getState().setTransform(id, { position: [i, 0, 0] });
    s.endGesture();
    useStore.getState().undo();
    expect(useStore.getState().scene).toBe(before);
  });

  it('never mutates previous scenes', () => {
    const s = useStore.getState();
    const before = s.scene;
    const snapshot = JSON.stringify(before.objects.map((o) => o.transform));
    s.setTransform(before.objects[0].id, { position: [9, 9, 9] });
    expect(JSON.stringify(before.objects.map((o) => o.transform))).toBe(snapshot);
  });
});
