/** Dev-only harness: the Working window on its own (not part of the production build). */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useStore } from '@/core/store';
import type { ViewMode } from '@/core/types';
import { getRenderer } from '@/render';
import { frameSelection, resetView, toggleDepthCue, zoomView } from '@/viewport/commands';
import { Viewport } from '@/viewport/Viewport';

(window as unknown as { __bryce: unknown }).__bryce = { store: useStore, renderer: getRenderer() };

const bar = document.getElementById('bar')!;
const button = (label: string, fn: () => void) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = fn;
  bar.appendChild(b);
};
const views: ViewMode[] = ['camera', 'director', 'top', 'front', 'left'];
views.forEach((v) => button(v, () => useStore.getState().setUI({ view: v })));
button('wire/solid', () => {
  const s = useStore.getState();
  s.setUI({ display: s.ui.display === 'solid' ? 'wireframe' : 'solid' });
});
button('depth cue', toggleDepthCue);
button('frame', frameSelection);
button('+', () => zoomView(1.25));
button('-', () => zoomView(0.8));
button('reset', resetView);
button('render', () => getRenderer().start(useStore.getState().scene));
button('undo', () => useStore.getState().undo());
const hint = document.createElement('span');
hint.id = 'hint';
bar.appendChild(hint);
useStore.subscribe((s) => {
  hint.textContent = s.ui.hint || s.ui.status;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Viewport />
  </StrictMode>,
);
