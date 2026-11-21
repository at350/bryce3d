/** Bryce's Text Display Area: names the control under the pointer, otherwise scene stats. */
import { useStore } from '@/core/store';

export function TextDisplay() {
  const hint = useStore((s) => s.ui.hint);
  const status = useStore((s) => s.ui.status);
  const count = useStore((s) => s.scene.objects.length);
  const render = useStore((s) => s.render);
  let text = hint || status;
  if (!text && render.status === 'rendering') text = `Rendering… ${Math.round(render.fraction * 100)}%`;
  if (!text) text = `${count} object${count === 1 ? '' : 's'}`;
  return (
    <div className="text-display" aria-live="polite">
      {text}
    </div>
  );
}
