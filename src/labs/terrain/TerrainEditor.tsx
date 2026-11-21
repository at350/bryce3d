/** The Terrain Editor room. NOTE: foundation stub; the terrain owner builds the real editor. */
import { useState } from 'react';
import { getObject, useStore } from '@/core/store';
import type { TerrainData } from '@/core/types';
import { Button, LabFrame } from '@/ui/kit';
import { applyOp, createTerrainData } from '@/terrain';

export function TerrainEditor() {
  const targetId = useStore((s) => s.ui.labTarget);
  const [terrain, setTerrain] = useState<TerrainData>(() => getObject(targetId)?.terrain ?? createTerrainData());
  const close = () => useStore.getState().closeLab();
  const confirm = () => {
    if (targetId) useStore.getState().updateObject(targetId, { terrain });
    close();
  };
  return (
    <LabFrame title="Terrain Editor" onConfirm={confirm} onCancel={close}>
      <div style={{ padding: 24, display: 'flex', gap: 8 }}>
        <Button onClick={() => setTerrain(createTerrainData('fractal', Math.floor(Math.random() * 1e6), terrain.resolution))}>Fractal</Button>
        <Button onClick={() => setTerrain({ ...terrain, heights: applyOp(terrain.heights, terrain.resolution, 'smooth'), recipe: undefined })}>Smooth</Button>
      </div>
    </LabFrame>
  );
}
