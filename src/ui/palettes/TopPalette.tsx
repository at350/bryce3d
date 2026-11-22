/** The top tool palette: Create / Edit / Sky & Fog titles (triangles open the libraries) and the active palette's shelf. */
import { useStore } from '@/core/store';
import type { LibraryKind, PaletteTab } from '@/core/types';
import { TriangleGlyph, useHint } from '@/ui/kit';
import { ErrorBoundary } from '../ErrorBoundary';
import { CreatePalette } from './CreatePalette';
import { EditPalette } from './EditPalette';
import { SkyFogPalette } from './SkyFogPalette';

const TABS: { id: PaletteTab; label: string; library: LibraryKind; libraryLabel: string; key: string }[] = [
  { id: 'create', label: 'Create', library: 'objects', libraryLabel: 'Objects Library', key: '1' },
  { id: 'edit', label: 'Edit', library: 'materials', libraryLabel: 'Materials Library', key: '2' },
  { id: 'sky', label: 'Sky & Fog', library: 'skies', libraryLabel: 'Skies Library', key: '3' },
];

function PaletteTitle({ id, label, library, libraryLabel, keyNum }: { id: PaletteTab; label: string; library: LibraryKind; libraryLabel: string; keyNum: string }) {
  const active = useStore((s) => s.ui.palette === id);
  const nameHint = useHint(`${label} palette (Ctrl+${keyNum})`);
  const libHint = useHint(`${libraryLabel}…`);
  return (
    <div className={`palette-title ${active ? 'is-active' : ''}`}>
      <button type="button" className="palette-title__name" aria-pressed={active} onClick={() => useStore.getState().setUI({ palette: id })} {...nameHint}>
        {label}
      </button>
      <button type="button" className="palette-title__tri" aria-label={libraryLabel} onClick={() => useStore.getState().openLibrary(library)} {...libHint}>
        <TriangleGlyph direction="right" />
      </button>
    </div>
  );
}

function DocumentLabel() {
  const name = useStore((s) => s.scene.name);
  const w = useStore((s) => s.scene.render.width);
  const h = useStore((s) => s.scene.render.height);
  const hint = useHint('Document name and render size (Render Settings in the render triangle)');
  return (
    <div className="top-palette__doc" {...hint}>
      <b>{name || 'Untitled'}</b> · {w} × {h}
    </div>
  );
}

export function TopPalette() {
  const palette = useStore((s) => s.ui.palette);
  return (
    <div className="top-palette">
      <div className="top-palette__zoom">
        <div className="top-palette__titles">
          {TABS.map((t) => (
            <PaletteTitle key={t.id} id={t.id} label={t.label} library={t.library} libraryLabel={t.libraryLabel} keyNum={t.key} />
          ))}
          <DocumentLabel />
        </div>
        <ErrorBoundary name={`The ${TABS.find((t) => t.id === palette)?.label ?? ''} palette`} resetKey={palette}>
          {palette === 'create' && <CreatePalette />}
          {palette === 'edit' && <EditPalette />}
          {palette === 'sky' && (
            <div className="shelf shelf--sky">
              <div className="shelf__row">
                <SkyFogPalette />
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
