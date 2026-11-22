/** Sun / moon trackball with the day-night swap, link-to-view and the sun (or moon) color. */
import { getActiveCamera } from '@/core/cameraOps';
import { useStore } from '@/core/store';
import type { Sky } from '@/core/types';
import { ColorBar } from '@/sky/components/ColorBar';
import { SunBall } from '@/sky/components/SunBall';
import { describeSun, flipSunMoon, linkSunToViewPatch } from '@/sky/sun';
import { Icon3D, IconButton } from '@/ui/kit';
import { currentSky, patchSky, skyGesture, type SkyFogMetrics } from './SkyFogLayout';

/** Link or unlink the sun to the view without moving it in the world. */
export function toggleSunLink(): void {
  const s = useStore.getState();
  const sky = s.scene.sky;
  const link = !sky.linkSunToView;
  s.setSky(linkSunToViewPatch(sky, link, getActiveCamera() ?? s.scene.camera));
  s.setHint(link ? 'Sun linked to view: it keeps its place in the frame as the camera turns' : 'Sun unlinked: it stays put in the world');
}

export function swapDayNight(): void {
  const sky = currentSky();
  const next = flipSunMoon(sky);
  patchSky(next, describeSun({ ...next, linkSunToView: sky.linkSunToView }));
}

export function SkyFogSun({ sky, m }: { sky: Sky; m: SkyFogMetrics }) {
  const night = sky.sunAltitude < 0;
  const btn = m.button;
  return (
    <div className="skyfog__cell skyfog__cell--sun">
      <SunBall sky={sky} size={m.ball} getPosition={currentSky} onChange={(p) => patchSky(p)} {...skyGesture} />
      <div className="skyfog__suncol">
        <IconButton hint={night ? 'Night: click for day (sun and moon swap)' : 'Day: click for night (sun and moon swap)'} size={btn} onClick={swapDayNight}>
          <Icon3D kind={night ? 'moon' : 'sun'} size={btn - 4} />
        </IconButton>
        <IconButton
          hint={sky.linkSunToView ? 'Sun linked to view (click to unlink)' : 'Link sun to view: keep the sun in the same place in the frame'}
          size={btn}
          active={sky.linkSunToView}
          toggle
          onClick={toggleSunLink}
        >
          <Icon3D kind="camera" size={btn - 4} />
        </IconButton>
        <div className="skyfog__suncolor" style={{ width: btn }}>
          {night ? (
            <ColorBar label="Moon color" value={sky.moonColor} onChange={(c) => patchSky({ moonColor: c })} {...skyGesture} />
          ) : (
            <ColorBar label="Sun color" value={sky.sunColor} onChange={(c) => patchSky({ sunColor: c })} {...skyGesture} />
          )}
        </div>
      </div>
    </div>
  );
}
