/** The tiling 32^3 value-noise texture (4 independent channels) sampled by the shaders. */
import { mulberry32 } from '@/core/math';
import { NOISE_SIZE } from '../shaders';

export function createNoiseTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const n = NOISE_SIZE;
  const data = new Float32Array(n * n * n * 4);
  const rand = mulberry32(0x0b5ce);
  for (let i = 0; i < data.length; i++) data[i] = rand();
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA16F, n, n, n);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, n, n, n, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
  return tex;
}
