/** setPointerCapture that tolerates pointers which are already gone (fast taps, synthetic events). */
export function capturePointer(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // the pointer was released before we could capture it; window-level events still arrive
  }
}
