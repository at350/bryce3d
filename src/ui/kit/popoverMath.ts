/** Pure placement math for popovers (kept separate so it can be unit tested). */

export type PopoverPlacement = 'down' | 'down-end' | 'up' | 'up-end' | 'right' | 'left';

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const MARGIN = 6;

/**
 * Where to put a popover of size (w, h) next to an anchor rect inside a viewport (vw, vh).
 * Prefers the requested side, flips to the opposite side when it would overflow, then
 * clamps into the viewport.
 */
export function placePopover(
  anchor: RectLike,
  w: number,
  h: number,
  vw: number,
  vh: number,
  placement: PopoverPlacement,
  offset = 4,
): { left: number; top: number; side: PopoverPlacement } {
  let left: number;
  let top: number;
  let side = placement;
  const below = anchor.bottom + offset;
  const above = anchor.top - offset - h;
  if (placement === 'down' || placement === 'down-end' || placement === 'up' || placement === 'up-end') {
    const wantsDown = placement === 'down' || placement === 'down-end';
    const fitsDown = below + h <= vh - MARGIN;
    const fitsUp = above >= MARGIN;
    const goDown = wantsDown ? fitsDown || !fitsUp : !fitsUp && fitsDown;
    top = goDown ? below : above;
    if (goDown !== wantsDown) side = flipVertical(placement);
    left = placement.endsWith('end') ? anchor.right - w : anchor.left;
  } else {
    const wantsRight = placement === 'right';
    const rightX = anchor.right + offset;
    const leftX = anchor.left - offset - w;
    const fitsRight = rightX + w <= vw - MARGIN;
    const fitsLeft = leftX >= MARGIN;
    const goRight = wantsRight ? fitsRight || !fitsLeft : !fitsLeft && fitsRight;
    left = goRight ? rightX : leftX;
    if (goRight !== wantsRight) side = wantsRight ? 'left' : 'right';
    top = anchor.top;
  }
  left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - w - MARGIN));
  top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - h - MARGIN));
  return { left: Math.round(left), top: Math.round(top), side };
}

function flipVertical(p: PopoverPlacement): PopoverPlacement {
  switch (p) {
    case 'down': return 'up';
    case 'down-end': return 'up-end';
    case 'up': return 'down';
    case 'up-end': return 'down-end';
    default: return p;
  }
}
