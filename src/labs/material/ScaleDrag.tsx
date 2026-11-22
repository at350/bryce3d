/**
 * Texture scale control. Scales span five orders of magnitude (fine grain to whole
 * mountains), so dragging is logarithmic: 100 px to the right multiplies the scale by ~3.
 * Double-click to type a value.
 */
import { useRef, useState } from 'react';
import { clamp } from '@/core/math';
import { COMPONENT_RANGES } from '@/materials/channels';
import { useHint, usePointerDrag } from '@/ui/kit';

const [MIN, MAX] = COMPONENT_RANGES.scale;

export function formatScale(v: number): string {
  if (v < 0.1) return v.toFixed(3);
  if (v < 10) return v.toFixed(2);
  if (v < 100) return v.toFixed(1);
  return String(Math.round(v));
}

export function ScaleDrag({ value, onChange, onStart, onEnd, hint }: { value: number; onChange: (v: number) => void; onStart?: () => void; onEnd?: () => void; hint: string }) {
  const [editing, setEditing] = useState(false);
  const acc = useRef(Math.log(value));
  const onPointerDown = usePointerDrag({
    onStart: () => {
      acc.current = Math.log(Math.max(MIN, value));
      onStart?.();
    },
    onMove: (dx, _dy, e) => {
      acc.current = clamp(acc.current + dx * (e.shiftKey ? 0.0012 : 0.011), Math.log(MIN), Math.log(MAX));
      onChange(Number(Math.exp(acc.current).toPrecision(3)));
    },
    onEnd: () => onEnd?.(),
  });
  const hintHandlers = useHint(`${hint}: ${formatScale(value)} (drag; Shift = fine; double-click to type)`);
  return (
    <div className="ml-scale" {...hintHandlers}>
      <span className="ml-scale__label">Scale</span>
      {editing ? (
        <input
          className="ml-scale__input"
          autoFocus
          defaultValue={formatScale(value)}
          onBlur={(e) => {
            const v = Number(e.currentTarget.value);
            if (Number.isFinite(v) && v > 0) onChange(clamp(v, MIN, MAX));
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
            e.stopPropagation();
          }}
        />
      ) : (
        <span className="ml-scale__value" role="spinbutton" aria-label="Scale" aria-valuenow={value} tabIndex={0} onPointerDown={onPointerDown} onDoubleClick={() => setEditing(true)}>
          {formatScale(value)}
        </span>
      )}
    </div>
  );
}
