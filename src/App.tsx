import { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import type { Skin } from '@/core/types';
import { ControlPalette } from '@/ui/ControlPalette';
import { DialogHost } from '@/ui/dialogs/DialogHost';
import { DisplayPalette } from '@/ui/DisplayPalette';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { prefetchIcons, iconBucket } from '@/ui/icons/iconRenderer';
import type { IconKind } from '@/ui/icons/iconKinds';
import { LabHost } from '@/ui/LabHost';
import { computeUiZoom, getUiZoom, setUiZoom } from '@/ui/layoutScale';
import { LibraryBrowser } from '@/ui/library/LibraryBrowser';
import { MenuBar } from '@/ui/MenuBar';
import { TopPalette } from '@/ui/palettes/TopPalette';
import { SelectionPalette } from '@/ui/SelectionPalette';
import { installShortcuts } from '@/ui/shortcuts';
import { SmallScreenNotice } from '@/ui/SmallScreenNotice';
import { Splash } from '@/ui/Splash';
import { Viewport } from '@/viewport/Viewport';

const SKINS: Skin[] = ['bryce5', 'bryce2', 'bryce7'];

/** Icons people see next (Edit palette, view cycling), rendered while the app is idle. */
const PREFETCH: { kinds: IconKind[]; size: number }[] = [
  { kinds: ['materials', 'resize', 'rotate', 'reposition', 'align', 'randomize', 'editObject', 'editTerrain'], size: 50 },
  { kinds: ['duplicate', 'land', 'delete'], size: 22 },
  { kinds: ['viewDirector', 'viewTop', 'viewBottom', 'viewLeft', 'viewRight', 'viewFront', 'viewBack'], size: 64 },
];

function useUiZoomTracking(): number {
  const [zoom, setZoom] = useState(getUiZoom);
  useEffect(() => {
    const on = () => {
      const z = computeUiZoom(window.innerWidth, window.innerHeight);
      setUiZoom(z);
      setZoom(z);
    };
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return zoom;
}

export function App() {
  const skin = useStore((s) => s.ui.skin);
  const lab = useStore((s) => s.ui.lab);
  const library = useStore((s) => s.ui.library);
  const zoom = useUiZoomTracking();
  const [ready, setReady] = useState(false);
  const [intro, setIntro] = useState(false);

  useEffect(() => installShortcuts(), []);

  // Skin class and zoom live on <body> too, so popovers rendered in portals inherit them.
  useEffect(() => {
    const body = document.body;
    SKINS.forEach((k) => body.classList.toggle(`skin-${k}`, k === skin));
    body.style.setProperty('--ui-zoom', String(zoom));
  }, [skin, zoom]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      for (const p of PREFETCH) prefetchIcons(p.kinds, skin, iconBucket(p.size * dpr * zoom));
    }, 1500);
    return () => clearTimeout(t);
  }, [ready, skin, zoom]);

  return (
    <div className={`app skin-${skin}`} style={{ ['--ui-zoom' as string]: zoom }}>
      {!lab && <MenuBar introMs={intro ? 2600 : 0} />}
      <div className="desktop" hidden={!!lab}>
        <ErrorBoundary name="The Control palette" style={{ gridArea: 'control' }}>
          <ControlPalette />
        </ErrorBoundary>
        <ErrorBoundary name="The tool palette" style={{ gridArea: 'top' }}>
          <TopPalette />
        </ErrorBoundary>
        <main className="working-window" aria-label="Working window">
          <ErrorBoundary name="The Working window">
            <Viewport />
          </ErrorBoundary>
        </main>
        <ErrorBoundary name="Display" style={{ gridArea: 'display' }}>
          <DisplayPalette />
        </ErrorBoundary>
        <ErrorBoundary name="The Selection palette" style={{ gridArea: 'select' }}>
          <SelectionPalette />
        </ErrorBoundary>
      </div>
      <LabHost />
      <ErrorBoundary name="The library" variant="overlay" resetKey={library} onClose={() => useStore.getState().closeLibrary()}>
        <LibraryBrowser />
      </ErrorBoundary>
      <DialogHost />
      <Splash
        onDone={(shown) => {
          setReady(true);
          setIntro(shown);
        }}
      />
      <SmallScreenNotice />
    </div>
  );
}
