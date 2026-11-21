/**
 * Default materials given to newly created objects, by type.
 * Owned by the materials module.
 */
import { defaultMaterial, makeComponent, makeMaterial } from '@/core/materialUtils';
import type { Material, ObjectType } from '@/core/types';

export function waterMaterial(): Material {
  return makeMaterial({
    name: 'Blue Lagoon',
    diffuseColor: [0.05, 0.22, 0.35],
    ambientColor: [0.02, 0.1, 0.18],
    diffusion: 25,
    ambience: 4,
    specularity: 70,
    specularHalo: 85,
    reflection: 60,
    transparency: 35,
    refraction: 133,
    transparentColor: [0.35, 0.75, 0.8],
    volumeColor: [0.1, 0.45, 0.5],
    bumpHeight: 18,
    components: [
      makeComponent({
        type: 'waves',
        mapping: 'worldTop',
        scale: 2.2,
        octaves: 4,
        roughness: 0.55,
        bump: 1,
        gradient: [
          { at: 0, color: [0.04, 0.18, 0.3] },
          { at: 1, color: [0.1, 0.35, 0.45] },
        ],
      }),
    ],
    drivers: { bumpHeight: 0 },
  });
}

export function groundMaterial(): Material {
  return makeMaterial({
    name: 'Sandy Plain',
    diffuseColor: [0.62, 0.52, 0.38],
    diffusion: 85,
    ambience: 8,
    specularity: 5,
    bumpHeight: 20,
    components: [
      makeComponent({
        type: 'fbm',
        mapping: 'worldTop',
        scale: 9,
        octaves: 7,
        roughness: 0.55,
        bump: 0.6,
        gradient: [
          { at: 0, color: [0.42, 0.33, 0.22] },
          { at: 0.55, color: [0.66, 0.55, 0.4] },
          { at: 1, color: [0.82, 0.74, 0.58] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });
}

export function cloudPlaneMaterial(): Material {
  return makeMaterial({
    name: 'Cloud Bank',
    mode: 'volume',
    volumeDensity: 45,
    diffuseColor: [1, 1, 1],
    volumeColor: [0.95, 0.96, 1],
    ambience: 30,
    transparency: 100,
    components: [makeComponent({ type: 'turbulence', mapping: 'world', scale: 30, octaves: 6, roughness: 0.55 })],
    drivers: { transparency: 0 },
  });
}

export function terrainMaterial(): Material {
  return makeMaterial({
    name: 'Mountain Rock',
    diffuseColor: [0.45, 0.4, 0.36],
    diffusion: 85,
    ambience: 8,
    specularity: 10,
    specularHalo: 30,
    bumpHeight: 35,
    components: [
      makeComponent({
        type: 'ridged',
        mapping: 'world',
        scale: 6,
        octaves: 7,
        roughness: 0.55,
        warp: 0.25,
        bump: 0.8,
        gradient: [
          { at: 0, color: [0.22, 0.2, 0.19] },
          { at: 0.5, color: [0.46, 0.41, 0.36] },
          { at: 1, color: [0.7, 0.65, 0.58] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
    altitude: { color: [0.95, 0.96, 1], start: 0.68, softness: 0.12, maxSlope: 0.55 },
  });
}

export function stoneMaterial(): Material {
  return makeMaterial({
    name: 'Greystone',
    diffuseColor: [0.5, 0.48, 0.46],
    diffusion: 85,
    specularity: 12,
    bumpHeight: 40,
    components: [
      makeComponent({
        type: 'granite',
        mapping: 'object',
        scale: 0.6,
        octaves: 5,
        bump: 0.7,
        gradient: [
          { at: 0, color: [0.28, 0.27, 0.26] },
          { at: 1, color: [0.62, 0.6, 0.57] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });
}

export function treeMaterial(): Material {
  return makeMaterial({
    name: 'Summer Leaves',
    diffuseColor: [0.2, 0.42, 0.14],
    diffusion: 85,
    specularity: 8,
    bumpHeight: 30,
    components: [
      makeComponent({
        type: 'voronoi',
        mapping: 'object',
        scale: 0.25,
        octaves: 3,
        bump: 0.8,
        gradient: [
          { at: 0, color: [0.1, 0.25, 0.07] },
          { at: 1, color: [0.35, 0.58, 0.2] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });
}

export function chromeMaterial(): Material {
  return makeMaterial({
    name: 'Chrome',
    diffuseColor: [0.75, 0.77, 0.8],
    diffusion: 10,
    ambience: 0,
    specularity: 90,
    specularHalo: 92,
    metallicity: 60,
    reflection: 92,
  });
}

export function glassMaterial(): Material {
  return makeMaterial({
    name: 'Clear Glass',
    diffuseColor: [0.9, 0.95, 1],
    diffusion: 5,
    ambience: 0,
    specularity: 90,
    specularHalo: 95,
    reflection: 12,
    transparency: 92,
    refraction: 152,
    transparentColor: [0.92, 0.97, 1],
  });
}

/** The material a freshly created object of this type gets. */
export function defaultMaterialFor(type: ObjectType): Material {
  switch (type) {
    case 'water': return waterMaterial();
    case 'ground': return groundMaterial();
    case 'cloud': return cloudPlaneMaterial();
    case 'terrain':
    case 'lattice': return terrainMaterial();
    case 'stone': return stoneMaterial();
    case 'tree': return treeMaterial();
    default: return defaultMaterial();
  }
}
