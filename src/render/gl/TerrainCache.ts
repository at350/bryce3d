/**
 * Terrain heights on the GPU: one TEXTURE_2D_ARRAY shared by every scene (main render and
 * previews), one layer per distinct heights array, cached by array identity (terrain
 * edits always produce a new Float32Array). Least-recently-used layers are recycled.
 */
import { MAX_TERRAIN_LAYERS } from '../layout';
import type { TerrainSlot } from '../pack';
import { prepareTerrain, type PreparedTerrain } from '../terrainData';
import type { TerrainData } from '@/core/types';

interface Entry {
  prepared: PreparedTerrain;
  layer: number;
  lastUse: number;
}

export class TerrainCache {
  private tex: WebGLTexture | null = null;
  private layerSize = 0;
  private capacity = 0;
  private entries = new Map<Float32Array, Entry>();
  private clock = 0;
  private pinned = new Set<Float32Array>();
  /** Bumps when slots or their availability change, invalidating resident scene packing. */
  version = 0;

  constructor(private gl: WebGL2RenderingContext) {
    this.allocate(1, 1);
  }

  get texture(): WebGLTexture | null {
    return this.tex;
  }

  /** Start a packing pass: layers used from now on are protected from eviction. */
  beginPack(): void {
    this.clock++;
  }

  /** Keep these terrains resident (the running main render's terrains). */
  pin(heights: Float32Array[]): void {
    const next = new Set(heights);
    if (next.size === this.pinned.size && [...next].every(h => this.pinned.has(h))) return;
    this.pinned = next;
    this.version++;
  }

  resolve = (terrain: TerrainData): TerrainSlot | null => {
    const key = terrain?.heights;
    if (!(key instanceof Float32Array)) return null;
    let e = this.entries.get(key);
    if (!e) {
      const prepared = prepareTerrain(terrain);
      if (!prepared) return null;
      const layer = this.freeLayer(prepared.n);
      if (layer < 0) return null;
      e = { prepared, layer, lastUse: this.clock };
      this.entries.set(key, e);
      this.upload(e);
    }
    e.lastUse = this.clock;
    const S = this.layerSize;
    return {
      layer: e.layer,
      uvScale: (e.prepared.n - 1) / S,
      uvBias: 0.5 / S,
      maxHeight: e.prepared.maxHeight,
      resolution: e.prepared.n,
    };
  };

  private freeLayer(n: number): number {
    if (n > this.layerSize) this.allocate(Math.max(n, 64), Math.max(this.capacity, 2));
    const used = new Set(Array.from(this.entries.values(), (e) => e.layer));
    for (let i = 0; i < this.capacity; i++) if (!used.has(i)) return i;
    if (this.capacity < MAX_TERRAIN_LAYERS) {
      const layer = this.capacity;
      this.allocate(this.layerSize, Math.min(MAX_TERRAIN_LAYERS, this.capacity * 2));
      return layer;
    }
    let victim: [Float32Array, Entry] | null = null;
    for (const kv of this.entries) {
      if (kv[1].lastUse === this.clock || this.pinned.has(kv[0])) continue;
      if (!victim || kv[1].lastUse < victim[1].lastUse) victim = kv;
    }
    if (!victim) return -1;
    this.entries.delete(victim[0]);
    this.version++;
    return victim[1].layer;
  }

  private allocate(size: number, capacity: number): void {
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = gl.createTexture();
    this.layerSize = size;
    this.capacity = capacity;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    // Manual bilinear sampling uses texelFetch, so float-linear filtering is
    // unnecessary. Keep Float32 precision: R16F rounding can exceed maxHeight.
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R32F, size, size, capacity);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    for (const e of this.entries.values()) this.upload(e);
    this.version++;
  }

  private upload(e: Entry): void {
    const gl = this.gl;
    const n = e.prepared.n;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, e.layer, n, n, 1, gl.RED, gl.FLOAT, e.prepared.data);
  }

  dispose(): void {
    if (this.tex) this.gl.deleteTexture(this.tex);
    this.tex = null;
    this.entries.clear();
  }
}
