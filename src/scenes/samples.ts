/**
 * Sample scenes gallery. NOTE: foundation stub; the scenes owner adds the real gallery
 * (keep the exported names and shapes).
 */
import type { Scene } from '@/core/types';
import { createDefaultScene } from './defaultScene';

export interface SampleScene {
  id: string;
  name: string;
  description: string;
  build: () => Scene;
}

export const SAMPLE_SCENES: SampleScene[] = [
  { id: 'island', name: 'Chrome Sphere Island', description: 'The startup scene.', build: createDefaultScene },
];
