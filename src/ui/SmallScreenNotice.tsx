/** A friendly note on phones and tiny windows: the editor wants room and a mouse. Can be dismissed. */
import { useEffect, useRef, useState } from 'react';
import { Button, GlossBall } from '@/ui/kit';
import { useLayer } from '@/ui/kit/layers';
import { useModalFocus } from '@/ui/kit/rooms';
import { isTooSmallForEditor } from './layoutScale';

const KEY = 'bryce3d-web:small-screen-ok';

export function SmallScreenNotice() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const active = !dismissed && isTooSmallForEditor(size.w, size.h);
  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  };
  const layer = useLayer('dialog', dismiss, active);
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, layer, active);
  if (!active) return null;
  return (
    <div ref={ref} tabIndex={-1} className="smallscreen" role="dialog" aria-modal="true" aria-labelledby="smallscreen-title" onKeyDown={(e) => e.stopPropagation()}>
      <div className="smallscreen__card">
        <GlossBall size={64} tone="accent" />
        <h1 id="smallscreen-title">Bryce 3D Web</h1>
        <p>This little world builder needs a bigger screen and a mouse: palettes, drag controls and a ray tracer all want room.</p>
        <p>Open it on a laptop or desktop (1024 × 700 or larger) for the full experience.</p>
        <Button
          variant="primary"
          onClick={dismiss}
        >
          Continue anyway
        </Button>
      </div>
    </div>
  );
}
