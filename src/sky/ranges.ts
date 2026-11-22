/**
 * Numeric ranges and labels for every Sky / CloudLayer value. One table drives the
 * Sky & Fog palette, the Sky Lab, the randomizer, sanitizing and the tests, so a range
 * changes in exactly one place.
 */
import type { CloudLayer, Sky } from '@/core/types';

export interface ValueRange {
  min: number;
  max: number;
  label: string;
  /** Unit suffix shown next to the value ('°', '%', ...). */
  unit?: string;
  /** Decimal places for display. */
  precision?: number;
}

type NumericKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

export type SkyNumberKey = NumericKeys<Sky>;
export type CloudNumberKey = NumericKeys<CloudLayer>;

export const SKY_RANGES: Record<SkyNumberKey, ValueRange> = {
  sunSize: { min: 0, max: 100, label: 'Sun Size' },
  sunGlow: { min: 0, max: 100, label: 'Sun Glow' },
  sunAzimuth: { min: 0, max: 360, label: 'Azimuth', unit: '°' },
  sunAltitude: { min: -90, max: 90, label: 'Altitude', unit: '°' },
  moonPhase: { min: 0, max: 1, label: 'Moon Phase', precision: 2 },
  moonSize: { min: 0, max: 100, label: 'Moon Size' },
  stars: { min: 0, max: 100, label: 'Stars' },
  haze: { min: 0, max: 100, label: 'Haze' },
  fogDensity: { min: 0, max: 100, label: 'Fog Density' },
  fogHeight: { min: 0, max: 100, label: 'Fog Height' },
  shadowIntensity: { min: 0, max: 100, label: 'Shadows' },
  ambient: { min: 0, max: 100, label: 'Ambient' },
};

export const CLOUD_RANGES: Record<CloudNumberKey, ValueRange> = {
  cover: { min: 0, max: 100, label: 'Cloud Cover' },
  height: { min: 100, max: 3000, label: 'Cloud Height' },
  frequency: { min: 1, max: 400, label: 'Frequency' },
  amplitude: { min: 0, max: 400, label: 'Amplitude' },
  shading: { min: 0, max: 1, label: 'Shading', precision: 2 },
};

/** Cloud offsets are free (they slide the pattern); keep them finite and modest. */
export const CLOUD_OFFSET_LIMIT = 100000;

export const SKY_MODE_LABELS: Record<Sky['mode'], string> = {
  soft: 'Soft Sky',
  darker: 'Darker Sky',
  custom: 'Custom Sky',
  off: 'Atmosphere Off',
};

export const SKY_MODES: Sky['mode'][] = ['soft', 'darker', 'custom', 'off'];

export const clampTo = (r: ValueRange, v: number) => (v < r.min ? r.min : v > r.max ? r.max : v);

/** Wrap an angle into [0, 360). */
export const wrapDegrees = (deg: number) => ((deg % 360) + 360) % 360;
