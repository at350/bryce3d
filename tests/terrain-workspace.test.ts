import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TerrainData } from '@/core/types';
import type { TerrainJob } from '@/terrain/jobs';
import { withCurrentClipping, runOpAction, type EditorContext } from '@/labs/terrain/actions';
import { useWorkspace } from '@/labs/terrain/useWorkspace';
import { runJobAsync } from '@/terrain/workerClient';
import { FilteringTab } from '@/labs/terrain/FilteringTab';
import { PicturesTab } from '@/labs/terrain/PicturesTab';

vi.mock('@/terrain/workerClient', () => ({ runJobAsync: vi.fn() }));
vi.mock('@/labs/terrain/pictureSources', () => ({
  loadImageFile: vi.fn(), rasterizeImage: vi.fn(), rasterizeText: (_text: string, n: number) => new Float32Array(n * n).fill(0.7),
}));
vi.mock('@/labs/terrain/thumbnails', () => ({ heightsToDataURL: () => '', patternThumb: () => '' }));

const worker = vi.mocked(runJobAsync);
const initial: TerrainData = {
  resolution: 2,
  heights: new Float32Array([0.1, 0.2, 0.3, 0.4]),
  clipLow: 0.05,
  clipHigh: 0.95,
  recipe: { generator: 'hills', seed: 7, resolution: 2, ops: [] },
};
const uiInitial: TerrainData = { ...initial, resolution: 16, heights: new Float32Array(16 * 16).fill(0.4) };

type Mount<T> = { value(): T; unmount(): Promise<void> };
async function mountHook<T>(hook: () => T): Promise<Mount<T>> {
  const host = document.createElement('div');
  document.body.append(host);
  const root: Root = createRoot(host);
  let value!: T;
  function Probe() { value = hook(); return null; }
  await act(async () => { root.render(createElement(Probe)); });
  return {
    value: () => value,
    unmount: async () => { await act(async () => root.unmount()); host.remove(); },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  worker.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('terrain async workspace', () => {
  it('keeps the latest clipping when a worker result arrives and blocks undo/redo while pending', async () => {
    const started = deferred<void>();
    const output = deferred<Float32Array>();
    worker.mockImplementation(() => { started.resolve(); return output.promise; });
    const mounted = await mountHook(() => useWorkspace(initial));
    const ws = mounted.value();
    const b = { ...initial, heights: new Float32Array(4).fill(0.2) };
    const c = { ...initial, heights: new Float32Array(4).fill(0.3) };
    await act(async () => { ws.commit(b); ws.commit(c); ws.undo(); });
    expect(mounted.value().canUndo).toBe(true);
    expect(mounted.value().canRedo).toBe(true);
    const ctx: EditorContext = { ws, preview: { show() {}, clear() {} }, last: null, setLast() {} };

    await act(async () => { runOpAction(ctx, 'invert'); await started.promise; });
    expect(ws.isBusy()).toBe(true);
    const beforeBlockedHistory = ws.current();
    await act(async () => { ws.undo(); ws.redo(); });
    expect(ws.current()).toBe(beforeBlockedHistory);

    await act(async () => { ws.replace({ ...ws.current(), clipLow: 0.25, clipHigh: 0.75 }); });
    output.resolve(new Float32Array(4).fill(0.8));
    await act(async () => { await output.promise; await Promise.resolve(); await Promise.resolve(); });
    expect(ws.current().clipLow).toBe(0.25);
    expect(ws.current().clipHigh).toBe(0.75);
    for (const h of ws.current().heights) expect(h).toBeCloseTo(0.8, 6);
    expect(ws.isBusy()).toBe(false);
    await mounted.unmount();
  });

  it('does not commit a late worker result after disposal', async () => {
    const started = deferred<void>();
    const output = deferred<Float32Array>();
    worker.mockImplementation(() => { started.resolve(); return output.promise; });
    const mounted = await mountHook(() => useWorkspace(initial));
    const ws = mounted.value();
    const job: TerrainJob = { kind: 'resample', heights: initial.heights, from: 2, to: 2 };
    await act(async () => {
      ws.enqueue('delayed test', async (compute) => {
        const heights = await compute(job);
        if (heights) ws.commit({ ...ws.current(), heights });
      });
      await started.promise;
    });
    await mounted.unmount();
    output.resolve(new Float32Array(4).fill(0.99));
    await output.promise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ws.current()).toBe(initial);
  });

  it('undoes erosion and clip-drag as two steps and redoes them in order', async () => {
    const started = deferred<void>();
    const output = deferred<Float32Array>();
    worker.mockImplementation(() => { started.resolve(); return output.promise; });
    const baseline: TerrainData = { ...initial, clipLow: 0 };
    const mounted = await mountHook(() => useWorkspace(baseline));
    const ws = mounted.value();
    await act(async () => { ws.beginClipGesture(); ws.replace({ ...ws.current(), clipLow: 0.144 }); });
    const job: TerrainJob = { kind: 'op', heights: baseline.heights, resolution: 2, op: 'erode', seed: 9 };
    await act(async () => {
      ws.enqueue('Erode', async (compute) => {
        const base = ws.current();
        const heights = await compute(job);
        if (heights) ws.commit(withCurrentClipping({ ...base, heights }, ws.current()));
      });
      await started.promise;
    });
    output.resolve(new Float32Array(4).fill(0.7));
    await act(async () => { await output.promise; await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { ws.endClipGesture(); });
    await act(async () => { ws.undo(); ws.undo(); });
    expect(ws.current().clipLow).toBe(0);
    expect(Array.from(ws.current().heights)).toEqual(Array.from(baseline.heights));
    await act(async () => { ws.redo(); ws.redo(); });
    expect(ws.current().clipLow).toBe(0.144);
    for (const h of ws.current().heights) expect(h).toBeCloseTo(0.7, 6);
    await mounted.unmount();
  });

  it('keeps current clip bounds across generated, filtered, resized, reseeded, and adjusted results', () => {
    const latest: TerrainData = { ...initial, clipLow: 0.2, clipHigh: 0.8 };
    const outputs: TerrainData[] = [
      { ...initial, recipe: { ...initial.recipe!, generator: 'ridged' } },
      { ...initial, recipe: { ...initial.recipe!, ops: [{ op: 'smooth' }] } },
      { ...initial, resolution: 512, heights: new Float32Array(512 * 512) },
      { ...initial, recipe: { ...initial.recipe!, seed: 42 } },
      { ...initial, heights: new Float32Array(4).fill(0.6) },
    ];
    for (const output of outputs) expect(withCurrentClipping(output, latest)).toMatchObject({ clipLow: 0.2, clipHigh: 0.8 });
  });

  it.each(['filter', 'picture'] as const)('blocks %s Apply while terrain work is pending', async (kind) => {
    const started = deferred<void>();
    const hold = deferred<void>();
    let latest!: ReturnType<typeof useWorkspace>;
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      latest = useWorkspace(uiInitial);
      const ctx: EditorContext = { ws: latest, preview: { show() {}, clear() {} }, last: null, setLast() {} };
      return kind === 'filter'
        ? createElement(FilteringTab, { ctx, rampCss: '' })
        : createElement(PicturesTab, { ctx, incomingFile: null, onFileTaken() {} });
    }
    await act(async () => { root.render(createElement(Probe)); });
    const applyButton = () => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Apply')!;
    if (kind === 'filter') {
      const preset = [...host.querySelectorAll<HTMLButtonElement>('.te-preset')].find((b) => b.textContent?.trim() === 'Plateau')!;
      await act(async () => { preset.click(); });
    } else {
      const textButton = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Text')!;
      await act(async () => { textButton.click(); });
    }
    expect(applyButton().disabled).toBe(false);
    await act(async () => {
      latest.enqueue('held job', async () => { started.resolve(); await hold.promise; });
      await started.promise;
    });
    expect(applyButton().disabled).toBe(true);
    const before = latest.current();
    await act(async () => { applyButton().click(); });
    expect(latest.current()).toBe(before);
    hold.resolve();
    await act(async () => { await hold.promise; await Promise.resolve(); });
    await act(async () => root.unmount());
    host.remove();
  });
});
