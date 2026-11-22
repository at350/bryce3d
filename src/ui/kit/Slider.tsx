/** Bryce "control": a recessed bar with a glowing fill you drag, plus a numeric field you can click to type. */
import { useRef, useState } from 'react';
import { clamp } from '@/core/math';
import { useHint } from './hint';
import { formatNumber, keyIncrement, parseNumberInput, quantize } from './numberFormat';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  step?: number;
  precision?: number;
  hint?: string;
  width?: number;
  disabled?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  unit?: string;
}

export function Slider({ label, value, min, max, onChange, step, precision = 0, hint, width = 220, disabled, onStart, onEnd, unit = '' }: SliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cancelled = useRef(false);
  const s = step ?? 0;
  const text = formatNumber(value, precision);
  const hintHandlers = useHint(`${hint ?? label}: ${text}${unit}`);
  const frac = max > min ? clamp((value - min) / (max - min), 0, 1) : 0;

  const valueAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return value;
    return quantize(min + clamp((clientX - r.left) / r.width, 0, 1) * (max - min), s, min, max);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.focus({ preventScroll: true });
    const id = e.pointerId;
    try {
      el.setPointerCapture(id);
    } catch {
      // ignore
    }
    setDragging(true);
    onStart?.();
    onChange(valueAt(e.clientX));
    const move = (ev: PointerEvent) => {
      if (ev.pointerId === id) onChange(valueAt(ev.clientX));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDragging(false);
      onEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const inc = (s > 0 ? s : Math.max(keyIncrement(0, precision), (max - min) / 100)) * (e.shiftKey ? 10 : 1);
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + inc;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - inc;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next === null) return;
    e.preventDefault();
    onChange(quantize(next, s, min, max));
  };

  const commit = (raw: string) => {
    setEditing(false);
    if (cancelled.current) return;
    const v = parseNumberInput(raw);
    if (v === null) return;
    onStart?.();
    onChange(quantize(v, s, min, max));
    onEnd?.();
  };

  return (
    <div className={`bk-slider ${disabled ? 'is-disabled' : ''} ${dragging ? 'is-dragging' : ''}`} style={{ width }} {...hintHandlers}>
      <span className="bk-slider__label">{label}</span>
      <div
        ref={track}
        className="bk-slider__track"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${text}${unit}`}
        aria-disabled={disabled || undefined}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        <div className="bk-slider__fill" style={{ width: `${frac * 100}%` }} />
      </div>
      {editing ? (
        <input
          className="bk-slider__input"
          data-bk-own-escape=""
          autoFocus
          defaultValue={text}
          aria-label={`${label} value`}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(e.currentTarget.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelled.current = true;
              setEditing(false);
            }
          }}
        />
      ) : (
        <button type="button" className="bk-slider__value" disabled={disabled} aria-label={`Type a value for ${label}`} onClick={() => {
            cancelled.current = false;
            setEditing(true);
          }}>
          {text}
          {unit}
        </button>
      )}
    </div>
  );
}
