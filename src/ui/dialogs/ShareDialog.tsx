/** Share-link dialog. NOTE: foundation stub; the scenes owner finishes it. */
import { useMemo } from 'react';
import { useStore } from '@/core/store';
import { encodeShareLink } from '@/io/share';
import { Dialog } from '@/ui/kit';

export function ShareDialog() {
  const scene = useStore((s) => s.scene);
  const link = useMemo(() => encodeShareLink(scene), [scene]);
  return (
    <Dialog title="Share Scene" onClose={() => useStore.getState().closeDialog()}>
      <textarea readOnly value={link} style={{ width: '100%', height: 120 }} />
    </Dialog>
  );
}
