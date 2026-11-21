/**
 * Scene <-> JSON. NOTE: foundation version (terrain heights as base64 Float32); the scenes
 * owner hardens validation/migration, keeping these signatures.
 */
import type { Scene, SceneObject } from '@/core/types';

function f32ToBase64(a: Float32Array): string {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function base64ToF32(b64: string): Float32Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

/** JSON text for a .bryce.json file. */
export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene, (key, value) => {
    if (key === 'heights' && value instanceof Float32Array) return { f32: f32ToBase64(value) };
    return value;
  });
}

/** Parse a .bryce.json file. Throws a readable Error when the text is not a scene. */
export function deserializeScene(text: string): Scene {
  const raw = JSON.parse(text, (key, value) => {
    if (key === 'heights' && value && typeof value.f32 === 'string') return base64ToF32(value.f32);
    return value;
  });
  if (!raw || raw.version !== 1 || !Array.isArray(raw.objects)) throw new Error('This file is not a Bryce 3D Web scene.');
  raw.objects = raw.objects as SceneObject[];
  return raw as Scene;
}
