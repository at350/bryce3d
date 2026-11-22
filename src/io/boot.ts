/**
 * Decide the scene the app opens with (called once from main.tsx before the first render):
 * a share link in the URL > the autosaved scene > the startup poster. "?fresh" (or "#new")
 * skips the autosave, handy for kiosks at events. Also starts autosave, drag-and-drop
 * opening and live share-link handling.
 */
import { useStore } from '@/core/store';
import type { Scene } from '@/core/types';
import { loadAutosave, startAutosave } from './autosave';
import { markClean } from './dirty';
import { installDropOpen } from './files';
import { hasShareHash, readShareHash } from './share';

const clearHash = () => history.replaceState(null, '', location.pathname + location.search);

/** Keep the share hash while the shared scene is untouched (a reload reopens it); drop it on the first edit. */
function clearHashOnFirstEdit(opened: Scene) {
  const unsubscribe = useStore.subscribe(
    (s) => s.scene,
    (scene) => {
      if (scene === opened) return;
      unsubscribe();
      if (hasShareHash(location.hash)) clearHash();
    },
  );
}

function openShared(hash: string, keepHistory: boolean): boolean {
  const result = readShareHash(hash);
  if (!result) return false;
  const s = useStore.getState();
  if ('error' in result) {
    s.showStatus(result.error);
    clearHash();
    return false;
  }
  s.loadScene(result.scene, { keepHistory });
  markClean(result.scene);
  s.showStatus(`Opened shared scene "${result.scene.name}"${result.warnings.length ? ` (${result.warnings[0]})` : ''}`);
  clearHashOnFirstEdit(result.scene);
  return true;
}

export function bootScene(): void {
  const s = useStore.getState();
  const fresh = new URLSearchParams(location.search).has('fresh') || location.hash === '#new';
  const opened = openShared(location.hash, false);
  if (!opened && !fresh) {
    const saved = loadAutosave();
    if (saved) {
      s.loadScene(saved);
      s.showStatus(`Welcome back: "${saved.name}" restored.`);
    }
  }
  if (location.hash === '#new') clearHash();
  markClean();
  startAutosave();
  installDropOpen();
  // a share link pasted into the address bar of an open tab only changes the hash
  window.addEventListener('hashchange', () => openShared(location.hash, true));
}
