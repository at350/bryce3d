/** Sky & Fog style thumbnail: drag horizontally (and vertically) on it to change values. */
import { useRef, useState, type ReactNode } from 'react';
import { clamp } from '@/core/math';
import { useHint } from './hint';
import { usePointerDrag } from './pointerDrag';

export interface DragPadProps {
  /** Current x value (horizontal drag). */
  x: number;
  xRange: [number, number];
  /** Optional y value (vertical drag; up = larger). */
  y?: number;
  yRange?: [number, number];
  onChange: (x: number, y?: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  hint?: string;
  width?: number;
  height?: number;
  /** Thumbnail content (e.g. a mini preview of the effect). */
  children?: ReactNode;
  disabled?: boolean;
}

const short = (v: number) => (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

export function DragPad({ x, xRange, y, yRange, onChange, onStart, onEnd, hint, width = 56, height = 42, children, disabled }: DragPadProps) {
  const acc = useRef({ x, y: y ?? 0 });
  const [dragging, setDragging] = useState(false);
  const onPointerDown = usePointerDrag({
    onStart: (e) => {
      (e.currentTarget as HTMLElement).focus({ preventScroll: true });
      acc.current = { x, y: y ?? 0 };
      setDragging(true);
      onStart?.();
    },
    onMove: (dx, dy, e) => {
      const k = e.shiftKey ? 0.1 : 1;
      acc.current.x = clamp(acc.current.x + (dx * k * (xRange[1] - xRange[0])) / 150, xRange[0], xRange[1]);
      if (yRange) acc.current.y = clamp(acc.current.y - (dy * k * (yRange[1] - yRange[0])) / 150, yRange[0], yRange[1]);
      onChange(acc.current.x, yRange ? acc.current.y : undefined);
    },
    onEnd: () => {
      setDragging(false);
      onEnd?.();
    },
  });
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const k = e.shiftKey ? 0.1 : 0.02;
    let nx = x;
    let ny = y;
    if (e.key === 'ArrowRight') nx = x + (xRange[1] - xRange[0]) * k;
    else if (e.key === 'ArrowLeft') nx = x - (xRange[1] - xRange[0]) * k;
    else if (yRange && y !== undefined && e.key === 'ArrowUp') ny = y + (yRange[1] - yRange[0]) * k;
    else if (yRange && y !== undefined && e.key === 'ArrowDown') ny = y - (yRange[1] - yRange[0]) * k;
    else return;
    e.preventDefault();
    onStart?.();
    onChange(clamp(nx, xRange[0], xRange[1]), yRange && ny !== undefined ? clamp(ny, yRange[0], yRange[1]) : undefined);
    onEnd?.();
  };
  const readout = `${short(x)}${y !== undefined ? ` / ${short(y)}` : ''}`;
  const label = hint ? `${hint}: ${readout}` : undefined;
  return (
    <div
      className={`bk-dragpad ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={{ width, height }}
      tabIndex={disabled ? -1 : 0}
      aria-roledescription="drag pad"
      aria-label={label ?? 'Drag pad'}
      aria-disabled={disabled || undefined}
      onPointerDown={disabled ? undefined : onPointerDown}
      onKeyDown={onKeyDown}
      {...useHint(label)}
    >
      {children}
      {dragging && <span className="bk-dragpad__readout">{readout}</span>}
    </div>
  );
}
