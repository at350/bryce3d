/**
 * Gradient editor for a component: the gradient bar with draggable stop markers and a
 * color chip under each stop. 2 to 4 stops; double-click a marker to remove it.
 */
import { useRef } from 'react';
import type { RGB, TextureComponent } from '@/core/types';
import { MAX_GRADIENT_STOPS, MIN_GRADIENT_STOPS } from '@/materials/channels';
import { ColorSwatch, IconButton, useHint, usePointerDrag } from '@/ui/kit';
import { gradientCss } from './labTypes';

export interface GradientEditorProps {
  gradient: TextureComponent['gradient'];
  letter: string;
  onPosition: (stop: number, at: number) => void;
  onColor: (stop: number, color: RGB) => void;
  onAdd: () => void;
  onRemove: (stop: number) => void;
  onReverse: () => void;
  onStart: () => void;
  onEnd: () => void;
}

/** Spread chip positions so neighboring chips never overlap (positions are fractions). */
function spread(ats: number[], gap: number): number[] {
  const out = ats.map((a) => Math.min(1 - gap / 2, Math.max(gap / 2, a)));
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap);
  for (let i = out.length - 1; i >= 0; i--) {
    const limit = i === out.length - 1 ? 1 - gap / 2 : out[i + 1] - gap;
    out[i] = Math.min(out[i], limit);
  }
  return out;
}

export function GradientEditor({ gradient, letter, onPosition, onColor, onAdd, onRemove, onReverse, onStart, onEnd }: GradientEditorProps) {
  const bar = useRef<HTMLDivElement>(null);
  const chips = spread(gradient.map((s) => s.at), 0.17);
  return (
    <div className="ml-grad">
      <div className="ml-grad__main">
        <div ref={bar} className="ml-grad__bar" style={{ background: gradientCss({ gradient }) }} {...useHint(`Component ${letter} gradient: the value picks a color along this bar`)}>
          {gradient.map((s, i) => (
            <StopMarker key={i} index={i} at={s.at} count={gradient.length} bar={bar} letter={letter} onPosition={onPosition} onRemove={onRemove} onStart={onStart} onEnd={onEnd} />
          ))}
        </div>
        <div className="ml-grad__chips">
          {gradient.map((s, i) => (
            <div key={i} className="ml-grad__chip" style={{ left: `${chips[i] * 100}%` }}>
              <ColorSwatch value={s.color} onChange={(c) => onColor(i, c)} onStart={onStart} onEnd={onEnd} size={16} hint={`Gradient stop ${i + 1} color`} />
            </div>
          ))}
        </div>
      </div>
      <div className="ml-grad__tools">
        <IconButton hint="Add a gradient stop" size={20} className="ml-glyph" disabled={gradient.length >= MAX_GRADIENT_STOPS} onClick={onAdd}>
          +
        </IconButton>
        <IconButton hint="Reverse the gradient" size={20} className="ml-glyph" onClick={onReverse}>
          ⇄
        </IconButton>
      </div>
    </div>
  );
}

interface StopMarkerProps {
  index: number;
  at: number;
  count: number;
  bar: React.RefObject<HTMLDivElement | null>;
  letter: string;
  onPosition: (stop: number, at: number) => void;
  onRemove: (stop: number) => void;
  onStart: () => void;
  onEnd: () => void;
}

function StopMarker({ index, at, count, bar, letter, onPosition, onRemove, onStart, onEnd }: StopMarkerProps) {
  const pos = useRef(at);
  const onPointerDown = usePointerDrag({
    onStart: () => {
      pos.current = at;
      onStart();
    },
    onMove: (dx) => {
      const width = bar.current?.getBoundingClientRect().width ?? 0;
      if (width <= 0) return;
      pos.current = Math.min(1, Math.max(0, pos.current + dx / width));
      onPosition(index, Math.round(pos.current * 1000) / 1000);
    },
    onEnd: () => onEnd(),
  });
  const removable = count > MIN_GRADIENT_STOPS;
  const hint = `Component ${letter} stop ${index + 1} at ${Math.round(at * 100)}%: drag to move${removable ? ', double-click to remove' : ''}`;
  return (
    <span
      className="ml-grad__stop"
      style={{ left: `${at * 100}%` }}
      role="slider"
      aria-label={hint}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={at}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => removable && onRemove(index)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          onPosition(index, Math.min(1, Math.max(0, at + (e.key === 'ArrowLeft' ? -0.01 : 0.01))));
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && removable) {
          e.preventDefault();
          onRemove(index);
        }
      }}
      {...useHint(hint)}
    />
  );
}
