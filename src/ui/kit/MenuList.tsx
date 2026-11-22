/**
 * Bryce-style pop-up menu list: bold items, check marks, double-rule dividers, optional
 * shortcut text and submenus. Keyboard: arrows move, Enter/Space select, ArrowRight opens
 * a submenu, ArrowLeft/Escape back out, Tab closes.
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { Popover } from './Popover';

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  checked?: boolean;
  disabled?: boolean;
  divider?: boolean;
  hint?: string;
  /** Shortcut text shown at the right (display only). */
  shortcut?: string;
  /** Nested items, shown as a submenu. */
  submenu?: MenuItem[];
  /** CSS color of a small chip shown before the label. */
  swatch?: string;
}

interface MenuListProps {
  items: MenuItem[];
  /** Close the whole menu tree (after a selection, Tab, ...). */
  onDone: () => void;
  /** Close just this level (submenus: ArrowLeft). */
  onBack?: () => void;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
}

function setHintText(text: string) {
  useStore.getState().setHint(text);
}

export function MenuList({ items, onDone, onBack, autoFocus = true, className = '', ariaLabel }: MenuListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [sub, setSub] = useState<{ index: number; focus: boolean } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const enabled = () => itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);

  useEffect(() => {
    if (autoFocus) enabled()[0]?.focus({ preventScroll: true });
    return () => clearTimeout(hoverTimer.current);
  }, [autoFocus]);

  const focusStep = (dir: 1 | -1) => {
    const els = enabled();
    if (!els.length) return;
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    const next = i < 0 ? (dir > 0 ? 0 : els.length - 1) : (i + dir + els.length) % els.length;
    els[next].focus({ preventScroll: true });
  };

  const activate = (index: number, viaKeyboard: boolean) => {
    const it = items[index];
    if (!it || it.disabled || it.divider) return;
    if (it.submenu) {
      setSub({ index, focus: viaKeyboard });
      return;
    }
    onDone();
    it.onSelect?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusStep(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusStep(-1);
        break;
      case 'Home':
        e.preventDefault();
        enabled()[0]?.focus();
        break;
      case 'End': {
        e.preventDefault();
        const els = enabled();
        els[els.length - 1]?.focus();
        break;
      }
      case 'ArrowRight': {
        const i = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
        if (i >= 0 && items[i]?.submenu) {
          e.preventDefault();
          setSub({ index: i, focus: true });
        }
        break;
      }
      case 'ArrowLeft':
        if (onBack) {
          e.preventDefault();
          onBack();
        }
        break;
      case 'Tab':
        e.preventDefault();
        onDone();
        break;
    }
  };

  const closeSub = (refocus: boolean) => {
    const i = sub?.index;
    setSub(null);
    if (refocus && i !== undefined) itemRefs.current[i]?.focus({ preventScroll: true });
  };

  return (
    <div ref={listRef} className={`bk-menu ${className}`} role="menu" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {items.map((it, i) =>
        it.divider ? (
          <div key={i} className="bk-menu__divider" role="separator" />
        ) : (
          <button
            key={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            role={it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'}
            aria-checked={it.checked !== undefined ? it.checked : undefined}
            aria-haspopup={it.submenu ? 'menu' : undefined}
            aria-expanded={it.submenu ? sub?.index === i : undefined}
            className={`bk-menu__item ${it.checked ? 'is-checked' : ''} ${sub?.index === i ? 'is-open' : ''}`}
            disabled={it.disabled}
            onClick={() => activate(i, false)}
            onPointerEnter={(e) => {
              if (it.hint) setHintText(it.hint);
              (e.currentTarget as HTMLButtonElement).focus({ preventScroll: true });
              clearTimeout(hoverTimer.current);
              if (it.submenu && !it.disabled) hoverTimer.current = setTimeout(() => setSub({ index: i, focus: false }), 120);
              else if (sub && sub.index !== i) hoverTimer.current = setTimeout(() => setSub(null), 200);
            }}
            onPointerLeave={() => {
              if (it.hint && useStore.getState().ui.hint === it.hint) setHintText('');
            }}
          >
            <span className="bk-menu__check" aria-hidden="true">
              {it.checked ? '✓' : ''}
            </span>
            {it.swatch && <span className="bk-menu__swatch" style={{ background: it.swatch }} aria-hidden="true" />}
            <span className="bk-menu__label">{it.label}</span>
            {it.shortcut && <span className="bk-menu__shortcut">{it.shortcut}</span>}
            {it.submenu && (
              <span className="bk-menu__more" aria-hidden="true">
                ▸
              </span>
            )}
          </button>
        ),
      )}
      {sub && items[sub.index]?.submenu && (
        <Popover anchor={itemRefs.current[sub.index] ?? null} placement="right" offset={-2} onClose={() => closeSub(true)}>
          <MenuList
            items={items[sub.index].submenu ?? []}
            onDone={onDone}
            onBack={() => closeSub(true)}
            autoFocus={sub.focus}
            ariaLabel={items[sub.index].label}
          />
        </Popover>
      )}
    </div>
  );
}
