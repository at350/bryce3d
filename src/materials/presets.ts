/**
 * The Materials preset library. NOTE: foundation stub with a handful of presets; the
 * materials owner expands it (keep the exported names and shapes).
 */
import type { Material } from '@/core/types';
import { chromeMaterial, glassMaterial, groundMaterial, stoneMaterial, terrainMaterial, waterMaterial } from './defaults';
import { defaultMaterial } from '@/core/materialUtils';

export interface MaterialPreset {
  id: string;
  name: string;
  category: string;
  /** One line describing the look (shown in the library). */
  description?: string;
  material: Material;
}

export const MATERIAL_CATEGORIES: string[] = ['Simple & Fast', 'Rocks & Stones', 'Planes & Terrains', 'Waters & Liquids', 'Metals', 'Glasses'];

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { id: 'default', name: 'Default', category: 'Simple & Fast', material: defaultMaterial() },
  { id: 'greystone', name: 'Greystone', category: 'Rocks & Stones', material: stoneMaterial() },
  { id: 'mountain-rock', name: 'Mountain Rock', category: 'Planes & Terrains', material: terrainMaterial() },
  { id: 'sandy-plain', name: 'Sandy Plain', category: 'Planes & Terrains', material: groundMaterial() },
  { id: 'blue-lagoon', name: 'Blue Lagoon', category: 'Waters & Liquids', material: waterMaterial() },
  { id: 'chrome', name: 'Chrome', category: 'Metals', material: chromeMaterial() },
  { id: 'clear-glass', name: 'Clear Glass', category: 'Glasses', material: glassMaterial() },
];

export function getMaterialPreset(id: string): MaterialPreset | undefined {
  return MATERIAL_PRESETS.find((p) => p.id === id);
}
