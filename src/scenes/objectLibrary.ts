/**
 * The Objects preset library (ready-made objects and groups). NOTE: foundation stub; the
 * scenes owner expands it (keep the exported names and shapes).
 */
import { createObject } from '@/core/defaults';
import type { SceneObject } from '@/core/types';

export interface ObjectPreset {
  id: string;
  name: string;
  category: string;
  description?: string;
  /** Build fresh objects (new ids) positioned around the origin, resting on y = 0. */
  build: () => SceneObject[];
}

export const OBJECT_CATEGORIES: string[] = ['Geometric'];

export const OBJECT_PRESETS: ObjectPreset[] = [
  {
    id: 'monolith',
    name: 'Monolith',
    category: 'Geometric',
    build: () => [createObject('cube', { name: 'Monolith', transform: { position: [0, 6, 0], rotation: [0, 0, 0], scale: [1.2, 6, 0.3] } })],
  },
];
