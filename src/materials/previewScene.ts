/**
 * The little scene used to preview a material (Materials Lab preview, library thumbnails).
 * NOTE: foundation version; the materials owner tunes it (keep the signature).
 */
import { createObject, defaultRenderSettings } from '@/core/defaults';
import { makeComponent, makeMaterial } from '@/core/materialUtils';
import type { Material, Scene } from '@/core/types';
import { defaultSky } from '@/sky/defaults';

export type PreviewShape = 'sphere' | 'cube' | 'plane';

export function materialPreviewScene(material: Material, options: { shape?: PreviewShape } = {}): Scene {
  const shape = options.shape ?? 'sphere';
  const floor = makeMaterial({
    name: 'Preview Floor',
    components: [makeComponent({ type: 'checker', mapping: 'worldTop', scale: 2, gradient: [
      { at: 0, color: [0.35, 0.35, 0.38] },
      { at: 1, color: [0.75, 0.75, 0.78] },
    ] })],
    drivers: { diffuseColor: 0 },
  });
  const subject =
    shape === 'plane'
      ? createObject('square', { material, transform: { position: [0, 0.01, 0], rotation: [0, 0, 0], scale: [3, 1, 3] } })
      : createObject(shape, { material, transform: { position: [0, 2, 0], rotation: [0, shape === 'cube' ? 30 : 0, 0], scale: [2, 2, 2] } });
  return {
    version: 1,
    name: 'Material Preview',
    objects: [createObject('ground', { material: floor }), subject],
    sky: { ...defaultSky(), sunAzimuth: 140, sunAltitude: 40, haze: 5, stratus: { ...defaultSky().stratus, enabled: false } },
    camera: shape === 'plane'
      ? { position: [0, 7, 0.01], target: [0, 0, 0], roll: 0, fov: 50 }
      : { position: [0, 3.2, 8.5], target: [0, 1.8, 0], roll: 0, fov: 40 },
    render: { ...defaultRenderSettings(), width: 160, height: 160 },
  };
}
