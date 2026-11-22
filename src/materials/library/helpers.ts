/** Small builders that keep the preset files readable. */
import { hexToRgb } from '@/core/math';
import { makeComponent, makeMaterial } from '@/core/materialUtils';
import type { Material, RGB, TextureComponent } from '@/core/types';

export interface MaterialPreset {
  id: string;
  name: string;
  category: string;
  /** One line describing the look (shown in the library). */
  description?: string;
  material: Material;
  /** Best thumbnail subject: 'plane' for water and ground looks (default 'sphere'). */
  preview?: 'sphere' | 'plane';
}

/** '#rrggbb' to an sRGB triple. */
export const hex = (h: string): RGB => hexToRgb(h);

/** Gradient from [at, '#hex'] pairs (2..4 stops, given in ascending order). */
export function grad(...stops: [number, string][]): TextureComponent['gradient'] {
  return stops.map(([at, h]) => ({ at, color: hex(h) }));
}

/** A texture component (unlisted fields take makeComponent's defaults). */
export const comp = (overrides: Partial<TextureComponent>): TextureComponent => makeComponent(overrides);

/** A material whose name is the preset name. */
export const mat = (name: string, overrides: Partial<Material>): Material => makeMaterial({ name, ...overrides });

/** Preset factory bound to one category (optionally with a default thumbnail subject). */
export function category(name: string, defaultPreview?: MaterialPreset['preview']) {
  return (id: string, title: string, description: string, material: Material, preview = defaultPreview): MaterialPreset => ({
    id,
    name: title,
    category: name,
    description,
    material: { ...material, name: title },
    ...(preview ? { preview } : {}),
  });
}

/** sRGB color pushed toward white (0 = unchanged, 1 = white). */
export const lighten = (c: RGB, k: number): RGB => c.map((v) => v + (1 - v) * k) as RGB;

/**
 * Clear-glass base with a tint and an index of refraction (x 100). The tint filters light
 * at the surfaces; the interior absorbs only a paler version of it, so thick glass stays
 * jewel-bright instead of turning black.
 */
export function glass(name: string, tint: string, refraction: number, overrides: Partial<Material> = {}): Material {
  const color = hex(tint);
  return mat(name, {
    diffuseColor: color,
    ambientColor: [0, 0, 0],
    transparentColor: color,
    volumeColor: lighten(color, 0.6),
    diffusion: 4,
    ambience: 0,
    specularity: 95,
    specularHalo: 96,
    reflection: 12,
    transparency: 92,
    refraction,
    ...overrides,
  });
}

/** Polished metal base: diffuse color tints reflections through metallicity. */
export function metal(name: string, color: string, overrides: Partial<Material> = {}): Material {
  const c = hex(color);
  return mat(name, {
    diffuseColor: c,
    specularColor: c.map((v) => Math.min(1, v * 0.4 + 0.6)) as RGB,
    specularHaloColor: c,
    diffusion: 22,
    ambience: 2,
    specularity: 92,
    specularHalo: 86,
    metallicity: 90,
    reflection: 72,
    ...overrides,
  });
}

/** A volume (participating medium) base. The renderer scatters diffuse x volume color, so volume stays white. */
export function volume(name: string, color: string, density: number, overrides: Partial<Material> = {}): Material {
  const c = hex(color);
  return mat(name, {
    mode: 'volume',
    volumeDensity: density,
    diffuseColor: c,
    volumeColor: [1, 1, 1],
    ambientColor: c,
    diffusion: 70,
    ambience: 25,
    specularity: 0,
    specularHalo: 20,
    transparency: 100,
    ...overrides,
  });
}
