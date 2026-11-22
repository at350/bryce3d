/**
 * Global keyboard shortcuts. `resolveShortcut` is a pure key -> action mapping (unit
 * tested); `installShortcuts` wires it to the window. Shortcuts stay quiet while typing,
 * while a lab, dialog, library or popover is open, or when ui.keyboardCaptured is set.
 */
import { useStore } from '@/core/store';
import {
  clearAndRender,
  cycleSelection,
  deleteSelection,
  duplicateSelection,
  editSelected,
  landSelection,
  newScene,
  nudgeSelection,
  openAttributes,
  openMaterialsLab,
  openScene,
  saveScene,
  scaleSelection,
  selectNone,
  startRender,
  stopRender,
} from './actions';
import { isEditableTarget, layerDepth } from './kit/layers';
import { resolveShortcut, type ShortcutAction } from './shortcutKeys';

export { resolveShortcut, SHORTCUT_GROUPS, NUDGE } from './shortcutKeys';
export type { ShortcutAction, KeyLike } from './shortcutKeys';

/** Runs an action. Returns false when it did nothing (so the browser keeps the key). */
export function runShortcut(a: ShortcutAction): boolean {
  const s = useStore.getState();
  switch (a.type) {
    case 'undo':
      s.undo();
      return true;
    case 'redo':
      s.redo();
      return true;
    case 'duplicate':
      duplicateSelection();
      return true;
    case 'delete':
      if (!s.selection.length) return false;
      deleteSelection();
      return true;
    case 'render':
      if (s.render.status === 'rendering') stopRender();
      else startRender();
      return true;
    case 'clearRender':
      clearAndRender();
      return true;
    case 'palette':
      s.setUI({ palette: a.palette });
      return true;
    case 'selectAll':
      s.selectAll();
      return true;
    case 'escape':
      if (s.render.status === 'rendering') stopRender();
      else if (s.selection.length) selectNone();
      else return false;
      return true;
    case 'materials':
      openMaterialsLab();
      return true;
    case 'edit':
      editSelected();
      return true;
    case 'attributes':
      openAttributes();
      return true;
    case 'skyLab':
      s.openLab('sky');
      return true;
    case 'save':
      saveScene();
      return true;
    case 'open':
      openScene();
      return true;
    case 'new':
      newScene();
      return true;
    case 'shortcuts':
      s.openDialog('shortcuts');
      return true;
    case 'nudge':
      if (!s.selection.length) return false;
      nudgeSelection(a.dir, a.step);
      return true;
    case 'cycle':
      cycleSelection(a.delta);
      return true;
    case 'scale':
      if (!s.selection.length) return false;
      scaleSelection(a.factor);
      return true;
    case 'land':
      if (!s.selection.length) return false;
      landSelection();
      return true;
  }
}

/** Keys that also move focus or scroll: only taken when focus is on the page itself. */
const NEEDS_BODY_FOCUS = new Set(['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Backspace', 'Delete', '/', '*', 'l', '?']);

function focusIsFree(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  if (!t || t === document.body || t === document.documentElement) return true;
  // the Working window (canvas or its container) counts as "the page"
  return !!t.closest?.('.working-window') && !t.closest('button, [role="slider"], [role="spinbutton"]');
}

export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;
    const s = useStore.getState();
    if (isEditableTarget(e.target) || s.ui.keyboardCaptured) return;
    // Windows that don't register a layer of their own still close with Esc.
    if (e.key === 'Escape' && layerDepth() === 0 && (s.ui.dialog || s.ui.library)) {
      e.preventDefault();
      if (s.ui.dialog) s.closeDialog();
      else s.closeLibrary();
      return;
    }
    if (s.ui.lab || s.ui.dialog || s.ui.library || layerDepth() > 0) return;
    const action = resolveShortcut(e);
    if (!action) return;
    const plainKey = !(e.metaKey || e.ctrlKey);
    if (plainKey && NEEDS_BODY_FOCUS.has(e.key.length === 1 ? e.key.toLowerCase() : e.key) && !focusIsFree(e.target)) return;
    if (runShortcut(action)) e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
