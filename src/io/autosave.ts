/** Debounced autosave of the current scene to localStorage. */
import { useStore } from '@/core/store';
import type { Scene } from '@/core/types';
import { deserializeScene, serializeScene } from './serialize';

const KEY = 'bryce3d-web:autosave';

export function loadAutosave(): Scene | null {
  try {
    const text = localStorage.getItem(KEY);
    return text ? deserializeScene(text) : null;
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

let started = false;

/** Begin saving the scene ~1 s after each change. Safe to call more than once. */
export function startAutosave(): void {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe(
    (s) => s.scene,
    (scene) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(KEY, serializeScene(scene));
        } catch {
          // quota exceeded or storage unavailable: autosave is best-effort
        }
      }, 1000);
    },
  );
}
