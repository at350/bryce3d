/** Right-hand Advanced Display palette. NOTE: foundation version; the ui owner restyles it. */
import { useStore } from '@/core/store';
import { frameSelection, zoomView } from '@/viewport/commands';
import { Icon3D, IconButton } from '@/ui/kit';

export function DisplayPalette() {
  const display = useStore((s) => s.ui.display);
  const under = useStore((s) => s.ui.showRenderUnderWireframe);
  const s = useStore.getState();
  return (
    <aside className="display-palette">
      <IconButton hint="Wireframe display" active={display === 'wireframe'} onClick={() => s.setUI({ display: 'wireframe' })}>
        <Icon3D kind="wireframe" size={24} />
      </IconButton>
      <IconButton hint="Solid display" active={display === 'solid'} onClick={() => s.setUI({ display: 'solid' })}>
        <Icon3D kind="solid" size={24} />
      </IconButton>
      <IconButton hint="Show render under wireframes" active={under} onClick={() => s.setUI({ showRenderUnderWireframe: !under })}>
        <Icon3D kind="eye" size={24} />
      </IconButton>
      <IconButton hint="Frame selection" onClick={() => frameSelection()}>
        <Icon3D kind="frame" size={24} />
      </IconButton>
      <IconButton hint="Zoom in" onClick={() => zoomView(1.25)}>
        <Icon3D kind="zoomIn" size={24} />
      </IconButton>
      <IconButton hint="Zoom out" onClick={() => zoomView(0.8)}>
        <Icon3D kind="zoomOut" size={24} />
      </IconButton>
    </aside>
  );
}
