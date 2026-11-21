/** The startup scene and the File > New scene. Owned by the scenes module. */
import { createObject, defaultCamera, defaultRenderSettings } from '@/core/defaults';
import type { ObjectType, Scene, SceneObject } from '@/core/types';
import { chromeMaterial } from '@/materials/defaults';
import { defaultSky } from '@/sky/defaults';
import { createTerrainData } from '@/terrain';

/** File > New: Bryce starts with a ground plane under the default sky. */
export function emptyScene(): Scene {
  return {
    version: 1,
    name: 'Untitled',
    objects: [createObject('ground')],
    sky: defaultSky(),
    camera: defaultCamera(),
    render: defaultRenderSettings(),
  };
}

/** The scene the app opens with: a mountain island, a reflective sea and a chrome sphere. */
export function createDefaultScene(): Scene {
  const objects: SceneObject[] = [];
  const add = (type: ObjectType, overrides: Partial<SceneObject> = {}) => {
    const o = createObject(type, overrides, objects);
    objects.push(o);
    return o;
  };
  add('ground', { transform: { position: [0, -3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } });
  add('water', { transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } });
  add('terrain', {
    name: 'Island',
    terrain: createTerrainData('fractal', 1994),
    transform: { position: [-4, 4, -12], rotation: [0, 20, 0], scale: [24, 7, 24] },
  });
  add('sphere', {
    name: 'Chrome Sphere',
    material: chromeMaterial(),
    transform: { position: [10, 5.5, 10], rotation: [0, 0, 0], scale: [3, 3, 3] },
  });
  add('stone', { transform: { position: [-9, 0.4, 16], rotation: [0, 30, 0], scale: [2.4, 1.6, 2] } });
  return {
    version: 1,
    name: 'Untitled',
    objects,
    sky: defaultSky(),
    camera: defaultCamera(),
    render: defaultRenderSettings(),
  };
}
