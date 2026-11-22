/**
 * Left Control palette: memory dots + Nano Preview, View Control, camera crosses and
 * trackball, render controls, and the Text Display Area at the bottom.
 */
import { getActiveCamera, setActiveCamera } from '@/core/cameraOps';
import { useStore } from '@/core/store';
import type { CameraState } from '@/core/types';
import { MemoryDots } from '@/ui/kit';
import { CameraControls, ViewControl } from './control/CameraControls';
import { NanoPreview } from './control/NanoPreview';
import { RenderControls } from './control/RenderControls';
import { TextDisplay } from './TextDisplay';

const MEMORY_COUNT = 6;

function CameraMemories() {
  const memories = useStore((s) => s.ui.cameraMemories);
  const write = (i: number, cam: CameraState | null) => {
    const m = [...useStore.getState().ui.cameraMemories];
    while (m.length < MEMORY_COUNT) m.push(null);
    m[i] = cam;
    useStore.getState().setUI({ cameraMemories: m });
  };
  return (
    <MemoryDots
      count={MEMORY_COUNT}
      filled={Array.from({ length: MEMORY_COUNT }, (_, i) => !!memories[i])}
      hint="Camera memory"
      onSave={(i) => {
        write(i, { ...(getActiveCamera() ?? useStore.getState().scene.camera) });
        useStore.getState().showStatus(`Camera stored in memory ${i + 1}`);
      }}
      onRecall={(i) => {
        const c = useStore.getState().ui.cameraMemories[i];
        if (!c) return;
        if (getActiveCamera()) setActiveCamera({ ...c });
        else useStore.getState().setCamera({ ...c });
      }}
      onClear={(i) => write(i, null)}
    />
  );
}

export function ControlPalette() {
  return (
    <aside className="control-palette" aria-label="Control palette">
      <div className="control-palette__zoom control-palette__main">
        <div className="nano-block">
          <CameraMemories />
          <NanoPreview />
        </div>
        <ViewControl />
        <CameraControls />
        <RenderControls />
      </div>
      <TextDisplay />
    </aside>
  );
}
