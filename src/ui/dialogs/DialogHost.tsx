/** Renders the dialog named by ui.dialog. */
import { useStore } from '@/core/store';
import { AboutDialog } from './AboutDialog';
import { AttributesDialog } from './AttributesDialog';
import { RenderSettingsDialog } from './RenderSettingsDialog';
import { ShareDialog } from './ShareDialog';
import { ShortcutsDialog } from './ShortcutsDialog';

export function DialogHost() {
  const dialog = useStore((s) => s.ui.dialog);
  switch (dialog) {
    case 'attributes': return <AttributesDialog />;
    case 'renderSettings': return <RenderSettingsDialog />;
    case 'about': return <AboutDialog />;
    case 'share': return <ShareDialog />;
    case 'shortcuts': return <ShortcutsDialog />;
    default: return null;
  }
}
