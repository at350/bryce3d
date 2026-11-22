/** React host for the 3D terrain preview (see previewScene.ts). */
import { useEffect, useRef, useState } from 'react';
import { useHint } from '@/ui/kit';
import type { HeightBus } from './heightBus';
import { createPreview, type PreviewApi, type PreviewOptions } from './previewScene';

interface Props extends PreviewOptions {
  bus: HeightBus;
}

export function Preview3D({ bus, clipLow, clipHigh, lut, aspect, mirror, autoRotate }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<PreviewApi | null>(null);
  const optsRef = useRef<PreviewOptions>({ clipLow, clipHigh, lut, aspect, mirror, autoRotate });
  optsRef.current = { clipLow, clipHigh, lut, aspect, mirror, autoRotate };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let api: PreviewApi;
    try {
      api = createPreview(host, optsRef.current);
    } catch (err) {
      console.warn('[terrain] 3D preview unavailable', err);
      setFailed(true);
      return;
    }
    apiRef.current = api;
    api.setHeights(bus.frame.heights, bus.frame.n);
    const unsub = bus.subscribe((f) => api.setHeights(f.heights, f.n));
    return () => {
      unsub();
      api.dispose();
      apiRef.current = null;
    };
  }, [bus]);

  useEffect(() => {
    apiRef.current?.setOptions({ clipLow, clipHigh, lut, aspect, mirror, autoRotate });
  }, [clipLow, clipHigh, lut, aspect, mirror, autoRotate]);

  return (
    <div className="te-preview3d" ref={hostRef} {...useHint('3D Preview: drag to turn, scroll to zoom, double-click to reset')}>
      {failed && <div className="te-preview3d__fallback">3D preview needs WebGL</div>}
    </div>
  );
}
