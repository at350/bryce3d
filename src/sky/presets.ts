/**
 * The Skies preset library. NOTE: foundation stub; the sky owner expands it (keep the
 * exported names and shapes).
 */
import type { Sky } from '@/core/types';
import { defaultSky } from './defaults';

export interface SkyPreset {
  id: string;
  name: string;
  category: string;
  description?: string;
  sky: Sky;
}

export const SKY_CATEGORIES: string[] = ['Daytime'];

export const SKY_PRESETS: SkyPreset[] = [{ id: 'soft-day', name: 'Soft Day', category: 'Daytime', sky: defaultSky() }];

export function getSkyPreset(id: string): SkyPreset | undefined {
  return SKY_PRESETS.find((p) => p.id === id);
}
