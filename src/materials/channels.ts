/**
 * Metadata about material channels and texture components: labels, ranges, which
 * channels a texture component can drive. Shared by the Materials Lab, validation and
 * the random generator.
 */
import type { MaterialChannel, TextureMapping, TextureType } from '@/core/types';

export const TEXTURE_TYPES: TextureType[] = ['fbm', 'ridged', 'turbulence', 'voronoi', 'marble', 'strata', 'spots', 'granite', 'waves', 'checker', 'grid'];

export const TEXTURE_MAPPINGS: TextureMapping[] = ['world', 'object', 'worldTop', 'objectTop', 'spherical'];

export const TEXTURE_TYPE_LABELS: Record<TextureType, string> = {
  fbm: 'Fractal Noise',
  ridged: 'Ridged',
  turbulence: 'Turbulence',
  voronoi: 'Cells',
  marble: 'Marble',
  strata: 'Strata',
  spots: 'Spots',
  granite: 'Granite',
  waves: 'Waves',
  checker: 'Checker',
  grid: 'Grid',
};

export const TEXTURE_TYPE_HINTS: Record<TextureType, string> = {
  fbm: 'Smooth rolling fractal noise: soil, clouds, mottling',
  ridged: 'Sharp ridged noise: rock veins and mountain crags',
  turbulence: 'Billowy turbulence: smoke, clouds, lava crust',
  voronoi: 'Cellular pattern: cracked mud, scales, leaves',
  marble: 'Veined bands swirled by turbulence',
  strata: 'Horizontal layers: sandstone and canyon walls',
  spots: 'Blobs and spots: lichen, leopard, polka dots',
  granite: 'Fine speckled grains: granite, sand, stucco',
  waves: 'Ripples: water swell and sand ripples',
  checker: 'The classic ray-tracer checkerboard',
  grid: 'Grid lines: tiles and sci-fi panels',
};

export const TEXTURE_MAPPING_LABELS: Record<TextureMapping, string> = {
  world: 'World Space',
  object: 'Object Space',
  worldTop: 'World Top',
  objectTop: 'Object Top',
  spherical: 'Spherical',
};

export const TEXTURE_MAPPING_HINTS: Record<TextureMapping, string> = {
  world: 'World space: the texture stays put while the object moves (terrains, water)',
  object: 'Object space: the texture travels and scales with the object',
  worldTop: 'World top: projected straight down, no vertical variation',
  objectTop: 'Object top: projected down in object space',
  spherical: 'Spherical: wrapped around the object center (planets)',
};

/** Channels a texture component can drive (the keys of Material.drivers). */
export const DRIVABLE_CHANNELS: MaterialChannel[] = [
  'diffuseColor',
  'ambientColor',
  'specularColor',
  'transparentColor',
  'diffusion',
  'ambience',
  'specularity',
  'reflection',
  'transparency',
  'bumpHeight',
];

export const COLOR_DRIVER_CHANNELS: MaterialChannel[] = ['diffuseColor', 'ambientColor', 'specularColor', 'transparentColor'];

export type MaterialColorKey = 'diffuseColor' | 'ambientColor' | 'specularColor' | 'specularHaloColor' | 'transparentColor' | 'volumeColor';

export type MaterialValueKey =
  | 'diffusion'
  | 'ambience'
  | 'specularity'
  | 'specularHalo'
  | 'metallicity'
  | 'bumpHeight'
  | 'transparency'
  | 'reflection'
  | 'refraction'
  | 'blur'
  | 'volumeDensity';

export const COLOR_KEYS: MaterialColorKey[] = ['diffuseColor', 'ambientColor', 'specularColor', 'specularHaloColor', 'transparentColor', 'volumeColor'];

/** Valid range of every numeric material channel (Bryce scales). */
export const VALUE_RANGES: Record<MaterialValueKey, [number, number]> = {
  diffusion: [0, 100],
  ambience: [0, 100],
  specularity: [0, 100],
  specularHalo: [0, 100],
  metallicity: [0, 100],
  bumpHeight: [-100, 100],
  transparency: [0, 100],
  reflection: [0, 100],
  refraction: [100, 300],
  blur: [0, 100],
  volumeDensity: [0, 100],
};

/** Default density used when a material switches to volume mode without one. */
export const DEFAULT_VOLUME_DENSITY = 50;

/** Ranges of the numeric texture component parameters. */
export const COMPONENT_RANGES = {
  scale: [0.01, 1000] as [number, number],
  octaves: [1, 10] as [number, number],
  roughness: [0, 1] as [number, number],
  warp: [0, 1] as [number, number],
  contrast: [0, 1] as [number, number],
  bias: [-1, 1] as [number, number],
  bump: [-1, 1] as [number, number],
};

export const MAX_COMPONENTS = 3;
export const MIN_GRADIENT_STOPS = 2;
export const MAX_GRADIENT_STOPS = 4;
export const COMPONENT_LETTERS = ['A', 'B', 'C'] as const;
