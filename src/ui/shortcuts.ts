/** Global keyboard shortcuts. NOTE: foundation version; the ui owner completes it. */
import { isTerrainLike } from '@/core/objects';
import { selectPrimarySelection, useStore } from '@/core/store';
import { getRenderer } from '@/render';

function typing(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const s = useStore.getState();
    if (typing(e) || s.ui.keyboardCaptured || s.ui.lab) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) s.redo();
      else s.undo();
    } else if (mod && k === 'r') {
      e.preventDefault();
      getRenderer().start(s.scene);
    } else if (mod && k === 'd') {
      e.preventDefault();
      s.duplicateObjects(s.selection);
    } else if (mod && (k === '1' || k === '2' || k === '3')) {
      e.preventDefault();
      s.setUI({ palette: k === '1' ? 'create' : k === '2' ? 'edit' : 'sky' });
    } else if (mod && k === 'a') {
      e.preventDefault();
      s.selectAll();
    } else if (mod && k === 'm') {
      e.preventDefault();
      const p = selectPrimarySelection(s);
      if (p) s.openLab('material', p.id);
    } else if (mod && k === 'e') {
      e.preventDefault();
      const p = selectPrimarySelection(s);
      if (p) s.openLab(isTerrainLike(p.type) ? 'terrain' : 'material', p.id);
    } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
      if (s.selection.length) {
        e.preventDefault();
        s.removeObjects(s.selection);
      }
    } else if (e.key === 'Escape') {
      if (s.ui.dialog) s.closeDialog();
      else if (s.ui.library) s.closeLibrary();
      else s.select(null);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
