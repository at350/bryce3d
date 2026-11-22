/**
 * Materials used by the sample scenes and the object library. Built locally (not looked up
 * in the material presets) so every scene keeps its designed look whatever the preset
 * catalogue contains. All original values.
 */
import { makeComponent, makeMaterial } from '@/core/materialUtils';
import type { Material, RGB } from '@/core/types';

type Stops = { at: number; color: RGB }[];

const stops = (...colors: RGB[]): Stops => colors.map((color, i) => ({ at: colors.length === 1 ? 0 : i / (colors.length - 1), color }));

// --- metals & mirrors -------------------------------------------------------

export const chrome = (): Material =>
  makeMaterial({ name: 'Mirror Chrome', diffuseColor: [0.7, 0.72, 0.76], diffusion: 8, ambience: 0, specularity: 95, specularHalo: 94, metallicity: 55, reflection: 94 });

export const gold = (): Material =>
  makeMaterial({
    name: 'Polished Gold',
    diffuseColor: [1, 0.74, 0.28],
    specularColor: [1, 0.88, 0.55],
    diffusion: 30,
    ambience: 4,
    specularity: 90,
    specularHalo: 86,
    metallicity: 92,
    reflection: 72,
  });

export const bronze = (): Material =>
  makeMaterial({ name: 'Old Bronze', diffuseColor: [0.62, 0.4, 0.2], diffusion: 55, specularity: 70, specularHalo: 70, metallicity: 80, reflection: 35, blur: 18 });

export const brushedSteel = (): Material =>
  makeMaterial({ name: 'Brushed Steel', diffuseColor: [0.6, 0.62, 0.66], diffusion: 35, specularity: 80, specularHalo: 60, metallicity: 70, reflection: 55, blur: 35 });

// --- glass & gems -----------------------------------------------------------

export const glass = (tint: RGB = [0.93, 0.97, 1], name = 'Clear Glass'): Material =>
  makeMaterial({
    name,
    diffuseColor: tint,
    transparentColor: tint,
    volumeColor: tint,
    diffusion: 4,
    ambience: 0,
    specularity: 92,
    specularHalo: 96,
    reflection: 14,
    transparency: 90,
    refraction: 150,
  });

export const crystal = (tint: RGB, name = 'Crystal'): Material => ({ ...glass(tint, name), refraction: 205, reflection: 22, transparency: 84 });

// --- glossy paints & glows --------------------------------------------------

export const gloss = (color: RGB, name = 'Gloss Paint'): Material =>
  makeMaterial({ name, diffuseColor: color, ambientColor: color, diffusion: 85, ambience: 8, specularity: 85, specularHalo: 88, reflection: 12 });

export const matte = (color: RGB, name = 'Matte'): Material => makeMaterial({ name, diffuseColor: color, ambientColor: color, diffusion: 88, ambience: 10, specularity: 6 });

/** Self-lit: glows in its own color (neon tubes, lamp globes, the sun disc). */
export const glow = (color: RGB, name = 'Neon Glow'): Material =>
  makeMaterial({ name, diffuseColor: color, ambientColor: color, diffusion: 30, ambience: 100, specularity: 0 });

export const pearl = (): Material =>
  makeMaterial({
    name: 'Pearl',
    diffuseColor: [0.94, 0.9, 0.92],
    specularColor: [1, 0.92, 0.98],
    specularHaloColor: [0.8, 0.9, 1],
    diffusion: 80,
    ambience: 14,
    specularity: 70,
    specularHalo: 45,
    reflection: 18,
  });

export const obsidian = (): Material =>
  makeMaterial({
    name: 'Obsidian Monolith',
    diffuseColor: [0.05, 0.05, 0.06],
    ambientColor: [0.02, 0.02, 0.03],
    diffusion: 60,
    ambience: 2,
    specularity: 75,
    specularHalo: 80,
    reflection: 28,
    blur: 8,
    bumpHeight: 8,
    components: [makeComponent({ type: 'granite', mapping: 'object', scale: 0.08, octaves: 3, bump: 0.4, gradient: stops([0.03, 0.03, 0.04], [0.09, 0.09, 0.1]) })],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

// --- stone ------------------------------------------------------------------

export const marble = (vein: RGB = [0.45, 0.46, 0.5], base: RGB = [0.95, 0.94, 0.91]): Material =>
  makeMaterial({
    name: 'Veined Marble',
    diffuseColor: base,
    diffusion: 82,
    ambience: 10,
    specularity: 60,
    specularHalo: 70,
    reflection: 8,
    components: [makeComponent({ type: 'marble', mapping: 'object', scale: 0.9, octaves: 5, warp: 0.5, contrast: 0.62, seed: 5, gradient: [{ at: 0, color: vein }, { at: 0.35, color: base }, { at: 1, color: base }] })],
    drivers: { diffuseColor: 0 },
  });

export const sandstone = (): Material =>
  makeMaterial({
    name: 'Temple Sandstone',
    diffuseColor: [0.82, 0.68, 0.48],
    diffusion: 88,
    ambience: 10,
    specularity: 6,
    bumpHeight: 25,
    components: [
      makeComponent({ type: 'granite', mapping: 'object', scale: 0.5, octaves: 4, bump: 0.6, gradient: stops([0.7, 0.55, 0.36], [0.9, 0.78, 0.58]) }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

export const limestone = (): Material =>
  makeMaterial({
    name: 'Weathered Limestone',
    diffuseColor: [0.86, 0.84, 0.78],
    diffusion: 86,
    ambience: 12,
    specularity: 8,
    bumpHeight: 30,
    components: [
      makeComponent({ type: 'fbm', mapping: 'object', scale: 0.6, octaves: 6, roughness: 0.6, bump: 0.7, gradient: stops([0.62, 0.6, 0.55], [0.9, 0.88, 0.83], [0.96, 0.95, 0.9]) }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

export const granite = (tint: RGB = [0.5, 0.48, 0.46]): Material =>
  makeMaterial({
    name: 'Granite',
    diffuseColor: tint,
    diffusion: 85,
    specularity: 14,
    bumpHeight: 35,
    components: [
      makeComponent({
        type: 'granite',
        mapping: 'object',
        scale: 0.5,
        octaves: 5,
        bump: 0.7,
        gradient: stops([tint[0] * 0.55, tint[1] * 0.55, tint[2] * 0.55], tint, [Math.min(1, tint[0] * 1.3), Math.min(1, tint[1] * 1.3), Math.min(1, tint[2] * 1.3)]),
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

export const terracotta = (): Material =>
  makeMaterial({
    name: 'Terracotta',
    diffuseColor: [0.72, 0.36, 0.2],
    diffusion: 86,
    ambience: 10,
    specularity: 12,
    bumpHeight: 12,
    components: [makeComponent({ type: 'fbm', mapping: 'object', scale: 0.4, octaves: 4, bump: 0.4, gradient: stops([0.6, 0.28, 0.15], [0.8, 0.44, 0.26]) })],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

// --- terrains -----------------------------------------------------------------

export const snowyRock = (rock: RGB = [0.42, 0.4, 0.4], snowStart = 0.62): Material =>
  makeMaterial({
    name: 'Snow-capped Rock',
    diffuseColor: rock,
    diffusion: 86,
    ambience: 8,
    specularity: 10,
    specularHalo: 30,
    bumpHeight: 40,
    components: [
      makeComponent({
        type: 'ridged',
        mapping: 'world',
        scale: 5,
        octaves: 7,
        roughness: 0.55,
        warp: 0.3,
        bump: 0.85,
        gradient: stops([rock[0] * 0.5, rock[1] * 0.5, rock[2] * 0.52], rock, [Math.min(1, rock[0] * 1.45), Math.min(1, rock[1] * 1.45), Math.min(1, rock[2] * 1.45)]),
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
    altitude: { color: [0.96, 0.97, 1], start: snowStart, softness: 0.1, maxSlope: 0.6 },
  });

export const alienRock = (dark: RGB, light: RGB, name = 'Alien Rock'): Material =>
  makeMaterial({
    name,
    diffuseColor: light,
    diffusion: 84,
    ambience: 12,
    specularity: 18,
    specularHalo: 40,
    bumpHeight: 40,
    components: [makeComponent({ type: 'ridged', mapping: 'world', scale: 4, octaves: 7, roughness: 0.55, warp: 0.35, bump: 0.85, gradient: stops(dark, light) })],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

/** Island rock with grass on the gentle slopes near the top. */
export const islandRock = (): Material =>
  makeMaterial({
    name: 'Island Rock',
    diffuseColor: [0.42, 0.4, 0.38],
    diffusion: 85,
    ambience: 8,
    specularity: 10,
    bumpHeight: 38,
    components: [
      makeComponent({
        type: 'ridged',
        mapping: 'world',
        scale: 4.5,
        octaves: 7,
        roughness: 0.55,
        warp: 0.3,
        bump: 0.85,
        gradient: [
          { at: 0, color: [0.2, 0.19, 0.2] },
          { at: 0.5, color: [0.45, 0.42, 0.4] },
          { at: 1, color: [0.66, 0.62, 0.57] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
    altitude: { color: [0.3, 0.46, 0.2], start: 0.3, softness: 0.25, maxSlope: 0.35 },
  });

export const canyonStrata = (): Material =>
  makeMaterial({
    name: 'Canyon Strata',
    diffuseColor: [0.74, 0.4, 0.22],
    diffusion: 88,
    ambience: 10,
    specularity: 6,
    bumpHeight: 30,
    components: [
      makeComponent({
        type: 'strata',
        mapping: 'world',
        scale: 2.2,
        octaves: 5,
        roughness: 0.5,
        warp: 0.35,
        bump: 0.6,
        seed: 3,
        gradient: [
          { at: 0, color: [0.55, 0.24, 0.12] },
          { at: 0.35, color: [0.82, 0.46, 0.25] },
          { at: 0.7, color: [0.93, 0.7, 0.48] },
          { at: 1, color: [0.68, 0.33, 0.18] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

export const desertSand = (): Material =>
  makeMaterial({
    name: 'Desert Sand',
    diffuseColor: [0.86, 0.7, 0.46],
    diffusion: 90,
    ambience: 10,
    specularity: 5,
    bumpHeight: 18,
    components: [
      makeComponent({ type: 'fbm', mapping: 'worldTop', scale: 14, octaves: 6, roughness: 0.5, bump: 0.3, gradient: stops([0.76, 0.58, 0.36], [0.92, 0.78, 0.55]) }),
      makeComponent({ type: 'waves', mapping: 'worldTop', scale: 1.4, octaves: 3, roughness: 0.4, bump: 0.8, seed: 4 }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 1 },
  });

export const beachSand = (): Material =>
  makeMaterial({
    name: 'Coral Beach',
    diffuseColor: [0.93, 0.86, 0.68],
    diffusion: 90,
    ambience: 12,
    specularity: 6,
    bumpHeight: 12,
    components: [makeComponent({ type: 'granite', mapping: 'worldTop', scale: 0.6, octaves: 4, bump: 0.4, gradient: stops([0.84, 0.76, 0.58], [0.98, 0.93, 0.8]) })],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

export const meadowGrass = (): Material =>
  makeMaterial({
    name: 'Meadow Grass',
    diffuseColor: [0.32, 0.55, 0.18],
    diffusion: 88,
    ambience: 10,
    specularity: 6,
    bumpHeight: 22,
    components: [
      makeComponent({
        type: 'fbm',
        mapping: 'worldTop',
        scale: 6,
        octaves: 6,
        roughness: 0.55,
        bump: 0.5,
        gradient: [
          { at: 0, color: [0.18, 0.38, 0.1] },
          { at: 0.6, color: [0.36, 0.58, 0.18] },
          { at: 1, color: [0.62, 0.7, 0.28] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

export const moonDust = (): Material =>
  makeMaterial({
    name: 'Moon Dust',
    diffuseColor: [0.55, 0.55, 0.56],
    diffusion: 90,
    ambience: 6,
    specularity: 4,
    bumpHeight: 45,
    components: [
      makeComponent({ type: 'voronoi', mapping: 'world', scale: 3, octaves: 3, bump: 0.9, gradient: stops([0.36, 0.36, 0.37], [0.62, 0.62, 0.63]) }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

/** Black basalt whose cracks glow with lava. */
export const lavaRock = (): Material =>
  makeMaterial({
    name: 'Volcanic Basalt',
    diffuseColor: [0.12, 0.1, 0.1],
    ambientColor: [1, 0.35, 0.05],
    diffusion: 80,
    ambience: 85,
    specularity: 20,
    bumpHeight: 40,
    components: [
      makeComponent({ type: 'ridged', mapping: 'world', scale: 3.5, octaves: 6, warp: 0.3, bump: 0.9, gradient: stops([0.06, 0.05, 0.05], [0.22, 0.18, 0.17]) }),
      makeComponent({
        type: 'voronoi',
        mapping: 'world',
        scale: 1.6,
        octaves: 2,
        seed: 9,
        gradient: [
          { at: 0, color: [0, 0, 0] },
          { at: 0.8, color: [0, 0, 0] },
          { at: 0.92, color: [0.6, 0.08, 0.01] },
          { at: 1, color: [1, 0.55, 0.1] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0, ambientColor: 1, ambience: 1 },
  });

export const moltenLava = (): Material =>
  makeMaterial({
    name: 'Molten Lava',
    diffuseColor: [1, 0.35, 0.05],
    ambientColor: [1, 0.4, 0.05],
    diffusion: 40,
    ambience: 95,
    specularity: 30,
    bumpHeight: 25,
    components: [
      makeComponent({
        type: 'turbulence',
        mapping: 'worldTop',
        scale: 6,
        octaves: 6,
        roughness: 0.55,
        warp: 0.6,
        bump: 0.5,
        gradient: [
          { at: 0, color: [0.35, 0.03, 0.01] },
          { at: 0.45, color: [0.95, 0.25, 0.02] },
          { at: 0.8, color: [1, 0.62, 0.1] },
          { at: 1, color: [1, 0.92, 0.55] },
        ],
      }),
    ],
    drivers: { diffuseColor: 0, ambientColor: 0, bumpHeight: 0 },
  });

export const iceShelf = (): Material =>
  makeMaterial({
    name: 'Glacier Ice',
    diffuseColor: [0.82, 0.9, 0.97],
    specularColor: [0.9, 0.97, 1],
    diffusion: 80,
    ambience: 18,
    specularity: 55,
    specularHalo: 60,
    reflection: 12,
    bumpHeight: 30,
    components: [
      makeComponent({ type: 'ridged', mapping: 'world', scale: 4, octaves: 6, warp: 0.3, bump: 0.8, gradient: stops([0.5, 0.64, 0.78], [0.86, 0.93, 0.99], [1, 1, 1]) }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

export const snowField = (tint: RGB = [0.9, 0.9, 0.97]): Material =>
  makeMaterial({
    name: 'Frost Snow',
    diffuseColor: tint,
    specularColor: [0.9, 0.95, 1],
    diffusion: 88,
    ambience: 16,
    specularity: 25,
    specularHalo: 30,
    bumpHeight: 22,
    components: [makeComponent({ type: 'fbm', mapping: 'worldTop', scale: 3, octaves: 6, roughness: 0.55, bump: 0.6, gradient: stops([tint[0] * 0.82, tint[1] * 0.84, tint[2] * 0.92], tint, [1, 1, 1]) })],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

export const blackMirror = (): Material => ({ ...obsidian(), name: 'Black Mirror', reflection: 72, blur: 0, specularity: 90 });

// --- grounds -------------------------------------------------------------------

export const checkerboard = (a: RGB = [0.06, 0.06, 0.07], b: RGB = [0.92, 0.92, 0.9], scale = 4): Material =>
  makeMaterial({
    name: 'Checkerboard',
    diffuseColor: b,
    diffusion: 85,
    ambience: 10,
    specularity: 40,
    specularHalo: 70,
    reflection: 22,
    components: [makeComponent({ type: 'checker', mapping: 'worldTop', scale, octaves: 1, contrast: 1, gradient: [{ at: 0, color: a }, { at: 1, color: b }] })],
    drivers: { diffuseColor: 0 },
  });

/** Dark floor with glowing grid lines (the 80s/vaporwave floor). */
export const neonGrid = (line: RGB, floor: RGB = [0.05, 0.02, 0.1], scale = 4): Material =>
  makeMaterial({
    name: 'Neon Grid',
    diffuseColor: floor,
    ambientColor: line,
    diffusion: 60,
    ambience: 100,
    specularity: 50,
    specularHalo: 80,
    reflection: 30,
    components: [makeComponent({ type: 'grid', mapping: 'worldTop', scale, octaves: 1, contrast: 0.9, gradient: [{ at: 0, color: floor }, { at: 1, color: line }] })],
    drivers: { ambientColor: 0, ambience: 0 },
  });

// --- waters ----------------------------------------------------------------------

export interface WaterLook {
  name: string;
  deep: RGB;
  shallow: RGB;
  /** 0..100 mirror amount. */
  reflection?: number;
  /** 0..100 see-through amount. */
  transparency?: number;
  /** Wave bump strength (0 = glassy calm). */
  waves?: number;
  /** Wave feature size in world units. */
  waveScale?: number;
}

export const water = (look: WaterLook): Material =>
  makeMaterial({
    name: look.name,
    diffuseColor: look.deep,
    ambientColor: look.deep,
    transparentColor: look.shallow,
    volumeColor: look.shallow,
    diffusion: 25,
    ambience: 5,
    specularity: 75,
    specularHalo: 88,
    reflection: look.reflection ?? 62,
    transparency: look.transparency ?? 30,
    refraction: 133,
    bumpHeight: look.waves ?? 16,
    components: [
      makeComponent({ type: 'waves', mapping: 'worldTop', scale: look.waveScale ?? 2.4, octaves: 4, roughness: 0.55, bump: 1, gradient: stops(look.deep, look.shallow) }),
    ],
    drivers: { bumpHeight: 0 },
  });

// --- plants ------------------------------------------------------------------------

export const leaves = (color: RGB, name = 'Leaves'): Material =>
  makeMaterial({
    name,
    diffuseColor: color,
    diffusion: 86,
    ambience: 10,
    specularity: 8,
    bumpHeight: 30,
    components: [
      makeComponent({
        type: 'voronoi',
        mapping: 'object',
        scale: 0.22,
        octaves: 3,
        bump: 0.8,
        gradient: stops([color[0] * 0.5, color[1] * 0.5, color[2] * 0.5], color, [Math.min(1, color[0] * 1.3), Math.min(1, color[1] * 1.3), Math.min(1, color[2] * 1.3)]),
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });

// --- the eye -------------------------------------------------------------------------

export const eyeWhite = (): Material =>
  makeMaterial({
    name: 'Eye White',
    diffuseColor: [0.97, 0.95, 0.93],
    diffusion: 82,
    ambience: 14,
    specularity: 90,
    specularHalo: 92,
    reflection: 14,
    components: [
      makeComponent({ type: 'marble', mapping: 'object', scale: 0.45, octaves: 4, warp: 0.6, gradient: [{ at: 0, color: [0.9, 0.62, 0.6] }, { at: 0.05, color: [0.97, 0.95, 0.93] }, { at: 1, color: [0.97, 0.95, 0.93] }] }),
    ],
    drivers: { diffuseColor: 0 },
  });

export const iris = (color: RGB): Material =>
  makeMaterial({
    name: 'Iris',
    diffuseColor: color,
    diffusion: 80,
    ambience: 16,
    specularity: 90,
    specularHalo: 95,
    reflection: 18,
    components: [
      makeComponent({
        type: 'turbulence',
        mapping: 'object',
        scale: 0.3,
        octaves: 5,
        warp: 0.4,
        gradient: stops([color[0] * 0.35, color[1] * 0.35, color[2] * 0.35], color, [Math.min(1, color[0] * 1.5 + 0.1), Math.min(1, color[1] * 1.5 + 0.1), Math.min(1, color[2] * 1.5 + 0.1)]),
      }),
    ],
    drivers: { diffuseColor: 0 },
  });

export const pupil = (): Material =>
  makeMaterial({ name: 'Pupil', diffuseColor: [0.01, 0.01, 0.02], diffusion: 50, ambience: 0, specularity: 95, specularHalo: 96, reflection: 30 });

// --- atmosphere ------------------------------------------------------------------------

export const fogBank = (color: RGB = [0.92, 0.94, 0.98], density = 35): Material =>
  makeMaterial({
    name: 'Fog Bank',
    mode: 'volume',
    volumeDensity: density,
    diffuseColor: color,
    volumeColor: color,
    ambience: 35,
    transparency: 100,
    components: [makeComponent({ type: 'turbulence', mapping: 'world', scale: 12, octaves: 5, roughness: 0.55 })],
    drivers: { transparency: 0 },
  });
