/**
 * The little scene used to preview a sky (Sky Lab preview, library thumbnails): a low
 * horizon over a calm sea with a chrome ball and a far island, looking slightly up so
 * the sky fills two thirds of the frame and color, sun, clouds, haze and fog all read.
 * The objects keep to the left so a sun or moon ahead and to the right is never hidden.
 *
 * The stage (objects, camera, settings) is built once and reused, so the renderer sees
 * stable object identities and only the sky changes between previews.
 */
import { createObject, defaultRenderSettings } from '@/core/defaults';
import type { CameraState, RenderSettings, Scene, SceneObject, Sky } from '@/core/types';
import { chromeMaterial } from '@/materials/defaults';
import { createTerrainData } from '@/terrain';

/** Camera of the sky preview: eye a few units above the water, pitched up ~8 degrees, facing azimuth 0. */
export const SKY_PREVIEW_CAMERA: CameraState = { position: [0, 3, 14], target: [0, 7.8, -20], roll: 0, fov: 62 };

interface Stage {
  objects: SceneObject[];
  camera: CameraState;
  render: RenderSettings;
}

let stage: Stage | null = null;

function buildStage(): Stage {
  const objects: SceneObject[] = [];
  const add = (o: SceneObject) => {
    objects.push(o);
    return o;
  };
  add(createObject('water', { name: 'Sea', transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } }, objects));
  add(
    createObject(
      'terrain',
      {
        name: 'Far Island',
        terrain: createTerrainData('fractal', 4242, 64),
        transform: { position: [-40, 4, -170], rotation: [0, 25, 0], scale: [46, 10, 30] },
      },
      objects,
    ),
  );
  add(
    createObject(
      'sphere',
      {
        name: 'Chrome Ball',
        material: chromeMaterial(),
        // Lower left, close to the camera: the right half of the sky (azimuth 0..35, where
        // sunsets and moons sit) stays clear, and the ball still mirrors the whole sky.
        transform: { position: [-6.2, 1.9, 1], rotation: [0, 0, 0], scale: [1.9, 1.9, 1.9] },
      },
      objects,
    ),
  );
  return { objects, camera: SKY_PREVIEW_CAMERA, render: { ...defaultRenderSettings(), width: 160, height: 120 } };
}

export function skyPreviewScene(sky: Sky): Scene {
  stage ??= buildStage();
  return { version: 1, name: 'Sky Preview', objects: stage.objects, sky, camera: stage.camera, render: stage.render };
}
