/**
 * Sun and moon positioning: the Sky & Fog trackball math, the day/night swap and the
 * "link sun to view" convention. The moon always sits exactly opposite the sun.
 *
 * linkSunToView convention (shared with the renderer): when linked, sunAzimuth is
 * measured from the camera's heading, so azimuth 0 is straight ahead of whatever camera
 * renders; effectiveSunAzimuth() gives the world azimuth.
 */
import { DEG, clamp, directionToAzAlt, sunDirection, v3 } from '@/core/math';
import type { CameraState, Sky, Vec3 } from '@/core/types';
import { wrapDegrees } from './ranges';

export interface SunPosition {
  sunAzimuth: number;
  sunAltitude: number;
}

/** Heading of the camera's view direction in sun-azimuth degrees (0 = looking toward -Z). */
export function cameraHeading(cam: CameraState): number {
  const f = v3.sub(cam.target, cam.position);
  if (Math.hypot(f[0], f[2]) < 1e-9) return 0;
  return wrapDegrees(Math.atan2(f[0], -f[2]) / DEG);
}

/** World-space sun azimuth for a camera (resolves linkSunToView). */
export function effectiveSunAzimuth(sky: Pick<Sky, 'sunAzimuth' | 'linkSunToView'>, cam: CameraState): number {
  return sky.linkSunToView ? wrapDegrees(sky.sunAzimuth + cameraHeading(cam)) : wrapDegrees(sky.sunAzimuth);
}

/** World-space unit vector toward the sun for a camera. */
export function effectiveSunDirection(sky: Pick<Sky, 'sunAzimuth' | 'sunAltitude' | 'linkSunToView'>, cam: CameraState): Vec3 {
  return sunDirection(effectiveSunAzimuth(sky, cam), sky.sunAltitude);
}

/** Toggle the link while keeping the sun where it is in the world (the stored azimuth is converted). */
export function linkSunToViewPatch(sky: Pick<Sky, 'sunAzimuth' | 'linkSunToView'>, link: boolean, cam: CameraState): Pick<Sky, 'linkSunToView' | 'sunAzimuth'> {
  if (link === sky.linkSunToView) return { linkSunToView: link, sunAzimuth: sky.sunAzimuth };
  const heading = cameraHeading(cam);
  return { linkSunToView: link, sunAzimuth: wrapDegrees(link ? sky.sunAzimuth - heading : sky.sunAzimuth + heading) };
}

/** Day/night toggle: the moon moves to where the sun was and the sun goes under the horizon. */
export function flipSunMoon(p: SunPosition): SunPosition {
  return { sunAzimuth: wrapDegrees(p.sunAzimuth + 180), sunAltitude: -p.sunAltitude };
}

export const isNight = (sunAltitude: number) => sunAltitude < 0;

function rotate(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const cross = v3.cross(axis, v);
  const d = v3.dot(axis, v) * (1 - c);
  return [v[0] * c + cross[0] * s + axis[0] * d, v[1] * c + cross[1] * s + axis[1] * d, v[2] * c + cross[2] * s + axis[2] * d];
}

/**
 * Roll the sky dome under a trackball drag. The ball shows the dome from above:
 * 12 o'clock = azimuth 0, 3 o'clock = azimuth 90, the center = straight up. Dragging moves
 * the light with the pointer; push it over the rim and the sun sets while the moon rises
 * on the far side. A drag across the whole ball turns the dome by 180 degrees.
 */
export function rollSun(p: SunPosition, dx: number, dy: number, diameterPx: number): SunPosition {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return p;
  const axis: Vec3 = [dy / len, 0, -dx / len];
  const angle = (len / Math.max(8, diameterPx)) * Math.PI;
  const d = rotate(sunDirection(p.sunAzimuth, p.sunAltitude), axis, angle);
  const { azimuth, altitude } = directionToAzAlt(d);
  return { sunAzimuth: wrapDegrees(azimuth), sunAltitude: clamp(altitude, -90, 90) };
}

/**
 * Position on the ball (unit disc, x right, y down) of the body that is above the horizon:
 * the sun by day, the moon (opposite) by night.
 */
export function ballSpot(p: SunPosition): { x: number; y: number; body: 'sun' | 'moon' } {
  const d = sunDirection(p.sunAzimuth, p.sunAltitude);
  const up = d[1] >= 0 ? d : v3.scale(d, -1);
  return { x: up[0], y: up[2], body: d[1] >= 0 ? 'sun' : 'moon' };
}

/** A friendly name for the light at this altitude. */
export function timeOfDay(sunAltitude: number): string {
  if (sunAltitude >= 60) return 'midday';
  if (sunAltitude >= 25) return 'daylight';
  if (sunAltitude >= 10) return 'low sun';
  if (sunAltitude >= 2) return 'golden hour';
  if (sunAltitude >= -2) return 'sun on the horizon';
  if (sunAltitude >= -12) return 'twilight';
  return 'night';
}

/** Text Display line for the sun control. */
export function describeSun(p: SunPosition & { linkSunToView?: boolean }): string {
  const az = Math.round(wrapDegrees(p.sunAzimuth));
  const alt = Math.round(p.sunAltitude);
  const linked = p.linkSunToView ? ' (linked to view)' : '';
  if (p.sunAltitude < -2) {
    const m = flipSunMoon(p);
    return `Moon: azimuth ${Math.round(m.sunAzimuth)}°, altitude ${Math.round(m.sunAltitude)}°, ${timeOfDay(p.sunAltitude)}${linked}`;
  }
  return `Sun: azimuth ${az}°, altitude ${alt}°, ${timeOfDay(p.sunAltitude)}${linked}`;
}

/** Name of a moon phase (0 = new, 0.5 = full, 1 = new again). */
export function moonPhaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p > 0.97) return 'New moon';
  if (p < 0.22) return 'Waxing crescent';
  if (p < 0.28) return 'First quarter';
  if (p < 0.47) return 'Waxing gibbous';
  if (p <= 0.53) return 'Full moon';
  if (p < 0.72) return 'Waning gibbous';
  if (p < 0.78) return 'Last quarter';
  return 'Waning crescent';
}
