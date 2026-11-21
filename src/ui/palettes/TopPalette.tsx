/** The top tool palette: Create / Edit / Sky & Fog titles and the active icon row. */
import { useStore } from '@/core/store';
import type { LibraryKind, PaletteTab } from '@/core/types';
import { TriangleMenu, useHint } from '@/ui/kit';
import { CreatePalette } from './CreatePalette';
import { EditPalette } from './EditPalette';
import { SkyFogPalette } from './SkyFogPalette';

const TABS: { id: PaletteTab; label: string; library: LibraryKind; libraryLabel: string }[] = [
  { id: 'create', label: 'Create', library: 'objects', libraryLabel: 'Objects Library' },
  { id: 'edit', label: 'Edit', library: 'materials', libraryLabel: 'Materials Library' },
  { id: 'sky', label: 'Sky & Fog', library: 'skies', libraryLabel: 'Skies Library' },
];

function PaletteTitle({ id, label, library, libraryLabel }: (typeof TABS)[number]) {
  const active = useStore((s) => s.ui.palette === id);
  const hint = useHint(`${label} palette`);
  return (
    <div className={`palette-title ${active ? 'is-active' : ''}`}>
      <button type="button" onClick={() => useStore.getState().setUI({ palette: id })} {...hint}>
        {label}
      </button>
      <TriangleMenu hint={libraryLabel} items={[{ label: `${libraryLabel}…`, onSelect: () => useStore.getState().openLibrary(library) }]} />
    </div>
  );
}

export function TopPalette() {
  const palette = useStore((s) => s.ui.palette);
  return (
    <div className="top-palette">
      <div className="top-palette__titles">
        {TABS.map((t) => (
          <PaletteTitle key={t.id} {...t} />
        ))}
      </div>
      <div className="top-palette__row">
        {palette === 'create' && <CreatePalette />}
        {palette === 'edit' && <EditPalette />}
        {palette === 'sky' && <SkyFogPalette />}
      </div>
    </div>
  );
}
