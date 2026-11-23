/** Render Settings: document size presets or a custom size (with constrain proportions), quality, samples, bounces, mosaic, exposure, anti-aliasing and softness. */
import { useState } from 'react';
import { useStore } from '@/core/store';
import type { RenderAntialias, RenderQuality } from '@/core/types';
import { Button, Dialog, DragValue, Slider, Toggle } from '@/ui/kit';
import { startRender } from '../actions';
import { aspectLabel, constrainSize, MAX_SIDE, MIN_SIDE, SIZE_GROUPS } from './renderSizes';

const QUALITY: { id: RenderQuality; label: string; note: string }[] = [
  { id: 'draft', label: 'Draft', note: 'One sample, hard shadows: fast test renders' },
  { id: 'normal', label: 'Normal', note: 'Mosaic passes, anti-aliasing and soft shadows' },
  { id: 'premium', label: 'Premium', note: 'Four times the samples, blurry reflections' },
];

const ANTIALIAS: { id: RenderAntialias; label: string; note: string }[] = [
  { id: 'edges', label: 'Edges only', note: "Like Bryce's Normal: extra samples go to edges only, so textures, fog and soft shadows keep their grain" },
  { id: 'full', label: 'Every pixel', note: "Like Bryce's Fine Art: every pixel gets every sample (slower)" },
];

export function RenderSettingsDialog() {
  const r = useStore((s) => s.scene.render);
  const set = useStore.getState().setRenderSettings;
  const [lock, setLock] = useState<number | null>(null);
  const close = () => useStore.getState().closeDialog();
  const gesture = { onStart: () => useStore.getState().beginGesture(), onEnd: () => useStore.getState().endGesture() };
  const mp = (r.width * r.height) / 1e6;
  const quality = QUALITY.find((q) => q.id === r.quality) ?? QUALITY[1];
  const antialias = ANTIALIAS.find((a) => a.id === r.antialias) ?? ANTIALIAS[1];

  return (
    <Dialog
      title="Render Settings"
      width={500}
      onClose={close}
      onConfirm={close}
      footer={
        <Button
          variant="primary"
          hint="Close and render now (Ctrl+R)"
          onClick={() => {
            close();
            startRender();
          }}
        >
          Render Now
        </Button>
      }
    >
      <div className="dlg-section">
        <h3 className="dlg-heading">Document size</h3>
        <div className="size-groups">
          {SIZE_GROUPS.map((g) => (
            <div key={g.title} className="size-group">
              <span className="size-group__title">{g.title}</span>
              {g.presets.map((p) => (
                <Button
                  key={p.label}
                  className="size-chip"
                  pressed={r.width === p.width && r.height === p.height}
                  hint={`Render at ${p.label}`}
                  onClick={() => {
                    set({ width: p.width, height: p.height });
                    if (lock) setLock(p.width / p.height);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          ))}
        </div>
        <div className="dlg-row">
          <DragValue
            label="Width"
            value={r.width}
            min={MIN_SIDE}
            max={MAX_SIDE}
            step={1}
            speed={2}
            width={120}
            unit=" px"
            {...gesture}
            onChange={(v) => set(constrainSize('width', v, r, lock))}
          />
          <DragValue
            label="Height"
            value={r.height}
            min={MIN_SIDE}
            max={MAX_SIDE}
            step={1}
            speed={2}
            width={124}
            unit=" px"
            {...gesture}
            onChange={(v) => set(constrainSize('height', v, r, lock))}
          />
          <Toggle label="Constrain proportions" value={lock !== null} onChange={(on) => setLock(on ? r.width / r.height : null)} />
        </div>
        <p className="dlg-note">
          {aspectLabel(r.width, r.height)} · {mp.toFixed(2)} megapixels{mp > 2.5 ? ' · big renders take a while: try Draft first' : ''}
        </p>
      </div>

      <div className="dlg-section">
        <h3 className="dlg-heading">Quality</h3>
        <div className="dlg-row" role="radiogroup" aria-label="Quality">
          {QUALITY.map((q) => (
            <Button key={q.id} pressed={r.quality === q.id} hint={q.note} onClick={() => set({ quality: q.id })}>
              {q.label}
            </Button>
          ))}
        </div>
        <p className="dlg-note">{quality.note}</p>
        <div className="dlg-grid">
          <Slider label="Anti-alias samples" value={r.samples} min={1} max={256} step={1} width={420} {...gesture} onChange={(v) => set({ samples: v })} hint="Samples per pixel after the mosaic passes (with Edges only, edge pixels get them all, the rest keep one)" />
          <Slider label="Ray bounces" value={r.maxBounces} min={1} max={12} step={1} width={420} {...gesture} onChange={(v) => set({ maxBounces: v })} hint="How deep reflections and refractions go" />
          <Slider label="Exposure" value={r.exposure} min={0.5} max={2} step={0.01} precision={2} width={420} {...gesture} onChange={(v) => set({ exposure: v })} />
        </div>
        <Toggle label="Mosaic passes (big blocks refining to pixels)" value={r.mosaic} onChange={(v) => set({ mosaic: v })} />
      </div>

      <div className="dlg-section">
        <h3 className="dlg-heading">Anti-aliasing</h3>
        <div className="dlg-row" role="radiogroup" aria-label="Anti-aliasing">
          {ANTIALIAS.map((a) => (
            <Button key={a.id} pressed={antialias.id === a.id} hint={a.note} onClick={() => set({ antialias: a.id })}>
              {a.label}
            </Button>
          ))}
        </div>
        <p className="dlg-note">
          {antialias.note}
          {r.quality === 'draft' ? ' · Draft has no anti-aliasing passes' : ''}
        </p>
        <div className="dlg-grid">
          <Slider label="Softness" value={r.softness} min={0} max={100} step={1} width={420} {...gesture} onChange={(v) => set({ softness: v })} hint="Blends neighbouring pixels like the soft 90s renders (0 = crisp)" />
        </div>
      </div>
    </Dialog>
  );
}
