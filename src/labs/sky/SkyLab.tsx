/** The Sky Lab room. NOTE: foundation stub; the sky owner builds the real lab. */
import { useState } from 'react';
import { useStore } from '@/core/store';
import { LabFrame, Slider } from '@/ui/kit';

export function SkyLab() {
  const [sky, setSky] = useState(() => useStore.getState().scene.sky);
  const close = () => useStore.getState().closeLab();
  const confirm = () => {
    useStore.getState().setSky(sky);
    close();
  };
  return (
    <LabFrame title="Sky Lab" onConfirm={confirm} onCancel={close}>
      <div style={{ padding: 24, display: 'grid', gap: 8 }}>
        <Slider label="Sun altitude" value={sky.sunAltitude} min={-90} max={90} onChange={(v) => setSky({ ...sky, sunAltitude: v })} />
        <Slider label="Haze" value={sky.haze} min={0} max={100} onChange={(v) => setSky({ ...sky, haze: v })} />
      </div>
    </LabFrame>
  );
}
