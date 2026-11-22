/** Tabs, Toggle, Select and MemoryDots. */
import { useRef, useState } from 'react';
import { useHint } from './hint';
import { MenuList } from './MenuList';
import { Popover } from './Popover';
import { TriangleGlyph } from './TriangleMenu';

// ---------------------------------------------------------------------------

export interface TabsProps {
  tabs: { id: string; label: string; hint?: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Bryce lab tabs: big light text, the active one lit. Arrow keys move between tabs. */
export function Tabs({ tabs, value, onChange, className = '' }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className={`bk-tabs ${className}`} role="tablist">
      {tabs.map((t, i) => (
        <TabButton
          key={t.id}
          active={t.id === value}
          label={t.label}
          hint={t.hint ?? t.label}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
          buttonRef={(el) => {
            refs.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

function TabButton({
  active,
  label,
  hint,
  onClick,
  onKeyDown,
  buttonRef,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      className={`bk-tab ${active ? 'is-active' : ''}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...useHint(hint)}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------

export interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

/** On/off switch drawn as a Bryce component-indicator ball. */
export function Toggle({ label, value, onChange, hint, disabled }: ToggleProps) {
  return (
    <label className={`bk-toggle ${value ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`} {...useHint(hint ?? label)}>
      <input type="checkbox" className="bk-visually-hidden" checked={value} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span className="bk-toggle__dot" aria-hidden="true" />
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
  disabled?: boolean;
}

/** Drop-down picker with a Bryce pop-up menu (no OS widget). Up/Down change the value directly. */
export function Select({ value, options, onChange, label, hint, width, disabled }: SelectProps) {
  const [open, setOpen] = useState<{ focus: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);
  const close = () => {
    const inside = !!document.activeElement?.closest('.bk-popover');
    setOpen(null);
    if (inside) btn.current?.focus({ preventScroll: true });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.altKey) {
        setOpen({ focus: true });
        return;
      }
      const next = options[Math.min(options.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (next && next.value !== value) onChange(next.value);
    }
  };
  return (
    <div className={`bk-select ${disabled ? 'is-disabled' : ''}`} style={{ width }} {...useHint(hint ?? label)}>
      {label && <span className="bk-select__label">{label}</span>}
      <button
        ref={btn}
        type="button"
        className="bk-select__button"
        aria-haspopup="listbox"
        aria-expanded={!!open}
        aria-label={label ? `${label}: ${current?.label ?? value}` : current?.label ?? value}
        disabled={disabled}
        onClick={(e) => setOpen((o) => (o ? null : { focus: e.detail === 0 }))}
        onKeyDown={onKeyDown}
      >
        <span className="bk-select__value">{current?.label ?? value}</span>
        <TriangleGlyph />
      </button>
      {open && (
        <Popover anchor={btn.current} placement="down" onClose={close}>
          <MenuList
            items={options.map((o) => ({ label: o.label, checked: o.value === value, onSelect: () => onChange(o.value) }))}
            onDone={close}
            autoFocus={open.focus}
            ariaLabel={label}
            className="bk-menu--select"
          />
        </Popover>
      )}
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
  /** Bryce stacks memory dots vertically (default). */
  direction?: 'vertical' | 'horizontal';
}

/** Bryce memory dots: click an empty dot to store, a filled dot to recall, Alt-click to clear. */
export function MemoryDots({ count, filled, onSave, onRecall, onClear, hint = 'Memory Dots', direction = 'vertical' }: MemoryDotsProps) {
  return (
    <div className={`bk-memdots bk-memdots--${direction}`} role="group" aria-label={hint}>
      {Array.from({ length: count }, (_, i) => (
        <MemoryDot key={i} index={i} filled={!!filled[i]} hint={hint} onSave={onSave} onRecall={onRecall} onClear={onClear} />
      ))}
    </div>
  );
}

function MemoryDot({
  index,
  filled,
  hint,
  onSave,
  onRecall,
  onClear,
}: {
  index: number;
  filled: boolean;
  hint: string;
  onSave: (i: number) => void;
  onRecall: (i: number) => void;
  onClear?: (i: number) => void;
}) {
  const text = filled
    ? `${hint} ${index + 1}: click to recall${onClear ? ', Alt-click to clear' : ''}`
    : `${hint} ${index + 1}: empty, click to store`;
  return (
    <button
      type="button"
      aria-label={text}
      className={`bk-memdot ${filled ? 'is-filled' : ''}`}
      onClick={(e) => {
        if (filled && e.altKey) onClear?.(index);
        else if (filled) onRecall(index);
        else onSave(index);
      }}
      onKeyDown={(e) => {
        if (filled && onClear && (e.key === 'Delete' || e.key === 'Backspace')) {
          e.preventDefault();
          e.stopPropagation();
          onClear(index);
        }
      }}
      {...useHint(text)}
    />
  );
}
