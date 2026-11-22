/**
 * Main-thread client for the terrain worker. Jobs resolve with new heights; input arrays are
 * copied before transfer so callers keep theirs. If workers are unavailable (or the worker
 * fails to load) jobs run inline after a frame, so a busy indicator can paint first.
 */
import { runTerrainJob, type TerrainJob, type WorkerRequest, type WorkerResponse } from './jobs';

interface Pending {
  job: TerrainJob;
  resolve: (h: Float32Array) => void;
  reject: (e: Error) => void;
  onProgress?: (fraction: number) => void;
}

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, Pending>();

function runInline(p: Pending): void {
  setTimeout(() => {
    try {
      p.resolve(runTerrainJob(p.job, p.onProgress));
    } catch (e) {
      p.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }, 16);
}

function failOver(): void {
  worker?.terminate();
  worker = null;
  const jobs = [...pending.values()];
  pending.clear();
  jobs.forEach(runInline);
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === 'undefined') return (worker = null);
  try {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'terrain' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'progress') p.onProgress?.(msg.value);
      else {
        pending.delete(msg.id);
        if (msg.type === 'done') p.resolve(msg.heights);
        else p.reject(new Error(msg.message));
      }
    };
    w.onerror = (e) => {
      e.preventDefault();
      failOver();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Run a terrain job off the main thread when possible. */
export function runJobAsync(job: TerrainJob, onProgress?: (fraction: number) => void): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const entry: Pending = { job, resolve, reject, onProgress };
    const w = getWorker();
    if (!w) {
      runInline(entry);
      return;
    }
    const id = ++seq;
    pending.set(id, entry);
    let sent: TerrainJob = job;
    const transfer: Transferable[] = [];
    if (job.kind === 'op' || job.kind === 'resample') {
      const copy = job.heights.slice();
      sent = { ...job, heights: copy };
      transfer.push(copy.buffer);
    }
    const msg: WorkerRequest = { id, job: sent };
    try {
      w.postMessage(msg, transfer);
    } catch {
      pending.delete(id);
      runInline(entry);
    }
  });
}
