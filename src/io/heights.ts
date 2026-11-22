/**
 * Text codecs for terrain heights.
 * - base64 Float32 / Uint16 (little-endian) for scene files and autosave;
 * - a predictive 8-bit codec for share links: heights are quantized to 0..255, each sample
 *   is predicted from its left/up neighbours and only the small residual is stored as one
 *   character, which lz-string then compresses very well for smooth terrains.
 */
import { clamp } from '@/core/math';

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export function f32ToBase64(a: Float32Array): string {
  const view = new DataView(new ArrayBuffer(a.length * 4));
  for (let i = 0; i < a.length; i++) view.setFloat32(i * 4, a[i], true);
  return bytesToBase64(new Uint8Array(view.buffer));
}

export function base64ToF32(b64: string): Float32Array {
  const bytes = base64ToBytes(b64);
  if (bytes.length % 4) throw new Error('Float32 height data has a bad length.');
  const view = new DataView(bytes.buffer);
  const out = new Float32Array(bytes.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

/** Heights (0..1) quantized to 16 bits: plenty for rendering, half the size of Float32. */
export function heightsToU16Base64(h: Float32Array): string {
  const view = new DataView(new ArrayBuffer(h.length * 2));
  for (let i = 0; i < h.length; i++) view.setUint16(i * 2, Math.round(clamp(h[i] || 0, 0, 1) * 65535), true);
  return bytesToBase64(new Uint8Array(view.buffer));
}

export function u16Base64ToHeights(b64: string): Float32Array {
  const bytes = base64ToBytes(b64);
  if (bytes.length % 2) throw new Error('Uint16 height data has a bad length.');
  const view = new DataView(bytes.buffer);
  const out = new Float32Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getUint16(i * 2, true) / 65535;
  return out;
}

/** 8-bit predictive heights: grid size n, value range lo..hi, residual characters d. */
export interface Heights8 {
  n: number;
  lo: number;
  hi: number;
  d: string;
}

/** First residual character code: above Latin-1 punctuation so JSON never escapes it. */
const BASE = 0xa1;

const predict = (q: Uint8Array, n: number, x: number, z: number): number => {
  if (x === 0 && z === 0) return 0;
  if (z === 0) return q[x - 1];
  if (x === 0) return q[(z - 1) * n];
  const left = q[z * n + x - 1];
  const up = q[(z - 1) * n + x];
  const upLeft = q[(z - 1) * n + x - 1];
  return clamp(left + up - upLeft, 0, 255);
};

export function encodeHeights8(h: Float32Array, n: number): Heights8 {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < h.length; i++) {
    if (h[i] < lo) lo = h[i];
    if (h[i] > hi) hi = h[i];
  }
  if (!Number.isFinite(lo)) lo = hi = 0;
  lo = Math.floor(lo * 1e4) / 1e4;
  hi = Math.ceil(hi * 1e4) / 1e4;
  const span = hi - lo || 1;
  const q = new Uint8Array(n * n);
  const chars: string[] = new Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      q[i] = Math.round(clamp((h[i] - lo) / span, 0, 1) * 255);
      const r = q[i] - predict(q, n, x, z);
      chars[i] = String.fromCharCode(BASE + (r >= 0 ? 2 * r : -2 * r - 1));
    }
  }
  return { n, lo, hi, d: chars.join('') };
}

export function decodeHeights8(p: Heights8): Float32Array {
  const n = p.n;
  if (!Number.isInteger(n) || n < 2 || n > 1024 || typeof p.d !== 'string' || p.d.length !== n * n) throw new Error('Damaged terrain data.');
  const lo = Number.isFinite(p.lo) ? p.lo : 0;
  const hi = Number.isFinite(p.hi) ? p.hi : 1;
  const q = new Uint8Array(n * n);
  const out = new Float32Array(n * n);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = z * n + x;
      const zz = p.d.charCodeAt(i) - BASE;
      if (zz < 0 || zz > 510) throw new Error('Damaged terrain data.');
      const r = zz & 1 ? -(zz + 1) / 2 : zz / 2;
      q[i] = clamp(predict(q, n, x, z) + r, 0, 255);
      out[i] = lo + (q[i] / 255) * (hi - lo);
    }
  }
  return out;
}
