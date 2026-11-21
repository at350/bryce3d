/**
 * The Working window. NOTE: foundation stub (lists objects and shows the render canvas);
 * the viewport owner replaces it with the three.js editor view, keeping the export.
 */
import { useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { getRenderer } from '@/render';

export function Viewport() {
  const objects = useStore((s) => s.scene.objects);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const renderVisible = useStore((s) => s.render.visible);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const canvas = getRenderer().outputCanvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    el.appendChild(canvas);
    return () => {
      canvas.remove();
    };
  }, []);

  return (
    <div className="viewport-stub" style={{ position: 'absolute', inset: 0, background: '#d8d8d4', overflow: 'hidden' }}>
      <div ref={holder} style={{ position: 'absolute', inset: 0, display: renderVisible ? 'block' : 'none' }} />
      <ul style={{ position: 'absolute', left: 12, top: 12, margin: 0, padding: 0, listStyle: 'none', font: '12px sans-serif' }}>
        {objects.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => select(o.id)}
              style={{ color: selection.includes(o.id) ? '#d01' : '#333', background: 'none', border: 0, cursor: 'pointer' }}
            >
              {o.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
