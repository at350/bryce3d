/** The Sky Lab's preset drawer: categories, painted thumbnails, name and description on hover. */
import { useState } from 'react';
import type { Sky } from '@/core/types';
import { SKY_CATEGORIES, SKY_PRESETS, skyPresetsIn, type SkyPreset } from '@/sky/presets';
import { skiesEqual } from '@/sky/sanitize';
import { paintedSkyThumbnail } from '@/sky/thumbnails';
import { useHint } from '@/ui/kit';

function Tile({ preset, current, onPick, onHover }: { preset: SkyPreset; current: boolean; onPick: () => void; onHover: (p: SkyPreset | null) => void }) {
  const hint = useHint(`${preset.name}: ${preset.description ?? ''}`);
  return (
    <button
      type="button"
      className={`skylab__tile ${current ? 'is-current' : ''}`}
      aria-pressed={current}
      onClick={onPick}
      onPointerEnter={() => {
        hint.onPointerEnter();
        onHover(preset);
      }}
      onPointerLeave={() => {
        hint.onPointerLeave();
        onHover(null);
      }}
      onFocus={() => onHover(preset)}
      onBlur={() => onHover(null)}
    >
      <img src={paintedSkyThumbnail(preset.id, preset.sky, 112, 84)} alt="" draggable={false} />
      <span>{preset.name}</span>
    </button>
  );
}

export function SkyPresetDrawer({ sky, onPick }: { sky: Sky; onPick: (p: SkyPreset) => void }) {
  const [category, setCategory] = useState(() => SKY_PRESETS.find((p) => skiesEqual(p.sky, sky))?.category ?? SKY_CATEGORIES[0]);
  const [hover, setHover] = useState<SkyPreset | null>(null);
  const current = SKY_PRESETS.find((p) => skiesEqual(p.sky, sky));
  const shown = hover ?? current ?? null;
  return (
    <section className="skylab__presets" aria-label="Preset skies">
      <header className="skylab__presethead">
        <h2>Preset Skies</h2>
        <div className="skylab__cats" role="tablist" aria-label="Sky categories">
          {SKY_CATEGORIES.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={c === category} className={`skylab__cat ${c === category ? 'is-active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </header>
      <div className="skylab__tiles" role="tabpanel">
        {skyPresetsIn(category).map((p) => (
          <Tile key={p.id} preset={p} current={current?.id === p.id} onPick={() => onPick(p)} onHover={setHover} />
        ))}
      </div>
      <p className="skylab__presetinfo">
        {shown ? (
          <>
            <b>{shown.name}</b> {shown.description}
          </>
        ) : (
          'Click a sky to try it in the preview. Everything stays adjustable; ✓ keeps it.'
        )}
      </p>
    </section>
  );
}
