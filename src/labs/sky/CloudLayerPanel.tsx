/**
 * One cloud layer in the Sky Lab's Cloud Cover tab (Stratus or Cumulus): on/off, a live
 * texture of the cloud pattern, cover / height / frequency / amplitude / shading sliders,
 * color, offset knob, quick shape buttons, a new-pattern dice and reset.
 */
import { useCallback } from 'react';
import { randomSeed, mulberry32 } from '@/core/math';
import type { CloudLayer, Sky } from '@/core/types';
import { PaintCanvas, type PaintFn } from '@/sky/components/PaintCanvas';
import { defaultCumulus, defaultStratus } from '@/sky/defaults';
import { paintCloudTexture } from '@/sky/paint/textures';
import { CLOUD_RANGES, clampTo } from '@/sky/ranges';
import { Button, GlossBall, Icon3D, IconButton, useHint } from '@/ui/kit';
import { OffsetKnob } from './OffsetKnob';
import { Panel, RangeSlider, SwatchField } from './SkyLabParts';

const INFO = {
  stratus: { title: 'Stratus', blurb: 'High, thin, wispy streaks that catch the sunset.' },
  cumulus: { title: 'Cumulus', blurb: 'Low, puffy, self-shaded clouds.' },
} as const;

function RoundButton({ hint, glyph, onClick }: { hint: string; glyph: 'plus' | 'minus'; onClick: () => void }) {
  return (
    <button type="button" className="skylab__round" aria-label={hint} onClick={onClick} {...useHint(hint)}>
      <GlossBall size={18} tone="metal" glyph={glyph} />
    </button>
  );
}

export function CloudLayerPanel({ kind, sky, onChange }: { kind: 'stratus' | 'cumulus'; sky: Sky; onChange: (patch: Partial<CloudLayer>, key: string) => void }) {
  const layer = sky[kind];
  const info = INFO[kind];
  const texture = useCallback<PaintFn>(
    (ctx, w, h) => paintCloudTexture(ctx, w, h, layer, kind, sky),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the texture only shows the layer and the sky tone
    [layer, kind, sky.mode, sky.zenithColor, sky.horizonColor, sky.skyDomeColor],
  );
  const set = (patch: Partial<CloudLayer>) => onChange(patch, `${kind}:${Object.keys(patch).sort().join(',')}`);
  const nudge = (field: 'frequency' | 'amplitude', f: (v: number) => number) => set({ [field]: clampTo(CLOUD_RANGES[field], f(layer[field])) });
  const newPattern = () => {
    const r = mulberry32(randomSeed());
    set({ offset: [Math.round((r() - 0.5) * 20000), Math.round((r() - 0.5) * 20000)] });
  };
  return (
    <Panel
      title={info.title}
      className="skylab__panel--cloud"
      toggle={{ on: layer.enabled, onChange: (on) => set({ enabled: on }), hint: `${info.title} clouds on / off` }}
      extra={<span className="skylab__blurb">{info.blurb}</span>}
    >
      <div className="skylab__cloud">
        <div className="skylab__cloudtex">
          <div className="skylab__texwrap">
            <PaintCanvas width={132} height={100} paint={texture} maxDpr={1} />
          </div>
          <div className="skylab__texbtns">
            <RoundButton hint="More detail (higher frequency)" glyph="plus" onClick={() => nudge('frequency', (v) => v * 1.25)} />
            <RoundButton hint="Less detail (lower frequency)" glyph="minus" onClick={() => nudge('frequency', (v) => v / 1.25)} />
            <RoundButton hint="Puffier, sharper edges (more amplitude)" glyph="plus" onClick={() => nudge('amplitude', (v) => v + 40)} />
            <RoundButton hint="Softer edges (less amplitude)" glyph="minus" onClick={() => nudge('amplitude', (v) => v - 40)} />
          </div>
          <div className="skylab__row skylab__row--tight">
            <Button hint={`Reset ${info.title} to its default`} onClick={() => set({ ...(kind === 'stratus' ? defaultStratus() : defaultCumulus()), enabled: layer.enabled })}>
              Reset
            </Button>
            <IconButton hint="New cloud pattern (same settings)" size={26} onClick={newPattern}>
              <Icon3D kind="dice" size={20} />
            </IconButton>
          </div>
        </div>
        <div className="skylab__fields">
          <RangeSlider range={CLOUD_RANGES.cover} label="Cover" hint={`${info.title} cloud cover`} value={layer.cover} onChange={(v) => set({ cover: v })} width={230} />
          <RangeSlider range={CLOUD_RANGES.height} label="Height" value={layer.height} onChange={(v) => set({ height: v })} width={230} hint={`${info.title} altitude in world units`} />
          <RangeSlider range={CLOUD_RANGES.frequency} value={layer.frequency} onChange={(v) => set({ frequency: v })} width={230} hint="Frequency: higher = smaller, more frequent clouds" />
          <RangeSlider range={CLOUD_RANGES.amplitude} value={layer.amplitude} onChange={(v) => set({ amplitude: v })} width={230} hint="Amplitude: higher = denser clouds with sharper edges" />
          <RangeSlider range={CLOUD_RANGES.shading} value={layer.shading} onChange={(v) => set({ shading: v })} width={230} scale={100} hint="How much the clouds shade their own undersides" />
          <div className="skylab__row">
            <SwatchField label="Color" value={layer.color} onChange={(c) => set({ color: c })} hint={`${info.title} color`} />
            <div className="skylab__knobwrap">
              <OffsetKnob label={info.title} offset={layer.offset} onChange={(o) => set({ offset: o })} />
              <span className="skylab__knoblabel">Cloud Offset</span>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
