import { useMemo } from 'react';
import { useStore } from '@/core/store';

/**
 * Bryce's Text Display Area: hovering any control shows its name.
 * Spread the returned handlers onto the element: <div {...useHint('Create Terrain')} />
 */
export function useHint(text: string | undefined) {
  return useMemo(
    () => ({
      onPointerEnter: () => {
        if (text) useStore.getState().setHint(text);
      },
      onPointerLeave: () => {
        if (text && useStore.getState().ui.hint === text) useStore.getState().setHint('');
      },
    }),
    [text],
  );
}

/** Imperative version for non-React code (viewport hover). */
export function setHint(text: string) {
  useStore.getState().setHint(text);
}
