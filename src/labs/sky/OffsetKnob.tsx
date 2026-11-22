/**
 * Cloud offset knob (Bryce's cloud motion control, minus the animation): drag to slide a
 * cloud layer's pattern across the sky; the arrow shows which way it has moved.
 * Double-click recenters it.
 */
import { useRef } from 'react';
import { clamp } from '@/core/math';
import { CLOUD_OFFSET_LIMIT } from '@/sky/ranges';
import { setHint, useHint, usePointerDrag } from '@/ui/kit';

/** World units of cloud offset per dragged pixel. */
const UNITS_PER_PX = 25;

export function OffsetKnob({ offset, onChange, size = 56, label }: { offset: [number, number]; onChange: (o: [number, number]) => void; size?: number; label: string }) {
  const acc = useRef<[number, number]>(offset);
  const text = (o: [number, number]) => `${label} offset: x ${Math.round(o[0])}, z ${Math.round(o[1])}`;
  const onPointerDown = usePointerDrag({
    onStart: () => {
      acc.current = offset;
    },
    onMove: (dx, dy, e) => {
      const k = UNITS_PER_PX * (e.shiftKey ? 0.1 : 1);
      const lim = CLOUD_OFFSET_LIMIT;
      acc.current = [clamp(acc.current[0] + dx * k, -lim, lim), clamp(acc.current[1] + dy * k, -lim, lim)];
      onChange(acc.current);
      setHint(text(acc.current));
    },
  });
  const hint = useHint(`${text(offset)}. Drag to slide the clouds, double-click to recenter`);
  // Direction of travel, compressed so big offsets stay on the dial.
  const len = Math.hypot(offset[0], offset[1]);
  const reach = len > 0 ? Math.min(1, Math.log10(1 + len / 200) / 2) : 0;
  const ax = len > 0 ? (offset[0] / len) * reach * 34 : 0;
  const ay = len > 0 ? (offset[1] / len) * reach * 34 : 0;
  return (
    <div
      className="skylab__knob"
      style={{ width: size, height: size }}
      role="slider"
      tabIndex={0}
      aria-label={`${label} cloud offset`}
      aria-valuetext={`x ${Math.round(offset[0])}, z ${Math.round(offset[1])}`}
      onPointerDown={onPointerDown}
      onDoubleClick={() => onChange([0, 0])}
      onKeyDown={(e) => {
        const step = (e.shiftKey ? 20 : 4) * UNITS_PER_PX;
        const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const v = d[e.key];
        if (!v) return;
        e.preventDefault();
        onChange([offset[0] + v[0], offset[1] + v[1]]);
      }}
      {...hint}
    >
      <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true">
        <circle r="46" className="skylab__knobface" />
        <circle r="34" className="skylab__knobring" />
        {[0, 90, 180, 270].map((a) => (
          <line key={a} x1="0" y1="-44" x2="0" y2="-38" className="skylab__knobtick" transform={`rotate(${a})`} />
        ))}
        <line x1="0" y1="0" x2={ax} y2={ay} className="skylab__knobarrow" />
        <circle cx={ax} cy={ay} r="6" className="skylab__knobdot" />
      </svg>
    </div>
  );
}
