/** LabFrame (full-screen Bryce "room") and Dialog (floating window). */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { getUiZoom } from '../layoutScale';
import { GlossBall } from './GlossBall';
import { useHint } from './hint';
import { isEditableTarget, isTopLayer, layerDepth, useLayer } from './layers';
import { Tabs } from './smallControls';

function RoundAction({ hint, glyph, tone, onClick, size = 46, className = '' }: { hint: string; glyph: 'check' | 'cross'; tone: 'accent' | 'metal'; onClick: () => void; size?: number; className?: string }) {
  return (
    <button type="button" className={`bk-roundaction ${className}`} aria-label={hint} onClick={onClick} {...useHint(hint)}>
      <GlossBall size={size} tone={tone} glyph={glyph} />
    </button>
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

/** A full-screen room (Materials Lab, Terrain Editor, Sky Lab) with ✗ / ✓ balls at the bottom right. Esc cancels, Enter accepts. */
export function LabFrame({ title, onConfirm, onCancel, children, tabs, tab, onTab, headerExtra, className = '' }: LabFrameProps) {
  const layer = useLayer('lab', onCancel);
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.defaultPrevented) return;
      if (!isTopLayer(layer.current) || isEditableTarget(e.target)) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('button, a, [role="slider"], [role="spinbutton"], [role="tab"]')) return;
      e.preventDefault();
      confirmRef.current();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [layer]);
  return (
    <div className={`bk-lab ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="bk-lab__header">
        <h1 className="bk-lab__title">{title}</h1>
        {tabs && tab && onTab && <Tabs tabs={tabs} value={tab} onChange={onTab} className="bk-lab__tabs" />}
        <div className="bk-lab__extra">{headerExtra}</div>
      </header>
      <div className="bk-lab__body">{children}</div>
      <footer className="bk-lab__footer">
        <RoundAction hint="Cancel (Esc)" glyph="cross" tone="metal" onClick={onCancel} className="bk-lab__cancel" />
        <RoundAction hint="Accept (Enter)" glyph="check" tone="accent" onClick={onConfirm} className="bk-lab__confirm" />
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
  /** Show Bryce ✗ / ✓ balls in the footer: ✗ calls onCancel (default onClose), ✓ calls onConfirm (default onClose). */
  onConfirm?: () => void;
  onCancel?: () => void;
  className?: string;
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** A floating Bryce window: dark title bar (drag it to move), metal body, Esc to close. */
export function Dialog({ title, onClose, children, footer, width = 420, onConfirm, onCancel, className = '' }: DialogProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useLayer('dialog', onCancel ?? onClose);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Focus the window itself: Tab then walks into its controls.
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const startMove = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const sx = e.clientX - offset.x;
    const sy = e.clientY - offset.y;
    const move = (ev: PointerEvent) => {
      const maxX = window.innerWidth / 2;
      const maxY = window.innerHeight / 2;
      setOffset({ x: Math.max(-maxX, Math.min(maxX, ev.clientX - sx)), y: Math.max(-maxY + 40, Math.min(maxY, ev.clientY - sy)) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const showBalls = !!(onConfirm || onCancel);
  return (
    <div
      className="bk-dialog__backdrop"
      onPointerDown={(e) => {
        // A click outside an open popover only closes the popover.
        if (e.target === e.currentTarget && layerDepth(['popover']) === 0) (onCancel ?? onClose)();
      }}
    >
      <div
        ref={ref}
        className={`bk-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width, transform: `translate(${offset.x / getUiZoom()}px, ${offset.y / getUiZoom()}px)` }}
        onKeyDown={trapTab}
      >
        <header className="bk-dialog__header" onPointerDown={startMove}>
          <span id={titleId} className="bk-dialog__title">
            {title}
          </span>
          <button type="button" className="bk-dialog__close" aria-label="Close" onClick={onCancel ?? onClose}>
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
              <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="bk-dialog__body">{children}</div>
        {(footer || showBalls) && (
          <footer className="bk-dialog__footer">
            {footer}
            {showBalls && (
              <span className="bk-dialog__balls">
                <RoundAction hint="Cancel" glyph="cross" tone="metal" size={34} onClick={onCancel ?? onClose} />
                <RoundAction hint="OK" glyph="check" tone="accent" size={34} onClick={onConfirm ?? onClose} />
              </span>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
