/** Material construction helpers (no dependencies beyond the types). */
import type { Material, TextureComponent } from './types';

/** Bryce's classic default: light matte gray. */
export function defaultMaterial(): Material {
  return {
    name: 'Default',
    diffuseColor: [0.78, 0.78, 0.78],
    ambientColor: [0.5, 0.5, 0.5],
    specularColor: [1, 1, 1],
    specularHaloColor: [1, 1, 1],
    transparentColor: [1, 1, 1],
    volumeColor: [1, 1, 1],
    diffusion: 80,
    ambience: 10,
    specularity: 20,
    specularHalo: 40,
    metallicity: 0,
    bumpHeight: 0,
    transparency: 0,
    reflection: 0,
    refraction: 100,
    blur: 0,
    components: [],
    drivers: {},
    mode: 'surface',
  };
}

/** The default material with overrides applied. */
export function makeMaterial(overrides: Partial<Material>): Material {
  return { ...defaultMaterial(), ...overrides };
}

/** A texture component with sensible defaults and overrides applied. */
export function makeComponent(overrides: Partial<TextureComponent>): TextureComponent {
  return {
    type: 'fbm',
    mapping: 'world',
    scale: 4,
    octaves: 6,
    roughness: 0.5,
    warp: 0,
    contrast: 0.5,
    bias: 0,
    seed: 1,
    gradient: [
      { at: 0, color: [0.2, 0.2, 0.2] },
      { at: 1, color: [0.9, 0.9, 0.9] },
    ],
    bump: 0.5,
    ...overrides,
  };
}

/** Deep copy (materials are plain data). */
export function cloneMaterial(m: Material): Material {
  return {
    ...m,
    diffuseColor: [...m.diffuseColor],
    ambientColor: [...m.ambientColor],
    specularColor: [...m.specularColor],
    specularHaloColor: [...m.specularHaloColor],
    transparentColor: [...m.transparentColor],
    volumeColor: [...m.volumeColor],
    components: m.components.map((c) => ({ ...c, gradient: c.gradient.map((g) => ({ at: g.at, color: [...g.color] })) })),
    drivers: { ...m.drivers },
    altitude: m.altitude ? { ...m.altitude, color: [...m.altitude.color] } : undefined,
  };
}
