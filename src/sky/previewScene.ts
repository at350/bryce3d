/**
 * The little scene used to preview a sky (Sky Lab preview, library thumbnails): a low
 * horizon over water with a chrome ball, so sky color, sun, clouds and haze all read.
 * NOTE: foundation version; the sky owner tunes it (keep the signature).
 */
import { createObject, defaultRenderSettings } from '@/core/defaults';
import type { Scene, Sky } from '@/core/types';
import { chromeMaterial } from '@/materials/defaults';

export function skyPreviewScene(sky: Sky): Scene {
  return {
    version: 1,
    name: 'Sky Preview',
    objects: [
      createObject('water'),
      createObject('sphere', { material: chromeMaterial(), transform: { position: [0, 2.2, -6], rotation: [0, 0, 0], scale: [2, 2, 2] } }),
    ],
    sky,
    camera: { position: [0, 3, 14], target: [0, 6, -20], roll: 0, fov: 60 },
    render: { ...defaultRenderSettings(), width: 160, height: 120 },
  };
}
