/**
 * Share links: the scene compressed into the URL hash (#s=...).
 * NOTE: foundation version; the scenes owner makes links compact (terrain recipes,
 * downsampled heights) keeping these signatures.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Scene } from '@/core/types';
import { deserializeScene, serializeScene } from './serialize';

/** Full URL that opens this scene. */
export function encodeShareLink(scene: Scene): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#s=${compressToEncodedURIComponent(serializeScene(scene))}`;
}

/** The scene in a location hash, or null if there is none / it is invalid. */
export function decodeShareHash(hash: string): Scene | null {
  const m = hash.match(/[#&]s=([^&]+)/);
  if (!m) return null;
  try {
    const text = decompressFromEncodedURIComponent(m[1]);
    return text ? deserializeScene(text) : null;
  } catch {
    return null;
  }
}
