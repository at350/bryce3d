/** Altitude blend: a color laid over the material above a height, only on gentle slopes (snow caps, moss). */
import type { Material } from '@/core/types';
import { DEFAULT_ALTITUDE, setAltitude } from '@/materials/edit';
import { ColorSwatch, Toggle } from '@/ui/kit';
import { ChannelBar } from './ChannelBar';
import type { LabEditor } from './labTypes';

type AltitudeKey = 'start' | 'softness' | 'maxSlope';

const ROWS: { key: AltitudeKey; label: string; hint: string }[] = [
  { key: 'start', label: 'Start', hint: 'Altitude Start: height (0 = bottom, 100 = top) where the blend begins' },
  { key: 'softness', label: 'Softness', hint: 'Altitude Softness: how gradual the transition is' },
  { key: 'maxSlope', label: 'Max Slope', hint: 'Altitude Max Slope: surfaces steeper than this stay bare' },
];

export function AltitudePanel({ editor }: { editor: LabEditor }) {
  const alt: NonNullable<Material['altitude']> | undefined = editor.material.altitude;
  const on = !!alt;
  const shown = alt ?? DEFAULT_ALTITUDE;
  return (
    <div className={`ml-alt ${on ? 'is-on' : ''}`}>
      <div className="ml-alt__head">
        <Toggle label="Altitude Blend" value={on} onChange={(v) => editor.update((cur) => setAltitude(cur, v ? {} : null), 'altitude')} hint="Altitude Blend: snow caps, moss tops, polar ice" />
        <ColorSwatch
          value={shown.color}
          onChange={(color) => editor.update((cur) => setAltitude(cur, { color }), 'altitude:color')}
          onStart={editor.begin}
          onEnd={editor.end}
          hint="Altitude Color"
          size={20}
        />
      </div>
      {on && (
        <div className="ml-alt__rows">
          {ROWS.map((row) => (
            <div key={row.key} className="ml-alt__row">
              <span className="ml-alt__label">{row.label}</span>
              <ChannelBar
                label={row.label}
                value={Math.round(shown[row.key] * 100)}
                min={0}
                max={100}
                hint={row.hint}
                onChange={(v) => editor.update((cur) => setAltitude(cur, { [row.key]: v / 100 }), `altitude:${row.key}`)}
                onStart={editor.begin}
                onEnd={editor.end}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
