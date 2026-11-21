/** Decide the scene the app opens with. Called once from main.tsx before the first render. */
import { useStore } from '@/core/store';
import { startAutosave } from './autosave';
import { decodeShareHash } from './share';

export function bootScene(): void {
  const shared = decodeShareHash(location.hash);
  if (shared) {
    useStore.getState().loadScene(shared);
    history.replaceState(null, '', location.pathname + location.search);
  }
  startAutosave();
}
