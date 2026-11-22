/**
 * The Bryce-style preset library window (objects / materials / skies / scenes), shown when
 * ui.library is set: categories on the left, a grid of ray-traced tiles, the focused
 * preset's name, description and a larger preview on top, Apply / Cancel at the bottom.
 * Double-click a tile to apply and close. Keys: arrows move, Enter applies, Escape cancels,
 * typing searches.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import type { LibraryKind } from '@/core/types';
import { hasUnsavedChanges } from '@/io/dirty';
import { downloadScene } from '@/io/files';
import { librarySpec, type LibraryItem } from './libraryItems';
import { LibraryTile } from './LibraryTile';
import { prioritizeThumbnail, useThumbnail, wantThumbnails } from './thumbnails';
import './library.css';

const lastCategory = new Map<LibraryKind, string>();
const MIN_ROWS = 4;

export function LibraryBrowser() {
  const kind = useStore((s) => s.ui.library);
  if (!kind) return null;
  return <LibraryWindow key={kind} kind={kind} />;
}

const matches = (item: LibraryItem, q: string) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);

function LibraryWindow({ kind }: { kind: LibraryKind }) {
  const spec = useMemo(() => librarySpec(kind), [kind]);
  const [category, setCategory] = useState(() => {
    const remembered = lastCategory.get(kind);
    return remembered && spec.categories.includes(remembered) ? remembered : spec.categories[0] ?? '';
  });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<LibraryItem | null>(null);
  const [confirming, setConfirming] = useState<LibraryItem | null>(null);
  const [cols, setCols] = useState(6);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // re-evaluate "blocked" (materials need a selection) whenever the selection changes
  useStore((s) => s.selection);
  const blocked = spec.blocked();

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => (q ? spec.items.filter((it) => matches(it, q)) : spec.items.filter((it) => it.category === category)), [spec, q, category]);
  const selected = visible.find((it) => it.id === selectedId) ?? null;
  const focus = hovered ?? selected ?? visible[0] ?? null;

  const close = useCallback(() => useStore.getState().closeLibrary(), []);

  useEffect(() => {
    lastCategory.set(kind, category);
  }, [kind, category]);

  // global shortcuts (delete, nudge, undo...) must not fire while the window has the keyboard
  useEffect(() => {
    const s = useStore.getState();
    s.setUI({ keyboardCaptured: true });
    gridRef.current?.focus({ preventScroll: true });
    return () => {
      useStore.getState().setUI({ keyboardCaptured: false });
      wantThumbnails([]);
      prioritizeThumbnail(null);
    };
  }, []);

  // thumbnails: visible tiles first, then the rest of this library, one at a time in idle time
  useEffect(() => {
    const rest = spec.items.filter((it) => !visible.includes(it));
    wantThumbnails([...visible, ...rest].map((it) => it.thumb));
  }, [spec, visible]);

  // the larger preview of the focused preset (debounced so sweeping the mouse stays cheap)
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => prioritizeThumbnail(focus.large), 220);
    return () => clearTimeout(t);
  }, [focus]);

  // columns of the auto-fill grid, for arrow keys and the empty Bryce slots
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => setCols(Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);

  const select = useCallback((item: LibraryItem) => {
    setSelectedId(item.id);
    setConfirming(null);
    useStore.getState().setHint(item.name);
  }, []);

  const apply = useCallback(
    (item: LibraryItem | null, confirmed = false) => {
      if (!item) return;
      const reason = spec.blocked();
      if (reason) {
        setSelectedId(item.id);
        useStore.getState().showStatus(reason);
        return;
      }
      if (spec.needsConfirm && !confirmed && hasUnsavedChanges()) {
        setSelectedId(item.id);
        setConfirming(item);
        return;
      }
      item.apply();
      close();
    },
    [spec, close],
  );

  const hover = useCallback((item: LibraryItem | null) => {
    setHovered(item);
    if (item) useStore.getState().setHint(`${item.name}: click to select, double-click to apply`);
  }, []);

  const move = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const i = selected ? visible.indexOf(selected) : -1;
      const next = visible[Math.min(visible.length - 1, Math.max(0, i < 0 ? 0 : i + delta))];
      setHovered(null);
      select(next);
      gridRef.current?.querySelector(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
    },
    [visible, selected, select],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inSearch = e.target === searchRef.current;
      const stop = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (e.key === 'Escape') {
        stop();
        if (confirming) setConfirming(null);
        else if (inSearch && query) setQuery('');
        else close();
      } else if (e.key === 'Enter') {
        stop();
        apply(confirming ?? selected ?? focus, !!confirming);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        stop();
        move(e.key === 'ArrowDown' ? cols : -cols);
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !inSearch) {
        stop();
        move(e.key === 'ArrowRight' ? 1 : -1);
      } else if (!inSearch && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && e.key !== ' ') {
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [confirming, query, selected, focus, cols, apply, move, close]);

  const slots = Math.max(MIN_ROWS * cols, Math.ceil(visible.length / cols) * cols) - visible.length;
  const largeUrl = useThumbnail(focus?.large.key ?? null);
  const smallUrl = useThumbnail(focus?.thumb.key ?? null);
  const preview = largeUrl ?? smallUrl;

  return (
    <div className="lib-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={`lib-window lib-window--${kind}`} role="dialog" aria-label={`${spec.title} library`}>
        <header className="lib-titlebar">
          <h2>{spec.title}</h2>
          <input
            ref={searchRef}
            className="lib-search"
            type="search"
            placeholder={`Search ${spec.items.length} ${spec.title.toLowerCase()}`}
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setSelectedId(null);
            }}
            aria-label={`Search ${spec.title.toLowerCase()}`}
          />
        </header>
        <div className="lib-body">
          <div className={`lib-preview ${spec.wide ? 'is-wide' : ''}`}>
            {preview ? <img src={preview} alt="" className={largeUrl ? '' : 'is-upscaled'} /> : <span className="lib-tile__spinner" aria-hidden="true" />}
            <span className="lib-preview__corner" aria-hidden="true" />
          </div>
          <div className="lib-info" aria-live="polite">
            {focus ? (
              <>
                <h3 className="lib-info__name">{focus.name}</h3>
                <p className="lib-info__desc">{focus.description}</p>
                <p className="lib-info__meta">
                  {focus.category}
                  {focus.meta ? ` · ${focus.meta}` : ''}
                </p>
              </>
            ) : (
              <h3 className="lib-info__name is-empty">Nothing matches “{query}”</h3>
            )}
            {blocked && <p className="lib-info__blocked">{blocked}</p>}
          </div>
          <nav className="lib-cats" aria-label="Categories">
            {spec.categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`lib-cat ${!q && c === category ? 'is-active' : ''}`}
                onClick={() => {
                  setCategory(c);
                  setQuery('');
                  setSelectedId(null);
                  gridRef.current?.scrollTo({ top: 0 });
                }}
                onPointerEnter={() => useStore.getState().setHint(`${c} (${spec.items.filter((it) => it.category === c).length})`)}
              >
                {c}
              </button>
            ))}
            {q && <p className="lib-cats__found">{visible.length} found</p>}
          </nav>
          <div ref={gridRef} className={`lib-grid ${spec.wide ? 'is-wide' : ''}`} role="listbox" aria-label={`${spec.title} presets`} tabIndex={0}>
            {visible.map((it) => (
              <LibraryTile key={it.id} item={it} selected={it.id === selected?.id} onSelect={select} onApply={apply} onHover={hover} />
            ))}
            {Array.from({ length: slots }, (_, i) => (
              <span key={`slot${i}`} className="lib-slot" aria-hidden="true" />
            ))}
          </div>
        </div>
        <footer className="lib-footer">
          <span className="lib-folder" title="Preset collection">
            Installed <span aria-hidden="true">▾</span>
          </span>
          {confirming ? (
            <div className="lib-confirm" role="alertdialog" aria-label="Replace the current scene?">
              <span>Replace your scene? It has unsaved changes (Undo can bring it back).</span>
              <button type="button" className="lib-textbtn" onClick={() => downloadScene(useStore.getState().scene)}>
                Save first
              </button>
              <button type="button" className="lib-textbtn is-strong" onClick={() => apply(confirming, true)}>
                Replace
              </button>
              <button type="button" className="lib-textbtn" onClick={() => setConfirming(null)}>
                Keep editing
              </button>
            </div>
          ) : (
            <span className="lib-footer__hint">{kind === 'materials' ? 'Applies to the selected objects' : 'Double-click a tile to apply'}</span>
          )}
          <div className="lib-buttons">
            <button type="button" className="lib-round lib-round--cancel" aria-label="Cancel" title="Cancel (Esc)" onClick={close}>
              ✕
            </button>
            <button
              type="button"
              className="lib-round lib-round--ok"
              aria-label="Apply"
              title={blocked ?? 'Apply (Enter)'}
              disabled={!!blocked || !focus}
              onClick={() => apply(selected ?? focus)}
            >
              ✓
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
