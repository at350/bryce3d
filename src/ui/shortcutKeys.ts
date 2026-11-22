/**
 * Keyboard shortcut definitions: the pure key -> action mapping (unit tested) and the list
 * shown in Help > Keyboard Shortcuts. shortcuts.ts runs the actions.
 */

export type ShortcutAction =
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'duplicate' }
  | { type: 'delete' }
  | { type: 'render' }
  | { type: 'clearRender' }
  | { type: 'palette'; palette: 'create' | 'edit' | 'sky' }
  | { type: 'selectAll' }
  | { type: 'escape' }
  | { type: 'materials' }
  | { type: 'edit' }
  | { type: 'attributes' }
  | { type: 'skyLab' }
  | { type: 'save' }
  | { type: 'open' }
  | { type: 'new' }
  | { type: 'shortcuts' }
  | { type: 'nudge'; dir: 'left' | 'right' | 'up' | 'down' | 'raise' | 'lower'; step: number }
  | { type: 'cycle'; delta: 1 | -1 }
  | { type: 'scale'; factor: number }
  | { type: 'land' };

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Nudge distances: plain, Shift (big), Alt (fine). */
export const NUDGE = { normal: 1, big: 5, fine: 0.1 };

export function resolveShortcut(e: KeyLike): ShortcutAction | null {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (mod) {
    if (k === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' };
    if (k === 'y' && !e.shiftKey) return { type: 'redo' };
    if (k === 'r') return e.altKey ? { type: 'clearRender' } : { type: 'render' };
    if (k === 'd') return { type: 'duplicate' };
    if (k === 'a' && !e.shiftKey) return { type: 'selectAll' };
    if (k === 'm') return { type: 'materials' };
    if (k === 'e') return e.altKey ? { type: 'attributes' } : { type: 'edit' };
    if (k === 'k') return { type: 'skyLab' };
    if (k === 's') return { type: 'save' };
    if (k === 'o') return { type: 'open' };
    if (k === 'n') return { type: 'new' };
    if (k === '1') return { type: 'palette', palette: 'create' };
    if (k === '2') return { type: 'palette', palette: 'edit' };
    if (k === '3') return { type: 'palette', palette: 'sky' };
    return null;
  }
  const step = e.shiftKey ? NUDGE.big : e.altKey ? NUDGE.fine : NUDGE.normal;
  switch (k) {
    case 'ArrowLeft':
      return { type: 'nudge', dir: 'left', step };
    case 'ArrowRight':
      return { type: 'nudge', dir: 'right', step };
    case 'ArrowUp':
      return { type: 'nudge', dir: 'up', step };
    case 'ArrowDown':
      return { type: 'nudge', dir: 'down', step };
    case 'PageUp':
      return { type: 'nudge', dir: 'raise', step };
    case 'PageDown':
      return { type: 'nudge', dir: 'lower', step };
    case 'Delete':
    case 'Backspace':
      return { type: 'delete' };
    case 'Escape':
      return { type: 'escape' };
    case '[':
      return { type: 'cycle', delta: -1 };
    case ']':
      return { type: 'cycle', delta: 1 };
    case '?':
      return { type: 'shortcuts' };
    case '*':
      return { type: 'scale', factor: 2 };
    case '/':
      return { type: 'scale', factor: 0.5 };
    case 'l':
      return e.altKey ? null : { type: 'land' };
    default:
      return null;
  }
}

/** The list shown in Help > Keyboard Shortcuts. */
export const SHORTCUT_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Scene & files',
    items: [
      ['Ctrl/⌘ N', 'New scene (undoable)'],
      ['Ctrl/⌘ O', 'Open a .bryce.json scene'],
      ['Ctrl/⌘ S', 'Save the scene file'],
      ['Ctrl/⌘ Z', 'Undo'],
      ['Shift Ctrl/⌘ Z  or  Ctrl/⌘ Y', 'Redo'],
    ],
  },
  {
    title: 'Rendering',
    items: [
      ['Ctrl/⌘ R', 'Render (again to stop)'],
      ['Ctrl/⌘ Alt R', 'Clear and render'],
      ['Esc', 'Stop rendering'],
    ],
  },
  {
    title: 'Palettes & rooms',
    items: [
      ['Ctrl/⌘ 1 / 2 / 3', 'Create / Edit / Sky & Fog palette'],
      ['Ctrl/⌘ M', 'Materials Lab for the selection'],
      ['Ctrl/⌘ E', 'Edit the selection (terrain: Terrain Editor)'],
      ['Ctrl/⌘ Alt E', 'Object Attributes'],
      ['Ctrl/⌘ K', 'Sky Lab'],
      ['Enter / Esc', 'In a lab: accept / cancel'],
      ['?', 'This list'],
    ],
  },
  {
    title: 'Selection',
    items: [
      ['Click', 'Select an object in the Working window'],
      ['Shift click / Ctrl/⌘ click', 'Add to / toggle in the selection'],
      ['Ctrl/⌘ A', 'Select all'],
      ['Esc', 'Select none'],
      ['[ / ]', 'Previous / next object'],
      ['Tab / Shift Tab', 'Move keyboard focus forward / backward'],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['Ctrl/⌘ D', 'Duplicate'],
      ['Delete / Backspace', 'Delete'],
      ['Arrow keys', 'Nudge across the ground (relative to the view)'],
      ['Page Up / Page Down', 'Nudge up / down'],
      ['Shift + nudge', 'Big steps (5 units)'],
      ['Alt + nudge', 'Fine steps (0.1 units)'],
      ['*  or  /', 'Double or halve the size'],
      ['L', 'Land the selection on the ground'],
      ['Drag the Edit tools', 'Resize, rotate, reposition, randomize (Shift snaps)'],
      ['Double-click a number', 'Type a value (Enter to apply)'],
    ],
  },
];
