/**
 * The little scene used to preview a material (Materials Lab preview, library thumbnails):
 * the subject on a classic checkered floor under a clear, softly clouded sky, lit from
 * the front left so highlights, reflections and bumps all read.
 *
 * The floor and sky are built once and reused (stable identities), so a renderer that
 * caches by object identity only re-packs the subject when the material changes.
 */
import { createObject, defaultRenderSettings } from '@/core/defaults';
import { makeComponent, makeMaterial } from '@/core/materialUtils';
import type { CameraState, Material, Scene, SceneObject, Sky, Transform, Vec3 } from '@/core/types';
import { defaultSky } from '@/sky/defaults';

export type PreviewShape = 'sphere' | 'cube' | 'plane';

export const PREVIEW_SHAPES: PreviewShape[] = ['sphere', 'cube', 'plane'];

export interface MaterialPreviewOptions {
  shape?: PreviewShape;
  /** Orbit the camera around the subject (degrees, positive = to the right). */
  yaw?: number;
  /** Raise (positive) or lower the camera around the subject (degrees). */
  pitch?: number;
}

let floorObject: SceneObject | null = null;
let previewSky: Sky | null = null;

function floor(): SceneObject {
  floorObject ??= createObject('ground', {
    id: 'material-preview-floor',
    name: 'Preview Floor',
    material: makeMaterial({
      name: 'Preview Checker',
      diffusion: 85,
      ambience: 10,
      specularity: 10,
      specularHalo: 40,
      components: [
        makeComponent({
          type: 'checker',
          mapping: 'worldTop',
          scale: 2,
          octaves: 1,
          gradient: [
            { at: 0, color: [0.36, 0.37, 0.4] },
            { at: 1, color: [0.78, 0.79, 0.8] },
          ],
        }),
      ],
      drivers: { diffuseColor: 0 },
    }),
  });
  return floorObject;
}

function sky(): Sky {
  if (!previewSky) {
    const base = defaultSky();
    previewSky = {
      ...base,
      mode: 'soft',
      horizonColor: [0.84, 0.88, 0.94],
      zenithColor: [0.22, 0.42, 0.8],
      skyDomeColor: [0.55, 0.68, 0.9],
      sunColor: [1, 0.97, 0.9],
      sunAzimuth: 215,
      sunAltitude: 42,
      linkSunToView: false,
      haze: 8,
      fogDensity: 0,
      shadowIntensity: 65,
      ambient: 40,
      stars: 0,
      rainbow: false,
      stratus: { ...base.stratus, enabled: false },
      cumulus: { ...base.cumulus, enabled: true, cover: 22 },
    };
  }
  return previewSky;
}

/** Object-space textures scale with the object, so they need a modest plane to keep their size. */
const usesObjectSpace = (m: Material) => m.components.some((c) => c.mapping === 'object' || c.mapping === 'objectTop' || c.mapping === 'spherical');

function subjectTransform(shape: PreviewShape, material: Material): Transform {
  switch (shape) {
    case 'cube': return { position: [0, 1.6, 0], rotation: [0, 32, 0], scale: [1.6, 1.6, 1.6] };
    case 'plane': {
      // A zero-thickness square cannot hold a volume, so volumes get a thin slab instead.
      if (material.mode === 'volume') return { position: [0, 0.7, 0], rotation: [0, 0, 0], scale: [5, 0.7, 5] };
      // World-space looks run out to the horizon so water and ground read as open sea or land.
      const half = usesObjectSpace(material) ? 6 : 400;
      return { position: [0, 0.03, 0], rotation: [0, 0, 0], scale: [half, 1, half] };
    }
    default: return { position: [0, 2, 0], rotation: [0, 0, 0], scale: [2, 2, 2] };
  }
}

function orbitCamera(cam: CameraState, yaw: number, pitch: number): CameraState {
  if (!yaw && !pitch) return cam;
  const off: Vec3 = [cam.position[0] - cam.target[0], cam.position[1] - cam.target[1], cam.position[2] - cam.target[2]];
  const r = Math.hypot(off[0], off[1], off[2]) || 1;
  const a = Math.atan2(off[0], off[2]) + (yaw * Math.PI) / 180;
  const e = Math.min(1.45, Math.max(-0.2, Math.asin(off[1] / r) + (pitch * Math.PI) / 180));
  return {
    ...cam,
    position: [cam.target[0] + r * Math.cos(e) * Math.sin(a), cam.target[1] + r * Math.sin(e), cam.target[2] + r * Math.cos(e) * Math.cos(a)],
  };
}

function cameraFor(shape: PreviewShape): CameraState {
  if (shape === 'plane') return { position: [0, 4.6, 10], target: [0, 0.6, -3], roll: 0, fov: 46 };
  return { position: [0, 3.3, 9.2], target: [0, 1.75, 0], roll: 0, fov: 38 };
}

let lastSubject: SceneObject | null = null;
let lastShape: PreviewShape | null = null;

function subjectFor(material: Material, shape: PreviewShape): SceneObject {
  // Reuse the object while only the camera changes (e.g. while orbiting the preview).
  if (lastSubject && lastSubject.material === material && lastShape === shape) return lastSubject;
  lastShape = shape;
  lastSubject = {
    id: 'material-preview-subject',
    name: 'Preview Subject',
    type: shape === 'sphere' ? 'sphere' : shape === 'cube' || material.mode === 'volume' ? 'cube' : 'square',
    transform: subjectTransform(shape, material),
    material,
    family: 0,
  };
  return lastSubject;
}

export function materialPreviewScene(material: Material, options: MaterialPreviewOptions = {}): Scene {
  const shape = options.shape ?? 'sphere';
  const subject = subjectFor(material, shape);
  return {
    version: 1,
    name: 'Material Preview',
    objects: [floor(), subject],
    sky: sky(),
    camera: orbitCamera(cameraFor(shape), options.yaw ?? 0, options.pitch ?? 0),
    render: { ...defaultRenderSettings(), width: 160, height: 160, maxBounces: 6 },
  };
}
