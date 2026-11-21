/** Create palette: one click adds an object. NOTE: foundation version; the ui owner restyles it. */
import { OBJECT_LABELS } from '@/core/objects';
import { useStore } from '@/core/store';
import type { ObjectType } from '@/core/types';
import { Icon3D, IconButton } from '@/ui/kit';
import type { IconKind } from '@/ui/kit';

interface CreateItem {
  kind: IconKind;
  type: ObjectType;
  label: string;
  scale?: [number, number, number];
}

const ITEMS: CreateItem[] = [
  { kind: 'water', type: 'water', label: 'Water Plane' },
  { kind: 'cloud', type: 'cloud', label: 'Cloud Plane' },
  { kind: 'ground', type: 'ground', label: 'Ground Plane' },
  { kind: 'terrain', type: 'terrain', label: 'Terrain' },
  { kind: 'lattice', type: 'lattice', label: 'Symmetrical Lattice' },
  { kind: 'stone', type: 'stone', label: 'Stone' },
  { kind: 'tree', type: 'tree', label: 'Tree' },
  ...(['sphere', 'cylinder', 'cube', 'torus', 'cone', 'pyramid', 'disc', 'square'] as const).map((t) => ({ kind: t, type: t, label: OBJECT_LABELS[t] })),
  { kind: 'radialLight', type: 'radialLight', label: 'Radial Light' },
  { kind: 'spotLight', type: 'spotLight', label: 'Spotlight' },
  { kind: 'squareSpotLight', type: 'squareSpotLight', label: 'Square Spotlight' },
  { kind: 'parallelLight', type: 'parallelLight', label: 'Parallel Light' },
];

export function CreatePalette() {
  const create = useStore((s) => s.createObject);
  return (
    <div className="palette-row">
      {ITEMS.map((it) => (
        <IconButton key={it.label} hint={`Create ${it.label}`} onClick={() => create(it.type)}>
          <Icon3D kind={it.kind} />
        </IconButton>
      ))}
    </div>
  );
}
