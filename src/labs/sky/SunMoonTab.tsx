/** Sky Lab: Sun & Moon tab (sun position / color / size / glow, the moon, stars). */
import { useCallback } from 'react';
import { getActiveCamera } from '@/core/cameraOps';
import { useStore } from '@/core/store';
import { PaintCanvas, type PaintFn } from '@/sky/components/PaintCanvas';
import { SunBall } from '@/sky/components/SunBall';
import { paintMoonPhase } from '@/sky/paint/ball';
import { paintStarsArt } from '@/sky/paint/textures';
import { SKY_RANGES } from '@/sky/ranges';
import { describeSun, flipSunMoon, linkSunToViewPatch, moonPhaseName, timeOfDay } from '@/sky/sun';
import { Button, Toggle } from '@/ui/kit';
import { Note, Panel, RangeSlider, SwatchField } from './SkyLabParts';
import type { SkyTabProps } from './tabTypes';

/** One-click times of day: they set the sun's altitude and keep its direction. */
const TIMES: { label: string; altitude: number }[] = [
  { label: 'Dawn', altitude: 3 },
  { label: 'Morning', altitude: 22 },
  { label: 'Noon', altitude: 68 },
  { label: 'Afternoon', altitude: 38 },
  { label: 'Golden', altitude: 9 },
  { label: 'Sunset', altitude: 1 },
  { label: 'Dusk', altitude: -5 },
  { label: 'Night', altitude: -32 },
];

export function SunMoonTab({ sky, update, current }: SkyTabProps) {
  const night = sky.sunAltitude < 0;
  const moonArt = useCallback<PaintFn>((ctx, w) => paintMoonPhase(ctx, w, sky.moonPhase, sky.moonColor), [sky.moonPhase, sky.moonColor]);
  const starArt = useCallback<PaintFn>((ctx, w, h) => paintStarsArt(ctx, w, h, sky.stars), [sky.stars]);
  const link = (on: boolean) => {
    const s = useStore.getState();
    update(linkSunToViewPatch(current(), on, getActiveCamera() ?? s.scene.camera), 'link');
  };
  const setTime = (altitude: number) => {
    update({ sunAltitude: altitude }, 'time');
    useStore.getState().setHint(`${timeOfDay(altitude)}: sun altitude ${altitude}°`);
  };
  return (
    <div className="skylab__panels">
      <Panel title="Sun Controls" className="skylab__panel--wide">
        <div className="skylab__suncontrols">
          <div className="skylab__ballwrap">
            <SunBall sky={sky} size={132} getPosition={current} onChange={(p) => update(p, 'sunpos')} />
            <span className="skylab__balllabel">{night ? 'Moon' : 'Sun'} · {timeOfDay(sky.sunAltitude)}</span>
          </div>
          <div className="skylab__fields">
            <RangeSlider range={SKY_RANGES.sunAzimuth} value={sky.sunAzimuth} onChange={(v) => update({ sunAzimuth: v % 360 }, 'sunpos')} hint="Sun azimuth: 0 is straight ahead, 90 to the right" />
            <RangeSlider range={SKY_RANGES.sunAltitude} value={sky.sunAltitude} onChange={(v) => update({ sunAltitude: v }, 'sunpos')} hint="Sun altitude: below 0 the sun sets and the moon rises opposite" />
            <div className="skylab__chips" role="group" aria-label="Time of day">
              {TIMES.map((t) => (
                <Button key={t.label} className="skylab__chip" pressed={Math.round(sky.sunAltitude) === t.altitude} hint={`${t.label}: sun at ${t.altitude}°`} onClick={() => setTime(t.altitude)}>
                  {t.label}
                </Button>
              ))}
            </div>
            <div className="skylab__row">
              <Button hint="Swap the sun and the moon" onClick={() => update(flipSunMoon(current()), 'flip')}>
                {night ? '☀ Switch to Day' : '☾ Switch to Night'}
              </Button>
              <Toggle label="Link Sun to View" value={sky.linkSunToView} onChange={link} hint="Keep the sun in the same place in the frame whichever way the camera looks" />
            </div>
            <Note>{describeSun(sky)}</Note>
          </div>
        </div>
      </Panel>
      <Panel title="Sun">
        <SwatchField label="Sun Color" value={sky.sunColor} onChange={(c) => update({ sunColor: c })} hint="Sunlight color: tints every lit surface" />
        <RangeSlider range={SKY_RANGES.sunSize} value={sky.sunSize} onChange={(v) => update({ sunSize: v })} label="Disc Size" />
        <RangeSlider range={SKY_RANGES.sunGlow} value={sky.sunGlow} onChange={(v) => update({ sunGlow: v })} label="Glow" hint="Glow / halo around the sun" />
      </Panel>
      <Panel title="Moon">
        <div className="skylab__moon">
          <PaintCanvas width={44} height={44} paint={moonArt} className="skylab__moonart" />
          <div className="skylab__fields">
            <SwatchField label="Moon Color" value={sky.moonColor} onChange={(c) => update({ moonColor: c })} />
            <RangeSlider range={SKY_RANGES.moonSize} value={sky.moonSize} onChange={(v) => update({ moonSize: v })} label="Disc Size" width={210} />
            <RangeSlider range={SKY_RANGES.moonPhase} value={sky.moonPhase} onChange={(v) => update({ moonPhase: v })} label="Phase" hint={`Moon phase: ${moonPhaseName(sky.moonPhase)}`} width={210} />
            <Note>{moonPhaseName(sky.moonPhase)}. The moon always rises opposite the sun.</Note>
          </div>
        </div>
      </Panel>
      <Panel title="Stars">
        <div className="skylab__moon">
          <PaintCanvas width={44} height={44} paint={starArt} className="skylab__moonart" />
          <div className="skylab__fields">
            <RangeSlider range={SKY_RANGES.stars} value={sky.stars} onChange={(v) => update({ stars: v })} label="Star Field" width={210} hint="Stars: visible where the sky is dark" />
            <Note>Stars shine wherever the sky is dark enough: at night, or in a black custom sky.</Note>
          </div>
        </div>
      </Panel>
    </div>
  );
}
