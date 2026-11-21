import { useStore } from '@/core/store';
import { Dialog } from '@/ui/kit';

export function AboutDialog() {
  return (
    <Dialog title="About Bryce 3D Web" onClose={() => useStore.getState().closeDialog()}>
      <p>
        An unofficial, browser-based homage to Bryce 3D, the landscape renderer by Phil Clevenger, Kai Krause,
        Sree Kotay and Eric Wenger (1994).
      </p>
      <p>
        Bryce is a trademark of DAZ 3D. This project is not affiliated with or endorsed by DAZ 3D and contains
        no original Bryce code, artwork or presets.
      </p>
    </Dialog>
  );
}
