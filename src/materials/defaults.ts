/**
 * Default materials given to newly created objects, by type. Owned by the materials
 * module; the presets with the same looks (Teal Sea, Sandy Plain, Mountain Rock, ...)
 * are built from these factories so there is a single definition of each.
 */
import { defaultMaterial } from '@/core/materialUtils';
import type { Material, ObjectType } from '@/core/types';
import { comp, grad, hex, mat } from './library/helpers';

/** The default sea: deep teal, mirror-bright toward the horizon, clear enough to show the shallows. */
export function waterMaterial(): Material {
  return mat('Teal Sea', {
    diffuseColor: hex('#0d3b50'),
    ambientColor: hex('#04161f'),
    transparentColor: hex('#4aa8b0'),
    volumeColor: hex('#0f4a5a'),
    diffusion: 30,
    ambience: 4,
    specularity: 85,
    specularHalo: 92,
    reflection: 64,
    transparency: 30,
    refraction: 133,
    bumpHeight: 24,
    components: [
      comp({ type: 'waves', mapping: 'worldTop', scale: 2.4, octaves: 5, roughness: 0.55, warp: 0.25, seed: 7, bump: 1, gradient: grad([0, '#0b2c3e'], [1, '#2a6a7c']) }),
    ],
    drivers: { bumpHeight: 0 },
  });
}

export function groundMaterial(): Material {
  return mat('Sandy Plain', {
    diffuseColor: hex('#9e8562'),
    diffusion: 85,
    ambience: 8,
    specularity: 5,
    specularHalo: 20,
    bumpHeight: 18,
    components: [
      comp({ type: 'fbm', mapping: 'worldTop', scale: 9, octaves: 7, roughness: 0.55, seed: 12, bump: 0.6,
        gradient: grad([0, '#6b5438'], [0.55, '#a88c66'], [1, '#d2bd94']) }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });
}

/** Volume material for infinite cloud planes: the driven transparency channel shapes the density. */
export function cloudPlaneMaterial(): Material {
  return mat('Cloud Bank', {
    mode: 'volume',
    volumeDensity: 45,
    diffuseColor: hex('#f2f4fa'),
    ambientColor: hex('#f2f4fa'),
    volumeColor: [1, 1, 1],
    diffusion: 70,
    ambience: 30,
    specularity: 0,
    specularHalo: 20,
    transparency: 100,
    components: [comp({ type: 'turbulence', mapping: 'world', scale: 30, octaves: 6, roughness: 0.55, bias: 0.2, seed: 1, gradient: grad([0, '#d4d8e2'], [1, '#ffffff']) })],
    drivers: { transparency: 0 },
  });
}

export function terrainMaterial(): Material {
  return mat('Mountain Rock', {
    diffuseColor: hex('#736a62'),
    diffusion: 85,
    ambience: 8,
    specularity: 10,
    specularHalo: 30,
    bumpHeight: 35,
    components: [
      comp({ type: 'ridged', mapping: 'world', scale: 6, octaves: 7, roughness: 0.55, warp: 0.25, seed: 1, bump: 0.8,
        gradient: grad([0, '#38332f'], [0.5, '#756b62'], [1, '#b2a596']) }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
    altitude: { color: hex('#f4f7fc'), start: 0.72, softness: 0.1, maxSlope: 0.55 },
  });
}

export function stoneMaterial(): Material {
  return mat('Greystone', {
    diffuseColor: hex('#7f7a75'),
    diffusion: 85,
    ambience: 8,
    specularity: 10,
    specularHalo: 30,
    bumpHeight: 40,
    components: [
      comp({ type: 'granite', mapping: 'object', scale: 0.5, octaves: 5, seed: 2, bump: 0.6, gradient: grad([0, '#47433f'], [0.55, '#827c76'], [1, '#b0aaa3']) }),
      comp({ type: 'fbm', mapping: 'object', scale: 0.35, octaves: 6, roughness: 0.6, seed: 3, bump: 0.8 }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 1 },
  });
}

export function treeMaterial(): Material {
  return mat('Summer Leaves', {
    diffuseColor: hex('#3a6a22'),
    diffusion: 85,
    ambience: 8,
    specularity: 12,
    specularHalo: 35,
    bumpHeight: 30,
    components: [
      comp({ type: 'voronoi', mapping: 'object', scale: 0.22, octaves: 3, roughness: 0.5, contrast: 0.55, seed: 25, bump: 0.8,
        gradient: grad([0, '#8ac04a'], [0.35, '#4c8a2a'], [0.7, '#2e5a1a'], [1, '#16300c']) }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });
}

export function chromeMaterial(): Material {
  return mat('Chrome Mirror', {
    diffuseColor: hex('#c9cdd3'),
    specularColor: [1, 1, 1],
    diffusion: 6,
    ambience: 0,
    specularity: 100,
    specularHalo: 95,
    metallicity: 35,
    reflection: 95,
  });
}

export function glassMaterial(): Material {
  const tint = hex('#f3f9ff');
  return mat('Clear Glass', {
    diffuseColor: tint,
    ambientColor: [0, 0, 0],
    transparentColor: tint,
    volumeColor: tint,
    diffusion: 4,
    ambience: 0,
    specularity: 95,
    specularHalo: 96,
    reflection: 10,
    transparency: 95,
    refraction: 152,
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
