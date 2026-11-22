/**
 * CPU evaluator of the procedural texture components (the A / B / C columns of the
 * Materials Lab). Used for component swatches, CPU material thumbnails and tests.
 * It mirrors the renderer's GLSL (src/render/shaders/textures.ts): the same pattern
 * formulas, mapping, seed offset, warp, contrast and bias, over CPU value noise, so a
 * swatch matches the ray-traced look in character (not bit-for-bit).
 */
import { mulberry32 } from '@/core/math';
import type { RGB, TextureComponent } from '@/core/types';
import { fbm, fbmRaw, hash3, hashUnit, noise3, ridgedNoise, turbulenceNoise, voronoiF1 } from './noise';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const fract = (v: number) => v - Math.floor(v);

function waves(x: number, y: number, z: number, octaves: number, rough: number): number {
  let qx = x + y * 0.71;
  let qz = z - y * 0.43;
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let ang = 0.4;
  for (let i = 0; i < octaves; i++) {
    const ph = (qx * Math.cos(ang) + qz * Math.sin(ang)) * 2.6 + (noise3(qx * 0.33, qz * 0.33, i * 3.7) - 0.5) * 7;
    const w = 0.5 + 0.5 * Math.sin(ph);
    sum += amp * w * w * (3 - 2 * w);
    norm += amp;
    amp *= Math.max(rough, 0.2);
    const rx = 0.8 * qx + 0.6 * qz;
    const rz = -0.6 * qx + 0.8 * qz;
    qx = rx * 1.83 + 3.7;
    qz = rz * 1.83 + 1.9;
    ang += 2.1;
  }
  return sum / Math.max(norm, 1e-4);
}

function strata(x: number, y: number, z: number, octaves: number, rough: number): number {
  let yy = y * 2 + (fbmRaw(x * 0.45, y * 0.45, z * 0.45, 3, 0.5) - 0.5) * 2.6;
  let v = 0;
  let amp = 1;
  let norm = 0;
  const bands = Math.max(Math.floor(octaves / 2), 1);
  for (let i = 0; i < Math.min(bands, 4); i++) {
    const band = Math.floor(yy);
    const f = yy - band;
    const a = hashUnit(hash3(band, i, 13, 0x3a7));
    const b = hashUnit(hash3(band + 1, i, 13, 0x3a7));
    v += amp * (a + (b - a) * smooth(0.8, 1, f));
    norm += amp;
    amp *= Math.max(rough, 0.25);
    yy = yy * 2.7 + 0.37;
  }
  const fine = 0.5 + 0.5 * Math.sin(y * 22 + noise3(x * 3, y * 3, z * 3) * 3);
  return clamp01((v / Math.max(norm, 1e-4)) * 0.85 + fine * 0.15);
}

function granite(x: number, y: number, z: number, octaves: number, rough: number): number {
  const n = fbm(x * 2.5, y * 2.5, z * 2.5, octaves, Math.max(rough, 0.6));
  const g = noise3(x * 19 + 3.1, y * 19 + 3.1, z * 19 + 3.1);
  return clamp01(n * 0.75 + smooth(0.62, 0.74, g) * 0.35 - smooth(0.32, 0.2, g) * 0.2);
}

/** Raw pattern value (0..1) of a texture type at a texture-space point (already mapped, scaled and warped). */
export function patternValue(type: TextureComponent['type'], x: number, y: number, z: number, octaves: number, rough: number): number {
  switch (type) {
    case 'fbm': return fbm(x, y, z, octaves, rough);
    case 'ridged': return ridgedNoise(x, y, z, octaves, rough);
    case 'turbulence': return turbulenceNoise(x, y, z, octaves, rough);
    case 'voronoi': {
      let f = voronoiF1(x, y, z);
      if (octaves > 2) f += (voronoiF1(x * 2.31 + 7.1, y * 2.31 + 7.1, z * 2.31 + 7.1) - f) * 0.35 * rough;
      return clamp01(f * 1.15);
    }
    case 'marble': {
      const t = turbulenceNoise(x * 0.6, y * 0.6, z * 0.6, octaves, rough);
      return 0.5 + 0.5 * Math.sin((x * 0.9 + y * 0.35 + z * 0.2) * 3.2 + t * 7);
    }
    case 'strata': return strata(x, y, z, octaves, rough);
    case 'spots': return smooth(0.5, 0.58, fbmRaw(x, y, z, octaves, rough));
    case 'granite': return granite(x, y, z, octaves, rough);
    case 'waves': return waves(x, y, z, octaves, rough);
    case 'checker': return (Math.floor(x + 0.0013) + Math.floor(y + 0.0137) + Math.floor(z + 0.0071)) & 1;
    case 'grid': {
      const d = Math.min(Math.abs(fract(x + 0.25) - 0.5), Math.abs(fract(y + 0.25) - 0.5), Math.abs(fract(z + 0.25) - 0.5));
      return 1 - smooth(0.03, 0.06, d);
    }
    default: return 0.5;
  }
}

/** Contrast (0.5 neutral, x0.25 .. x4) and bias (-1..1) applied after the pattern. */
export function shapeValue(n: number, contrast: number, bias: number): number {
  const k = Math.pow(2, (clamp01(contrast) - 0.5) * 4);
  return clamp01((n - 0.5) * k + 0.5 + Math.max(-1, Math.min(1, bias)) * 0.5);
}

const offsets = new Map<number, [number, number, number]>();

/** The renderer's per-seed texture-space offset (a seed slides the pattern through the noise). */
export function seedOffset(seed: number): [number, number, number] {
  const s = Number.isFinite(seed) ? Math.floor(seed) : 0;
  let o = offsets.get(s);
  if (!o) {
    const r = mulberry32(s ^ 0x5bd1e995);
    o = [r() * 32, r() * 32, r() * 32];
    if (offsets.size > 256) offsets.clear();
    offsets.set(s, o);
  }
  return o;
}

/** Options for evaluation; maxOctaves lowers detail for tiny thumbnails. */
export interface EvalOptions {
  maxOctaves?: number;
}

/**
 * Evaluate a component at a surface point given in world and object space.
 * Returns the component value n(p) in 0..1 (what drives value channels and indexes the gradient).
 */
export function evalComponent(
  c: TextureComponent,
  wx: number, wy: number, wz: number,
  ox: number, oy: number, oz: number,
  options: EvalOptions = {},
): number {
  let x: number;
  let y: number;
  let z: number;
  switch (c.mapping) {
    case 'object': x = ox; y = oy; z = oz; break;
    case 'worldTop': x = wx; y = 0; z = wz; break;
    case 'objectTop': x = ox; y = 0; z = oz; break;
    case 'spherical': {
      const l = Math.hypot(ox, oy, oz);
      if (l > 1e-5) {
        x = ox / l;
        y = oy / l;
        z = oz / l;
      } else {
        x = 0;
        y = 1;
        z = 0;
      }
      break;
    }
    default: x = wx; y = wy; z = wz;
  }
  const inv = 1 / Math.max(1e-3, Math.abs(Number.isFinite(c.scale) ? c.scale : 4));
  const [sx, sy, sz] = seedOffset(c.seed);
  x = x * inv + sx;
  y = y * inv + sy;
  z = z * inv + sz;
  const octaves = Math.max(1, Math.min(Math.round(Number.isFinite(c.octaves) ? c.octaves : 6), options.maxOctaves ?? 10, 10));
  const rough = clamp01(Number.isFinite(c.roughness) ? c.roughness : 0.5);
  const warp = clamp01(Number.isFinite(c.warp) ? c.warp : 0);
  if (warp > 0) {
    const k = warp * 3;
    const wx1 = noise3(x * 0.5 + 11.3, y * 0.5 + 11.3, z * 0.5 + 11.3, 0) - 0.5 + (noise3(x * 1.13 + 4.1, y * 1.13 + 4.1, z * 1.13 + 4.1, 0) - 0.5) * 0.35;
    const wy1 = noise3(x * 0.5 + 11.3, y * 0.5 + 11.3, z * 0.5 + 11.3, 1) - 0.5 + (noise3(x * 1.13 + 4.1, y * 1.13 + 4.1, z * 1.13 + 4.1, 1) - 0.5) * 0.35;
    const wz1 = noise3(x * 0.5 + 11.3, y * 0.5 + 11.3, z * 0.5 + 11.3, 2) - 0.5 + (noise3(x * 1.13 + 4.1, y * 1.13 + 4.1, z * 1.13 + 4.1, 2) - 0.5) * 0.35;
    x += wx1 * k;
    y += wy1 * k;
    z += wz1 * k;
  }
  return shapeValue(patternValue(c.type, x, y, z, octaves, rough), c.contrast, c.bias);
}

/** Sample a component gradient (stops sorted by `at`) into out (sRGB 0..1). */
export function sampleGradient(gradient: TextureComponent['gradient'], t: number, out: RGB = [0, 0, 0]): RGB {
  const n = gradient.length;
  if (n === 0) {
    out[0] = out[1] = out[2] = t;
    return out;
  }
  const first = gradient[0];
  const last = gradient[n - 1];
  if (n === 1 || t <= first.at) {
    out[0] = first.color[0];
    out[1] = first.color[1];
    out[2] = first.color[2];
    return out;
  }
  if (t >= last.at) {
    out[0] = last.color[0];
    out[1] = last.color[1];
    out[2] = last.color[2];
    return out;
  }
  for (let i = 1; i < n; i++) {
    const b = gradient[i];
    if (t <= b.at) {
      const a = gradient[i - 1];
      const span = b.at - a.at;
      const k = span > 1e-6 ? (t - a.at) / span : 1;
      out[0] = a.color[0] + (b.color[0] - a.color[0]) * k;
      out[1] = a.color[1] + (b.color[1] - a.color[1]) * k;
      out[2] = a.color[2] + (b.color[2] - a.color[2]) * k;
      return out;
    }
  }
  out[0] = last.color[0];
  out[1] = last.color[1];
  out[2] = last.color[2];
  return out;
}

/**
 * The value field of a component over its 2D swatch window, size x size samples.
 * - world / object: a vertical slice through the texture (shows strata bands).
 * - worldTop / objectTop: seen from above.
 * - spherical: a longitude / latitude unwrap.
 * World mappings show an 8-unit window, object mappings the object's [-1, 1] extent.
 */
export function componentField(c: TextureComponent, size: number, options: EvalOptions = {}): Float32Array {
  const field = new Float32Array(size * size);
  const isWorld = c.mapping === 'world' || c.mapping === 'worldTop';
  const top = c.mapping === 'worldTop' || c.mapping === 'objectTop';
  const half = isWorld ? 4 : 1;
  // Pretend the object is a default 4-unit primitive at the origin (half-extent 2).
  const objScale = 2;
  for (let j = 0; j < size; j++) {
    const v = 1 - ((j + 0.5) / size) * 2;
    for (let i = 0; i < size; i++) {
      const u = ((i + 0.5) / size) * 2 - 1;
      let ox: number;
      let oy: number;
      let oz: number;
      if (c.mapping === 'spherical') {
        const lon = u * Math.PI;
        const lat = v * Math.PI * 0.5;
        ox = Math.cos(lat) * Math.sin(lon);
        oy = Math.sin(lat);
        oz = Math.cos(lat) * Math.cos(lon);
      } else if (top) {
        ox = (u * half) / (isWorld ? objScale : 1);
        oy = 0.25;
        oz = (-v * half) / (isWorld ? objScale : 1);
      } else {
        ox = (u * half) / (isWorld ? objScale : 1);
        oy = (v * half) / (isWorld ? objScale : 1);
        oz = 0.37;
      }
      field[j * size + i] = evalComponent(c, ox * objScale, oy * objScale, oz * objScale, ox, oy, oz, options);
    }
  }
  return field;
}

export type SwatchMode = 'color' | 'alpha' | 'bump';

/**
 * Turn a component field into RGBA pixels: the gradient colors, the grayscale value
 * ("alpha" output in Bryce terms) or a lit relief of the bump output.
 */
export function fieldToPixels(c: TextureComponent, field: Float32Array, size: number, mode: SwatchMode, out?: Uint8ClampedArray<ArrayBuffer>): Uint8ClampedArray<ArrayBuffer> {
  const data = out ?? new Uint8ClampedArray(size * size * 4);
  const rgb: RGB = [0, 0, 0];
  const relief = (c.bump >= 0 ? 1 : -1) * Math.max(0.25, Math.abs(c.bump)) * size * 0.9;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const n = field[k];
      let r: number;
      let g: number;
      let b: number;
      if (mode === 'color') {
        sampleGradient(c.gradient, n, rgb);
        r = rgb[0];
        g = rgb[1];
        b = rgb[2];
      } else if (mode === 'alpha') {
        r = g = b = n;
      } else {
        const nx = field[j * size + Math.min(i + 1, size - 1)] - field[j * size + Math.max(i - 1, 0)];
        const ny = field[Math.min(j + 1, size - 1) * size + i] - field[Math.max(j - 1, 0) * size + i];
        // Light from the upper left.
        const shade = 0.62 + relief * (-nx * 0.5 + ny * 0.5) / size;
        r = g = b = clamp01(shade);
      }
      data[k * 4] = r * 255;
      data[k * 4 + 1] = g * 255;
      data[k * 4 + 2] = b * 255;
      data[k * 4 + 3] = 255;
    }
  }
  return data;
}
