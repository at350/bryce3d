/** Edit palette. NOTE: foundation version; the ui owner adds the drag-to-transform tools. */
import { isTerrainLike } from '@/core/objects';
import { selectPrimarySelection, useStore } from '@/core/store';
import { Icon3D, IconButton } from '@/ui/kit';

export function EditPalette() {
  const primary = useStore(selectPrimarySelection);
  const s = useStore.getState();
  return (
    <div className="palette-row">
      <IconButton hint="Materials Lab" disabled={!primary} onClick={() => primary && s.openLab('material', primary.id)}>
        <Icon3D kind="materials" />
      </IconButton>
      <IconButton
        hint="Edit Terrain"
        disabled={!primary || !isTerrainLike(primary.type)}
        onClick={() => primary && s.openLab('terrain', primary.id)}
      >
        <Icon3D kind="editTerrain" />
      </IconButton>
      <IconButton hint="Duplicate" disabled={!primary} onClick={() => s.duplicateObjects(useStore.getState().selection)}>
        <Icon3D kind="duplicate" />
      </IconButton>
      <IconButton hint="Delete" disabled={!primary} onClick={() => s.removeObjects(useStore.getState().selection)}>
        <Icon3D kind="delete" />
      </IconButton>
    </div>
  );
}
