/** The A / B / C component editors (up to three) with an Add button. */
import { useEffect, useRef } from 'react';
import { COMPONENT_LETTERS, MAX_COMPONENTS } from '@/materials/channels';
import { addComponent } from '@/materials/edit';
import { Button } from '@/ui/kit';
import { ComponentEditor } from './ComponentEditor';
import type { LabEditor } from './labTypes';
import { newComponentFor } from './newComponent';

export function ComponentStack({ editor, selected, onSelect }: { editor: LabEditor; selected: number; onSelect: (i: number) => void }) {
  const m = editor.material;
  const count = m.components.length;
  const list = useRef<HTMLDivElement>(null);
  // Bring the selected editor into view (e.g. after clicking a grid ball or column head).
  useEffect(() => {
    const el = list.current?.querySelectorAll('.ml-comp')[selected];
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected, count]);
  return (
    <div className="ml-comps" ref={list}>
      {m.components.map((_, i) => (
        <ComponentEditor key={i} editor={editor} index={i} selected={selected === i} onSelect={() => onSelect(i)} />
      ))}
      {count === 0 && (
        <p className="ml-comps__empty">
          Flat colors only. Add a texture component, then click the A / B / C balls in the grid to let it drive a channel.
        </p>
      )}
      {count < MAX_COMPONENTS && (
        <Button
          hint={`Add texture component ${COMPONENT_LETTERS[count]}`}
          onClick={() => {
            editor.update((cur) => addComponent(cur, newComponentFor(cur, null, cur.components.length)), 'add');
            onSelect(count);
          }}
        >
          + Add component {COMPONENT_LETTERS[count]}
        </Button>
      )}
    </div>
  );
}
