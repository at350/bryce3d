/**
 * The Materials preset library: original presets in Bryce-like categories. The presets
 * themselves live in ./library (one file per category); this module keeps the public
 * names other modules import.
 */
import { CLOUD_PRESETS } from './library/clouds';
import { COMPLEX_PRESETS } from './library/complex';
import { GLASS_PRESETS } from './library/glasses';
import type { MaterialPreset } from './library/helpers';
import { METAL_PRESETS } from './library/metals';
import { ROCK_PRESETS } from './library/rocks';
import { SIMPLE_PRESETS } from './library/simple';
import { TERRAIN_PRESETS } from './library/terrains';
import { WATER_PRESETS } from './library/waters';
import { WILD_PRESETS } from './library/wild';
import { WOOD_PRESETS } from './library/woods';

export type { MaterialPreset } from './library/helpers';

export const MATERIAL_CATEGORIES: string[] = [
  'Simple & Fast',
  'Rocks & Stones',
  'Planes & Terrains',
  'Waters & Liquids',
  'Metals',
  'Glasses',
  'Wild & Fun',
  'Clouds & Fogs',
  'Complex f/x',
  'Leaves & Woods',
];

export const MATERIAL_PRESETS: MaterialPreset[] = [
  ...SIMPLE_PRESETS,
  ...ROCK_PRESETS,
  ...TERRAIN_PRESETS,
  ...WATER_PRESETS,
  ...METAL_PRESETS,
  ...GLASS_PRESETS,
  ...WILD_PRESETS,
  ...CLOUD_PRESETS,
  ...COMPLEX_PRESETS,
  ...WOOD_PRESETS,
];

const BY_ID = new Map(MATERIAL_PRESETS.map((p) => [p.id, p]));

export function getMaterialPreset(id: string): MaterialPreset | undefined {
  return BY_ID.get(id);
}

/** Presets of one category, in library order. */
export function presetsInCategory(category: string): MaterialPreset[] {
  return MATERIAL_PRESETS.filter((p) => p.category === category);
}
