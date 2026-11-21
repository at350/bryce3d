import { useEffect } from 'react';
import { useStore } from '@/core/store';
import { ControlPalette } from '@/ui/ControlPalette';
import { DialogHost } from '@/ui/dialogs/DialogHost';
import { DisplayPalette } from '@/ui/DisplayPalette';
import { LabHost } from '@/ui/LabHost';
import { LibraryBrowser } from '@/ui/library/LibraryBrowser';
import { MenuBar } from '@/ui/MenuBar';
import { TopPalette } from '@/ui/palettes/TopPalette';
import { SelectionPalette } from '@/ui/SelectionPalette';
import { installShortcuts } from '@/ui/shortcuts';
import { Viewport } from '@/viewport/Viewport';

export function App() {
  const skin = useStore((s) => s.ui.skin);
  const lab = useStore((s) => s.ui.lab);
  useEffect(() => installShortcuts(), []);
  return (
    <div className={`app skin-${skin}`}>
      <div className="desktop" hidden={!!lab}>
        <MenuBar />
        <TopPalette />
        <ControlPalette />
        <main className="working-window">
          <Viewport />
        </main>
        <DisplayPalette />
        <SelectionPalette />
      </div>
      <LabHost />
      <LibraryBrowser />
      <DialogHost />
    </div>
  );
}
