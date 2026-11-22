/** Glossy trackball with a four-way arrow cross: drag it (or use arrow keys) to rotate something. */
import { useId, useRef, useState, type ReactNode } from 'react';
import { clamp } from '@/core/math';
import { useHint } from './hint';
import { usePointerDrag } from './pointerDrag';

export interface TrackballProps {
  /** Pixel deltas while dragging. */
  onDrag: (dx: number, dy: number, e: PointerEvent) => void;
  onStart?: () => void;
  onEnd?: () => void;
  hint?: string;
  /** Diameter in px (default 64). */
  size?: number;
  variant?: 'camera' | 'sun';
  children?: ReactNode;
  disabled?: boolean;
}

const ARROWS =
  'M50 14 L61 27 L55 27 L55 45 L73 45 L73 39 L86 50 L73 61 L73 55 L55 55 L55 73 L61 73 L50 86 L39 73 L45 73 L45 55 L27 55 L27 61 L14 50 L27 39 L27 45 L45 45 L45 27 L39 27 Z';

export function Trackball({ onDrag, onStart, onEnd, hint, size = 64, variant = 'camera', children, disabled }: TrackballProps) {
  const id = useId().replace(/:/g, '');
  const [roll, setRoll] = useState<{ x: number; y: number } | null>(null);
  const rollRef = useRef({ x: 0, y: 0 });
  const onPointerDown = usePointerDrag({
    onStart: (e) => {
      (e.currentTarget as HTMLElement).focus({ preventScroll: true });
      rollRef.current = { x: 0, y: 0 };
      setRoll({ x: 0, y: 0 });
      onStart?.();
    },
    onMove: (dx, dy, e) => {
      const r = rollRef.current;
      rollRef.current = { x: clamp(r.x + dx * 0.35, -9, 9), y: clamp(r.y + dy * 0.35, -9, 9) };
      setRoll(rollRef.current);
      onDrag(dx, dy, e);
    },
    onEnd: () => {
      setRoll(null);
      onEnd?.();
    },
  });
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 24 : 6;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = map[e.key];
    if (!d || disabled) return;
    e.preventDefault();
    onStart?.();
    onDrag(d[0], d[1], new PointerEvent('pointermove', { shiftKey: e.shiftKey, altKey: e.altKey }));
    onEnd?.();
  };
  const tilt = roll ? `translate(${roll.x} ${roll.y})` : undefined;
  return (
    <div
      className={`bk-trackball bk-trackball--${variant} ${roll ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={{ width: size, height: size }}
      tabIndex={disabled ? -1 : 0}
      aria-roledescription="trackball"
      aria-label={hint ? `${hint} (drag, or use the arrow keys)` : 'Trackball'}
      aria-disabled={disabled || undefined}
      onPointerDown={disabled ? undefined : onPointerDown}
      onKeyDown={onKeyDown}
      {...useHint(hint)}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <defs>
          <radialGradient id={`${id}b`} cx="0.36" cy="0.3" r="0.78">
            <stop offset="0" className="bk-tb-hi" />
            <stop offset="0.5" className="bk-tb-mid" />
            <stop offset="1" className="bk-tb-lo" />
          </radialGradient>
          <linearGradient id={`${id}a`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" className="bk-tba-hi" />
            <stop offset="0.55" className="bk-tba-mid" />
            <stop offset="1" className="bk-tba-lo" />
          </linearGradient>
          <radialGradient id={`${id}g`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`${id}c`}>
            <circle cx="50" cy="50" r="45" />
          </clipPath>
        </defs>
        <circle cx="50" cy="50" r="46" className="bk-tb-rim" />
        <circle cx="50" cy="50" r="45" fill={`url(#${id}b)`} />
        {variant === 'camera' && (
          <g clipPath={`url(#${id}c)`}>
            <g className="bk-tb-arrows" transform={tilt}>
              <path d={ARROWS} className="bk-tb-arrow-shadow" transform="translate(1.5 2.5)" />
              <path d={ARROWS} fill={`url(#${id}a)`} className="bk-tb-arrow" />
            </g>
          </g>
        )}
        <ellipse cx="40" cy="26" rx="22" ry="13" fill={`url(#${id}g)`} opacity="0.85" />
      </svg>
      {children && <div className="bk-trackball__overlay">{children}</div>}
    </div>
  );
}
