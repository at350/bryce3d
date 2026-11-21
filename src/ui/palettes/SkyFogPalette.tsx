/** The Sky & Fog palette row. NOTE: foundation stub; the sky owner builds the real palette. */
import { useStore } from '@/core/store';
import { randomSky } from '@/sky/random';
import { DragPad, Icon3D, IconButton } from '@/ui/kit';

export function SkyFogPalette() {
  const sky = useStore((s) => s.scene.sky);
  const setSky = useStore((s) => s.setSky);
  return (
    <div className="palette-row">
      <DragPad hint="Haze" x={sky.haze} xRange={[0, 100]} onChange={(x) => setSky({ haze: x })}>
        <Icon3D kind="haze" />
      </DragPad>
      <DragPad hint="Fog" x={sky.fogDensity} xRange={[0, 100]} y={sky.fogHeight} yRange={[0, 60]} onChange={(x, y) => setSky({ fogDensity: x, fogHeight: y ?? sky.fogHeight })}>
        <Icon3D kind="fog" />
      </DragPad>
      <IconButton hint="Randomize Sky" onClick={() => setSky(randomSky())}>
        <Icon3D kind="dice" />
      </IconButton>
      <IconButton hint="Sky Lab" onClick={() => useStore.getState().openLab('sky')}>
        <Icon3D kind="sun" />
      </IconButton>
    </div>
  );
}
