/**
 * Shared Bryce-style controls. Props are a contract used by every module: owners of
 * src/ui may restyle and add optional props, but must not rename or remove props.
 *
 * NOTE: foundation versions (functional, plain styling).
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { clamp, hexToRgb, rgbToHex } from '@/core/math';
import type { RGB } from '@/core/types';
import { useHint } from './hint';

// ---------------------------------------------------------------------------

export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  hint?: string;
  variant?: 'default' | 'primary' | 'ghost';
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Button({ children, onClick, hint, variant = 'default', disabled, className = '', style }: ButtonProps) {
  return (
    <button
      type="button"
      className={`bk-button bk-button--${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
      {...useHint(hint)}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

export interface IconButtonProps {
  /** Shown in the Text Display Area on hover (also the accessible label). */
  hint: string;
  children: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  active?: boolean;
  disabled?: boolean;
  /** Square size in px (default 36). */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function IconButton({ hint, children, onClick, onPointerDown, active, disabled, size = 36, className = '', style }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={hint}
      className={`bk-iconbutton ${active ? 'is-active' : ''} ${className}`}
      style={{ width: size, height: size, ...style }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      {...useHint(hint)}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

/** Pointer-drag helper: calls onMove with deltas since the last event while the pointer is held. */
export function usePointerDrag(handlers: {
  onStart?: (e: React.PointerEvent) => void;
  onMove: (dx: number, dy: number, e: PointerEvent) => void;
  onEnd?: () => void;
}) {
  const ref = useRef(handlers);
  ref.current = handlers;
  return (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    let lx = e.clientX;
    let ly = e.clientY;
    ref.current.onStart?.(e);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - lx;
      const dy = ev.clientY - ly;
      lx = ev.clientX;
      ly = ev.clientY;
      if (dx || dy) ref.current.onMove(dx, dy, ev);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      ref.current.onEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
}

const fmt = (v: number, precision: number) => (precision > 0 ? v.toFixed(precision) : String(Math.round(v)));

// ---------------------------------------------------------------------------

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
}

/** A number you change by dragging left/right on it (Bryce style); double-click to type. */
export function DragValue({ value, min, max, onChange, label, step = 0, precision = 0, unit = '', hint, width = 64, onStart, onEnd }: DragValueProps) {
  const [editing, setEditing] = useState(false);
  const acc = useRef(value);
  const range = max - min;
  const onPointerDown = usePointerDrag({
    onStart: () => {
      acc.current = value;
      onStart?.();
    },
    onMove: (dx, _dy, e) => {
      const speed = (e.shiftKey ? 0.1 : 1) * (range / 300);
      acc.current = clamp(acc.current + dx * speed, min, max);
      const v = step > 0 ? Math.round(acc.current / step) * step : acc.current;
      onChange(clamp(v, min, max));
    },
    onEnd,
  });
  const hintText = hint ?? label;
  const hintHandlers = useHint(hintText ? `${hintText}: ${fmt(value, precision)}${unit}` : undefined);
  return (
    <div className="bk-dragvalue" style={{ width }} {...hintHandlers}>
      {label && <span className="bk-dragvalue__label">{label}</span>}
      {editing ? (
        <input
          className="bk-dragvalue__input"
          autoFocus
          defaultValue={fmt(value, precision)}
          onBlur={(e) => {
            const v = Number(e.currentTarget.value);
            if (Number.isFinite(v)) onChange(clamp(v, min, max));
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      ) : (
        <span className="bk-dragvalue__value" onPointerDown={onPointerDown} onDoubleClick={() => setEditing(true)}>
          {fmt(value, precision)}
          {unit}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

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
}

/** Bryce "control": a labeled slider bar with a numeric field. */
export function Slider({ label, value, min, max, onChange, step, precision = 0, hint, width = 220, disabled, onStart, onEnd }: SliderProps) {
  const hintHandlers = useHint(`${hint ?? label}: ${fmt(value, precision)}`);
  return (
    <label className={`bk-slider ${disabled ? 'is-disabled' : ''}`} style={{ width }} {...hintHandlers}>
      <span className="bk-slider__label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? (max - min) / 1000}
        value={value}
        disabled={disabled}
        onPointerDown={onStart}
        onPointerUp={onEnd}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <span className="bk-slider__value">{fmt(value, precision)}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------

export interface ColorSwatchProps {
  value: RGB;
  onChange: (c: RGB) => void;
  label?: string;
  hint?: string;
  /** Square size in px (default 22). */
  size?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

/** A color chip that opens a picker. */
export function ColorSwatch({ value, onChange, label, hint, size = 22, onStart, onEnd }: ColorSwatchProps) {
  const hintHandlers = useHint(hint ?? label);
  return (
    <label className="bk-swatch" {...hintHandlers}>
      <span className="bk-swatch__chip" style={{ width: size, height: size, background: rgbToHex(value) }}>
        <input
          type="color"
          value={rgbToHex(value)}
          onFocus={onStart}
          onBlur={onEnd}
          onChange={(e) => onChange(hexToRgb(e.currentTarget.value))}
        />
      </span>
      {label && <span className="bk-swatch__label">{label}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------

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
}

/** A ball you drag to rotate something (camera trackball, sun position). */
export function Trackball({ onDrag, onStart, onEnd, hint, size = 64, variant = 'camera', children }: TrackballProps) {
  const onPointerDown = usePointerDrag({ onStart: () => onStart?.(), onMove: onDrag, onEnd });
  return (
    <div
      className={`bk-trackball bk-trackball--${variant}`}
      style={{ width: size, height: size }}
      onPointerDown={onPointerDown}
      {...useHint(hint)}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface CrossControlProps {
  /** Which pair of world axes this cross moves along (first = horizontal drag, second = vertical drag). */
  plane: 'xz' | 'xy' | 'zy';
  /** Deltas along the two axes in pixels (b is positive when dragging up). */
  onDrag: (a: number, b: number, e: PointerEvent) => void;
  onStart?: () => void;
  onEnd?: () => void;
  hint?: string;
  size?: number;
}

/** Bryce camera cross: drag on it to move along two axes. */
export function CrossControl({ plane, onDrag, onStart, onEnd, hint, size = 54 }: CrossControlProps) {
  const onPointerDown = usePointerDrag({ onStart: () => onStart?.(), onMove: (dx, dy, e) => onDrag(dx, -dy, e), onEnd });
  return (
    <div className={`bk-cross bk-cross--${plane}`} style={{ width: size, height: size }} onPointerDown={onPointerDown} {...useHint(hint)}>
      <span className="bk-cross__label">{plane.toUpperCase()}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

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
}

/** Sky & Fog style thumbnail: drag horizontally (and vertically) on it to change values. */
export function DragPad({ x, xRange, y, yRange, onChange, onStart, onEnd, hint, width = 56, height = 42, children }: DragPadProps) {
  const acc = useRef({ x, y: y ?? 0 });
  const onPointerDown = usePointerDrag({
    onStart: () => {
      acc.current = { x, y: y ?? 0 };
      onStart?.();
    },
    onMove: (dx, dy, e) => {
      const k = e.shiftKey ? 0.1 : 1;
      acc.current.x = clamp(acc.current.x + (dx * k * (xRange[1] - xRange[0])) / 150, xRange[0], xRange[1]);
      if (yRange) acc.current.y = clamp(acc.current.y - (dy * k * (yRange[1] - yRange[0])) / 150, yRange[0], yRange[1]);
      onChange(acc.current.x, yRange ? acc.current.y : undefined);
    },
    onEnd,
  });
  const label = hint ? `${hint}: ${Math.round(x)}${y !== undefined ? ` / ${Math.round(y)}` : ''}` : undefined;
  return (
    <div className="bk-dragpad" style={{ width, height }} onPointerDown={onPointerDown} {...useHint(label)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface TabsProps {
  tabs: { id: string; label: string; hint?: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className = '' }: TabsProps) {
  return (
    <div className={`bk-tabs ${className}`} role="tablist">
      {tabs.map((t) => (
        <TabButton key={t.id} active={t.id === value} label={t.label} hint={t.hint ?? t.label} onClick={() => onChange(t.id)} />
      ))}
    </div>
  );
}

function TabButton({ active, label, hint, onClick }: { active: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={active} className={`bk-tab ${active ? 'is-active' : ''}`} onClick={onClick} {...useHint(hint)}>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  checked?: boolean;
  disabled?: boolean;
  divider?: boolean;
  hint?: string;
}

export interface TriangleMenuProps {
  items: MenuItem[];
  hint?: string;
  /** Where the menu opens relative to the triangle. */
  direction?: 'down' | 'right' | 'up';
  /** Optional custom trigger content instead of the triangle. */
  trigger?: ReactNode;
  className?: string;
}

/** The little triangle that opens an options menu. */
export function TriangleMenu({ items, hint, direction = 'down', trigger, className = '' }: TriangleMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className={`bk-trimenu bk-trimenu--${direction} ${className}`} ref={ref}>
      <button type="button" className="bk-trimenu__trigger" aria-label={hint ?? 'Options'} onClick={() => setOpen((o) => !o)} {...useHint(hint)}>
        {trigger ?? '▾'}
      </button>
      {open && (
        <div className="bk-menu" role="menu">
          {items.map((it, i) =>
            it.divider ? (
              <div key={i} className="bk-menu__divider" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={`bk-menu__item ${it.checked ? 'is-checked' : ''}`}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect?.();
                }}
              >
                <span className="bk-menu__check">{it.checked ? '✓' : ''}</span>
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface LabFrameProps {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
  tabs?: { id: string; label: string }[];
  tab?: string;
  onTab?: (id: string) => void;
  /** Extra controls in the header row (right side). */
  headerExtra?: ReactNode;
  className?: string;
}

/** A full-screen Bryce "room" (Materials Lab, Terrain Editor, Sky Lab) with ✓ / ✗ buttons. */
export function LabFrame({ title, onConfirm, onCancel, children, tabs, tab, onTab, headerExtra, className = '' }: LabFrameProps) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onConfirm, onCancel]);
  return (
    <div className={`bk-lab ${className}`} role="dialog" aria-label={title}>
      <header className="bk-lab__header">
        <h1 className="bk-lab__title">{title}</h1>
        {tabs && tab && onTab && <Tabs tabs={tabs} value={tab} onChange={onTab} className="bk-lab__tabs" />}
        <div className="bk-lab__extra">{headerExtra}</div>
      </header>
      <div className="bk-lab__body">{children}</div>
      <footer className="bk-lab__footer">
        <IconButton hint="Cancel" onClick={onCancel} className="bk-lab__cancel">
          ✕
        </IconButton>
        <IconButton hint="Accept" onClick={onConfirm} className="bk-lab__confirm">
          ✓
        </IconButton>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/** A modal window. */
export function Dialog({ title, onClose, children, footer, width = 420 }: DialogProps) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="bk-dialog__backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bk-dialog" role="dialog" aria-label={title} style={{ width }}>
        <header className="bk-dialog__header">
          <span>{title}</span>
          <button type="button" className="bk-dialog__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="bk-dialog__body">{children}</div>
        {footer && <footer className="bk-dialog__footer">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface MemoryDotsProps {
  count: number;
  filled: boolean[];
  /** Click on an empty dot. */
  onSave: (i: number) => void;
  /** Click on a filled dot. */
  onRecall: (i: number) => void;
  /** Alt/Option-click on a filled dot. */
  onClear?: (i: number) => void;
  hint?: string;
}

/** Bryce memory dots: click an empty dot to store, a filled dot to recall. */
export function MemoryDots({ count, filled, onSave, onRecall, onClear, hint = 'Memory Dots' }: MemoryDotsProps) {
  return (
    <div className="bk-memdots" {...useHint(`${hint}: click empty to store, filled to recall, Alt-click to clear`)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`${hint} ${i + 1}`}
          className={`bk-memdot ${filled[i] ? 'is-filled' : ''}`}
          onClick={(e) => {
            if (filled[i] && e.altKey) onClear?.(i);
            else if (filled[i]) onRecall(i);
            else onSave(i);
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}

export function Toggle({ label, value, onChange, hint }: ToggleProps) {
  return (
    <label className={`bk-toggle ${value ? 'is-on' : ''}`} {...useHint(hint ?? label)}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span className="bk-toggle__dot" />
      <span className="bk-toggle__label">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------

export interface SelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  label?: string;
  hint?: string;
  width?: number;
}

export function Select({ value, options, onChange, label, hint, width }: SelectProps) {
  return (
    <label className="bk-select" style={{ width }} {...useHint(hint ?? label)}>
      {label && <span className="bk-select__label">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
