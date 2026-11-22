/**
 * Share links: the whole scene packed into the URL hash (#s=...). Nothing is uploaded.
 * Fractal terrains travel as their recipe (a few bytes); hand-made terrains as 8-bit
 * heights. Links made by the foundation version (full JSON) still open.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Scene } from '@/core/types';
import { deserializeSceneReport, normalizeSceneReport } from './serialize';
import { isPackedScene, packScene, unpackScene, type PackOptions } from './shareCodec';

export interface ShareOptions extends PackOptions {
  /** Page URL the hash is appended to (default: this page). */
  base?: string;
}

/** Links longer than this may be cut by some chat apps and mail clients. */
export const SHARE_WARN_CHARS = 8 * 1024;
/** Links longer than this may not open in every browser or app. */
export const SHARE_LIMIT_CHARS = 32 * 1024;

const DAMAGED = 'This share link is damaged or incomplete.';

export function shareBaseUrl(): string {
  return `${location.origin}${location.pathname}`;
}

/** The compressed scene that follows "#s=". */
export function encodeSharePayload(scene: Scene, options: PackOptions = {}): string {
  return compressToEncodedURIComponent(JSON.stringify(packScene(scene, options)));
}

/** Full URL that opens this scene. */
export function encodeShareLink(scene: Scene, options: ShareOptions = {}): string {
  return `${options.base ?? shareBaseUrl()}#s=${encodeSharePayload(scene, options)}`;
}

export type ShareReadResult = { scene: Scene; warnings: string[] } | { error: string };

function payloadOf(hash: string): string | null {
  const m = hash.match(/[#&?]s=([^&]+)/);
  if (!m) return null;
  let p = m[1];
  if (p.includes('%')) {
    try {
      p = decodeURIComponent(p);
    } catch {
      // keep the raw text; decompression will report it as damaged
    }
  }
  return p.replace(/ /g, '+');
}

export function hasShareHash(hash: string): boolean {
  return payloadOf(hash) !== null;
}

/** Decode a "#s=" payload into a scene (with repair warnings) or a readable error. */
export function decodeSharePayload(payload: string): ShareReadResult {
  let text: string | null;
  try {
    text = decompressFromEncodedURIComponent(payload);
  } catch {
    text = null;
  }
  if (!text) return { error: DAMAGED };
  try {
    const raw: unknown = JSON.parse(text);
    if (isPackedScene(raw)) return normalizeSceneReport(unpackScene(raw));
    return deserializeSceneReport(text);
  } catch (e) {
    return { error: e instanceof SyntaxError ? DAMAGED : e instanceof Error ? e.message : DAMAGED };
  }
}

/** The shared scene in a location hash: null when there is none, else the scene or an error. */
export function readShareHash(hash: string): ShareReadResult | null {
  const payload = payloadOf(hash);
  return payload === null ? null : decodeSharePayload(payload);
}

/** The scene in a location hash, or null if there is none / it is invalid. */
export function decodeShareHash(hash: string): Scene | null {
  const r = readShareHash(hash);
  return r && 'scene' in r ? r.scene : null;
}
