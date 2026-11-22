/** Filtering tab: remap heights through a curve (presets, live preview, Apply). */
import { useEffect, useMemo, useState } from 'react';
import { Button, Slider, Toggle, useHint } from '@/ui/kit';
import {
  applyLUT,
  applyOpToTerrain,
  buildCurveLUT,
  CURVE_PRESETS,
  curveToParams,
  histogram,
  identityCurve,
  isIdentityCurve,
  type CurvePreset,
  type FilterCurve,
} from '@/terrain';
import { lerpHeights } from '@/terrain/grid';
import type { EditorContext } from './actions';
import { CurveEditor, curvePath } from './CurveEditor';

interface Props {
  ctx: EditorContext;
  rampCss: string;
}

function PresetButton({ preset, active, onPick }: { preset: CurvePreset; active: boolean; onPick(): void }) {
  return (
    <button type="button" className={`te-preset ${active ? 'is-active' : ''}`} onClick={onPick} aria-label={preset.label} {...useHint(`${preset.label}: ${preset.hint}`)}>
      <svg viewBox="-4 -4 108 108" className="te-preset__icon" aria-hidden>
        <rect x={-4} y={-4} width={108} height={108} rx={10} />
        <path d={curvePath(preset.curve, 40)} />
      </svg>
      <span>{preset.label}</span>
    </button>
  );
}

export function FilteringTab({ ctx, rampCss }: Props) {
  const [curve, setCurve] = useState<FilterCurve>(identityCurve);
  const [amount, setAmount] = useState(1);
  const [presetId, setPresetId] = useState('reset');
  const [live, setLive] = useState(true);
  const terrain = ctx.ws.terrain;
  const { preview } = ctx;
  const hist = useMemo(() => histogram(terrain.heights, 64), [terrain]);
  const identity = useMemo(() => isIdentityCurve(curve), [curve]);

  useEffect(() => {
    if (identity || !live || amount <= 0) {
      preview.clear();
      return;
    }
    const out = applyLUT(terrain.heights, buildCurveLUT(curve, 2048));
    preview.show(amount < 1 ? lerpHeights(terrain.heights, out, amount, out) : out);
  }, [curve, amount, terrain, identity, live, preview]);

  useEffect(() => () => preview.clear(), [preview]);

  const edit = (c: FilterCurve) => {
    setCurve(c);
    setPresetId('');
  };

  const apply = () => {
    if (identity || amount <= 0) return;
    const params = curveToParams(curve);
    if (amount < 1) params.amount = Math.round(amount * 1000) / 1000;
    ctx.ws.commit(applyOpToTerrain(ctx.ws.current(), 'curve', params));
    ctx.setLast(null);
    setCurve(identityCurve());
    setPresetId('reset');
  };

  return (
    <div className="te-filtering">
      <div className="te-presets">
        {CURVE_PRESETS.map((p) => (
          <PresetButton
            key={p.id}
            preset={p}
            active={p.id === presetId}
            onPick={() => {
              setCurve(p.curve);
              setPresetId(p.id);
            }}
          />
        ))}
      </div>
      <div className="te-filtering__body">
        <CurveEditor curve={curve} onChange={edit} histogram={hist} rampCss={rampCss} />
        <div className="te-filtering__side">
          <Toggle label="Smooth curve" value={curve.smooth} onChange={(v) => edit({ ...curve, smooth: v })} hint="Smooth curve, or straight segments for crisp steps" />
          <Toggle label="Live preview" value={live} onChange={setLive} hint="Show the filtered terrain on the canvas and in 3D before applying" />
          <p className="te-note">{identity ? 'Pick a preset or drag the line to reshape the heights.' : live ? 'Previewing: Apply to keep it.' : 'Preview off.'}</p>
        </div>
      </div>
      <Slider label="Amount" value={amount} min={0} max={1} step={0.01} precision={2} width={300} onChange={setAmount} hint="Blend between the original and the filtered heights" />
      <div className="te-row">
        <Button onClick={() => edit(identityCurve())} hint="Back to the straight diagonal" disabled={identity}>
          Reset
        </Button>
        <Button variant="primary" onClick={apply} hint="Apply the filter to the terrain" disabled={identity || amount <= 0}>
          Apply
        </Button>
      </div>
    </div>
  );
}
