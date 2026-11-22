/**
 * The Sky & Fog thumbnails: sky mode, shadows / ambient, fog, haze, cloud height, cloud
 * cover and cloud frequency / amplitude. Each one is a live little picture of its value;
 * drag on it to change the value, click the color bar under it to pick a color.
 */
import { useCallback, useRef, type ReactNode } from 'react';
import type { RGB, Sky } from '@/core/types';
import { describeClouds, primaryCloud, setCloudCover, setCloudHeight, setCloudShape } from '@/sky/cloudEdit';
import { ColorBar } from '@/sky/components/ColorBar';
import { PaintCanvas, type PaintFn } from '@/sky/components/PaintCanvas';
import { css } from '@/sky/color';
import { resolveSkyLook } from '@/sky/model';
import { paintSkyView } from '@/sky/paint/skyView';
import { paintCloudHeightArt, paintFogArt, paintFreqAmpArt, paintHazeArt, paintShadowsArt } from '@/sky/paint/thumbs';
import { CLOUD_RANGES, SKY_MODES, SKY_MODE_LABELS, SKY_RANGES } from '@/sky/ranges';
import { DragPad, TriangleMenu, useHint, usePointerDrag } from '@/ui/kit';
import { currentSky, patchSky, skyGesture, type SkyFogMetrics } from './SkyFogLayout';

interface CellProps {
  sky: Sky;
  m: SkyFogMetrics;
}

const range = (r: { min: number; max: number }): [number, number] => [r.min, r.max];

function Cell({ m, bars, children, className = '' }: { m: SkyFogMetrics; bars: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`skyfog__cell ${className}`}>
      {children}
      <div className="skyfog__bars" style={{ width: m.padW }}>
        {bars}
      </div>
    </div>
  );
}

/** Thumbnail art with its name printed small in the corner (Bryce relied on the hint line alone). */
function Art({ m, paint, maxDpr, label }: { m: SkyFogMetrics; paint: PaintFn; maxDpr?: number; label: string }) {
  return (
    <div className="skyfog__art">
      <PaintCanvas width={m.padW} height={m.padH} paint={paint} maxDpr={maxDpr} />
      <span className="skyfog__label">{label}</span>
    </div>
  );
}

function Bar({ label, value, onPick }: { label: string; value: RGB; onPick: (c: RGB) => void }) {
  return <ColorBar label={label} value={value} onChange={onPick} onStart={skyGesture.onStart} onEnd={skyGesture.onEnd} />;
}

// --- sky mode ---------------------------------------------------------------

const DRAG_STEP_PX = 22;

const MODE_SHORT: Record<Sky['mode'], string> = { soft: 'Soft', darker: 'Darker', custom: 'Custom', off: 'Off' };

function cycleMode(steps: number) {
  const sky = currentSky();
  const i = SKY_MODES.indexOf(sky.mode);
  const mode = SKY_MODES[(((i + steps) % SKY_MODES.length) + SKY_MODES.length) % SKY_MODES.length];
  patchSky({ mode }, `Sky mode: ${SKY_MODE_LABELS[mode]}`);
}

function ModeCell({ sky, m }: CellProps) {
  const acc = useRef(0);
  const paint = useCallback<PaintFn>((ctx, w, h) => paintSkyView(ctx, w, h, sky, { pitch: 3, fov: 70 }), [sky]);
  const onPointerDown = usePointerDrag({
    onStart: () => {
      acc.current = 0;
      skyGesture.onStart();
    },
    onMove: (dx) => {
      acc.current += dx;
      const steps = Math.trunc(acc.current / DRAG_STEP_PX);
      if (steps) {
        acc.current -= steps * DRAG_STEP_PX;
        cycleMode(steps);
      }
    },
    onEnd: ({ moved }) => {
      if (!moved) cycleMode(1);
      skyGesture.onEnd();
    },
  });
  const hint = useHint(`Sky mode: ${SKY_MODE_LABELS[sky.mode]} (click or drag to change)`);
  const off = sky.mode === 'off';
  const items = SKY_MODES.map((mode) => ({
    label: SKY_MODE_LABELS[mode],
    checked: sky.mode === mode,
    swatch: css(resolveSkyLook({ ...sky, mode }).zenith),
    onSelect: () => patchSky({ mode }, `Sky mode: ${SKY_MODE_LABELS[mode]}`),
  }));
  return (
    <Cell
      m={m}
      className="skyfog__cell--mode"
      bars={
        off ? (
          <Bar label="Background color" value={sky.zenithColor} onPick={(c) => patchSky({ zenithColor: c })} />
        ) : (
          <>
            <Bar label="Zenith color (top of the sky)" value={sky.zenithColor} onPick={(c) => patchSky({ zenithColor: c })} />
            <Bar label="Horizon color" value={sky.horizonColor} onPick={(c) => patchSky({ horizonColor: c })} />
          </>
        )
      }
    >
      <div className="skyfog__modewrap">
        <button
          type="button"
          className="skyfog__mode"
          style={{ width: m.padW, height: m.padH }}
          aria-label={`Sky mode: ${SKY_MODE_LABELS[sky.mode]}`}
          onPointerDown={onPointerDown}
          onClick={(e) => {
            if (e.detail === 0) cycleMode(1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              cycleMode(e.key === 'ArrowRight' ? 1 : -1);
            }
          }}
          {...hint}
        >
          <Art m={m} paint={paint} maxDpr={1} label={MODE_SHORT[sky.mode]} />
        </button>
        <TriangleMenu hint="Sky mode" items={items} className="skyfog__modemenu" />
      </div>
    </Cell>
  );
}

// --- shadows / ambient ------------------------------------------------------------

function ShadowsCell({ sky, m }: CellProps) {
  const paint = useCallback<PaintFn>(
    (ctx, w, h) => paintShadowsArt(ctx, w, h, sky),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repaint only for the fields the art shows
    [sky.shadowIntensity, sky.ambient, sky.ambientColor, sky.sunAzimuth, sky.sunAltitude, sky.sunColor, sky.moonColor, sky.mode, sky.horizonColor, sky.zenithColor, sky.skyDomeColor],
  );
  return (
    <Cell m={m} bars={<Bar label="Ambient light color" value={sky.ambientColor} onPick={(c) => patchSky({ ambientColor: c })} />}>
      <DragPad
        hint="Shadows (drag sideways) / Ambient light (drag up)"
        x={sky.shadowIntensity}
        xRange={range(SKY_RANGES.shadowIntensity)}
        y={sky.ambient}
        yRange={range(SKY_RANGES.ambient)}
        width={m.padW}
        height={m.padH}
        {...skyGesture}
        onChange={(x, y) => patchSky({ shadowIntensity: x, ambient: y ?? sky.ambient }, `Shadows ${Math.round(x)}, ambient light ${Math.round(y ?? sky.ambient)}`)}
      >
        <Art m={m} paint={paint} label="Shadows" />
      </DragPad>
    </Cell>
  );
}

// --- fog / haze ---------------------------------------------------------------------

function FogCell({ sky, m }: CellProps) {
  const paint = useCallback<PaintFn>(
    (ctx, w, h) => paintFogArt(ctx, w, h, sky),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repaint only for the fields the art shows
    [sky.fogDensity, sky.fogHeight, sky.fogColor, sky.mode, sky.horizonColor, sky.zenithColor, sky.skyDomeColor, sky.sunAltitude],
  );
  return (
    <Cell m={m} bars={<Bar label="Fog color" value={sky.fogColor} onPick={(c) => patchSky({ fogColor: c })} />}>
      <DragPad
        hint="Fog density (drag sideways) / height (drag up)"
        x={sky.fogDensity}
        xRange={range(SKY_RANGES.fogDensity)}
        y={sky.fogHeight}
        yRange={range(SKY_RANGES.fogHeight)}
        width={m.padW}
        height={m.padH}
        {...skyGesture}
        onChange={(x, y) => patchSky({ fogDensity: x, fogHeight: y ?? sky.fogHeight }, `Fog density ${Math.round(x)}, height ${Math.round(y ?? sky.fogHeight)}`)}
      >
        <Art m={m} paint={paint} label="Fog" />
      </DragPad>
    </Cell>
  );
}

function HazeCell({ sky, m }: CellProps) {
  const paint = useCallback<PaintFn>(
    (ctx, w, h) => paintHazeArt(ctx, w, h, sky),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repaint only for the fields the art shows
    [sky.haze, sky.hazeColor, sky.mode, sky.horizonColor, sky.zenithColor, sky.skyDomeColor, sky.sunAltitude],
  );
  return (
    <Cell m={m} bars={<Bar label="Haze color" value={sky.hazeColor} onPick={(c) => patchSky({ hazeColor: c })} />}>
      <DragPad
        hint="Haze"
        x={sky.haze}
        xRange={range(SKY_RANGES.haze)}
        width={m.padW}
        height={m.padH}
        {...skyGesture}
        onChange={(x) => patchSky({ haze: x }, `Haze ${Math.round(x)}`)}
      >
        <Art m={m} paint={paint} label="Haze" />
      </DragPad>
    </Cell>
  );
}

// --- clouds -----------------------------------------------------------------------

/** Cloud drags edit every enabled layer relative to where the drag started. */
function useCloudDrag() {
  const start = useRef<Sky | null>(null);
  return {
    onStart: () => {
      start.current = currentSky();
      skyGesture.onStart();
    },
    onEnd: () => {
      start.current = null;
      skyGesture.onEnd();
    },
    base: () => start.current ?? currentSky(),
  };
}

function CloudHeightCell({ sky, m }: CellProps) {
  const drag = useCloudDrag();
  const primary = sky[primaryCloud(sky)];
  const paint = useCallback<PaintFn>(
    (ctx, w, h) => paintCloudHeightArt(ctx, w, h, sky),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repaint only for the fields the art shows
    [sky.stratus, sky.cumulus, sky.mode, sky.horizonColor, sky.zenithColor, sky.skyDomeColor, sky.sunAltitude],
  );
  return (
    <Cell m={m} bars={<Bar label="Sky dome color (tints the whole sky)" value={sky.skyDomeColor} onPick={(c) => patchSky({ skyDomeColor: c })} />}>
      <DragPad
        hint="Cloud height"
        x={primary.height}
        xRange={range(CLOUD_RANGES.height)}
        width={m.padW}
        height={m.padH}
        onStart={drag.onStart}
        onEnd={drag.onEnd}
        onChange={(x) => {
          const next = setCloudHeight(drag.base(), x);
          patchSky(next, `Cloud height: ${describeClouds(next, 'height')}`);
        }}
      >
        <Art m={m} paint={paint} label="Height" />
      </DragPad>
    </Cell>
  );
}

function CloudCoverCell({ sky, m }: CellProps) {
  const drag = useCloudDrag();
  const primary = sky[primaryCloud(sky)];
  const paint = useCallback<PaintFn>((ctx, w, h) => paintSkyView(ctx, w, h, { ...sky, stars: 0 }, { pitch: 32, fov: 78, sea: false }), [sky]);
  return (
    <Cell
      m={m}
      bars={
        <>
          <Bar label="Stratus (high cloud) color" value={sky.stratus.color} onPick={(c) => patchSky({ stratus: { ...currentSky().stratus, color: c } })} />
          <Bar label="Cumulus (puffy cloud) color" value={sky.cumulus.color} onPick={(c) => patchSky({ cumulus: { ...currentSky().cumulus, color: c } })} />
        </>
      }
    >
      <DragPad
        hint="Cloud cover"
        x={primary.enabled ? primary.cover : 0}
        xRange={range(CLOUD_RANGES.cover)}
        width={m.padW}
        height={m.padH}
        onStart={drag.onStart}
        onEnd={drag.onEnd}
        onChange={(x) => {
          const next = setCloudCover(drag.base(), x);
          patchSky(next, `Cloud cover: ${describeClouds(next, 'cover')}`);
        }}
      >
        <Art m={m} paint={paint} maxDpr={1} label="Cover" />
      </DragPad>
    </Cell>
  );
}

function LayerToggle({ label, letter, on, onToggle }: { label: string; letter: string; on: boolean; onToggle: () => void }) {
  const hint = useHint(`${label}: ${on ? 'on' : 'off'} (click to turn ${on ? 'off' : 'on'})`);
  return (
    <button type="button" className={`skyfog__layer ${on ? 'is-on' : ''}`} aria-pressed={on} aria-label={label} onClick={onToggle} {...hint}>
      <span className="skyfog__layerdot" />
      {letter}
    </button>
  );
}

function FreqAmpCell({ sky, m }: CellProps) {
  const drag = useCloudDrag();
  const key = primaryCloud(sky);
  const primary = sky[key];
  const paint = useCallback<PaintFn>(
    (ctx, w, h) => paintFreqAmpArt(ctx, w, h, sky, primary),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repaint only for the fields the art shows
    [primary, sky.mode, sky.horizonColor, sky.zenithColor, sky.skyDomeColor, sky.sunAltitude],
  );
  const toggle = (k: 'stratus' | 'cumulus') => {
    const layer = currentSky()[k];
    patchSky({ [k]: { ...layer, enabled: !layer.enabled } }, `${k === 'stratus' ? 'Stratus' : 'Cumulus'} clouds ${layer.enabled ? 'off' : 'on'}`);
  };
  return (
    <Cell
      m={m}
      bars={
        <>
          <LayerToggle label="Stratus clouds (high, wispy)" letter="S" on={sky.stratus.enabled} onToggle={() => toggle('stratus')} />
          <LayerToggle label="Cumulus clouds (low, puffy)" letter="C" on={sky.cumulus.enabled} onToggle={() => toggle('cumulus')} />
        </>
      }
    >
      <DragPad
        hint="Cloud frequency (drag sideways) / amplitude (drag up)"
        x={primary.frequency}
        xRange={range(CLOUD_RANGES.frequency)}
        y={primary.amplitude}
        yRange={range(CLOUD_RANGES.amplitude)}
        width={m.padW}
        height={m.padH}
        onStart={drag.onStart}
        onEnd={drag.onEnd}
        onChange={(x, y) => {
          const next = setCloudShape(drag.base(), x, y ?? primary.amplitude);
          patchSky(next, `Cloud frequency ${describeClouds(next, 'frequency')}; amplitude ${describeClouds(next, 'amplitude')}`);
        }}
      >
        <Art m={m} paint={paint} label="Freq · Amp" />
      </DragPad>
    </Cell>
  );
}

export function SkyFogPads({ sky, m }: CellProps) {
  return (
    <>
      <ModeCell sky={sky} m={m} />
      <ShadowsCell sky={sky} m={m} />
      <FogCell sky={sky} m={m} />
      <HazeCell sky={sky} m={m} />
      <CloudHeightCell sky={sky} m={m} />
      <CloudCoverCell sky={sky} m={m} />
      <FreqAmpCell sky={sky} m={m} />
    </>
  );
}
