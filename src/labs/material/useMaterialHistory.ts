/**
 * The lab's working copy with its own undo/redo (the scene's history only records the
 * final ✓). Rapid edits of the same kind (a drag, a slider scrub) coalesce into one step.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Material } from '@/core/types';

const COALESCE_MS = 650;
const LIMIT = 120;

interface HistoryState {
  past: Material[];
  present: Material;
  future: Material[];
}

export interface MaterialHistory {
  material: Material;
  /** Apply an edit. `kind` groups rapid edits of the same control into one undo step. */
  update: (fn: (m: Material) => Material, kind?: string) => void;
  /** Group every edit until end() into one undo step (a drag, an open color picker). */
  begin: () => void;
  end: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useMaterialHistory(init: () => Material): MaterialHistory {
  const [state, setState] = useState<HistoryState>(() => ({ past: [], present: init(), future: [] }));
  const last = useRef({ kind: '', time: 0 });
  const group = useRef({ active: false, pushed: false });

  const update = useCallback((fn: (m: Material) => Material, kind = '') => {
    const now = performance.now();
    let coalesce: boolean;
    if (group.current.active) {
      coalesce = group.current.pushed;
      group.current.pushed = true;
    } else {
      coalesce = kind !== '' && kind === last.current.kind && now - last.current.time < COALESCE_MS;
    }
    last.current = { kind, time: now };
    setState((s) => {
      const next = fn(s.present);
      if (next === s.present) return s;
      return { past: coalesce ? s.past : [...s.past, s.present].slice(-LIMIT), present: next, future: [] };
    });
  }, []);

  const begin = useCallback(() => {
    group.current = { active: true, pushed: false };
  }, []);

  const end = useCallback(() => {
    group.current = { active: false, pushed: false };
    last.current = { kind: '', time: 0 };
  }, []);

  const undo = useCallback(() => {
    last.current = { kind: '', time: 0 };
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);

  const redo = useCallback(() => {
    last.current = { kind: '', time: 0 };
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  return useMemo(
    () => ({ material: state.present, update, begin, end, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }),
    [state, update, begin, end, undo, redo],
  );
}
