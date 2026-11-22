import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/core/store';

/**
 * Bryce's Text Display Area: hovering any control shows its name.
 * Spread the returned handlers onto the element: <div {...useHint('Create Terrain')} />
 * While hovered, a changing text (e.g. "Haze: 42" during a drag) updates live, and the
 * hint is cleared if the element goes away under the pointer.
 */
export function useHint(text: string | undefined) {
  const hovered = useRef(false);
  const current = useRef(text);

  useEffect(() => {
    const prev = current.current;
    current.current = text;
    if (!hovered.current || prev === text) return;
    const s = useStore.getState();
    if (text) s.setHint(text);
    else if (prev && s.ui.hint === prev) s.setHint('');
  }, [text]);

  useEffect(
    () => () => {
      const t = current.current;
      if (hovered.current && t && useStore.getState().ui.hint === t) useStore.getState().setHint('');
    },
    [],
  );

  return useMemo(
    () => ({
      onPointerEnter: () => {
        hovered.current = true;
        if (current.current) useStore.getState().setHint(current.current);
      },
      onPointerLeave: () => {
        hovered.current = false;
        const t = current.current;
        if (t && useStore.getState().ui.hint === t) useStore.getState().setHint('');
      },
    }),
    [],
  );
}

/** Imperative version for non-React code (viewport hover). */
export function setHint(text: string) {
  useStore.getState().setHint(text);
}
