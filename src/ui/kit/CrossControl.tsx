/** Bryce camera cross: four metal arrows around a glossy ball, tilted into the plane it moves in. */
import { useId, useState } from 'react';
import { useHint } from './hint';
import { usePointerDrag } from './pointerDrag';

export interface CrossControlProps {
  /** Which pair of world axes this cross moves along (first = horizontal drag, second = vertical drag). */
  plane: 'xz' | 'xy' | 'zy';
  /** Deltas along the two axes in pixels (b is positive when dragging up). */
  onDrag: (a: number, b: number, e: PointerEvent) => void;
  onStart?: () => void;
  onEnd?: () => void;
  hint?: string;
  size?: number;
  disabled?: boolean;
}

type Dir = 'n' | 's' | 'e' | 'w' | null;

const ARROW = 'M50 4 L63 21 L56 21 L56 36 L44 36 L44 21 L37 21 Z';

export function CrossControl({ plane, onDrag, onStart, onEnd, hint, size = 54, disabled }: CrossControlProps) {
  const id = useId().replace(/:/g, '');
  const [dir, setDir] = useState<Dir>(null);
  const [dragging, setDragging] = useState(false);
  const onPointerDown = usePointerDrag({
    onStart: (e) => {
      (e.currentTarget as HTMLElement).focus({ preventScroll: true });
      setDragging(true);
      onStart?.();
    },
    onMove: (dx, dy, e) => {
      setDir(Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n');
      onDrag(dx, -dy, e);
    },
    onEnd: () => {
      setDragging(false);
      setDir(null);
      onEnd?.();
    },
  });
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const d = map[e.key];
    if (!d || disabled) return;
    e.preventDefault();
    onStart?.();
    onDrag(d[0], d[1], new PointerEvent('pointermove', { shiftKey: e.shiftKey, altKey: e.altKey }));
    onEnd?.();
  };
  const arrow = (rot: number, d: Exclude<Dir, null>) => (
    <g transform={`rotate(${rot} 50 50)`} className={dir === d ? 'is-lit' : ''}>
      <path d={ARROW} className="bk-cross-arrow-shadow" transform="translate(1.2 2)" />
      <path d={ARROW} fill={`url(#${id}a)`} className="bk-cross-arrow" />
    </g>
  );
  return (
    <div
      className={`bk-cross bk-cross--${plane} ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={{ width: size, height: size }}
      tabIndex={disabled ? -1 : 0}
      aria-roledescription="camera cross"
      aria-label={hint ? `${hint} (drag, or use the arrow keys)` : `Move in the ${plane.toUpperCase()} plane`}
      aria-disabled={disabled || undefined}
      onPointerDown={disabled ? undefined : onPointerDown}
      onKeyDown={onKeyDown}
      {...useHint(hint)}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="bk-cross__svg" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0" className="bk-ca-hi" />
            <stop offset="0.5" className="bk-ca-mid" />
            <stop offset="1" className="bk-ca-lo" />
          </linearGradient>
          <radialGradient id={`${id}b`} cx="0.36" cy="0.3" r="0.75">
            <stop offset="0" className="bk-ball-hi" />
            <stop offset="0.5" className="bk-ball-mid" />
            <stop offset="1" className="bk-ball-lo" />
          </radialGradient>
        </defs>
        {arrow(0, 'n')}
        {arrow(90, 'e')}
        {arrow(180, 's')}
        {arrow(270, 'w')}
        <circle cx="51" cy="53" r="15" fill="#000" opacity="0.25" />
        <circle cx="50" cy="50" r="15" fill={`url(#${id}b)`} />
        <ellipse cx="45" cy="43" rx="7" ry="4.5" fill="#fff" opacity="0.75" />
      </svg>
    </div>
  );
}
