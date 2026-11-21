/** File / Edit / Objects / Help menus. NOTE: foundation version; the ui owner restyles it. */
import { useStore } from '@/core/store';
import { downloadRenderPNG, downloadScene, openSceneFile } from '@/io/files';
import { TriangleMenu, type MenuItem } from '@/ui/kit';

function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  return <TriangleMenu className="menubar__menu" hint={`${label} menu`} trigger={label} items={items} />;
}

export function MenuBar() {
  const s = useStore.getState();
  const file: MenuItem[] = [
    { label: 'New', onSelect: () => s.newScene() },
    {
      label: 'Open…',
      onSelect: () =>
        openSceneFile()
          .then((scene) => scene && useStore.getState().loadScene(scene))
          .catch((e: Error) => useStore.getState().showStatus(e.message)),
    },
    { label: 'Save', onSelect: () => downloadScene(useStore.getState().scene) },
    { label: 'Share Link…', onSelect: () => s.openDialog('share') },
    { divider: true, label: '' },
    { label: 'Export Render (PNG)', onSelect: () => void downloadRenderPNG().then((ok) => !ok && useStore.getState().showStatus('Render the scene first.')) },
    { label: 'Sample Scenes…', onSelect: () => s.openLibrary('scenes') },
  ];
  const edit: MenuItem[] = [
    { label: 'Undo', onSelect: () => s.undo() },
    { label: 'Redo', onSelect: () => s.redo() },
    { divider: true, label: '' },
    { label: 'Duplicate', onSelect: () => s.duplicateObjects(useStore.getState().selection) },
    { label: 'Delete', onSelect: () => s.removeObjects(useStore.getState().selection) },
    { label: 'Select All', onSelect: () => s.selectAll() },
  ];
  const objects: MenuItem[] = [
    { label: 'Object Attributes…', onSelect: () => s.openDialog('attributes') },
    { label: 'Objects Library…', onSelect: () => s.openLibrary('objects') },
  ];
  const help: MenuItem[] = [
    { label: 'Keyboard Shortcuts', onSelect: () => s.openDialog('shortcuts') },
    { label: 'About Bryce 3D Web', onSelect: () => s.openDialog('about') },
  ];
  return (
    <nav className="menubar">
      <Menu label="File" items={file} />
      <Menu label="Edit" items={edit} />
      <Menu label="Objects" items={objects} />
      <Menu label="Help" items={help} />
    </nav>
  );
}
