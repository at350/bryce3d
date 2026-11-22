/** Sky Lab: Atmosphere tab (sky mode and colors, haze, fog, light and shadow, rainbow). */
import { useCallback } from 'react';
import type { Sky, SkyMode } from '@/core/types';
import { PaintCanvas, type PaintFn } from '@/sky/components/PaintCanvas';
import { paintSkyView } from '@/sky/paint/skyView';
import { SKY_MODES, SKY_MODE_LABELS, SKY_RANGES } from '@/sky/ranges';
import { Toggle, useHint } from '@/ui/kit';
import { Note, Panel, RangeSlider, SwatchField } from './SkyLabParts';
import type { SkyTabProps } from './tabTypes';

const MODE_NOTES: Record<SkyMode, string> = {
  soft: 'Soft Sky: your horizon and zenith colors, reddened at sunset and darkened at night automatically.',
  darker: 'Darker Sky: a deeper, more saturated version of the soft sky. Good for brooding weather.',
  custom: 'Custom Sky: exactly your colors, whatever the sun does. The door to alien worlds.',
  off: 'Atmosphere Off: a flat background in the zenith color. Objects are still lit by the sun.',
};

function ModeTile({ sky, mode, onPick }: { sky: Sky; mode: SkyMode; onPick: () => void }) {
  const paint = useCallback<PaintFn>((ctx, w, h) => paintSkyView(ctx, w, h, { ...sky, mode }, { pitch: 4, fov: 66 }), [sky, mode]);
  const active = sky.mode === mode;
  return (
    <button type="button" className={`skylab__modetile ${active ? 'is-active' : ''}`} aria-pressed={active} onClick={onPick} {...useHint(MODE_NOTES[mode])}>
      <PaintCanvas width={92} height={62} paint={paint} maxDpr={1} />
      <span>{SKY_MODE_LABELS[mode]}</span>
    </button>
  );
}

export function AtmosphereTab({ sky, update }: SkyTabProps) {
  const off = sky.mode === 'off';
  return (
    <div className="skylab__panels">
      <Panel title="Sky Mode" className="skylab__panel--wide">
        <div className="skylab__modes" role="radiogroup" aria-label="Sky mode">
          {SKY_MODES.map((mode) => (
            <ModeTile key={mode} sky={sky} mode={mode} onPick={() => update({ mode })} />
          ))}
        </div>
        <Note>{MODE_NOTES[sky.mode]}</Note>
      </Panel>
      <Panel title="Sky Colors">
        <SwatchField label={off ? 'Background' : 'Zenith'} value={sky.zenithColor} onChange={(c) => update({ zenithColor: c })} hint={off ? 'Background color' : 'Zenith color: the sky straight overhead'} />
        <SwatchField label="Horizon" value={sky.horizonColor} onChange={(c) => update({ horizonColor: c })} hint="Horizon color: the sky low down, also seen in reflections" />
        <SwatchField label="Sky Dome" value={sky.skyDomeColor} onChange={(c) => update({ skyDomeColor: c })} hint="Sky dome color: a wash of color over the whole sky" />
        {off && <Note>Atmosphere Off ignores the horizon and dome colors.</Note>}
      </Panel>
      <Panel title="Haze">
        <SwatchField label="Haze Color" value={sky.hazeColor} onChange={(c) => update({ hazeColor: c })} />
        <RangeSlider range={SKY_RANGES.haze} value={sky.haze} onChange={(v) => update({ haze: v })} label="Haze" hint="Haze: distance glow toward the horizon" />
        <Note>Haze softens the horizon line and fades far-away land into the sky.</Note>
      </Panel>
      <Panel title="Fog">
        <SwatchField label="Fog Color" value={sky.fogColor} onChange={(c) => update({ fogColor: c })} />
        <RangeSlider range={SKY_RANGES.fogDensity} value={sky.fogDensity} onChange={(v) => update({ fogDensity: v })} label="Density" hint="Fog density" />
        <RangeSlider range={SKY_RANGES.fogHeight} value={sky.fogHeight} onChange={(v) => update({ fogHeight: v })} label="Height" hint="Fog fills the world below this height (world units)" />
        <Note>Keep the height below the camera for ground fog; raise it above to stand inside a cloud.</Note>
      </Panel>
      <Panel title="Light & Shadow">
        <SwatchField label="Ambient Color" value={sky.ambientColor} onChange={(c) => update({ ambientColor: c })} hint="Ambient color: the sky light that fills shadows" />
        <RangeSlider range={SKY_RANGES.ambient} value={sky.ambient} onChange={(v) => update({ ambient: v })} label="Ambient" />
        <RangeSlider range={SKY_RANGES.shadowIntensity} value={sky.shadowIntensity} onChange={(v) => update({ shadowIntensity: v })} label="Shadows" hint="Shadow darkness (100 = black)" />
      </Panel>
      <Panel title="Rainbow">
        <Toggle label="Rainbow" value={sky.rainbow} onChange={(v) => update({ rainbow: v })} hint="A rainbow opposite the sun" />
        <Note>Rainbows hang opposite the sun and need a sun lower than 42°: put it behind the camera to see one.</Note>
      </Panel>
    </div>
  );
}
