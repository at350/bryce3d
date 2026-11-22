/** The packed data textures (objects, materials, lights) for one scene. */
import { LIGHT_TEXELS, MAT_TEXELS, MAX_LIGHTS, MAX_MATERIALS, MAX_OBJECT_ROWS, OBJ_TEXELS } from '../layout';
import { packScene, type PackedScene } from '../pack';
import type { Scene } from '@/core/types';
import type { TerrainCache } from './TerrainCache';

function dataTexture(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture | null {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export class SceneGPU {
  readonly objects: WebGLTexture | null;
  readonly materials: WebGLTexture | null;
  readonly lights: WebGLTexture | null;
  objectCount = 0;
  lightCount = 0;
  hasVolumes = false;
  dropped = 0;
  terrainUnavailable = false;
  private lastScene: Scene | null = null;
  private lastSkyOnly = false;
  private lastVersion = -1;

  constructor(
    private gl: WebGL2RenderingContext,
    private terrains: TerrainCache,
  ) {
    this.objects = dataTexture(gl, OBJ_TEXELS, MAX_OBJECT_ROWS);
    this.materials = dataTexture(gl, MAT_TEXELS, MAX_MATERIALS);
    this.lights = dataTexture(gl, LIGHT_TEXELS, MAX_LIGHTS);
  }

  /** Re-pack and upload unless this exact scene is already resident. */
  update(scene: Scene, skyOnly = false): void {
    if (scene === this.lastScene && skyOnly === this.lastSkyOnly && this.terrains.version === this.lastVersion) return;
    this.terrains.beginPack();
    const before = this.terrains.version;
    const pack = () => {
      this.terrainUnavailable = false;
      return packScene(scene, (terrain) => {
        const slot = this.terrains.resolve(terrain);
        if (!slot) this.terrainUnavailable = true;
        return slot;
      }, { skyOnly });
    };
    let packed = pack();
    // Uploading a larger terrain may have reallocated the array: slots packed earlier moved.
    if (this.terrains.version !== before) packed = pack();
    this.upload(packed);
    this.lastScene = scene;
    this.lastSkyOnly = skyOnly;
    this.lastVersion = this.terrains.version;
  }

  private upload(p: PackedScene): void {
    const gl = this.gl;
    const put = (tex: WebGLTexture | null, width: number, rows: number, data: Float32Array) => {
      if (rows <= 0) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, rows, gl.RGBA, gl.FLOAT, data.subarray(0, width * rows * 4));
    };
    put(this.objects, OBJ_TEXELS, Math.min(p.objectCount, MAX_OBJECT_ROWS), p.objects);
    put(this.materials, MAT_TEXELS, Math.min(p.materialCount, MAX_MATERIALS), p.materials);
    put(this.lights, LIGHT_TEXELS, Math.min(p.lightCount, MAX_LIGHTS), p.lights);
    this.objectCount = p.objectCount;
    this.lightCount = p.lightCount;
    this.hasVolumes = p.hasVolumes;
    this.dropped = p.dropped;
  }

  /** Forget the resident scene (forces the next update to re-pack). */
  invalidate(): void {
    this.lastScene = null;
  }

  dispose(): void {
    this.gl.deleteTexture(this.objects);
    this.gl.deleteTexture(this.materials);
    this.gl.deleteTexture(this.lights);
  }
}
