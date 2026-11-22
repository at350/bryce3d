/**
 * The sun / moon trackball: a glossy ball showing the sky dome from above with the sun's
 * highlight (and the smaller moon highlight opposite). Drag to roll the sun around the
 * sky, double-click to swap day and night. Used by the Sky & Fog palette and the Sky Lab.
 */
import { useCallback } from 'react';
import type { Sky } from '@/core/types';
import { Trackball, setHint } from '@/ui/kit';
import { paintSunBall } from '../paint/ball';
import { describeSun, flipSunMoon, rollSun, type SunPosition } from '../sun';
import { PaintCanvas } from './PaintCanvas';
import './skyui.css';

export interface SunBallProps {
  sky: Sky;
  size: number;
  /** Latest sun position (read at every drag step so fast drags never use stale props). */
  getPosition: () => SunPosition;
  onChange: (p: SunPosition) => void;
  onStart?: () => void;
  onEnd?: () => void;
  className?: string;
}

export function SunBall({ sky, size, getPosition, onChange, onStart, onEnd, className = '' }: SunBallProps) {
  const paint = useCallback((ctx: CanvasRenderingContext2D, w: number) => paintSunBall(ctx, w, sky), [sky]);
  const hint = `${describeSun(sky)}. Drag to move the sun, double-click for ${sky.sunAltitude >= 0 ? 'night' : 'day'}`;
  return (
    <div
      className={`sky-sunball ${className}`}
      style={{ width: size, height: size }}
      onDoubleClick={() => {
        onStart?.();
        const next = flipSunMoon(getPosition());
        onChange(next);
        setHint(describeSun({ ...next, linkSunToView: sky.linkSunToView }));
        onEnd?.();
      }}
    >
      <Trackball
        variant="sun"
        size={size}
        hint={hint}
        onStart={onStart}
        onEnd={onEnd}
        onDrag={(dx, dy, e) => {
          const k = e.shiftKey ? 0.25 : 1;
          const next = rollSun(getPosition(), dx * k, dy * k, size);
          onChange(next);
          setHint(describeSun({ ...next, linkSunToView: sky.linkSunToView }));
        }}
      >
        <PaintCanvas width={Math.round(size * 0.9)} height={Math.round(size * 0.9)} paint={paint} maxDpr={1.5} className="sky-sunball__canvas" />
      </Trackball>
    </div>
  );
}
