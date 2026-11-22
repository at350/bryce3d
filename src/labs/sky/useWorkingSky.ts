/**
 * The Sky Lab's working copy of the sky with its own undo / redo. Rapid edits of the same
 * fields (a slider drag) coalesce into one step, like the store's history.
 */
import { useCallback, useRef, useState } from 'react';
import type { Sky } from '@/core/types';

const COALESCE_MS = 700;
const LIMIT = 80;

interface History {
  sky: Sky;
  past: Sky[];
  future: Sky[];
}

export interface WorkingSky {
  sky: Sky;
  /** Merge a patch; `key` groups rapid edits (defaults to the patched field names). */
  update: (patch: Partial<Sky>, key?: string) => void;
  /** Replace the whole sky (preset, random, memory) as one undo step. */
  replace: (sky: Sky) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Latest value, for handlers that run between renders (drags). */
  current: () => Sky;
}

export function useWorkingSky(initial: Sky): WorkingSky {
  const [h, setH] = useState<History>({ sky: initial, past: [], future: [] });
  const latest = useRef(initial);
  const last = useRef({ key: '', time: 0 });

  const commit = useCallback((next: (sky: Sky) => Sky, key: string) => {
    const now = performance.now();
    const coalesce = key !== '' && key === last.current.key && now - last.current.time < COALESCE_MS;
    last.current = { key, time: now };
    const sky = next(latest.current);
    if (sky === latest.current) return;
    latest.current = sky;
    setH((s) => ({ sky, past: coalesce ? s.past : [...s.past, s.sky].slice(-LIMIT), future: [] }));
  }, []);

  const update = useCallback(
    (patch: Partial<Sky>, key?: string) => commit((sky) => ({ ...sky, ...patch }), key ?? Object.keys(patch).sort().join(',')),
    [commit],
  );
  const replace = useCallback((sky: Sky) => commit(() => sky, ''), [commit]);

  const undo = useCallback(() => {
    last.current = { key: '', time: 0 };
    setH((s) => {
      if (!s.past.length) return s;
      const sky = s.past[s.past.length - 1];
      latest.current = sky;
      return { sky, past: s.past.slice(0, -1), future: [s.sky, ...s.future].slice(0, LIMIT) };
    });
  }, []);

  const redo = useCallback(() => {
    last.current = { key: '', time: 0 };
    setH((s) => {
      if (!s.future.length) return s;
      const sky = s.future[0];
      latest.current = sky;
      return { sky, past: [...s.past, s.sky].slice(-LIMIT), future: s.future.slice(1) };
    });
  }, []);

  const current = useCallback(() => latest.current, []);

  return { sky: h.sky, update, replace, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0, current };
}
