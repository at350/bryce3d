/**
 * Owns the private WebGL2 context: capability checks, programs, the noise texture, the
 * terrain cache, float render targets, and the four draw operations (trace a band, splat
 * mosaic blocks, display with tone mapping, copy to a 2D canvas).
 */
import type { Rect } from '../scheduler';
import { programSources } from '../shaders';
import { ProgramSet } from './programs';
import type { SceneGPU } from './SceneGPU';
import { TerrainCache } from './TerrainCache';
import { GpuTimer } from './timer';
import { createNoiseTexture } from './noiseTexture';
import { SKY_SLOT_COUNT } from '../skyParams';

export interface RenderTarget {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export interface TraceUniforms {
  cam: Float32Array;
  sky: Float32Array;
  quality: Float32Array;
}

const TEX = { objects: 0, materials: 1, lights: 2, terrain: 3, noise: 4 } as const;

export class RayTracer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  timer!: GpuTimer;
  terrains!: TerrainCache;
  /** Accumulation format: RGBA32F when float blending is available, else RGBA16F. */
  readonly accumFormat: number;
  readonly maxSize: number;
  lost = false;
  private programs!: ProgramSet;
  private noise: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private readonly terrainFormat: number;

  private warm: 'none' | 'pending' | 'done' = 'none';
  private warmFence: WebGLSync | null = null;
  private warmTarget: RenderTarget | null = null;

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    accumFormat: number,
    terrainFormat: number,
    private salt: number,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.accumFormat = accumFormat;
    this.terrainFormat = terrainFormat;
    this.maxSize = Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    this.init();
  }

  /** Create the tracer, or explain why this browser cannot run it. */
  static create(options: { salt?: number } = {}): { tracer: RayTracer } | { error: string } {
    if (typeof document === 'undefined') return { error: 'No document available.' };
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    let gl: WebGL2RenderingContext | null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch {
      gl = null;
    }
    if (!gl) return { error: 'This browser does not support WebGL 2, which the ray tracer needs. Wireframes and editing still work.' };
    if (!gl.getExtension('EXT_color_buffer_float')) {
      return { error: 'This GPU/browser cannot render to floating-point targets (EXT_color_buffer_float), which the ray tracer needs.' };
    }
    const floatBlend = !!gl.getExtension('EXT_float_blend');
    const floatLinear = !!gl.getExtension('OES_texture_float_linear');
    return { tracer: new RayTracer(canvas, gl, floatBlend ? gl.RGBA32F : gl.RGBA16F, floatLinear ? gl.R32F : gl.R16F, options.salt ?? 0) };
  }

  /** (Re)create every GL resource. Called at construction and after a context restore. */
  init(): void {
    const gl = this.gl;
    // Extensions are disabled again on a restored context: enable them before allocating.
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_float_blend');
    gl.getExtension('OES_texture_float_linear');
    this.programs = new ProgramSet(gl, programSources(this.salt));
    this.warm = 'none';
    this.warmFence = null;
    this.warmTarget = null;
    this.noise = createNoiseTexture(gl);
    this.terrains = new TerrainCache(gl, this.terrainFormat);
    this.timer = new GpuTimer(gl);
    this.vao = gl.createVertexArray();
    this.lost = false;
  }

  /**
   * 'ready' once the programs are linked AND their GPU pipelines are built. Building the
   * Metal/D3D pipeline for the large trace shader can take seconds on a cold driver cache,
   * so it is triggered by a tiny warm-up draw and awaited with a fence instead of letting
   * the first real band (or a synchronous call) stall the page.
   */
  pollReady(warmScene?: () => SceneGPU): 'pending' | 'ready' | 'failed' {
    const linked = this.programs.poll();
    if (linked !== 'ready' || this.warm === 'done') return linked;
    const gl = this.gl;
    if (this.warm === 'none') {
      if (!warmScene) return 'ready';
      this.warmTarget = this.createTarget(1, 1);
      const second = this.createTarget(1, 1);
      if (this.warmTarget && second) {
        const u: TraceUniforms = { cam: new Float32Array(16), sky: new Float32Array(SKY_SLOT_COUNT * 4), quality: new Float32Array(8) };
        this.traceBand(warmScene(), u, new Float32Array([1, 1, 1, 1, 0, 1, 0, 0]), this.warmTarget, { x: 0, y: 0, w: 1, h: 1 }, null);
        this.splat(this.warmTarget, second, { x: 0, y: 0, w: 1, h: 1 }, 0, 1, 1);
        this.display(second, 1, 1, 1);
      }
      this.deleteTarget(second);
      this.warmFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      this.warm = 'pending';
      return 'pending';
    }
    const status = this.warmFence ? (gl.getSyncParameter(this.warmFence, gl.SYNC_STATUS) as number) : gl.SIGNALED;
    if (status !== gl.SIGNALED) return 'pending';
    if (this.warmFence) gl.deleteSync(this.warmFence);
    this.warmFence = null;
    this.deleteTarget(this.warmTarget);
    this.warmTarget = null;
    this.warm = 'done';
    return 'ready';
  }

  get error(): string | null {
    return this.programs.error;
  }

  createTarget(w: number, h: number, format = this.accumFormat): RenderTarget | null {
    const gl = this.gl;
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      return null;
    }
    const t = { tex, fbo, w, h };
    this.clearTarget(t);
    return t;
  }

  deleteTarget(t: RenderTarget | null): void {
    if (!t) return;
    this.gl.deleteTexture(t.tex);
    this.gl.deleteFramebuffer(t.fbo);
  }

  clearTarget(t: RenderTarget, rect?: Rect): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    if (rect) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(rect.x, rect.y, rect.w, rect.h);
    } else gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Trace the scissored rect of a target. frame = uFrame (8 floats). blendAlpha null = overwrite. */
  traceBand(scene: SceneGPU, u: TraceUniforms, frame: Float32Array, target: RenderTarget, rect: Rect, blendAlpha: number | null): void {
    const gl = this.gl;
    const p = this.programs.use('trace');
    const loc = (n: string) => this.programs.uniform(p, n);
    gl.activeTexture(gl.TEXTURE0 + TEX.objects);
    gl.bindTexture(gl.TEXTURE_2D, scene.objects);
    gl.activeTexture(gl.TEXTURE0 + TEX.materials);
    gl.bindTexture(gl.TEXTURE_2D, scene.materials);
    gl.activeTexture(gl.TEXTURE0 + TEX.lights);
    gl.bindTexture(gl.TEXTURE_2D, scene.lights);
    gl.activeTexture(gl.TEXTURE0 + TEX.terrain);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.terrains.texture);
    gl.activeTexture(gl.TEXTURE0 + TEX.noise);
    gl.bindTexture(gl.TEXTURE_3D, this.noise);
    gl.uniform1i(loc('uObjects'), TEX.objects);
    gl.uniform1i(loc('uMaterials'), TEX.materials);
    gl.uniform1i(loc('uLights'), TEX.lights);
    gl.uniform1i(loc('uTerrain'), TEX.terrain);
    gl.uniform1i(loc('uNoise'), TEX.noise);
    gl.uniform1i(loc('uObjectCount'), scene.objectCount);
    gl.uniform1i(loc('uLightCount'), scene.lightCount);
    gl.uniform4fv(loc('uSky'), u.sky);
    gl.uniform4fv(loc('uCam'), u.cam);
    gl.uniform4fv(loc('uQuality'), u.quality);
    gl.uniform4fv(loc('uFrame'), frame);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.w, target.h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.w, rect.h);
    // Blending stays enabled for every trace draw (alpha 1 = overwrite) so the driver builds a
    // single pipeline state for the big shader instead of one per blend mode.
    gl.enable(gl.BLEND);
    gl.blendColor(0, 0, 0, blendAlpha ?? 1);
    gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
  }

  /** Expand mosaic cells from the scratch target into `rect` of the accumulation target. */
  splat(scratch: RenderTarget, accum: RenderTarget, rect: Rect, originX: number, top: number, block: number): void {
    const gl = this.gl;
    const p = this.programs.use('splat');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scratch.tex);
    gl.uniform1i(this.programs.uniform(p, 'uScratch'), 0);
    gl.uniform4f(this.programs.uniform(p, 'uSplat'), originX, top, block, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, accum.fbo);
    gl.viewport(0, 0, accum.w, accum.h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.w, rect.h);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
  }

  /** Tone-map w x h texels of `source` into the bottom-left of the default framebuffer. */
  display(source: RenderTarget, w: number, h: number, exposure: number): void {
    const gl = this.gl;
    this.ensureCanvas(w, h);
    const p = this.programs.use('display');
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.tex);
    gl.uniform1i(this.programs.uniform(p, 'uAccum'), 0);
    gl.uniform4f(this.programs.uniform(p, 'uDisplay'), exposure, Math.random() * 100, 0, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Copy the last display() result into a 2D canvas (replacing its pixels). */
  copyTo(ctx: CanvasRenderingContext2D, w: number, h: number, dw: number, dh: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'copy';
    ctx.imageSmoothingEnabled = dw !== w || dh !== h;
    ctx.drawImage(this.canvas, 0, this.canvas.height - h, w, h, 0, 0, dw, dh);
    ctx.restore();
  }

  private ensureCanvas(w: number, h: number): void {
    if (this.canvas.width >= w && this.canvas.height >= h) return;
    this.canvas.width = Math.max(this.canvas.width, w);
    this.canvas.height = Math.max(this.canvas.height, h);
  }

  private loseExt: { loseContext(): void; restoreContext(): void } | null = null;

  /** Simulate a context loss (dev harness). getExtension() returns null once lost, so keep it. */
  loseContext(): void {
    this.loseExt ??= this.gl.getExtension('WEBGL_lose_context');
    this.loseExt?.loseContext();
  }

  restoreContext(): void {
    this.loseExt?.restoreContext();
  }

  dispose(): void {
    if (this.lost) return;
    const gl = this.gl;
    this.programs.dispose();
    this.terrains.dispose();
    this.timer.dispose();
    gl.deleteTexture(this.noise);
    gl.deleteVertexArray(this.vao);
  }
}
