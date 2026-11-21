/**
 * The renderer's public contract. Implemented in src/render (getRenderer()).
 * UI and viewport code talk to the ray tracer only through this interface.
 */
import type { CameraState, RenderProgress, Scene } from './types';

export interface RenderRegion {
  /** Normalized 0..1 rectangle within the document (Bryce "plop render"). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StartOptions {
  /** Render only this part of the frame; the rest of the previous image is kept. */
  region?: RenderRegion;
}

export interface PreviewOptions {
  width: number;
  height: number;
  /**
   * 'nano':    the Nano Preview / quick thumbnails: 1-4 spp, 2 bounces, fast.
   * 'preview': lab previews (material sphere, sky lab): ~16 spp, 4 bounces.
   * 'icon':    preset tiles: ~8 spp.
   */
  quality: 'nano' | 'preview' | 'icon';
  /** Render only the sky (no objects). */
  skyOnly?: boolean;
  /** Override the scene camera. */
  camera?: CameraState;
  /**
   * Requests sharing a key supersede each other: when a newer request with the same key
   * arrives, the older pending one resolves without drawing. Use one key per preview widget.
   */
  key?: string;
}

export interface RendererAPI {
  /** false when WebGL2 / float render targets are unavailable. */
  readonly supported: boolean;
  /** Human-readable reason when unsupported or when the shader failed. */
  readonly error: string | null;
  /**
   * 2D canvas sized to the document (scene.render.width x height) holding the current
   * main render. The viewport displays it (CSS-scaled with image-rendering: pixelated
   * during mosaic passes). Stable for the app's lifetime.
   */
  readonly outputCanvas: HTMLCanvasElement;
  /** Start a fresh progressive render of the scene (clears the previous image unless a region is given). */
  start(scene: Scene, options?: StartOptions): void;
  /** Continue a stopped render where it left off (adds more samples if it had finished). */
  resume(): void;
  /** Pause the current render. */
  stop(): void;
  /** Stop and blank the output. */
  clear(): void;
  /** Progress updates (also mirrored into the store by the renderer). Returns an unsubscribe function. */
  subscribe(listener: (progress: RenderProgress) => void): () => void;
  /** Current progress snapshot. */
  getProgress(): RenderProgress;
  /** Render a small image of the scene into target (sized by the caller). Resolves when drawn or superseded. */
  preview(scene: Scene, target: HTMLCanvasElement, options: PreviewOptions): Promise<void>;
  /** PNG of the current main render, or null if nothing has been rendered. */
  exportPNG(): Promise<Blob | null>;
}
