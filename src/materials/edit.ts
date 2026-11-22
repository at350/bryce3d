/**
 * Pure, immutable editing operations on materials (used by the Materials Lab). Every
 * function returns a new Material and never mutates its input.
 */
import type { ChannelDriver, Material, MaterialChannel, RGB, TextureComponent } from '@/core/types';
import { DEFAULT_VOLUME_DENSITY, MAX_COMPONENTS, MAX_GRADIENT_STOPS, MIN_GRADIENT_STOPS } from './channels';
import { sampleGradient } from './texturePreview';

type GradientStop = TextureComponent['gradient'][number];

/** The component index driving a channel, or -1 when the channel uses its fixed value. */
export function driverOf(m: Material, channel: MaterialChannel): ChannelDriver {
  const d = m.drivers[channel];
  return d !== undefined && d >= 0 && d < m.components.length ? d : -1;
}

/** Set (or clear with -1) the component driving a channel. */
export function setDriver(m: Material, channel: MaterialChannel, driver: ChannelDriver): Material {
  const drivers = { ...m.drivers };
  if (driver < 0) delete drivers[channel];
  else drivers[channel] = driver;
  return { ...m, drivers };
}

/**
 * Bryce component indicator click: drive the channel with component `index`, or return it
 * to its fixed value when that component already drives it. Missing components up to
 * `index` are created with `make` (the lab passes a pleasant default texture).
 */
export function toggleDriver(m: Material, channel: MaterialChannel, index: 0 | 1 | 2, make: (i: number) => TextureComponent): Material {
  if (driverOf(m, channel) === index) return setDriver(m, channel, -1);
  let next = m;
  while (next.components.length <= index && next.components.length < MAX_COMPONENTS) {
    next = addComponent(next, make(next.components.length));
  }
  if (index >= next.components.length) return m;
  return setDriver(next, channel, index);
}

export function addComponent(m: Material, component: TextureComponent): Material {
  if (m.components.length >= MAX_COMPONENTS) return m;
  return { ...m, components: [...m.components, component] };
}

/** Remove a component; channels it drove return to fixed values, later drivers shift down. */
export function removeComponent(m: Material, index: number): Material {
  if (index < 0 || index >= m.components.length) return m;
  const drivers: Partial<Record<MaterialChannel, ChannelDriver>> = {};
  for (const [key, d] of Object.entries(m.drivers) as [MaterialChannel, ChannelDriver | undefined][]) {
    if (d === undefined || d < 0 || d === index) continue;
    drivers[key] = (d > index ? d - 1 : d) as ChannelDriver;
  }
  return { ...m, components: m.components.filter((_, i) => i !== index), drivers };
}

export function updateComponent(m: Material, index: number, patch: Partial<TextureComponent>): Material {
  if (index < 0 || index >= m.components.length) return m;
  return { ...m, components: m.components.map((c, i) => (i === index ? { ...c, ...patch } : c)) };
}

/** Channels driven by a component (for the component editor's "drives" line). */
export function channelsDrivenBy(m: Material, index: number): MaterialChannel[] {
  return (Object.keys(m.drivers) as MaterialChannel[]).filter((k) => driverOf(m, k) === index);
}

// --- gradients ---------------------------------------------------------------

function withGradient(m: Material, ci: number, gradient: GradientStop[]): Material {
  return updateComponent(m, ci, { gradient });
}

/** Move a stop, kept between its neighbors so stop order (and indices) stay stable while dragging. */
export function setStopPosition(m: Material, ci: number, si: number, at: number): Material {
  const g = m.components[ci]?.gradient;
  if (!g || si < 0 || si >= g.length) return m;
  const lo = si > 0 ? g[si - 1].at : 0;
  const hi = si < g.length - 1 ? g[si + 1].at : 1;
  const clamped = Math.min(hi, Math.max(lo, at));
  return withGradient(m, ci, g.map((s, i) => (i === si ? { at: clamped, color: s.color } : s)));
}

export function setStopColor(m: Material, ci: number, si: number, color: RGB): Material {
  const g = m.components[ci]?.gradient;
  if (!g || si < 0 || si >= g.length) return m;
  return withGradient(m, ci, g.map((s, i) => (i === si ? { at: s.at, color: [...color] as RGB } : s)));
}

/** Insert a stop in the middle of the widest gap, colored like the gradient there. */
export function addStop(m: Material, ci: number): Material {
  const g = m.components[ci]?.gradient;
  if (!g || g.length >= MAX_GRADIENT_STOPS) return m;
  let best = 0;
  let bestGap = -1;
  for (let i = 0; i < g.length - 1; i++) {
    const gap = g[i + 1].at - g[i].at;
    if (gap > bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  const at = g.length > 1 ? (g[best].at + g[best + 1].at) / 2 : 0.5;
  const color = sampleGradient(g, at, [0, 0, 0]);
  const next = [...g.slice(0, best + 1), { at, color }, ...g.slice(best + 1)];
  return withGradient(m, ci, next);
}

export function removeStop(m: Material, ci: number, si: number): Material {
  const g = m.components[ci]?.gradient;
  if (!g || g.length <= MIN_GRADIENT_STOPS || si < 0 || si >= g.length) return m;
  return withGradient(m, ci, g.filter((_, i) => i !== si));
}

/** Reverse a gradient (dark-to-light becomes light-to-dark). */
export function reverseGradient(m: Material, ci: number): Material {
  const g = m.components[ci]?.gradient;
  if (!g) return m;
  return withGradient(m, ci, [...g].reverse().map((s) => ({ at: 1 - s.at, color: s.color })));
}

// --- modes and blends --------------------------------------------------------

export function setMode(m: Material, mode: Material['mode']): Material {
  if (m.mode === mode) return m;
  if (mode === 'volume') return { ...m, mode, volumeDensity: m.volumeDensity ?? DEFAULT_VOLUME_DENSITY };
  return { ...m, mode };
}

export const DEFAULT_ALTITUDE: NonNullable<Material['altitude']> = { color: [0.95, 0.96, 1], start: 0.62, softness: 0.12, maxSlope: 0.55 };

/** Enable (with defaults), patch or (null) remove the altitude blend. */
export function setAltitude(m: Material, patch: Partial<NonNullable<Material['altitude']>> | null): Material {
  if (patch === null) {
    const { altitude: _drop, ...rest } = m;
    return rest;
  }
  return { ...m, altitude: { ...(m.altitude ?? DEFAULT_ALTITUDE), ...patch } };
}
