/** Shows the open lab ("room") full-screen. */
import { useStore } from '@/core/store';
import { MaterialLab } from '@/labs/material/MaterialLab';
import { SkyLab } from '@/labs/sky/SkyLab';
import { TerrainEditor } from '@/labs/terrain/TerrainEditor';

export function LabHost() {
  const lab = useStore((s) => s.ui.lab);
  const target = useStore((s) => s.ui.labTarget);
  // key = lab + target so reopening starts from fresh working copies
  switch (lab) {
    case 'material': return <MaterialLab key={`m-${target}`} />;
    case 'terrain': return <TerrainEditor key={`t-${target}`} />;
    case 'sky': return <SkyLab key="sky" />;
    default: return null;
  }
}
