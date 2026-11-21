/** Render settings dialog. NOTE: foundation version; the ui owner completes it. */
import { useStore } from '@/core/store';
import type { RenderQuality } from '@/core/types';
import { Dialog, Select, Slider, Toggle } from '@/ui/kit';

export function RenderSettingsDialog() {
  const r = useStore((s) => s.scene.render);
  const set = useStore((s) => s.setRenderSettings);
  return (
    <Dialog title="Render Settings" onClose={() => useStore.getState().closeDialog()}>
      <div style={{ display: 'grid', gap: 8 }}>
        <Select
          label="Quality"
          value={r.quality}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'normal', label: 'Normal' },
            { value: 'premium', label: 'Premium' },
          ]}
          onChange={(v) => set({ quality: v as RenderQuality })}
        />
        <Slider label="Samples" value={r.samples} min={1} max={256} step={1} onChange={(v) => set({ samples: v })} />
        <Slider label="Max bounces" value={r.maxBounces} min={1} max={12} step={1} onChange={(v) => set({ maxBounces: v })} />
        <Toggle label="Mosaic passes" value={r.mosaic} onChange={(v) => set({ mosaic: v })} />
      </div>
    </Dialog>
  );
}
