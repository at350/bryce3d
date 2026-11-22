/** Paintbrush controls: mode, size, softness, flow and the level used by Plateau. */
import { useRef } from 'react';
import { Slider, Toggle, useHint } from '@/ui/kit';
import { BRUSH_MODES, type BrushSettings } from '@/terrain';
import { capturePointer } from './capture';

interface Props {
  brush: BrushSettings;
  onChange(b: BrushSettings): void;
  showBrush: boolean;
  onShowBrush(v: boolean): void;
  rampCss: string;
}

function ModeButton({ id, label, hint, active, onPick }: { id: string; label: string; hint: string; active: boolean; onPick(): void }) {
  return (
    <button type="button" className={`te-mode te-mode--${id} ${active ? 'is-active' : ''}`} onClick={onPick} aria-pressed={active} {...useHint(`${label} brush: ${hint}`)}>
      <span className="te-mode__glyph" aria-hidden />
      {label}
    </button>
  );
}

/** Bryce's paintbrush level: a vertical gray strip with a red dot; drag to set the height. */
function LevelBar({ level, onChange, rampCss }: { level: number; onChange(v: number): void; rampCss: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    onChange(Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height)));
  };
  return (
    <div
      ref={ref}
      className="te-level"
      style={{ background: rampCss }}
      onPointerDown={(e) => {
        capturePointer(e.currentTarget, e.pointerId);
        set(e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) set(e.clientY);
      }}
      {...useHint(`Brush level ${(level * 100).toFixed(0)}%: the height Plateau flattens to (Space-click the canvas to pick one)`)}
    >
      <span className="te-level__dot" style={{ bottom: `${level * 100}%` }} />
    </div>
  );
}

export function BrushPanel({ brush, onChange, showBrush, onShowBrush, rampCss }: Props) {
  const set = (patch: Partial<BrushSettings>) => onChange({ ...brush, ...patch });
  const soft = brush.softness;
  return (
    <aside className="te-brush">
      <h3 className="te-panel-title">Paintbrush</h3>
      <div className="te-brush__preview" {...useHint('Brush preview: size and softness')}>
        <span
          style={{
            width: `${Math.max(6, Math.min(100, brush.size * 2 * 100 * 1.4))}%`,
            background: `radial-gradient(circle, rgba(255,255,255,${0.35 + brush.flow * 0.65}) ${(1 - soft) * 70}%, rgba(255,255,255,0) 71%)`,
          }}
        />
      </div>
      <div className="te-modes">
        {BRUSH_MODES.map((m) => (
          <ModeButton key={m.id} id={m.id} label={m.label} hint={m.hint} active={brush.mode === m.id} onPick={() => set({ mode: m.id })} />
        ))}
      </div>
      <div className="te-brush__sliders">
        <Slider label="Size" value={brush.size * 200} min={1} max={80} step={0.5} precision={0} width={176} onChange={(v) => set({ size: v / 200 })} hint="Brush diameter, % of the canvas ([ and ] keys)" />
        <Slider label="Softness" value={soft * 100} min={0} max={100} step={1} width={176} onChange={(v) => set({ softness: v / 100 })} hint="Hard edge (0) to feathered (100)" />
        <Slider label="Flow" value={brush.flow * 100} min={1} max={100} step={1} width={176} onChange={(v) => set({ flow: v / 100 })} hint="How much each dab changes the terrain" />
      </div>
      <div className="te-brush__level">
        <LevelBar level={brush.level} onChange={(v) => set({ level: v })} rampCss={rampCss} />
        <div className="te-brush__levelinfo">
          <strong>Level</strong>
          <span>{(brush.level * 100).toFixed(0)}%</span>
          <small>Plateau target. Space-click the canvas to pick a height.</small>
        </div>
      </div>
      <Toggle label="Show brush outline" value={showBrush} onChange={onShowBrush} hint="Show the brush circle over the canvas" />
      <p className="te-tip">Alt inverts Raise/Lower · Shift paints straight lines</p>
    </aside>
  );
}
