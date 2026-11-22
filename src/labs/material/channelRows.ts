/** The rows of the Bryce material grid, per mode (surface or volume). */
import type { Material, MaterialChannel } from '@/core/types';
import { VALUE_RANGES, type MaterialColorKey, type MaterialValueKey } from '@/materials/channels';

export interface ColorRow {
  kind: 'color';
  key: MaterialColorKey;
  label: string;
  /** The drivers key a component indicator sets, or null for fixed-only channels. */
  driver: MaterialChannel | null;
  hint: string;
}

export interface ValueRow {
  kind: 'value';
  key: MaterialValueKey;
  label: string;
  driver: MaterialChannel | null;
  min: number;
  max: number;
  precision: number;
  hint: string;
}

export type GridRow = ColorRow | ValueRow;

export interface RowGroup {
  title: string;
  rows: GridRow[];
}

const color = (key: MaterialColorKey, label: string, driver: MaterialChannel | null, hint: string): ColorRow => ({ kind: 'color', key, label, driver, hint });

const value = (key: MaterialValueKey, label: string, driver: MaterialChannel | null, hint: string, precision = 0): ValueRow => ({
  kind: 'value',
  key,
  label,
  driver,
  min: VALUE_RANGES[key][0],
  max: VALUE_RANGES[key][1],
  precision,
  hint,
});

const DIFFUSE = color('diffuseColor', 'Diffuse', 'diffuseColor', 'Diffuse Color: the color of directly lit areas');
const AMBIENT = color('ambientColor', 'Ambient', 'ambientColor', 'Ambient Color: the self-lit glow color (with Ambience)');
const SPECULAR = color('specularColor', 'Specular', 'specularColor', 'Specular Color: the color of the highlight');
const HALO_COLOR = color('specularHaloColor', 'Specular Halo', null, 'Specular Halo Color: the soft glow around highlights');
const TRANSPARENT = color('transparentColor', 'Transparent', 'transparentColor', 'Transparent Color: tints light passing through');
const VOLUME = color('volumeColor', 'Volume', null, 'Volume Color: tint of the interior');

const DIFFUSION = value('diffusion', 'Diffusion', 'diffusion', 'Diffusion: how strongly direct light is scattered');
const AMBIENCE = value('ambience', 'Ambience', 'ambience', 'Ambience: self-illumination (100 = glows on its own)');
const SPECULARITY = value('specularity', 'Specularity', 'specularity', 'Specularity: highlight strength');
const HALO = value('specularHalo', 'Specular Halo', null, 'Specular Halo: highlight tightness (low = broad and soft)');
const METALLICITY = value('metallicity', 'Metallicity', null, 'Metallicity: tints reflections with the Diffuse Color');
const BUMP = value('bumpHeight', 'Bump Height', 'bumpHeight', 'Bump Height: strength of the driving component\'s bumps (negative = dents)');
const TRANSPARENCY = value('transparency', 'Transparency', 'transparency', 'Transparency: how see-through the surface is');
const REFLECTION = value('reflection', 'Reflection', 'reflection', 'Reflection: mirror amount');
const REFRACTION = value('refraction', 'Refraction', null, 'Refraction: index of refraction x 100 (133 water, 152 glass, 242 diamond)');
const BLUR = value('blur', 'Blur', null, 'Blur: frosts reflections and refractions');
const DENSITY = value('volumeDensity', 'Base Density', 'transparency', 'Base Density: how thick the volume is (a component shapes it into puffs)');

const SURFACE_GROUPS: RowGroup[] = [
  { title: 'Color', rows: [DIFFUSE, AMBIENT, SPECULAR, HALO_COLOR, TRANSPARENT, VOLUME] },
  { title: 'Value', rows: [DIFFUSION, AMBIENCE, SPECULARITY, HALO, METALLICITY, BUMP] },
  { title: 'Optics', rows: [TRANSPARENCY, REFLECTION, REFRACTION, BLUR] },
];

const VOLUME_GROUPS: RowGroup[] = [
  { title: 'Color', rows: [DIFFUSE, AMBIENT, SPECULAR, VOLUME] },
  { title: 'Value', rows: [DIFFUSION, AMBIENCE, SPECULARITY] },
  { title: 'Volume', rows: [DENSITY] },
];

export function rowGroups(mode: Material['mode']): RowGroup[] {
  return mode === 'volume' ? VOLUME_GROUPS : SURFACE_GROUPS;
}

/** Read a value row (volumeDensity is optional on the material). */
export function rowValue(m: Material, key: MaterialValueKey): number {
  if (key === 'volumeDensity') return m.volumeDensity ?? 50;
  return m[key];
}

/** A value that makes a freshly driven channel visible (a texture times 0 shows nothing). */
export const DRIVEN_DEFAULTS: Partial<Record<MaterialValueKey, number>> = {
  diffusion: 80,
  ambience: 60,
  specularity: 70,
  reflection: 60,
  transparency: 70,
  bumpHeight: 30,
  volumeDensity: 50,
};
