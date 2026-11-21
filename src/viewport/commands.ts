/**
 * Commands the UI can send to the Working window.
 * NOTE: foundation stubs; the viewport owner implements them.
 */

/** Fit the selection (or the whole scene when nothing is selected) in the current view. */
export function frameSelection(): void {}

/** Zoom the current view: factor > 1 zooms in. Ortho views scale; camera views narrow the FOV or dolly. */
export function zoomView(factor: number): void {
  void factor;
}

/** Reset the current orthographic view's pan/zoom. */
export function resetView(): void {}
