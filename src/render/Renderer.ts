/**
 * The progressive renderer behind RendererAPI. Work is time-sliced on requestAnimationFrame:
 * each frame spends ~12 ms of GPU time on bands of the current pass (Bryce mosaic 16 -> 2 px,
 * then full-resolution sample passes accumulated into a float target), interleaved with
 * small preview jobs. Nothing here blocks the main thread for longer than one band.
 *
 * Bryce-style anti-aliasing: with `render.antialias` 'edges', an edge mask is built from the
 * first full-resolution pass and the later sample passes trace only the pixels it marks. The
 * main image is presented through the soft pixel filter (`render.softness`).
 */
import type { PreviewOptions, RendererAPI, StartOptions } from '@/core/renderApi';
import { useStore } from '@/core/store';
import type { RenderProgress, Scene } from '@/core/types';
import { cameraUniforms } from './camera';
import { paintFallback } from './fallback';
import { RayTracer, type RenderTarget, type TraceUniforms } from './gl/RayTracer';
import { SceneGPU } from './gl/SceneGPU';
import { PreviewQueue, type QueuedPreview } from './previewQueue';
import { EDGE_STRONG_THRESHOLD, EDGE_THRESHOLD, filterKernel, mainQuality, previewQuality, type FilterKernel, type TraceQuality } from './quality';
import { BandController, edgeMasked, extendPasses, passGrid, planPasses, regionToPixels, totalWork, type Pass, type Rect } from './scheduler';
import { computeSkyParams } from './skyParams';

const FRAME_BUDGET_MS = 12;
const PREVIEW_SHARE_MS = 5;
const EMIT_INTERVAL_MS = 100;
const IDLE: RenderProgress = { status: 'idle', pass: 0, passCount: 0, fraction: 0, samples: 0, elapsedMs: 0 };

interface MainJob {
  scene: Scene;
  width: number;
  height: number;
  region: Rect;
  quality: TraceQuality;
  passes: Pass[];
  passIndex: number;
  /** Rows of the current pass's grid already traced (counted from the top). */
  rowsDone: number;
  workDone: number;
  workTotal: number;
  elapsedMs: number;
  runningSince: number;
  seed: number;
  state: 'running' | 'paused' | 'done';
  samplesDone: number;
  keepImage: boolean;
  uniforms: TraceUniforms | null;
  /**
   * Edge-only anti-aliasing: 'pending' until the first masked pass builds the mask (from the
   * finished first sample pass, inside the region), then 'ready' for every later pass, resumes
   * included. 'off' = every pixel gets every sample.
   */
  mask: 'pending' | 'ready' | 'off';
  /** The soft pixel filter applied when presenting sample passes. */
  filter: FilterKernel;
  message?: string;
}

interface PreviewPayload {
  scene: Scene;
  target: HTMLCanvasElement;
  options: PreviewOptions;
}

interface PreviewJob {
  req: QueuedPreview<PreviewPayload>;
  scene: Scene;
  skyOnly: boolean;
  quality: TraceQuality;
  uniforms: TraceUniforms;
  w: number;
  h: number;
  sample: number;
  rowsDone: number;
  seed: number;
  exposure: number;
}

const clampInt = (v: unknown, def: number, lo: number, hi: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : def;
  return Math.min(hi, Math.max(lo, n));
};

function qualityUniforms(q: TraceQuality, hasVolumes: boolean): Float32Array {
  return new Float32Array([q.maxRays, q.maxDepth, q.softShadows ? 1 : 0, q.blur ? 1 : 0, q.volumeSteps, 0, q.sdfSteps, hasVolumes ? 1 : 0]);
}

function exposureOf(scene: Scene): number {
  const e = scene.render?.exposure;
  return typeof e === 'number' && Number.isFinite(e) ? Math.min(4, Math.max(0.25, e)) : 1;
}

function terrainHeights(scene: Scene): Float32Array[] {
  return scene.objects.filter((o) => !o.hidden && (o.type === 'terrain' || o.type === 'lattice') && o.terrain?.heights instanceof Float32Array).map((o) => o.terrain!.heights);
}

export class WebGLRenderer implements RendererAPI {
  readonly outputCanvas: HTMLCanvasElement;
  private _supported = true;
  private _error: string | null = null;
  private rt: RayTracer;
  private mainScene: SceneGPU;
  private previewScene: SceneGPU;
  private accum: RenderTarget | null = null;
  private scratch: RenderTarget | null = null;
  /** R8 edge mask of the main job: allocated on first use, released with accum (so always its size). */
  private edges: RenderTarget | null = null;
  /** Rows of the soft pixel filter: allocated on first use, released with accum. */
  private soft: RenderTarget | null = null;
  private previewAccum: RenderTarget | null = null;
  private job: MainJob | null = null;
  private previewJob: PreviewJob | null = null;
  private queue = new PreviewQueue<PreviewPayload>();
  private mainBands = new BandController(FRAME_BUDGET_MS);
  /**
   * Edge-masked passes cost a small, scene-dependent fraction of a full pass per cell: they keep
   * their own estimate, so a full pass never inherits theirs (one oversized band) and they are
   * not held to a full pass's.
   */
  private maskedBands = new BandController(FRAME_BUDGET_MS);
  private previewBands = new BandController(PREVIEW_SHARE_MS);
  private listeners = new Set<(p: RenderProgress) => void>();
  private progress: RenderProgress = IDLE;
  private frame: number | null = null;
  private lastEmit = 0;
  private hasImage = false;
  private outputCtx: CanvasRenderingContext2D | null;

  constructor(rt: RayTracer) {
    this.rt = rt;
    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = 800;
    this.outputCanvas.height = 600;
    this.outputCtx = this.outputCanvas.getContext('2d');
    this.mainScene = new SceneGPU(rt.gl, rt.terrains);
    this.previewScene = new SceneGPU(rt.gl, rt.terrains);
    rt.canvas.addEventListener('webglcontextlost', this.onContextLost, false);
    rt.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
    this.schedule();
  }

  get supported(): boolean {
    return this._supported;
  }

  get error(): string | null {
    return this._error;
  }

  /** Debug/test access (dev harness). */
  get tracer(): RayTracer {
    return this.rt;
  }

  // -------------------------------------------------------------------------
  // RendererAPI
  // -------------------------------------------------------------------------

  start(scene: Scene, options: StartOptions = {}): void {
    if (!this._supported) {
      this.paintUnsupported(scene);
      return;
    }
    const width = clampInt(scene.render?.width, 800, 16, this.rt.maxSize);
    const height = clampInt(scene.render?.height, 600, 16, this.rt.maxSize);
    const sizeChanged = this.outputCanvas.width !== width || this.outputCanvas.height !== height;
    const keepImage = !!options.region && !sizeChanged && this.hasImage && !!this.accum;
    if (sizeChanged) {
      this.outputCanvas.width = width;
      this.outputCanvas.height = height;
      this.hasImage = false;
    }
    const quality = mainQuality(scene.render);
    const region = keepImage ? regionToPixels(options.region, width, height) : { x: 0, y: 0, w: width, h: height };
    const passes = planPasses(quality.mosaic, quality.samples);
    this.rt.terrains.pin(terrainHeights(scene));
    this.job = {
      scene,
      width,
      height,
      region,
      quality,
      passes,
      passIndex: 0,
      rowsDone: 0,
      workDone: 0,
      workTotal: totalWork(passes, region),
      elapsedMs: 0,
      runningSince: performance.now(),
      seed: Math.floor(Math.random() * 1e6),
      state: 'running',
      samplesDone: 0,
      keepImage,
      uniforms: null,
      mask: quality.edgesOnly ? 'pending' : 'off',
      filter: filterKernel(quality.filterSigma),
    };
    this.mainBands.resetGrowth();
    this.maskedBands.resetGrowth();
    this.emit(true);
    this.schedule();
  }

  resume(): void {
    const job = this.job;
    if (!job || !this._supported) return;
    if (job.state === 'paused') {
      job.state = 'running';
      job.runningSince = performance.now();
    } else if (job.state === 'done') {
      const extra = Math.max(4, job.quality.samples);
      job.passes = extendPasses(job.passes, extra);
      job.workTotal = totalWork(job.passes, job.region);
      job.state = 'running';
      job.runningSince = performance.now();
    } else return;
    this.rt.terrains.pin(terrainHeights(job.scene));
    this.emit(true);
    this.schedule();
  }

  stop(): void {
    const job = this.job;
    if (!job || job.state !== 'running') return;
    job.elapsedMs += performance.now() - job.runningSince;
    job.state = 'paused';
    this.rt.terrains.pin([]);
    this.emit(true);
  }

  clear(): void {
    this.job = null;
    this.rt.terrains.pin([]);
    this.hasImage = false;
    this.outputCtx?.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    if (this.accum && !this.rt.lost) this.rt.clearTarget(this.accum);
    this.progress = IDLE;
    this.emit(true);
  }

  subscribe(listener: (p: RenderProgress) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getProgress(): RenderProgress {
    return this.progress;
  }

  preview(scene: Scene, target: HTMLCanvasElement, options: PreviewOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this._supported) {
        paintFallback(scene, target);
        resolve();
        return;
      }
      const priority = options.quality === 'nano' ? 0 : options.quality === 'preview' ? 1 : 2;
      this.queue.push({ key: options.key, priority, payload: { scene, target, options }, resolve });
      this.schedule();
    });
  }

  async exportPNG(): Promise<Blob | null> {
    if (!this.hasImage || !this.job) return null;
    return new Promise<Blob | null>((resolve) => this.outputCanvas.toBlob(resolve, 'image/png'));
  }

  // -------------------------------------------------------------------------
  // Frame loop
  // -------------------------------------------------------------------------

  private schedule(): void {
    if (this.frame !== null || this.rt.lost) return;
    if (typeof requestAnimationFrame === 'function') this.frame = requestAnimationFrame(this.tick);
    else this.frame = setTimeout(this.tick, 16) as unknown as number;
  }

  private needsWork(): boolean {
    return this.job?.state === 'running' || this.previewJob !== null || this.queue.size > 0;
  }

  private tick = (): void => {
    this.frame = null;
    if (this.rt.lost || !this._supported) return;
    const ready = this.rt.pollReady(() => this.previewScene);
    if (ready === 'failed') {
      this.fail(this.rt.error ?? 'The ray tracer shader failed to compile.');
      return;
    }
    if (ready === 'pending') {
      if (this.job?.state === 'running' && !this.job.message) {
        this.job.message = 'Preparing the ray tracer...';
        this.emit(true);
      }
      this.schedule();
      return;
    }
    try {
      this.rt.timer.poll();
      const mainRunning = this.job?.state === 'running';
      const spent = this.stepPreview(mainRunning ? PREVIEW_SHARE_MS : FRAME_BUDGET_MS);
      if (this.job?.state === 'running') this.stepMain(Math.max(3, FRAME_BUDGET_MS - spent));
    } catch (err) {
      this.fail(`Renderer error: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (this.needsWork()) this.schedule();
  };

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  private prepareMain(job: MainJob): boolean {
    const { width: w, height: h } = job;
    if (!this.accum || this.accum.w !== w || this.accum.h !== h) {
      this.rt.deleteTarget(this.accum);
      this.rt.deleteTarget(this.scratch);
      this.rt.deleteTarget(this.edges);
      this.rt.deleteTarget(this.soft);
      this.edges = null;
      this.soft = null;
      const big = w * h > 4_200_000;
      this.accum = this.rt.createTarget(w, h, big ? this.rt.gl.RGBA16F : this.rt.accumFormat);
      this.scratch = this.rt.createTarget(Math.ceil(w / 2), Math.ceil(h / 2), big ? this.rt.gl.RGBA16F : this.rt.accumFormat);
      job.keepImage = false;
      if (!this.accum || !this.scratch) {
        this.fail('Could not allocate the render buffers (out of GPU memory?).');
        return false;
      }
    }
    if (!job.keepImage && this.accum) this.rt.clearTarget(this.accum);
    this.rt.terrains.pin(terrainHeights(job.scene));
    this.mainScene.update(job.scene);
    job.uniforms = {
      cam: cameraUniforms(job.scene.camera, w, h),
      sky: computeSkyParams(job.scene.sky, job.scene.camera),
      quality: qualityUniforms(job.quality, this.mainScene.hasVolumes),
    };
    const dropped = this.mainScene.dropped;
    job.message = dropped > 0 ? `${dropped} object(s) over the renderer limit were skipped.` : undefined;
    return true;
  }

  private stepMain(budgetMs: number): void {
    const job = this.job;
    if (!job) return;
    if (!job.uniforms && !this.prepareMain(job)) return;
    const accum = this.accum;
    const scratch = this.scratch;
    const u = job.uniforms;
    if (!accum || !scratch || !u) return;
    this.mainScene.update(job.scene);
    let spent = 0;
    let drew: Pass | null = null;
    while (spent < budgetMs && job.passIndex < job.passes.length) {
      const pass = job.passes[job.passIndex];
      const mask = edgeMasked(pass, job.mask !== 'off') ? this.edgeMask(job, accum) : null;
      const bands = mask ? this.maskedBands : this.mainBands;
      const grid = passGrid(pass, job.region);
      const rows = bands.rowsFor(grid.cols, grid.rows - job.rowsDone);
      const cells = rows * grid.cols;
      this.rt.timer.measure(() => this.drawMainBand(job, pass, rows, accum, scratch, u, mask), cells, bands);
      drew = pass;
      spent += bands.costPerCell * cells;
      job.rowsDone += rows;
      job.workDone += cells;
      if (job.rowsDone >= grid.rows) {
        if (pass.kind === 'sample') job.samplesDone = pass.sample;
        job.passIndex++;
        job.rowsDone = 0;
        this.mainBands.resetGrowth();
        this.maskedBands.resetGrowth();
      }
    }
    // The mosaic stays chunky: the soft pixel filter starts with the full-resolution passes.
    if (drew) this.presentMain(job, accum, drew.kind === 'sample');
    if (job.passIndex >= job.passes.length) {
      job.elapsedMs += performance.now() - job.runningSince;
      job.state = 'done';
      this.rt.terrains.pin([]);
      this.emit(true);
    } else this.emit(false);
  }

  /**
   * The job's edge mask, built on first use: by then the first sample pass has covered the
   * region, and the mask never changes afterwards, so every marked pixel receives every later
   * pass and its running average stays exact. Null (and edge-only AA off) if it cannot be allocated.
   */
  private edgeMask(job: MainJob, accum: RenderTarget): RenderTarget | null {
    if (job.mask === 'pending') {
      this.edges ??= this.rt.createTarget(accum.w, accum.h, this.rt.gl.R8);
      if (!this.edges) {
        job.mask = 'off';
        return null;
      }
      this.rt.edgeMask(accum, this.edges, job.region, exposureOf(job.scene), EDGE_THRESHOLD, EDGE_STRONG_THRESHOLD);
      job.mask = 'ready';
    }
    return job.mask === 'ready' ? this.edges : null;
  }

  private drawMainBand(job: MainJob, pass: Pass, rows: number, accum: RenderTarget, scratch: RenderTarget, u: TraceUniforms, mask: RenderTarget | null): void {
    const r = job.region;
    const top = r.y + r.h;
    const frame = new Float32Array([
      job.width,
      job.height,
      pass.block,
      pass.sample,
      r.x,
      top,
      pass.sample > 1 ? 1 : 0,
      (job.seed + job.passIndex * 7919) % 1_000_000,
    ]);
    if (pass.kind === 'mosaic') {
      const cols = Math.ceil(r.w / pass.block);
      this.rt.traceBand(this.mainScene, u, frame, scratch, { x: 0, y: job.rowsDone, w: cols, h: rows }, null);
      const y1 = Math.max(r.y, top - (job.rowsDone + rows) * pass.block);
      const y2 = top - job.rowsDone * pass.block;
      this.rt.splat(scratch, accum, { x: r.x, y: y1, w: r.w, h: y2 - y1 }, r.x, top, pass.block);
    } else {
      const y2 = top - job.rowsDone;
      const y1 = Math.max(r.y, y2 - rows);
      this.rt.traceBand(this.mainScene, u, frame, accum, { x: r.x, y: y1, w: r.w, h: y2 - y1 }, pass.sample > 1 ? 1 / pass.sample : null, mask);
    }
  }

  /**
   * The scratch target of the soft pixel filter (half floats are plenty for one row pass of
   * linear color). If it cannot be allocated the job is presented unfiltered from then on.
   */
  private softTarget(job: MainJob, accum: RenderTarget): RenderTarget | null {
    this.soft ??= this.rt.createTarget(accum.w, accum.h, this.rt.gl.RGBA16F);
    if (!this.soft) job.filter = filterKernel(0);
    return this.soft;
  }

  private presentMain(job: MainJob, accum: RenderTarget, filtered: boolean): void {
    if (!this.outputCtx) return;
    const scratch = filtered && job.filter.radius > 0 ? this.softTarget(job, accum) : null;
    this.rt.display(accum, job.width, job.height, exposureOf(job.scene), scratch ? { kernel: job.filter, scratch } : null);
    this.outputCtx.save();
    if (job.keepImage) {
      const r = job.region;
      this.outputCtx.beginPath();
      this.outputCtx.rect(r.x, job.height - r.y - r.h, r.w, r.h);
      this.outputCtx.clip();
    }
    this.rt.copyTo(this.outputCtx, job.width, job.height, job.width, job.height);
    this.outputCtx.restore();
    this.hasImage = true;
  }

  // -------------------------------------------------------------------------
  // Previews
  // -------------------------------------------------------------------------

  private startPreviewJob(req: QueuedPreview<PreviewPayload>): PreviewJob | null {
    const { scene, target, options } = req.payload;
    if (!scene || !target) {
      req.resolve();
      return null;
    }
    const w = clampInt(options.width, target.width || 160, 1, 1024);
    const h = clampInt(options.height, target.height || 120, 1, 1024);
    if (!this.previewAccum || this.previewAccum.w < w || this.previewAccum.h < h) {
      const pw = Math.max(w, this.previewAccum?.w ?? 0, 256);
      const ph = Math.max(h, this.previewAccum?.h ?? 0, 256);
      this.rt.deleteTarget(this.previewAccum);
      this.previewAccum = this.rt.createTarget(pw, ph);
      if (!this.previewAccum) {
        req.resolve();
        return null;
      }
    }
    const skyOnly = !!options.skyOnly;
    this.previewScene.update(scene, skyOnly);
    if (this.previewScene.terrainUnavailable && this.job?.state === 'running') {
      // All layers may be pinned by the main job. Retry after it advances or
      // finishes instead of publishing and caching an incomplete sky-only image.
      this.queue.push(req);
      return null;
    }
    const quality = previewQuality(options.quality);
    const camera = options.camera ?? scene.camera;
    return {
      req,
      scene,
      skyOnly,
      quality,
      uniforms: {
        cam: cameraUniforms(camera, w, h),
        sky: computeSkyParams(scene.sky, camera),
        quality: qualityUniforms(quality, this.previewScene.hasVolumes),
      },
      w,
      h,
      sample: 1,
      rowsDone: 0,
      seed: Math.floor(Math.random() * 1e6),
      exposure: exposureOf(scene),
    };
  }

  /** Runs preview bands for up to budgetMs (estimated GPU time). Returns the time spent. */
  private stepPreview(budgetMs: number): number {
    let spent = 0;
    while (spent < budgetMs) {
      if (this.previewJob && this.queue.hasPending(this.previewJob.req.key)) {
        this.previewJob.req.resolve();
        this.previewJob = null;
      }
      if (!this.previewJob) {
        const next = this.queue.shift();
        if (!next) break;
        this.previewJob = this.startPreviewJob(next);
        if (!this.previewJob) break;
        this.previewBands.resetGrowth();
      }
      const job = this.previewJob;
      const accum = this.previewAccum;
      if (!accum) break;
      this.previewScene.update(job.scene, job.skyOnly);
      if (this.previewScene.terrainUnavailable && this.job?.state === 'running') {
        this.queue.push(job.req);
        this.previewJob = null;
        break;
      }
      const rows = this.previewBands.rowsFor(job.w, job.h - job.rowsDone);
      const cells = rows * job.w;
      const y2 = job.h - job.rowsDone;
      const frame = new Float32Array([job.w, job.h, 1, job.sample, 0, job.h, job.sample > 1 ? 1 : 0, (job.seed + job.sample * 7919) % 1_000_000]);
      this.rt.timer.measure(
        () => this.rt.traceBand(this.previewScene, job.uniforms, frame, accum, { x: 0, y: y2 - rows, w: job.w, h: rows }, job.sample > 1 ? 1 / job.sample : null),
        cells,
        this.previewBands,
      );
      spent += this.previewBands.costPerCell * cells;
      job.rowsDone += rows;
      if (job.rowsDone >= job.h) {
        const done = job.sample >= job.quality.samples;
        if (job.sample === 1 || done) this.presentPreview(job, accum);
        job.rowsDone = 0;
        job.sample++;
        this.previewBands.resetGrowth();
        if (done) {
          job.req.resolve();
          this.previewJob = null;
        }
      }
    }
    return spent;
  }

  private presentPreview(job: PreviewJob, accum: RenderTarget): void {
    const target = job.req.payload.target;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    this.rt.display(accum, job.w, job.h, job.exposure);
    this.rt.copyTo(ctx, job.w, job.h, target.width || job.w, target.height || job.h);
  }

  // -------------------------------------------------------------------------
  // Progress, failures, context loss
  // -------------------------------------------------------------------------

  private snapshot(): RenderProgress {
    const job = this.job;
    if (!job) return IDLE;
    const running = job.state === 'running';
    const elapsedMs = job.elapsedMs + (running ? performance.now() - job.runningSince : 0);
    return {
      status: running ? 'rendering' : job.state === 'paused' ? 'paused' : 'done',
      pass: Math.min(job.passIndex, job.passes.length - 1),
      passCount: job.passes.length,
      fraction: job.workTotal > 0 ? Math.min(1, job.workDone / job.workTotal) : 1,
      samples: job.samplesDone,
      elapsedMs,
      ...(job.message ? { message: job.message } : {}),
    };
  }

  private emit(force: boolean, override?: RenderProgress): void {
    const now = performance.now();
    if (!force && now - this.lastEmit < EMIT_INTERVAL_MS) return;
    this.lastEmit = now;
    this.progress = override ?? this.snapshot();
    try {
      useStore.getState().setRenderProgress(this.progress);
    } catch {
      // the store is optional for the renderer (dev harness, tests)
    }
    for (const l of this.listeners) l(this.progress);
  }

  private fail(message: string): void {
    this._error = message;
    this._supported = false;
    this.queue.flush();
    if (this.previewJob) {
      paintFallback(this.previewJob.scene, this.previewJob.req.payload.target);
      this.previewJob.req.resolve();
      this.previewJob = null;
    }
    if (this.job) this.paintUnsupported(this.job.scene);
    else this.emit(true, { ...IDLE, status: 'error', message });
  }

  private paintUnsupported(scene: Scene): void {
    const w = clampInt(scene.render?.width, 800, 16, 8192);
    const h = clampInt(scene.render?.height, 600, 16, 8192);
    if (this.outputCanvas.width !== w || this.outputCanvas.height !== h) {
      this.outputCanvas.width = w;
      this.outputCanvas.height = h;
    }
    paintFallback(scene, this.outputCanvas);
    this.emit(true, { ...IDLE, status: 'error', message: this._error ?? 'Ray tracing is unavailable.' });
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.rt.lost = true;
    if (this.frame !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  };

  private onContextRestored = (): void => {
    this.rt.init();
    this.mainScene = new SceneGPU(this.rt.gl, this.rt.terrains);
    this.previewScene = new SceneGPU(this.rt.gl, this.rt.terrains);
    this.accum = null;
    this.scratch = null;
    this.edges = null;
    this.soft = null;
    this.previewAccum = null;
    const job = this.job;
    if (job) {
      // The accumulated image is gone: start the passes over (the 2D output keeps the old image
      // meanwhile). The edge mask is rebuilt once the first sample pass is done again.
      job.passIndex = 0;
      job.rowsDone = 0;
      job.workDone = 0;
      job.samplesDone = 0;
      job.keepImage = false;
      job.mask = job.quality.edgesOnly ? 'pending' : 'off';
      job.region = { x: 0, y: 0, w: job.width, h: job.height };
      job.passes = planPasses(job.quality.mosaic, job.quality.samples);
      job.workTotal = totalWork(job.passes, job.region);
      job.uniforms = null;
      if (job.state === 'done') {
        job.state = 'running';
        job.runningSince = performance.now();
      }
    }
    const pj = this.previewJob;
    if (pj) {
      this.previewJob = null;
      this.queue.push(pj.req);
    }
    this.emit(true);
    this.schedule();
  };

  dispose(): void {
    if (this.frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
    this.frame = null;
    this.queue.flush();
    this.previewJob?.req.resolve();
    this.previewJob = null;
    this.rt.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.rt.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    if (!this.rt.lost) {
      this.rt.deleteTarget(this.accum);
      this.rt.deleteTarget(this.scratch);
      this.rt.deleteTarget(this.edges);
      this.rt.deleteTarget(this.soft);
      this.rt.deleteTarget(this.previewAccum);
      this.mainScene.dispose();
      this.previewScene.dispose();
      this.rt.dispose();
    }
  }
}

/** RendererAPI stand-in when WebGL2 is unavailable: paints a gradient so the app keeps working. */
export class UnsupportedRenderer implements RendererAPI {
  readonly supported = false;
  readonly outputCanvas: HTMLCanvasElement;
  private listeners = new Set<(p: RenderProgress) => void>();
  private progress: RenderProgress = IDLE;
  private painted = false;

  constructor(readonly error: string) {
    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = 800;
    this.outputCanvas.height = 600;
  }

  start(scene: Scene): void {
    this.outputCanvas.width = clampInt(scene.render?.width, 800, 16, 8192);
    this.outputCanvas.height = clampInt(scene.render?.height, 600, 16, 8192);
    paintFallback(scene, this.outputCanvas);
    this.painted = true;
    this.set({ ...IDLE, status: 'error', message: this.error });
  }
  resume(): void {}
  stop(): void {}
  clear(): void {
    this.outputCanvas.getContext('2d')?.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    this.painted = false;
    this.set(IDLE);
  }
  subscribe(listener: (p: RenderProgress) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  getProgress(): RenderProgress {
    return this.progress;
  }
  async preview(scene: Scene, target: HTMLCanvasElement): Promise<void> {
    paintFallback(scene, target);
  }
  async exportPNG(): Promise<Blob | null> {
    if (!this.painted) return null;
    return new Promise<Blob | null>((resolve) => this.outputCanvas.toBlob(resolve, 'image/png'));
  }
  private set(p: RenderProgress): void {
    this.progress = p;
    try {
      useStore.getState().setRenderProgress(p);
    } catch {
      // store unavailable
    }
    this.listeners.forEach((l) => l(p));
  }
}
