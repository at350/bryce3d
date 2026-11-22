/** One preset tile in the library grid: a ray-traced thumbnail in a beveled slot. */
import { memo } from 'react';
import type { LibraryItem } from './libraryItems';
import { useThumbnail } from './thumbnails';

export interface LibraryTileProps {
  item: LibraryItem;
  selected: boolean;
  onSelect: (item: LibraryItem) => void;
  onApply: (item: LibraryItem) => void;
  onHover: (item: LibraryItem | null) => void;
}

export const LibraryTile = memo(function LibraryTile({ item, selected, onSelect, onApply, onHover }: LibraryTileProps) {
  const url = useThumbnail(item.thumb.key);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={item.name}
      data-id={item.id}
      tabIndex={-1}
      className={`lib-tile ${selected ? 'is-selected' : ''} ${url ? '' : 'is-pending'}`}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onApply(item)}
      onPointerEnter={() => onHover(item)}
      onPointerLeave={() => onHover(null)}
    >
      {url ? <img src={url} alt="" draggable={false} /> : <span className="lib-tile__spinner" aria-hidden="true" />}
    </button>
  );
});
