/** Terrain worker: runs generators, ops and recipes off the main thread. */
import { runTerrainJob, type WorkerRequest, type WorkerResponse } from './jobs';

interface WorkerScope {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  const { id, job } = e.data;
  let last = 0;
  const onProgress = (value: number) => {
    const now = performance.now();
    if (now - last < 60 && value < 1) return;
    last = now;
    scope.postMessage({ id, type: 'progress', value });
  };
  try {
    const heights = runTerrainJob(job, onProgress);
    scope.postMessage({ id, type: 'done', heights }, [heights.buffer as ArrayBuffer]);
  } catch (err) {
    scope.postMessage({ id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
