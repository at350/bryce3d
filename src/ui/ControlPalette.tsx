/**
 * Left Control palette: Nano Preview, memory dots, view control, camera controls, render
 * controls and the Text Display Area. NOTE: foundation version; the ui owner restyles it.
 */
import { useEffect, useRef } from 'react';
import { advance, editActiveCamera, moveAxis, orbit } from '@/core/cameraOps';
import { useStore } from '@/core/store';
import type { ViewMode } from '@/core/types';
import { getRenderer } from '@/render';
import { CrossControl, Icon3D, IconButton, MemoryDots, Trackball, TriangleMenu } from '@/ui/kit';
import { TextDisplay } from './TextDisplay';

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'camera', label: 'Camera View' },
  { id: 'director', label: "Director's View" },
  { id: 'top', label: 'Top View' },
  { id: 'bottom', label: 'Bottom View' },
  { id: 'left', label: 'Left View' },
  { id: 'right', label: 'Right View' },
  { id: 'front', label: 'Front View' },
  { id: 'back', label: 'Back View' },
];

function NanoPreview() {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useStore((s) => s.scene);
  const nanoMode = useStore((s) => s.ui.nanoMode);
  const autoNano = useStore((s) => s.ui.autoNano);
  useEffect(() => {
    if (!autoNano || !ref.current) return;
    const canvas = ref.current;
    const t = setTimeout(() => {
      void getRenderer().preview(scene, canvas, { width: canvas.width, height: canvas.height, quality: 'nano', skyOnly: nanoMode === 'sky', key: 'nano' });
    }, 120);
    return () => clearTimeout(t);
  }, [scene, nanoMode, autoNano]);
  return (
    <div className="nano">
      <canvas ref={ref} width={160} height={120} className="nano__canvas" />
      <TriangleMenu
        hint="Nano Preview options"
        items={[
          { label: 'Scene', checked: nanoMode === 'scene', onSelect: () => useStore.getState().setUI({ nanoMode: 'scene' }) },
          { label: 'Sky only', checked: nanoMode === 'sky', onSelect: () => useStore.getState().setUI({ nanoMode: 'sky' }) },
          { divider: true, label: '' },
          { label: 'Auto update', checked: autoNano, onSelect: () => useStore.getState().setUI({ autoNano: !autoNano }) },
        ]}
      />
    </div>
  );
}

export function ControlPalette() {
  const view = useStore((s) => s.ui.view);
  const memories = useStore((s) => s.ui.cameraMemories);
  const s = useStore.getState();
  const gesture = { onStart: () => useStore.getState().beginGesture(), onEnd: () => useStore.getState().endGesture() };
  const step = 0.08;
  return (
    <aside className="control-palette">
      <NanoPreview />
      <MemoryDots
        count={4}
        filled={memories.map(Boolean)}
        hint="Camera memory"
        onSave={(i) => {
          const m = [...useStore.getState().ui.cameraMemories];
          m[i] = useStore.getState().scene.camera;
          s.setUI({ cameraMemories: m });
        }}
        onRecall={(i) => {
          const c = useStore.getState().ui.cameraMemories[i];
          if (c) s.setCamera(c);
        }}
        onClear={(i) => {
          const m = [...useStore.getState().ui.cameraMemories];
          m[i] = null;
          s.setUI({ cameraMemories: m });
        }}
      />
      <div className="view-control">
        <IconButton
          hint={VIEWS.find((v) => v.id === view)?.label ?? 'View'}
          size={56}
          onClick={() => {
            const i = VIEWS.findIndex((v) => v.id === view);
            s.setUI({ view: VIEWS[(i + 1) % VIEWS.length].id });
          }}
        >
          <Icon3D kind={view === 'camera' ? 'camera' : 'director'} size={44} />
        </IconButton>
        <TriangleMenu hint="Views" items={VIEWS.map((v) => ({ label: v.label, checked: v.id === view, onSelect: () => s.setUI({ view: v.id }) }))} />
      </div>
      <div className="camera-crosses">
        <CrossControl plane="xz" hint="Move camera along X and Z" {...gesture} onDrag={(a, b) => editActiveCamera((c) => moveAxis(moveAxis(c, 0, a * step), 2, -b * step))} />
        <CrossControl plane="xy" hint="Move camera along X and Y" {...gesture} onDrag={(a, b) => editActiveCamera((c) => moveAxis(moveAxis(c, 0, a * step), 1, b * step))} />
        <CrossControl plane="zy" hint="Move camera forward and up" {...gesture} onDrag={(a, b) => editActiveCamera((c) => moveAxis(advance(c, a * step), 1, b * step))} />
      </div>
      <Trackball hint="Camera Trackball: drag to orbit" size={78} {...gesture} onDrag={(dx, dy) => editActiveCamera((c) => orbit(c, -dx * 0.5, dy * 0.5))} />
      <div className="render-controls">
        <IconButton hint="Resume Render" size={30} onClick={() => getRenderer().resume()}>
          <Icon3D kind="renderResume" size={22} />
        </IconButton>
        <IconButton hint="Render" size={52} onClick={() => getRenderer().start(useStore.getState().scene)}>
          <Icon3D kind="render" size={44} />
        </IconButton>
        <IconButton hint="Clear and Render" size={30} onClick={() => { getRenderer().clear(); getRenderer().start(useStore.getState().scene); }}>
          <Icon3D kind="renderClear" size={22} />
        </IconButton>
        <TriangleMenu hint="Render options" items={[{ label: 'Render Settings…', onSelect: () => s.openDialog('renderSettings') }]} />
      </div>
      <TextDisplay />
    </aside>
  );
}
