/** Small building blocks for the Sky Lab tabs: framed panels and range-bound controls. */
import type { ReactNode } from 'react';
import type { RGB } from '@/core/types';
import type { ValueRange } from '@/sky/ranges';
import { ColorSwatch, Slider, Toggle } from '@/ui/kit';

export function Panel({
  title,
  children,
  className = '',
  toggle,
  extra,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  toggle?: { on: boolean; onChange: (on: boolean) => void; hint: string };
  extra?: ReactNode;
}) {
  return (
    <section className={`skylab__panel ${toggle && !toggle.on ? 'is-off' : ''} ${className}`}>
      <header className="skylab__panelhead">
        {toggle ? <Toggle label={title} value={toggle.on} onChange={toggle.onChange} hint={toggle.hint} /> : <h2>{title}</h2>}
        {extra && <div className="skylab__panelextra">{extra}</div>}
      </header>
      <div className="skylab__panelbody">{children}</div>
    </section>
  );
}

export function RangeSlider({
  range,
  value,
  onChange,
  label,
  hint,
  width = 250,
  disabled,
  scale = 1,
  unit,
}: {
  range: ValueRange;
  value: number;
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
  width?: number;
  disabled?: boolean;
  /** Display scale (e.g. 100 shows a 0..1 value as 0..100). */
  scale?: number;
  unit?: string;
}) {
  return (
    <Slider
      label={label ?? range.label}
      hint={hint}
      value={value * scale}
      min={range.min * scale}
      max={range.max * scale}
      precision={scale === 1 ? range.precision ?? 0 : 0}
      unit={unit ?? range.unit}
      width={width}
      disabled={disabled}
      onChange={(v) => onChange(v / scale)}
    />
  );
}

export function SwatchField({ label, value, onChange, hint }: { label: string; value: RGB; onChange: (c: RGB) => void; hint?: string }) {
  return (
    <div className="skylab__swatch">
      <ColorSwatch label={label} value={value} onChange={onChange} hint={hint} size={20} />
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="skylab__note">{children}</p>;
}
