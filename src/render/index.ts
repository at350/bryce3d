/**
 * Renderer entry point. getRenderer() returns the app-wide RendererAPI singleton.
 *
 * NOTE: foundation stub. It paints the sky gradient with Canvas 2D so the rest of the app
 * can be built against the real interface; the renderer owner replaces it with the
 * WebGL2 ray tracer.
 */
import type { PreviewOptions, RendererAPI, StartOptions } from '@/core/renderApi';
import { useStore } from '@/core/store';
import type { RenderProgress, Scene } from '@/core/types';
import { rgbToHex } from '@/core/math';

class StubRenderer implements RendererAPI {
  readonly supported = true;
  readonly error: string | null = null;
  readonly outputCanvas = document.createElement('canvas');
  private listeners = new Set<(p: RenderProgress) => void>();
  private progress: RenderProgress = { status: 'idle', pass: 0, passCount: 0, fraction: 0, samples: 0, elapsedMs: 0 };
  private scene: Scene | null = null;

  start(scene: Scene, _options?: StartOptions) {
    this.scene = scene;
    this.outputCanvas.width = scene.render.width;
    this.outputCanvas.height = scene.render.height;
    paintSky(scene, this.outputCanvas);
    this.emit({ status: 'done', pass: 1, passCount: 1, fraction: 1, samples: 1, elapsedMs: 0 });
  }
  resume() {
    if (this.scene) this.start(this.scene);
  }
  stop() {
    if (this.progress.status === 'rendering') this.emit({ ...this.progress, status: 'paused' });
  }
  clear() {
    this.outputCanvas.getContext('2d')?.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    this.emit({ status: 'idle', pass: 0, passCount: 0, fraction: 0, samples: 0, elapsedMs: 0 });
  }
  subscribe(listener: (p: RenderProgress) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  getProgress() {
    return this.progress;
  }
  async preview(scene: Scene, target: HTMLCanvasElement, _options: PreviewOptions) {
    paintSky(scene, target);
  }
  async exportPNG() {
    if (this.progress.status === 'idle') return null;
    return new Promise<Blob | null>((resolve) => this.outputCanvas.toBlob(resolve, 'image/png'));
  }
  private emit(p: RenderProgress) {
    this.progress = p;
    useStore.getState().setRenderProgress(p);
    this.listeners.forEach((l) => l(p));
  }
}

function paintSky(scene: Scene, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, rgbToHex(scene.sky.zenithColor));
  g.addColorStop(0.55, rgbToHex(scene.sky.horizonColor));
  g.addColorStop(0.56, '#3a5a6a');
  g.addColorStop(1, '#1d2f38');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

let instance: RendererAPI | null = null;

export function getRenderer(): RendererAPI {
  if (!instance) instance = new StubRenderer();
  return instance;
}
