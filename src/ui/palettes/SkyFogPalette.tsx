/**
 * The Sky & Fog palette row (Bryce 4/5): sky mode, shadows, fog, haze and cloud
 * thumbnails you drag on, color bars, the sun / moon trackball, Sky Lab, dice, sky memory
 * dots and the options menu. Every edit goes straight to the store, so the Nano Preview
 * follows along.
 */
import { useRef } from 'react';
import { useStore } from '@/core/store';
import { SkyFogActions } from './SkyFogActions';
import { metricsFor, useAvailableWidth } from './SkyFogLayout';
import { SkyFogPads } from './SkyFogPads';
import { SkyFogSun } from './SkyFogSun';
import './SkyFogPalette.css';

export function SkyFogPalette() {
  const sky = useStore((s) => s.scene.sky);
  const ref = useRef<HTMLDivElement>(null);
  const m = metricsFor(useAvailableWidth(ref));
  return (
    <div ref={ref} className={`palette-row skyfog skyfog--${m.tier}`} role="toolbar" aria-label="Sky & Fog">
      <SkyFogPads sky={sky} m={m} />
      <span className="skyfog__sep" aria-hidden="true" />
      <SkyFogSun sky={sky} m={m} />
      <span className="skyfog__sep" aria-hidden="true" />
      <SkyFogActions sky={sky} m={m} />
    </div>
  );
}
