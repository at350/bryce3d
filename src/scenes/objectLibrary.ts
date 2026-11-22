/**
 * The Objects preset library: ready-made objects and groups. Every build() returns fresh
 * objects (new ids) around the origin, resting on y = 0 (or floating above it), facing +Z.
 */
import { ARCHITECTURE } from './objects/architecture';
import { GEOMETRIC } from './objects/geometric';
import { LIGHTS, TERRAINS } from './objects/lightsAndTerrains';
import { NATURE } from './objects/nature';
import { SURREAL } from './objects/surreal';
import type { ObjectPreset } from './objects/types';

export type { ObjectPreset } from './objects/types';

export const OBJECT_CATEGORIES: string[] = ['Geometric', 'Architecture', 'Nature', 'Surreal', 'Lights', 'Terrains'];

export const OBJECT_PRESETS: ObjectPreset[] = [...GEOMETRIC, ...ARCHITECTURE, ...NATURE, ...SURREAL, ...LIGHTS, ...TERRAINS];

export function getObjectPreset(id: string): ObjectPreset | undefined {
  return OBJECT_PRESETS.find((p) => p.id === id);
}
