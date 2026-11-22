/**
 * Nano Preview: a tiny live render of the scene (renderer.preview, key 'nano'), refreshed
 * ~120 ms after any change. With Auto-Update off it refreshes when you point at it or
 * click it, like Bryce. The camera-memory dots sit to its left.
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import type { CameraState } from '@/core/types';
import { getRenderer } from '@/render';
import { TriangleMenu, useHint, type MenuItem } from '@/ui/kit';

type NanoCamera = 'camera' | 'director' | 'current';

export function NanoPreview() {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useStore((s) => s.scene);
  const view = useStore((s) => s.ui.view);
  const director = useStore((s) => s.ui.directorCamera);
  const nanoMode = useStore((s) => s.ui.nanoMode);
  const autoNano = useStore((s) => s.ui.autoNano);
  const [nanoCamera, setNanoCamera] = useState<NanoCamera>('camera');
  const [quality, setQuality] = useState<'nano' | 'preview'>('nano');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const lastTick = useRef(-1);
  const renderer = getRenderer();
  const supported = renderer.supported;

  const useDirector = nanoCamera === 'director' || (nanoCamera === 'current' && view === 'director');
  const camera: CameraState | undefined = useDirector ? director : undefined;

  useEffect(() => {
    const manual = tick !== lastTick.current;
    lastTick.current = tick;
    const canvas = ref.current;
    if ((!autoNano && !manual) || !canvas || !supported) return;
    let live = true;
    const t = setTimeout(() => {
      setBusy(true);
      renderer
        .preview(scene, canvas, { width: canvas.width, height: canvas.height, quality, skyOnly: nanoMode === 'sky', camera, key: 'nano' })
        .catch(() => undefined)
        .finally(() => {
          if (live) setBusy(false);
        });
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [scene, nanoMode, autoNano, quality, camera, tick, supported, renderer]);

  const setUI = useStore.getState().setUI;
  const items: MenuItem[] = [
    { label: 'Full Scene', checked: nanoMode === 'scene', onSelect: () => setUI({ nanoMode: 'scene' }) },
    { label: 'Sky Only', checked: nanoMode === 'sky', onSelect: () => setUI({ nanoMode: 'sky' }) },
    { divider: true, label: '' },
    { label: 'Auto-Update', checked: autoNano, onSelect: () => setUI({ autoNano: !autoNano }) },
    { divider: true, label: '' },
    { label: 'Camera View', checked: nanoCamera === 'camera', onSelect: () => setNanoCamera('camera') },
    { label: "Director's View", checked: nanoCamera === 'director', onSelect: () => setNanoCamera('director') },
    { label: 'Current View', checked: nanoCamera === 'current', onSelect: () => setNanoCamera('current') },
    { divider: true, label: '' },
    { label: 'Fast Preview', checked: quality === 'nano', onSelect: () => setQuality('nano') },
    { label: 'Better Preview', checked: quality === 'preview', onSelect: () => setQuality('preview') },
  ];
  const hint = useHint(
    !supported ? 'Nano Preview needs WebGL2' : autoNano ? 'Nano Preview: a live render of your scene (click to refresh)' : 'Nano Preview: point or click to refresh (Auto-Update is off)',
  );
  return (
    <div className="nano">
      <div
        className="nano__frame"
        role="button"
        tabIndex={0}
        aria-label="Nano Preview (click to refresh)"
        onClick={() => setTick((t) => t + 1)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setTick((t) => t + 1);
          }
        }}
        onPointerEnter={() => {
          hint.onPointerEnter();
          if (!autoNano) setTick((t) => t + 1);
        }}
        onPointerLeave={hint.onPointerLeave}
      >
        <canvas ref={ref} width={160} height={120} className="nano__canvas" />
        {busy && <span className="nano__busy" aria-hidden="true" />}
        {!supported && <span className="nano__off">Preview needs WebGL2</span>}
      </div>
      <TriangleMenu hint="Nano Preview options" items={items} />
    </div>
  );
}
