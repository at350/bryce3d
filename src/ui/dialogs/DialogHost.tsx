/** Renders the dialog named by ui.dialog (inside an error boundary so a broken dialog can be closed). */
import { useStore } from '@/core/store';
import { ErrorBoundary } from '../ErrorBoundary';
import { AboutDialog } from './AboutDialog';
import { AttributesDialog } from './AttributesDialog';
import { RenderSettingsDialog } from './RenderSettingsDialog';
import { ShareDialog } from './ShareDialog';
import { ShortcutsDialog } from './ShortcutsDialog';

function CurrentDialog({ dialog }: { dialog: NonNullable<ReturnType<typeof useStore.getState>['ui']['dialog']> }) {
  switch (dialog) {
    case 'attributes': return <AttributesDialog />;
    case 'renderSettings': return <RenderSettingsDialog />;
    case 'about': return <AboutDialog />;
    case 'share': return <ShareDialog />;
    case 'shortcuts': return <ShortcutsDialog />;
    default: return null;
  }
}

export function DialogHost() {
  const dialog = useStore((s) => s.ui.dialog);
  if (!dialog) return null;
  return (
    <ErrorBoundary name="This window" variant="overlay" resetKey={dialog} onClose={() => useStore.getState().closeDialog()}>
      <CurrentDialog dialog={dialog} />
    </ErrorBoundary>
  );
}
