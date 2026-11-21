/** File download/upload helpers for scenes and renders. */
import { useStore } from '@/core/store';
import type { Scene } from '@/core/types';
import { getRenderer } from '@/render';
import { deserializeScene, serializeScene } from './serialize';

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

const safeName = (name: string) => (name.trim() || 'Untitled').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-');

/** Save the scene as <name>.bryce.json. */
export function downloadScene(scene: Scene): void {
  download(new Blob([serializeScene(scene)], { type: 'application/json' }), `${safeName(scene.name)}.bryce.json`);
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
        resolve(deserializeScene(await file.text()));
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
