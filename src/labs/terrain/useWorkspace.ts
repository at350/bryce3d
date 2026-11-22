/**
 * The editor's working copy: the TerrainData being edited, its in-lab undo/redo history and a
 * serial job queue (worker jobs run one after another, each starting from the latest terrain).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { TerrainData } from '@/core/types';
import type { TerrainJob } from '@/terrain/jobs';
import { runJobAsync } from '@/terrain/workerClient';

export interface BusyState {
  label: string;
  /** 0..1, or null when unknown. */
  progress: number | null;
}

const HISTORY_BYTES = 96 * 1024 * 1024;
const HISTORY_STEPS = 60;
const BUSY_DELAY_MS = 120;

export type Compute = (job: TerrainJob) => Promise<Float32Array | null>;

export interface Workspace {
  terrain: TerrainData;
  /** Latest terrain, readable from async callbacks. */
  current(): TerrainData;
  /** Make `next` the terrain as one undo step (undoing returns to `from`, default: the current terrain). */
  commit(next: TerrainData, from?: TerrainData): void;
  /** Swap the terrain without a new undo step (live tweaks of the last action). */
  replace(next: TerrainData): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  busy: BusyState | null;
  /** True while any queued task is pending (even before the busy indicator shows). */
  isBusy(): boolean;
  /**
   * Queue a task. Tasks run one at a time; `compute` runs a worker job and resolves with its
   * heights, or null when a newer task with the same `supersede` key has been queued since.
   */
  enqueue(label: string, task: (compute: Compute) => Promise<void>, supersede?: string): void;
}

export function useWorkspace(initial: TerrainData): Workspace {
  const [terrain, setTerrain] = useState(initial);
  const ref = useRef(initial);
  const undoRef = useRef<TerrainData[]>([]);
  const redoRef = useRef<TerrainData[]>([]);
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const [busy, setBusy] = useState<BusyState | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const latestRef = useRef(new Map<string, number>());
  const pendingRef = useRef(0);

  const set = useCallback((next: TerrainData) => {
    ref.current = next;
    setTerrain(next);
  }, []);

  const syncHist = useCallback(() => setHist({ undo: undoRef.current.length, redo: redoRef.current.length }), []);

  const commit = useCallback(
    (next: TerrainData, from: TerrainData = ref.current) => {
      if (next === from) {
        if (next !== ref.current) set(next);
        return;
      }
      const undo = undoRef.current;
      undo.push(from);
      let bytes = 0;
      for (let i = undo.length - 1; i >= 0; i--) {
        bytes += undo[i].heights.byteLength;
        if (bytes > HISTORY_BYTES || undo.length - i > HISTORY_STEPS) {
          undo.splice(0, i + 1);
          break;
        }
      }
      redoRef.current = [];
      set(next);
      syncHist();
    },
    [set, syncHist],
  );

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(ref.current);
    set(prev);
    syncHist();
  }, [set, syncHist]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(ref.current);
    set(next);
    syncHist();
  }, [set, syncHist]);

  const enqueue = useCallback<Workspace['enqueue']>((label, task, supersede) => {
    let ticket = 0;
    if (supersede) {
      ticket = (latestRef.current.get(supersede) ?? 0) + 1;
      latestRef.current.set(supersede, ticket);
    }
    const stale = () => !!supersede && latestRef.current.get(supersede) !== ticket;
    pendingRef.current++;
    const run = async () => {
      const timer = setTimeout(() => setBusy({ label, progress: null }), BUSY_DELAY_MS);
      try {
        if (stale()) return;
        await task(async (job) => {
          const h = await runJobAsync(job, (f) => setBusy((b) => (b ? { label, progress: f } : b)));
          return stale() ? null : h;
        });
      } catch (err) {
        console.warn('[terrain] task failed', err);
      } finally {
        clearTimeout(timer);
        pendingRef.current--;
        if (pendingRef.current === 0) setBusy(null);
      }
    };
    queueRef.current = queueRef.current.then(run);
  }, []);

  const current = useCallback(() => ref.current, []);
  const isBusy = useCallback(() => pendingRef.current > 0, []);

  return useMemo(
    () => ({
      terrain,
      current,
      commit,
      replace: set,
      undo,
      redo,
      canUndo: hist.undo > 0,
      canRedo: hist.redo > 0,
      busy,
      isBusy,
      enqueue,
    }),
    [terrain, current, commit, set, undo, redo, hist, busy, isBusy, enqueue],
  );
}
