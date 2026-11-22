/**
 * Preset thumbnails for the library window. Each is ray traced through renderer.preview
 * (quality 'icon'), strictly one at a time and only in idle time so the main render and
 * the UI stay responsive, then cached as a data URL for the session. The large preview of
 * the focused preset jumps the queue. When the renderer is missing or draws nothing, a
 * small 2D painting stands in.
 */
import { useSyncExternalStore } from 'react';
import type { CameraState, Scene } from '@/core/types';
import { getRenderer } from '@/render';

export interface ThumbJob {
  /** Cache key (kind:id plus a size tag). */
  key: string;
  width: number;
  height: number;
  /** Builds the scene to render; called only when the job actually runs. */
  scene: () => Scene;
  camera?: CameraState;
  skyOnly?: boolean;
  /** 2D stand-in when ray tracing is unavailable or fails. */
  fallback: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const RENDER_TIMEOUT_MS = 20000;

const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let wanted: ThumbJob[] = [];
let priority: ThumbJob | null = null;
let busy = false;

const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThumbnail(key: string): string | undefined {
  return cache.get(key);
}

/** The cached data URL for a key (re-renders the component when it arrives). */
export function useThumbnail(key: string | null): string | undefined {
  return useSyncExternalStore(subscribe, () => (key ? cache.get(key) : undefined));
}

/** Replace the set of thumbnails worth rendering (in order); anything else is dropped. */
export function wantThumbnails(jobs: ThumbJob[]): void {
  wanted = jobs.filter((j) => !cache.has(j.key));
  pump();
}

/** Render this job next (the library's large preview). */
export function prioritizeThumbnail(job: ThumbJob | null): void {
  priority = job && !cache.has(job.key) ? job : null;
  pump();
}

const whenIdle = (fn: () => void) => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 400 });
  else setTimeout(fn, 30);
};

function pump() {
  if (busy) return;
  const job = priority ?? wanted.shift();
  if (job === priority) priority = null;
  if (!job) return;
  if (cache.has(job.key)) {
    pump();
    return;
  }
  busy = true;
  whenIdle(() => {
    renderJob(job)
      .then((url) => {
        cache.set(job.key, url);
        notify();
      })
      .catch(() => {
        // a job that cannot even paint its fallback is simply skipped
      })
      .finally(() => {
        busy = false;
        pump();
      });
  });
}

/** True when nothing was drawn into a 2D-capable canvas (fully transparent). */
function isBlank(canvas: HTMLCanvasElement): boolean {
  let ctx: CanvasRenderingContext2D | null;
  try {
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  } catch {
    return false;
  }
  if (!ctx) return false; // the renderer used another context type: it drew
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 16) if (data[i] !== 0) return false;
  return true;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function renderJob(job: ThumbJob): Promise<string> {
  let canvas = document.createElement('canvas');
  canvas.width = job.width;
  canvas.height = job.height;
  const renderer = getRenderer();
  let drawn = false;
  if (renderer.supported) {
    try {
      const scene = job.scene();
      await withTimeout(
        renderer.preview(scene, canvas, { width: job.width, height: job.height, quality: 'icon', key: `library:${job.key}`, camera: job.camera, skyOnly: job.skyOnly }),
        RENDER_TIMEOUT_MS,
      );
      drawn = !isBlank(canvas);
    } catch {
      drawn = false;
    }
  }
  if (!drawn) {
    canvas = document.createElement('canvas');
    canvas.width = job.width;
    canvas.height = job.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d canvas');
    job.fallback(ctx, job.width, job.height);
  }
  return canvas.toDataURL('image/png');
}
