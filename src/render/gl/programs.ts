/**
 * Shader programs compiled once, asynchronously when KHR_parallel_shader_compile is
 * available (the uber shader is large; blocking on it would freeze the UI at startup).
 */
import type { ProgramSource } from '../shaders';

export interface CompiledProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

interface PendingProgram {
  name: string;
  program: WebGLProgram;
  vs: WebGLShader;
  fs: WebGLShader;
}

const COMPLETION_STATUS_KHR = 0x91b1;

export class ProgramSet {
  private pending: PendingProgram[] = [];
  private compiled = new Map<string, CompiledProgram>();
  private failure: string | null = null;
  private readonly parallel: boolean;

  constructor(
    private gl: WebGL2RenderingContext,
    sources: ProgramSource[],
  ) {
    this.parallel = !!gl.getExtension('KHR_parallel_shader_compile');
    for (const src of sources) {
      const vs = this.shader(gl.VERTEX_SHADER, src.vertex);
      const fs = this.shader(gl.FRAGMENT_SHADER, src.fragment);
      const program = gl.createProgram();
      if (!vs || !fs || !program) {
        this.failure = 'Could not create WebGL shader objects.';
        return;
      }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      this.pending.push({ name: src.name, program, vs, fs });
    }
  }

  private shader(type: number, source: string): WebGLShader | null {
    const sh = this.gl.createShader(type);
    if (!sh) return null;
    this.gl.shaderSource(sh, source);
    this.gl.compileShader(sh);
    return sh;
  }

  /** 'ready' once every program linked; 'failed' (see error) if any did not. Never blocks when parallel compile is available. */
  poll(): 'pending' | 'ready' | 'failed' {
    if (this.failure) return 'failed';
    const gl = this.gl;
    const still: PendingProgram[] = [];
    for (const p of this.pending) {
      if (this.parallel && !gl.getProgramParameter(p.program, COMPLETION_STATUS_KHR)) {
        still.push(p);
        continue;
      }
      if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) {
        const log = gl.getShaderInfoLog(p.fs) || gl.getShaderInfoLog(p.vs) || gl.getProgramInfoLog(p.program) || 'unknown error';
        this.failure = `Ray tracer shader "${p.name}" failed to compile: ${log.slice(0, 600)}`;
        return 'failed';
      }
      gl.deleteShader(p.vs);
      gl.deleteShader(p.fs);
      this.compiled.set(p.name, { program: p.program, uniforms: new Map() });
    }
    this.pending = still;
    return still.length ? 'pending' : 'ready';
  }

  get error(): string | null {
    return this.failure;
  }

  use(name: string): CompiledProgram {
    const p = this.compiled.get(name);
    if (!p) throw new Error(`program ${name} not ready`);
    this.gl.useProgram(p.program);
    return p;
  }

  uniform(p: CompiledProgram, name: string): WebGLUniformLocation | null {
    let loc = p.uniforms.get(name);
    if (loc === undefined) {
      loc = this.gl.getUniformLocation(p.program, name);
      p.uniforms.set(name, loc);
    }
    return loc;
  }

  dispose(): void {
    for (const p of this.pending) {
      this.gl.deleteProgram(p.program);
      this.gl.deleteShader(p.vs);
      this.gl.deleteShader(p.fs);
    }
    for (const p of this.compiled.values()) this.gl.deleteProgram(p.program);
    this.pending = [];
    this.compiled.clear();
  }
}
