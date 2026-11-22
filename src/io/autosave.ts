/**
 * Autosave of the current scene to localStorage: debounced (with a max wait so long edits
 * still save), skipped when nothing changed, flushed when the page is hidden, and
 * size-guarded: the lossless format is tried first, then a compact one, then it pauses
 * with a message instead of failing silently.
 */
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { useStore } from '@/core/store';
import type { Scene } from '@/core/types';
import { deserializeScene, normalizeScene, serializeScene } from './serialize';
import { packScene, unpackScene } from './shareCodec';

const KEY = 'bryce3d-web:autosave';
/** localStorage holds ~5M characters per origin; leave room for preferences. */
const MAX_CHARS = 4_000_000;
const COMPACT_PREFIX = 'lz1:';
const DEBOUNCE_MS = 800;
const MAX_WAIT_MS = 4000;

export function loadAutosave(): Scene | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    if (text.startsWith(COMPACT_PREFIX)) {
      const json = decompressFromUTF16(text.slice(COMPACT_PREFIX.length));
      return json ? normalizeScene(unpackScene(JSON.parse(json))) : null;
    }
    return deserializeScene(text);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable
  }
}

/** Store a scene, falling back to the compact encoding when the full one is too large. */
export function writeAutosave(scene: Scene): boolean {
  const encodings = [
    () => serializeScene(scene, { heights: 'u16' }),
    () => COMPACT_PREFIX + compressToUTF16(JSON.stringify(packScene(scene, { terrainDetail: 1024 }))),
  ];
  for (const encode of encodings) {
    try {
      const text = encode();
      if (text.length > MAX_CHARS) continue;
      localStorage.setItem(KEY, text);
      return true;
    } catch {
      // quota exceeded or storage unavailable: try the next encoding
    }
  }
  return false;
}

let started = false;
let pending: Scene | null = null;
let lastSaved: Scene | null = null;
let firstPendingAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let warned = false;

/** Save any pending change right now. */
export function flushAutosave(): void {
  clearTimeout(timer);
  firstPendingAt = 0;
  const scene = pending;
  pending = null;
  if (!scene || scene === lastSaved) return;
  if (writeAutosave(scene)) {
    lastSaved = scene;
    warned = false;
  } else if (!warned) {
    warned = true;
    useStore.getState().showStatus('Autosave paused: this scene is too big for browser storage. Use File > Save.');
  }
}

function schedule(scene: Scene) {
  pending = scene;
  const now = Date.now();
  if (!firstPendingAt) firstPendingAt = now;
  clearTimeout(timer);
  timer = setTimeout(flushAutosave, now - firstPendingAt >= MAX_WAIT_MS ? 0 : DEBOUNCE_MS);
}

/** Begin saving the scene shortly after each change. Safe to call more than once. */
export function startAutosave(): void {
  if (started) return;
  started = true;
  lastSaved = useStore.getState().scene;
  useStore.subscribe((s) => s.scene, schedule);
  window.addEventListener('pagehide', flushAutosave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAutosave();
  });
}
