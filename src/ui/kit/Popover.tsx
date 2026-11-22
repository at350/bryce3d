/**
 * Floating panel anchored to an element (menus, color picker, object list). Rendered in a
 * portal on <body> so palettes with overflow:hidden never clip it; scaled with the UI zoom.
 * Closes on Escape (via the layer stack) and on pointer-down outside itself, its anchor
 * and any nested popovers it opened.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLayer } from './layers';
import { placePopover, type PopoverPlacement } from './popoverMath';

export type { PopoverPlacement } from './popoverMath';

const ChainContext = createContext('');
let popoverSeq = 0;

export interface PopoverProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  placement?: PopoverPlacement;
  children: ReactNode;
  className?: string;
  /** Gap between the anchor and the popover in px. */
  offset?: number;
  role?: string;
  ariaLabel?: string;
  /** Runs once the popover has been positioned (e.g. to move focus into it). */
  onReady?: (el: HTMLElement) => void;
  style?: CSSProperties;
}

export function Popover({ anchor, onClose, placement = 'down', children, className = '', offset = 4, role, ariaLabel, onReady, style }: PopoverProps) {
  const parentChain = useContext(ChainContext);
  const [id] = useState(() => ++popoverSeq);
  const chain = parentChain ? `${parentChain},${id}` : String(id);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; side: PopoverPlacement } | null>(null);
  const closeRef = useRef(onClose);
  const readyRef = useRef(onReady);
  useEffect(() => {
    closeRef.current = onClose;
    readyRef.current = onReady;
  });
  useLayer('popover', () => closeRef.current());

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el || !anchor) return;
      if (!anchor.isConnected) {
        closeRef.current();
        return;
      }
      const r = el.getBoundingClientRect();
      setPos(placePopover(anchor.getBoundingClientRect(), r.width, r.height, window.innerWidth, window.innerHeight, placement, offset));
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (ref.current) ro?.observe(ref.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, placement, offset]);

  const positioned = pos !== null;
  useEffect(() => {
    if (positioned && ref.current) readyRef.current?.(ref.current);
  }, [positioned]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (anchor?.contains(t)) return;
      const host = t.closest?.('[data-bk-chain]') as HTMLElement | null;
      if (host?.dataset.bkChain?.split(',').includes(String(id))) return;
      closeRef.current();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [anchor, id]);

  // Labs render at 1x; only popovers from the zoomed palettes follow the UI zoom.
  const inLab = !!anchor?.closest('.bk-lab');
  const wrapperStyle: CSSProperties = {
    ...(pos ? { left: pos.left, top: pos.top } : { left: -10000, top: -10000, visibility: 'hidden' }),
    ...(inLab ? { ['--ui-zoom' as string]: 1 } : {}),
  };
  return createPortal(
    <ChainContext.Provider value={chain}>
      <div
        ref={ref}
        className={`bk-popover bk-popover--${pos?.side ?? placement} ${className}`}
        style={{ ...wrapperStyle, ...style }}
        data-bk-chain={chain}
        role={role}
        aria-label={ariaLabel}
      >
        <div className="bk-popover__zoom">{children}</div>
      </div>
    </ChainContext.Provider>,
    document.body,
  );
}
