import { useEffect, useRef, useState } from 'react';

/** Largest square (px) that fits the element, minus `reserveX` horizontally; tracks resizes. */
export function useSquareSize<T extends HTMLElement>(reserveX = 0) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize(Math.max(120, Math.floor(Math.min(el.clientWidth - reserveX, el.clientHeight))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [reserveX]);
  return { ref, size };
}
