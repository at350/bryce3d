/**
 * Bryce's Text Display Area: names whatever is under the pointer; otherwise shows render
 * progress, or the scene summary ("5 objects / 12.3 K polygons") and the selection.
 */
import { useMemo } from 'react';
import { selectPrimarySelection, useStore } from '@/core/store';
import { formatElapsed, formatObjects, formatPolygons, scenePolygons } from './edit/sceneStats';

export function TextDisplay() {
  const hint = useStore((s) => s.ui.hint);
  const status = useStore((s) => s.ui.status);
  const objects = useStore((s) => s.scene.objects);
  const selectionCount = useStore((s) => s.selection.length);
  const primary = useStore(selectPrimarySelection);
  const renderStatus = useStore((s) => s.render.status);
  const fraction = useStore((s) => s.render.fraction);
  const pass = useStore((s) => s.render.pass);
  const passCount = useStore((s) => s.render.passCount);
  const elapsed = useStore((s) => s.render.elapsedMs);
  const message = useStore((s) => s.render.message);
  const polys = useMemo(() => scenePolygons(objects), [objects]);

  let main: string;
  let sub = '';
  let meta = '';
  const isHint = !!(hint || status);
  if (hint || status) {
    main = hint || status;
  } else if (renderStatus === 'rendering' || renderStatus === 'paused') {
    main = `${renderStatus === 'paused' ? 'Paused' : 'Rendering'} ${Math.round(fraction * 100)}%`;
    sub = passCount ? `pass ${Math.min(pass + 1, passCount)} of ${passCount}` : '';
    meta = formatElapsed(elapsed);
  } else if (renderStatus === 'error') {
    main = 'Render problem';
    sub = message ?? '';
  } else {
    const target = selectionCount > 1 ? `${selectionCount} selected` : primary ? primary.name : '';
    main = formatObjects(objects.length);
    sub = formatPolygons(polys);
    meta = renderStatus === 'done' ? `rendered in ${formatElapsed(elapsed)}${target ? ` · ${target}` : ''}` : target;
  }
  return (
    <div className={`text-display ${isHint ? 'is-hint' : ''}`} aria-live="polite">
      <div className="text-display__main">{main}</div>
      {sub && <div className="text-display__sub">{sub}</div>}
      {meta && <div className="text-display__meta">{meta}</div>}
    </div>
  );
}
