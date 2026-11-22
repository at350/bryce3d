/**
 * GPU time measurement for band sizing. Uses EXT_disjoint_timer_query_webgl2 when the
 * browser exposes it (asynchronous, non-blocking). Otherwise a few bands per controller
 * are timed with gl.finish() (blocking for at most one ~12 ms band) to calibrate.
 */
import type { BandController } from '../scheduler';

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

interface PendingQuery {
  query: WebGLQuery;
  cells: number;
  controller: BandController;
}

export class GpuTimer {
  private ext: TimerExt | null;
  private pending: PendingQuery[] = [];
  private counts = new WeakMap<BandController, number>();

  constructor(private gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
  }

  get precise(): boolean {
    return this.ext !== null;
  }

  measure(draw: () => void, cells: number, controller: BandController): void {
    const gl = this.gl;
    if (this.ext && this.pending.length < 16) {
      const query = gl.createQuery();
      if (query) {
        gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
        draw();
        gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        this.pending.push({ query, cells, controller });
        return;
      }
    }
    const n = (this.counts.get(controller) ?? 0) + 1;
    this.counts.set(controller, n);
    if (!this.ext && (n <= 3 || n % 8 === 0)) {
      const t0 = performance.now();
      draw();
      gl.finish();
      controller.record(performance.now() - t0, cells);
    } else {
      draw();
    }
  }

  /** Feed finished query results to their controllers. */
  poll(): void {
    if (!this.ext || !this.pending.length) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    const still: PendingQuery[] = [];
    for (const p of this.pending) {
      if (!gl.getQueryParameter(p.query, gl.QUERY_RESULT_AVAILABLE)) {
        still.push(p);
        continue;
      }
      if (!disjoint) p.controller.record((gl.getQueryParameter(p.query, gl.QUERY_RESULT) as number) / 1e6, p.cells);
      gl.deleteQuery(p.query);
    }
    this.pending = still;
  }

  dispose(): void {
    for (const p of this.pending) this.gl.deleteQuery(p.query);
    this.pending = [];
  }
}
