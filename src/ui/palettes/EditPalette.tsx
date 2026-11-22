/**
 * Edit palette: Materials, the drag-to-transform tools (Resize, Rotate, Reposition), Align,
 * Randomize and Edit, plus Duplicate / Land / Delete. Everything is disabled until
 * something is selected.
 */
import { useRef, useState } from 'react';
import { isInfinitePlane, isLight, isTerrainLike } from '@/core/objects';
import { randomSeed } from '@/core/math';
import { selectPrimarySelection, useStore } from '@/core/store';
import { Icon3D, IconButton, TriangleMenu, useHint, type MenuItem } from '@/ui/kit';
import { alignSelection, deleteSelection, duplicateSelection, editSelected, landSelection, openAttributes, openMaterialsLab } from '../actions';
import { DragTool } from '../edit/DragTool';
import { randomizeTool, repositionTool, resizeTool, rotateTool } from '../edit/editTools';
import type { RandomizeOptions } from '../edit/transformOps';

type ScatterMode = 'all' | 'position' | 'rotation' | 'size';

const SCATTER: Record<ScatterMode, RandomizeOptions> = {
  all: { position: true, rotation: true, size: true },
  position: { position: true, rotation: false, size: false },
  rotation: { position: false, rotation: true, size: false },
  size: { position: false, rotation: false, size: true },
};

const ALIGN_ITEMS: MenuItem[] = [
  { label: 'Align Left Edges (X)', onSelect: () => alignSelection(0, 'min') },
  { label: 'Align Centers (X)', onSelect: () => alignSelection(0, 'center') },
  { label: 'Align Right Edges (X)', onSelect: () => alignSelection(0, 'max') },
  { divider: true, label: '' },
  { label: 'Align Bottoms (Y)', onSelect: () => alignSelection(1, 'min') },
  { label: 'Align Centers (Y)', onSelect: () => alignSelection(1, 'center') },
  { label: 'Align Tops (Y)', onSelect: () => alignSelection(1, 'max') },
  { divider: true, label: '' },
  { label: 'Align Backs (Z)', onSelect: () => alignSelection(2, 'min') },
  { label: 'Align Centers (Z)', onSelect: () => alignSelection(2, 'center') },
  { label: 'Align Fronts (Z)', onSelect: () => alignSelection(2, 'max') },
  { divider: true, label: '' },
  { label: 'Land on the Ground', shortcut: 'L', onSelect: () => landSelection() },
];

function AlignTool({ disabled }: { disabled: boolean }) {
  const hint = useHint(disabled ? 'Align (select objects first)' : 'Align: click for alignment options');
  return (
    <div className={`edit-tool ${disabled ? 'is-disabled' : ''}`} {...hint}>
      <TriangleMenu
        className="edit-tool__menu"
        ariaLabel="Align"
        disabled={disabled}
        items={ALIGN_ITEMS}
        trigger={
          <span className="edit-tool__icon" style={{ cursor: 'pointer' }}>
            <Icon3D kind="align" size={50} />
          </span>
        }
      />
    </div>
  );
}

export function EditPalette() {
  const primary = useStore(selectPrimarySelection);
  const count = useStore((s) => s.selection.length);
  const [scatter, setScatter] = useState<ScatterMode>('all');
  const seed = useRef(randomSeed());
  const none = !primary;
  const terrain = !!primary && isTerrainLike(primary.type);
  const light = !!primary && isLight(primary.type);
  const planeOnly = !!primary && count === 1 && isInfinitePlane(primary.type);
  // Read the seed at call time: a fresh one is picked when each drag begins.
  const scatterFn: Parameters<typeof DragTool>[0]['apply'] = (base, mode, d) => randomizeTool(seed.current, SCATTER[scatter])(base, mode, d);

  const materialsMenu: MenuItem[] = [
    { label: 'Materials Lab…', shortcut: 'Ctrl+M', disabled: none || light, onSelect: openMaterialsLab },
    { label: 'Materials Library…', onSelect: () => useStore.getState().openLibrary('materials') },
  ];
  const editMenu: MenuItem[] = [
    { label: 'Object Attributes…', shortcut: 'Ctrl+Alt+E', disabled: none, onSelect: openAttributes },
    { label: 'Terrain Editor…', disabled: !terrain, onSelect: () => primary && useStore.getState().openLab('terrain', primary.id) },
  ];
  const scatterMenu: MenuItem[] = (['all', 'position', 'rotation', 'size'] as ScatterMode[]).map((m) => ({
    label: m === 'all' ? 'Scatter Everything' : m === 'position' ? 'Positions Only' : m === 'rotation' ? 'Rotations Only' : 'Sizes Only',
    checked: scatter === m,
    onSelect: () => setScatter(m),
  }));

  return (
    <div className="shelf">
      <div className="shelf__row edit-row">
        <div className={`edit-tool ${none || light ? 'is-disabled' : ''}`}>
          <IconButton hint={light ? 'Lights have no material' : 'Materials Lab (Ctrl+M)'} size={56} disabled={none || light} onClick={openMaterialsLab}>
            <Icon3D kind="materials" size={50} />
          </IconButton>
          <TriangleMenu className="edit-tool__tri" hint="Materials options" items={materialsMenu} />
        </div>
        <DragTool kind="resize" label="Resize" hint="Resize: drag right to grow, left to shrink (X/Y/Z balls: one axis, Shift: 50% steps)" disabled={none || planeOnly} handles={['x', 'y', 'z']} apply={resizeTool} />
        <DragTool kind="rotate" label="Rotate" hint="Rotate: drag to spin around Y (X/Y/Z balls pick the axis, Shift: 45° steps)" disabled={none || planeOnly} handles={['x', 'y', 'z']} apply={rotateTool} />
        <DragTool kind="reposition" label="Reposition" hint="Reposition: drag to slide across the ground (X/Y/Z balls: one axis, Alt: slow)" disabled={none} handles={['x', 'y', 'z']} apply={repositionTool} />
        <AlignTool disabled={none} />
        <DragTool
          kind="randomize"
          label="Randomize"
          hint="Randomize: drag right to scatter the selection, left to calm it (triangle: what to scatter)"
          disabled={none}
          apply={scatterFn}
          onBegin={() => {
            seed.current = randomSeed();
          }}
          menu={scatterMenu}
          menuHint="Randomize options"
        />
        <div className={`edit-tool ${none ? 'is-disabled' : ''}`}>
          <IconButton hint={terrain ? 'Edit Terrain (Ctrl+E)' : 'Edit Object Attributes (Ctrl+E)'} size={56} disabled={none} onClick={editSelected}>
            <Icon3D kind={terrain ? 'editTerrain' : 'editObject'} size={50} />
          </IconButton>
          <TriangleMenu className="edit-tool__tri" hint="Edit options" items={editMenu} />
        </div>
        <div className="edit-small">
          <IconButton hint="Duplicate (Ctrl+D)" size={24} disabled={none} onClick={duplicateSelection}>
            <Icon3D kind="duplicate" size={22} />
          </IconButton>
          <IconButton hint="Land on the ground (L)" size={24} disabled={none} onClick={landSelection}>
            <Icon3D kind="land" size={22} />
          </IconButton>
          <IconButton hint="Delete (Del)" size={24} disabled={none} onClick={deleteSelection}>
            <Icon3D kind="delete" size={20} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
