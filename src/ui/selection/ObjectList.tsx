/** Compact list of every object: click to select (Shift/Cmd: add or remove), eye = hidden, lock = locked. */
import { useMemo, useState } from 'react';
import { FAMILY_COLORS } from '@/core/defaults';
import { rgbToHex } from '@/core/math';
import { OBJECT_LABELS } from '@/core/objects';
import { useStore } from '@/core/store';

function EyeGlyph({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M1 8 C3.5 3.5 12.5 3.5 15 8 C12.5 12.5 3.5 12.5 1 8 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {open ? <circle cx="8" cy="8" r="2.4" fill="currentColor" /> : <path d="M2 14 L14 2" stroke="currentColor" strokeWidth="1.4" />}
    </svg>
  );
}

function LockGlyph({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor" />
      <path d={locked ? 'M5 7 V5 a3 3 0 0 1 6 0 V7' : 'M5 7 V5 a3 3 0 0 1 6 0'} fill="none" stroke="currentColor" strokeWidth="1.6" transform={locked ? undefined : 'translate(3 -1)'} />
    </svg>
  );
}

export function ObjectList() {
  const objects = useStore((s) => s.scene.objects);
  const selection = useStore((s) => s.selection);
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? objects.filter((o) => o.name.toLowerCase().includes(q) || OBJECT_LABELS[o.type].toLowerCase().includes(q)) : objects;
  }, [objects, filter]);
  const sel = new Set(selection);
  const s = useStore.getState();
  return (
    <div className="object-list" role="dialog" aria-label="Objects in the scene">
      <div className="object-list__header">
        <span>{objects.length} objects</span>
        <input className="object-list__filter" placeholder="Find…" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} aria-label="Filter objects" />
      </div>
      <div className="object-list__items" role="list">
        {shown.map((o) => (
          <div key={o.id} className={`object-row ${sel.has(o.id) ? 'is-selected' : ''}`} role="listitem">
            <span className="object-row__swatch" style={{ background: rgbToHex(FAMILY_COLORS[o.family ?? 0] ?? FAMILY_COLORS[0]) }} />
            <button
              type="button"
              className="object-row__name"
              title={o.name}
              onClick={(e) => s.select(o.id, e.shiftKey || e.metaKey || e.ctrlKey ? 'toggle' : 'replace')}
            >
              {o.name}
            </button>
            <span className="object-row__type">{OBJECT_LABELS[o.type]}</span>
            <button
              type="button"
              className={`object-row__toggle ${o.hidden ? 'is-off' : ''}`}
              aria-label={o.hidden ? `Show ${o.name}` : `Hide ${o.name}`}
              aria-pressed={!o.hidden}
              onClick={() => s.updateObject(o.id, { hidden: !o.hidden })}
            >
              <EyeGlyph open={!o.hidden} />
            </button>
            <button
              type="button"
              className={`object-row__toggle ${o.locked ? '' : 'is-off'}`}
              aria-label={o.locked ? `Unlock ${o.name}` : `Lock ${o.name}`}
              aria-pressed={!!o.locked}
              onClick={() => s.updateObject(o.id, { locked: !o.locked })}
            >
              <LockGlyph locked={!!o.locked} />
            </button>
          </div>
        ))}
        {!shown.length && <div className="object-list__empty">{objects.length ? 'No match' : 'The scene is empty: create something!'}</div>}
      </div>
    </div>
  );
}
