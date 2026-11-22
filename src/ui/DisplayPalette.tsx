/** Right-hand Advanced Display palette: display mode, render-under-wireframe, depth cue, framing and zoom, Nano on/off. */
import { useStore } from '@/core/store';
import { frameSelection, resetView, zoomView } from '@/viewport/commands';
import { useViewport } from '@/viewport/viewState';
import { Icon3D, IconButton } from '@/ui/kit';

const Sep = () => <div className="display-palette__sep" aria-hidden="true" />;

export function DisplayPalette() {
  const display = useStore((s) => s.ui.display);
  const under = useStore((s) => s.ui.showRenderUnderWireframe);
  const autoNano = useStore((s) => s.ui.autoNano);
  const view = useStore((s) => s.ui.view);
  const depthCue = useViewport((v) => v.depthCue);
  const setUI = useStore.getState().setUI;
  const ortho = view !== 'camera' && view !== 'director';
  return (
    <aside className="display-palette" aria-label="Advanced Display palette">
      <div className="display-palette__zoom">
        <IconButton hint="Wireframe display" size={32} toggle active={display === 'wireframe'} onClick={() => setUI({ display: 'wireframe' })}>
          <Icon3D kind="wireframe" size={26} />
        </IconButton>
        <IconButton hint="Solid (shaded) display" size={32} toggle active={display === 'solid'} onClick={() => setUI({ display: 'solid' })}>
          <Icon3D kind="solid" size={26} />
        </IconButton>
        <Sep />
        <IconButton
          hint={`Keep the render visible under the wireframes: ${under ? 'on' : 'off'}`}
          size={32}
          toggle
          active={under}
          onClick={() => setUI({ showRenderUnderWireframe: !under })}
        >
          <Icon3D kind="eye" size={26} />
        </IconButton>
        <IconButton
          hint={`Depth cue (far lines fade): ${depthCue ? 'on' : 'off'}`}
          size={32}
          toggle
          active={depthCue}
          onClick={() => useViewport.getState().setDepthCue(!depthCue)}
        >
          <Icon3D kind="depthCue" size={26} />
        </IconButton>
        <Sep />
        <IconButton hint="Frame the selection (or the whole scene)" size={32} onClick={() => frameSelection()}>
          <Icon3D kind="frame" size={26} />
        </IconButton>
        <IconButton hint="Zoom in" size={32} onClick={() => zoomView(1.25)}>
          <Icon3D kind="zoomIn" size={26} />
        </IconButton>
        <IconButton hint="Zoom out" size={32} onClick={() => zoomView(0.8)}>
          <Icon3D kind="zoomOut" size={26} />
        </IconButton>
        <IconButton hint={ortho ? 'Reset this view' : 'Reset the view (orthographic views)'} size={32} disabled={!ortho} onClick={() => resetView()}>
          <Icon3D kind="resetView" size={26} />
        </IconButton>
        <Sep />
        <IconButton hint={`Nano Preview auto-update: ${autoNano ? 'on' : 'off'}`} size={32} toggle active={autoNano} onClick={() => setUI({ autoNano: !autoNano })}>
          <Icon3D kind="camera" size={24} />
        </IconButton>
      </div>
    </aside>
  );
}
