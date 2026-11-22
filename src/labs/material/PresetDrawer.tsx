/**
 * Presets strip: category tabs over a scrolling row of named, CPU-rendered sphere tiles.
 * Clicking a tile loads the preset into the working copy (undoable). Tiles render a few
 * at a time in the background and are cached for the session.
 */
import { useEffect, useMemo, useState } from 'react';
import { cachedThumbnailURL, materialThumbnailURL } from '@/materials/cpuPreview';
import { MATERIAL_CATEGORIES, presetsInCategory, type MaterialPreset } from '@/materials/presets';
import { Tabs, useHint } from '@/ui/kit';

const TILE = 64;
const FRAME_BUDGET_MS = 14;

/** Render missing thumbnails a few per frame; returns a counter that bumps as tiles land. */
function useThumbnails(presets: MaterialPreset[]): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const queue = presets.filter((p) => !cachedThumbnailURL(p.id, TILE, p.preview));
    if (!queue.length) return;
    let timer = 0;
    const step = () => {
      const start = performance.now();
      let drawn = 0;
      while (queue.length && (drawn === 0 || performance.now() - start < FRAME_BUDGET_MS)) {
        const p = queue.shift()!;
        if (materialThumbnailURL(p.material, TILE, p.id, { shape: p.preview })) drawn++;
      }
      if (drawn) setVersion((v) => v + 1);
      if (queue.length) timer = window.setTimeout(step, 16);
    };
    timer = window.setTimeout(step, 40);
    return () => window.clearTimeout(timer);
  }, [presets]);
  return version;
}

export function PresetDrawer({ activeId, onPick }: { activeId: string | null; onPick: (p: MaterialPreset) => void }) {
  const [category, setCategory] = useState(() => MATERIAL_CATEGORIES[0]);
  const presets = useMemo(() => presetsInCategory(category), [category]);
  useThumbnails(presets);
  const tabs = useMemo(() => MATERIAL_CATEGORIES.map((c) => ({ id: c, label: c, hint: `${c} presets` })), []);
  return (
    <div className="ml-drawer">
      <Tabs tabs={tabs} value={category} onChange={setCategory} className="ml-drawer__tabs" />
      <div className="ml-drawer__tiles" role="listbox" aria-label={`${category} materials`}>
        {presets.map((p) => (
          <Tile key={p.id} preset={p} url={cachedThumbnailURL(p.id, TILE, p.preview)} active={p.id === activeId} onPick={() => onPick(p)} />
        ))}
      </div>
    </div>
  );
}

function Tile({ preset, url, active, onPick }: { preset: MaterialPreset; url: string | undefined; active: boolean; onPick: () => void }) {
  const hint = `${preset.name}: ${preset.description ?? ''}`;
  return (
    <button type="button" role="option" aria-selected={active} className={`ml-tile ${active ? 'is-active' : ''}`} onClick={onPick} aria-label={hint} {...useHint(hint)}>
      {url ? <img src={url} width={TILE} height={TILE} alt="" draggable={false} /> : <span className="ml-tile__placeholder" />}
      <span className="ml-tile__name">{preset.name}</span>
    </button>
  );
}
