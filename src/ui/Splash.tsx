/**
 * A short homage title card on load: fades after ~1.2 s, or on click / any key. Shown once
 * per browser session; skipped for automation (headless screenshots) unless ?splash=1.
 */
import { useEffect, useRef, useState } from 'react';
import { paintSplash } from './splashArt';

const KEY = 'bryce3d-web:splash-seen';

let decision: boolean | null = null;

/** Decided once per page load (StrictMode runs state initializers twice). */
function shouldShowSplash(): boolean {
  if (decision !== null) return decision;
  const q = new URLSearchParams(location.search);
  if (q.has('splash')) decision = q.get('splash') !== '0';
  else if (navigator.webdriver) decision = false;
  else {
    decision = true;
    try {
      if (sessionStorage.getItem(KEY)) decision = false;
      else sessionStorage.setItem(KEY, '1');
    } catch {
      // storage unavailable: show it every time
    }
  }
  return decision;
}

/** onDone(shown) runs when the card is gone (shown = false when it was skipped). */
export function Splash({ onDone }: { onDone?: (shown: boolean) => void }) {
  const [shown] = useState(shouldShowSplash);
  const [phase, setPhase] = useState<'show' | 'leaving' | 'gone'>(shown ? 'show' : 'gone');
  const canvas = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (phase === 'gone') {
      doneRef.current?.(shown);
      return;
    }
    if (phase === 'show') {
      if (canvas.current) paintSplash(canvas.current);
      const leave = () => setPhase('leaving');
      const t = setTimeout(leave, 1200);
      window.addEventListener('keydown', leave, { once: true });
      return () => {
        clearTimeout(t);
        window.removeEventListener('keydown', leave);
      };
    }
    const t = setTimeout(() => setPhase('gone'), 480);
    return () => clearTimeout(t);
  }, [phase, shown]);

  if (phase === 'gone') return null;
  return (
    <div className={`splash ${phase === 'leaving' ? 'is-leaving' : ''}`} role="presentation" onClick={() => setPhase('leaving')}>
      <div className="splash__card">
        <canvas ref={canvas} className="splash__canvas" aria-hidden="true" />
        <div className="splash__title">
          Bryce 3D Web
          <small>A LANDSCAPE HOMAGE</small>
        </div>
        <div className="splash__credit">Unofficial tribute to Bryce by Eric Wenger, Kai Krause, Phil Clevenger &amp; Sree Kotay</div>
      </div>
    </div>
  );
}
