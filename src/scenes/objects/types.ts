import type { SceneObject } from '@/core/types';

export interface ObjectPreset {
  id: string;
  name: string;
  category: string;
  description?: string;
  /** Build fresh objects (new ids) positioned around the origin, resting on y = 0. */
  build: () => SceneObject[];
  /** Thumbnail hints: night sky for lights, camera angle tweaks. */
  preview?: { night?: boolean; yaw?: number; elevation?: number };
}
