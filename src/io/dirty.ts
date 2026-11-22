/**
 * "Unsaved changes" tracking for the scene: a scene is clean right after it was loaded
 * or saved, and becomes dirty once it is edited (undoing back to it makes it clean again).
 */
import { useStore } from '@/core/store';
import type { Scene } from '@/core/types';

let cleanScene: Scene | null = null;

/** Remember the current (or given) scene as saved/loaded. */
export function markClean(scene: Scene = useStore.getState().scene): void {
  cleanScene = scene;
}

/** True when the scene has edits worth protecting (not just a fresh or untouched load). */
export function hasUnsavedChanges(): boolean {
  const s = useStore.getState();
  if (s.scene === cleanScene || !s.past.length) return false;
  // a near-empty scene (File > New is just a ground plane) has nothing worth protecting
  return s.scene.objects.length > 1;
}
