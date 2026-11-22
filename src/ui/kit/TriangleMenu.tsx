/** The little triangle that opens an options menu (Bryce pop-up menu). */
import { useRef, useState, type ReactNode } from 'react';
import { useHint } from './hint';
import { MenuList, type MenuItem } from './MenuList';
import { Popover } from './Popover';

export interface TriangleMenuProps {
  items: MenuItem[];
  hint?: string;
  /** Where the menu opens relative to the triangle. */
  direction?: 'down' | 'right' | 'up';
  /** Optional custom trigger content instead of the triangle. */
  trigger?: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Accessible name for the trigger (defaults to hint). */
  ariaLabel?: string;
}

export function TriangleGlyph({ direction = 'down' }: { direction?: 'down' | 'right' | 'up' | 'left' }) {
  const rot = { down: 0, left: 90, up: 180, right: 270 }[direction];
  return (
    <svg className="bk-triangle" viewBox="0 0 10 10" width="9" height="9" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M1 2.5 H9 L5 8 Z" />
    </svg>
  );
}

export function TriangleMenu({ items, hint, direction = 'down', trigger, className = '', disabled, ariaLabel }: TriangleMenuProps) {
  const [open, setOpen] = useState<{ focus: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const hintHandlers = useHint(hint);
  const placement = direction === 'right' ? 'right' : direction === 'up' ? 'up' : 'down';
  const close = () => {
    const hadFocusInside = !!document.activeElement?.closest('.bk-popover');
    setOpen(null);
    if (hadFocusInside) btn.current?.focus({ preventScroll: true });
  };
  return (
    <div className={`bk-trimenu bk-trimenu--${direction} ${open ? 'is-open' : ''} ${className}`}>
      <button
        ref={btn}
        type="button"
        className="bk-trimenu__trigger"
        aria-label={ariaLabel ?? hint ?? 'Options'}
        aria-haspopup="menu"
        aria-expanded={!!open}
        disabled={disabled}
        onClick={(e) => setOpen((o) => (o ? null : { focus: e.detail === 0 }))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || (direction === 'right' && e.key === 'ArrowRight') || (direction === 'up' && e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen({ focus: true });
          }
        }}
        {...hintHandlers}
      >
        {trigger ?? <TriangleGlyph direction={direction} />}
      </button>
      {open && (
        <Popover anchor={btn.current} placement={placement} onClose={close}>
          <MenuList items={items} onDone={close} autoFocus={open.focus} ariaLabel={hint} />
        </Popover>
      )}
    </div>
  );
}
