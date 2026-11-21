/**
 * The Materials Lab room. NOTE: foundation stub showing the working-copy pattern every lab
 * follows: edit a local copy, ✓ commits to the store, ✗ discards.
 */
import { useState } from 'react';
import { cloneMaterial, defaultMaterial } from '@/core/materialUtils';
import { getObject, useStore } from '@/core/store';
import { LabFrame, Slider } from '@/ui/kit';

export function MaterialLab() {
  const targetId = useStore((s) => s.ui.labTarget);
  const [mat, setMat] = useState(() => cloneMaterial(getObject(targetId)?.material ?? defaultMaterial()));
  const close = () => useStore.getState().closeLab();
  const confirm = () => {
    const s = useStore.getState();
    const ids = s.selection.length ? s.selection : targetId ? [targetId] : [];
    if (ids.length) s.setMaterial(ids, mat);
    close();
  };
  return (
    <LabFrame title="Materials Lab" onConfirm={confirm} onCancel={close}>
      <div style={{ padding: 24, display: 'grid', gap: 8 }}>
        <Slider label="Reflection" value={mat.reflection} min={0} max={100} onChange={(v) => setMat({ ...mat, reflection: v })} />
        <Slider label="Transparency" value={mat.transparency} min={0} max={100} onChange={(v) => setMat({ ...mat, transparency: v })} />
      </div>
    </LabFrame>
  );
}
