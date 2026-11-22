/** Bryce numeric field: drag left/right on it to change, double-click (or Enter) to type. */
import { useRef, useState } from 'react';
import { clamp } from '@/core/math';
import { useHint } from './hint';
import { formatNumber, keyIncrement, parseNumberInput, quantize } from './numberFormat';
import { usePointerDrag } from './pointerDrag';

export interface DragValueProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
  step?: number;
  /** Decimal places shown (default 0). */
  precision?: number;
  unit?: string;
  hint?: string;
  /** Width in px. */
  width?: number;
  onStart?: () => void;
  onEnd?: () => void;
  /** Value change per dragged pixel (default (max - min) / 300). Shift = 1/10, Alt = 10x. */
  speed?: number;
  disabled?: boolean;
  className?: string;
}

export function DragValue({
  value,
  min,
  max,
  onChange,
  label,
  step = 0,
  precision = 0,
  unit = '',
  hint,
  width = 64,
  onStart,
  onEnd,
  speed,
  disabled,
  className = '',
}: DragValueProps) {
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const acc = useRef(value);
  const cancelled = useRef(false);
  const pxSpeed = speed ?? (max - min) / 300;
  const text = formatNumber(value, precision);

  const onPointerDown = usePointerDrag({
    onStart: (e) => {
      (e.currentTarget as HTMLElement).focus({ preventScroll: true });
      acc.current = value;
      setDragging(true);
      onStart?.();
    },
    onMove: (dx, _dy, e) => {
      const mult = e.shiftKey ? 0.1 : e.altKey ? 10 : 1;
      acc.current = clamp(acc.current + dx * pxSpeed * mult, min, max);
      onChange(quantize(acc.current, step, min, max));
    },
    onEnd: () => {
      setDragging(false);
      onEnd?.();
    },
  });

  const commitTyped = (raw: string) => {
    setEditing(false);
    if (cancelled.current) return;
    const v = parseNumberInput(raw);
    if (v === null) return;
    onStart?.();
    onChange(quantize(v, step, min, max));
    onEnd?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      cancelled.current = false;
      setEditing(true);
      return;
    }
    const dir = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const inc = keyIncrement(step, precision) * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);
    onChange(quantize(value + dir * inc, step, min, max));
  };

  const hintText = hint ?? label;
  const hintHandlers = useHint(hintText ? `${hintText}: ${text}${unit}` : undefined);
  return (
    <div className={`bk-dragvalue ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''} ${className}`} style={{ width }} {...hintHandlers}>
      {label && <span className="bk-dragvalue__label">{label}</span>}
      {editing ? (
        <input
          className="bk-dragvalue__input"
          data-bk-own-escape=""
          autoFocus
          defaultValue={text}
          aria-label={hintText ?? 'Value'}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commitTyped(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitTyped(e.currentTarget.value);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelled.current = true;
              setEditing(false);
            }
          }}
        />
      ) : (
        <span
          className="bk-dragvalue__value"
          role="spinbutton"
          tabIndex={disabled ? -1 : 0}
          aria-label={hintText ?? 'Value'}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-disabled={disabled || undefined}
          onPointerDown={disabled ? undefined : onPointerDown}
          onDoubleClick={() => {
            if (disabled) return;
            cancelled.current = false;
            setEditing(true);
          }}
          onKeyDown={onKeyDown}
        >
          {text}
          {unit}
        </span>
      )}
    </div>
  );
}
