/** File download/upload helpers for scenes and renders, plus drag-and-drop opening. */
import { useStore } from '@/core/store';
import type { Scene } from '@/core/types';
import { getRenderer } from '@/render';
import { markClean } from './dirty';
import { deserializeScene, deserializeSceneReport, serializeScene } from './serialize';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeName = (name: string) => (name.trim() || 'Untitled').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-') || 'Untitled';

/** Save the scene as <name>.bryce.json. */
export function downloadScene(scene: Scene): void {
  download(new Blob([serializeScene(scene)], { type: 'application/json' }), `${safeName(scene.name)}.bryce.json`);
  markClean(scene);
}

/** Ask the user for a .bryce.json file; resolves with the scene, or null if cancelled. Rejects on invalid files. */
export function openSceneFile(): Promise<Scene | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.bryce.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const scene = deserializeScene(await file.text());
        markClean(scene);
        resolve(scene);
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}

/** Download the current render as PNG. Returns false when there is no render yet. */
export async function downloadRenderPNG(): Promise<boolean> {
  const blob = await getRenderer().exportPNG();
  if (!blob) return false;
  download(blob, `${safeName(useStore.getState().scene.name)}.png`);
  return true;
}

/** Load a scene into the editor as an undoable step and report what happened. */
export function openSceneInEditor(scene: Scene, warnings: string[] = [], verb = 'Opened'): void {
  const s = useStore.getState();
  s.loadScene(scene, { keepHistory: true });
  markClean(scene);
  const note = warnings.length ? ` (${warnings[0]}${warnings.length > 1 ? ` +${warnings.length - 1} more` : ''})` : '';
  s.showStatus(`${verb} "${scene.name}"${note}`);
}

// --- drag and drop -----------------------------------------------------------------

const OVERLAY_STYLE =
  'position:fixed;inset:0;z-index:10000;display:grid;place-items:center;pointer-events:none;' +
  'background:rgba(12,14,24,0.55);backdrop-filter:blur(2px);font-family:system-ui,-apple-system,sans-serif';
const CARD_STYLE =
  'display:grid;gap:4px;text-align:center;padding:20px 34px;border-radius:14px;color:#24262b;' +
  'background:linear-gradient(#f6f7f9,#c6c9cf);border:1px solid rgba(255,255,255,0.8);' +
  'box-shadow:0 18px 50px rgba(0,0,0,0.5),inset 0 1px 0 #fff';

let dropInstalled = false;

/**
 * Open .bryce.json files dropped anywhere on the window. Other drops are left to the
 * element that handles them (e.g. a lab's picture well); stray file drops never navigate
 * the page away from the user's scene.
 */
export function installDropOpen(): () => void {
  if (dropInstalled || typeof window === 'undefined') return () => {};
  dropInstalled = true;
  let overlay: HTMLDivElement | null = null;
  let depth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
  const labOpen = () => !!useStore.getState().ui.lab;
  const hide = () => {
    overlay?.remove();
    overlay = null;
    depth = 0;
  };
  const show = () => {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.setAttribute('style', OVERLAY_STYLE);
    overlay.setAttribute('aria-hidden', 'true');
    const card = document.createElement('div');
    card.setAttribute('style', CARD_STYLE);
    const title = document.createElement('strong');
    title.textContent = 'Drop to open the scene';
    title.style.fontSize = '16px';
    const sub = document.createElement('span');
    sub.textContent = '.bryce.json files open as an undoable step';
    sub.style.cssText = 'font-size:12px;color:#5b5e66';
    card.append(title, sub);
    overlay.append(card);
    document.body.append(overlay);
  };
  const onEnter = (e: DragEvent) => {
    if (!hasFiles(e) || labOpen()) return;
    depth++;
    show();
  };
  const onOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer && !e.defaultPrevented) e.dataTransfer.dropEffect = labOpen() ? 'none' : 'copy';
  };
  const onLeave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) hide();
  };
  const onDrop = async (e: DragEvent) => {
    if (!hasFiles(e)) return;
    const handled = e.defaultPrevented;
    e.preventDefault();
    hide();
    if (handled || labOpen()) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    const file = files.find((f) => /\.json$/i.test(f.name) || f.type === 'application/json');
    const s = useStore.getState();
    if (!file) {
      s.showStatus('Drop a .bryce.json scene file to open it.');
      return;
    }
    try {
      const { scene, warnings } = deserializeSceneReport(await file.text());
      openSceneInEditor(scene, warnings);
    } catch (err) {
      s.showStatus(err instanceof Error ? err.message : 'That file could not be opened.');
    }
  };
  window.addEventListener('dragenter', onEnter);
  window.addEventListener('dragover', onOver);
  window.addEventListener('dragleave', onLeave);
  window.addEventListener('drop', onDrop);
  return () => {
    window.removeEventListener('dragenter', onEnter);
    window.removeEventListener('dragover', onOver);
    window.removeEventListener('dragleave', onLeave);
    window.removeEventListener('drop', onDrop);
    hide();
    dropInstalled = false;
  };
}
