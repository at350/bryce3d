/** Object Attributes dialog. NOTE: foundation version; the ui owner completes it. */
import { selectPrimarySelection, useStore } from '@/core/store';
import type { Vec3 } from '@/core/types';
import { Dialog, DragValue } from '@/ui/kit';

export function AttributesDialog() {
  const obj = useStore(selectPrimarySelection);
  const close = () => useStore.getState().closeDialog();
  if (!obj) {
    return (
      <Dialog title="Object Attributes" onClose={close}>
        <p>Select an object first.</p>
      </Dialog>
    );
  }
  const setVec = (key: 'position' | 'rotation' | 'scale', i: number, v: number) => {
    const next = [...obj.transform[key]] as Vec3;
    next[i] = v;
    useStore.getState().setTransform(obj.id, { [key]: next });
  };
  return (
    <Dialog title={`Attributes: ${obj.name}`} onClose={close}>
      {(['position', 'rotation', 'scale'] as const).map((key) => (
        <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 70 }}>{key}</span>
          {[0, 1, 2].map((i) => (
            <DragValue
              key={i}
              value={obj.transform[key][i]}
              min={key === 'scale' ? 0.01 : key === 'rotation' ? -360 : -1000}
              max={key === 'rotation' ? 360 : 1000}
              precision={2}
              onChange={(v) => setVec(key, i, v)}
            />
          ))}
        </div>
      ))}
    </Dialog>
  );
}
