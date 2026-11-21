/** Bottom Selection palette. NOTE: foundation version; the ui owner restyles it. */
import { SELECTION_GROUPS } from '@/core/objects';
import { useStore } from '@/core/store';
import { Button } from '@/ui/kit';

export function SelectionPalette() {
  const s = useStore.getState();
  return (
    <footer className="selection-palette">
      <Button hint="Select all" onClick={() => s.selectAll()}>All</Button>
      {SELECTION_GROUPS.map((g) => (
        <Button key={g.id} hint={`Select ${g.label}`} onClick={() => s.selectByType(g.types)}>
          {g.label}
        </Button>
      ))}
    </footer>
  );
}
