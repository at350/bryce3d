/**
 * The clipping bracket beside the canvas: heights outside [low, high] are not rendered
 * (below low: cut away, above high: flattened). Drag either end, or the middle to move both.
 * Double-click resets.
 */
import { useRef } from 'react';
import { useHint } from '@/ui/kit';
import { capturePointer } from './capture';

interface Props {
  low: number;
  high: number;
  rampCss: string;
  onChange(low: number, high: number): void;
  onStart(): void;
  onEnd(): void;
}

const MIN_GAP = 0.01;

export function ClipBracket({ low, high, rampCss, onChange, onStart, onEnd }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ part: 'low' | 'high' | 'both'; y0: number; low: number; high: number } | null>(null);

  const valueAt = (clientY: number) => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, 1 - (clientY - r.top) / r.height));
  };

  const begin = (part: 'low' | 'high' | 'both') => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (e.altKey) {
      onStart();
      onChange(0, 1);
      onEnd();
      return;
    }
    capturePointer(barRef.current!, e.pointerId);
    drag.current = { part, y0: valueAt(e.clientY), low, high };
    onStart();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const v = valueAt(e.clientY);
    if (d.part === 'low') onChange(Math.min(v, d.high - MIN_GAP), d.high);
    else if (d.part === 'high') onChange(d.low, Math.max(v, d.low + MIN_GAP));
    else {
      const delta = Math.min(1 - d.high, Math.max(-d.low, v - d.y0));
      onChange(d.low + delta, d.high + delta);
    }
  };

  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    onEnd();
  };

  const hint = useHint(`Clipping bracket ${(low * 100).toFixed(0)}%–${(high * 100).toFixed(0)}%: drag the ends to cut away lows (red) or flatten highs (yellow); drag the middle to move both; double-click resets`);

  return (
    <div className="te-clip" {...hint}>
      <span className="te-clip__value">{(high * 100).toFixed(0)}</span>
      <div
        ref={barRef}
        className="te-clip__bar"
        style={{ background: rampCss }}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onDoubleClick={() => {
          onStart();
          onChange(0, 1);
          onEnd();
        }}
      >
        <span className="te-clip__out te-clip__out--high" style={{ height: `${(1 - high) * 100}%` }} />
        <span className="te-clip__out te-clip__out--low" style={{ height: `${low * 100}%` }} />
        <span className="te-clip__range" style={{ bottom: `${low * 100}%`, top: `${(1 - high) * 100}%` }} onPointerDown={begin('both')} />
        <span className="te-clip__handle te-clip__handle--high" style={{ bottom: `${high * 100}%` }} onPointerDown={begin('high')} />
        <span className="te-clip__handle te-clip__handle--low" style={{ bottom: `${low * 100}%` }} onPointerDown={begin('low')} />
      </div>
      <span className="te-clip__value">{(low * 100).toFixed(0)}</span>
    </div>
  );
}
