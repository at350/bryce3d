/**
 * The heights currently on screen, shared by the 2D canvas and the 3D preview without going
 * through React state (painting updates it many times per second).
 */
import type { DirtyRect } from '@/terrain';

export interface HeightsFrame {
  heights: Float32Array;
  n: number;
  /** Region that changed since the previous frame (null = everything). */
  dirty: DirtyRect | null;
  version: number;
}

type Listener = (frame: HeightsFrame) => void;

export class HeightBus {
  frame: HeightsFrame;
  private listeners = new Set<Listener>();

  constructor(heights: Float32Array, n: number) {
    this.frame = { heights, n, dirty: null, version: 0 };
  }

  set(heights: Float32Array, n: number, dirty: DirtyRect | null = null): void {
    this.frame = { heights, n, dirty, version: this.frame.version + 1 };
    this.listeners.forEach((l) => l(this.frame));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}
