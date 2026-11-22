/**
 * The Bryce grid's value control: an LED bar you drag across (or click to jump), with a
 * numeric field (kit DragValue) for exact entry. Negative ranges fill from the middle.
 */
import { useRef } from 'react';
import { clamp } from '@/core/math';
import { DragValue, useHint, usePointerDrag } from '@/ui/kit';

export interface ChannelBarProps {
  label: string;
  value: number;
  min: number;
  max: number;
  precision?: number;
  hint: string;
  /** The value multiplies a driving texture (shown as a dimmer, striped bar). */
  driven?: boolean;
  onChange: (v: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export function ChannelBar({ label, value, min, max, precision = 0, hint, driven, onChange, onStart, onEnd }: ChannelBarProps) {
  const track = useRef<HTMLDivElement>(null);
  const range = max - min;
  const fromPointer = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return value;
    return clamp(min + ((clientX - r.left) / r.width) * range, min, max);
  };
  const acc = useRef(value);
  const onPointerDown = usePointerDrag({
    onStart: (e) => {
      onStart?.();
      acc.current = fromPointer(e.clientX);
      onChange(round(acc.current, precision));
    },
    onMove: (dx, _dy, e) => {
      const r = track.current?.getBoundingClientRect();
      const perPx = r && r.width > 0 ? range / r.width : range / 120;
      acc.current = clamp(acc.current + dx * perPx * (e.shiftKey ? 0.1 : 1), min, max);
      onChange(round(acc.current, precision));
    },
    onEnd: () => onEnd?.(),
  });
  const zero = min < 0 ? (-min / range) * 100 : 0;
  const pos = ((clamp(value, min, max) - min) / range) * 100;
  const left = Math.min(zero, pos);
  const width = Math.abs(pos - zero);
  const hintHandlers = useHint(`${hint}${driven ? ' (multiplies the texture)' : ''}: ${round(value, precision)}`);
  return (
    <div className={`ml-bar ${driven ? 'is-driven' : ''}`}>
      <div
        ref={track}
        className="ml-bar__track"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={round(value, precision)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => {
          const step = (e.shiftKey ? 10 : 1) * (precision > 0 ? Math.pow(10, -precision) : 1);
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(clamp(value + step, min, max));
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(clamp(value - step, min, max));
          else return;
          e.preventDefault();
        }}
        {...hintHandlers}
      >
        <div className="ml-bar__fill" style={{ left: `${left}%`, width: `${width}%` }} />
        {min < 0 && <div className="ml-bar__zero" style={{ left: `${zero}%` }} />}
      </div>
      <DragValue value={value} min={min} max={max} precision={precision} onChange={onChange} onStart={onStart} onEnd={onEnd} hint={hint} width={52} />
    </div>
  );
}

function round(v: number, precision: number): number {
  const k = Math.pow(10, precision);
  return Math.round(v * k) / k;
}
