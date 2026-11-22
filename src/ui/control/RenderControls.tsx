/** Render controls: the big glossy render ball (stop while rendering) with a progress ring, Resume, Clear & Render, and the options triangle. */
import { useStore } from '@/core/store';
import type { RenderQuality } from '@/core/types';
import { Icon3D, IconButton, TriangleMenu, type MenuItem } from '@/ui/kit';
import { clearAndRender, exportRender, resumeRender, toggleRender } from '../actions';

const QUALITIES: { id: RenderQuality; label: string }[] = [
  { id: 'draft', label: 'Draft (fast, no anti-aliasing)' },
  { id: 'normal', label: 'Normal' },
  { id: 'premium', label: 'Premium (soft and blurry effects)' },
];

const R = 33;
const CIRC = 2 * Math.PI * R;

export function RenderControls() {
  const status = useStore((s) => s.render.status);
  const fraction = useStore((s) => s.render.fraction);
  const quality = useStore((s) => s.scene.render.quality);
  const mosaic = useStore((s) => s.scene.render.mosaic);
  const rendering = status === 'rendering';
  const showRing = rendering || status === 'paused';
  const set = (patch: Parameters<ReturnType<typeof useStore.getState>['setRenderSettings']>[0]) => useStore.getState().setRenderSettings(patch);

  const items: MenuItem[] = [
    ...QUALITIES.map((q) => ({ label: q.label, checked: quality === q.id, onSelect: () => set({ quality: q.id }) })),
    { divider: true, label: '' },
    { label: 'Mosaic Passes', checked: mosaic, onSelect: () => set({ mosaic: !mosaic }) },
    { divider: true, label: '' },
    { label: 'Render Settings…', onSelect: () => useStore.getState().openDialog('renderSettings') },
    { label: 'Export Render as PNG', disabled: status === 'idle', onSelect: exportRender },
  ];

  return (
    <div className="render-block">
      <IconButton className="small-ball" hint={status === 'paused' ? 'Resume Render' : 'Resume Render (adds more passes)'} size={34} onClick={resumeRender}>
        <Icon3D kind="renderResume" size={30} />
      </IconButton>
      <div className="render-ball">
        <IconButton hint={rendering ? `Stop Render (${Math.round(fraction * 100)}%)` : 'Render (Ctrl+R)'} size={64} active={rendering} onClick={toggleRender}>
          <Icon3D kind={rendering ? 'stop' : 'render'} size={rendering ? 40 : 60} />
        </IconButton>
        {showRing && (
          <svg className="render-ball__ring" viewBox="0 0 70 70" aria-hidden="true">
            <circle className="track" cx="35" cy="35" r={R} />
            <circle className="bar" cx="35" cy="35" r={R} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - Math.min(1, Math.max(0, fraction)))} />
          </svg>
        )}
      </div>
      <IconButton className="small-ball" hint="Clear and Render (Ctrl+Alt+R)" size={34} onClick={clearAndRender}>
        <Icon3D kind="renderClear" size={30} />
      </IconButton>
      <TriangleMenu hint="Render options" items={items} />
    </div>
  );
}
