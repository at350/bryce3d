import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useStore } from './core/store';
import { bootScene } from './io/boot';
import { getRenderer } from './render';
import './styles/app.css';
import './ui/kit/kit.css';

bootScene();

// Debug/automation handle (used by scripts/shot.mjs and handy in the console).
(window as unknown as { __bryce: unknown }).__bryce = { store: useStore, renderer: getRenderer() };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
