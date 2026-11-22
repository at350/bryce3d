/**
 * Random material generator (the Materials Lab dice). It first picks a style family
 * (metal, glass, stone, planet, glow...) and then randomizes within ranges that keep
 * the result pleasant, with harmonious HSV palettes. Deterministic for a given seed.
 */
import { hsvToRgb, mulberry32, randomSeed } from '@/core/math';
import { makeComponent, makeMaterial } from '@/core/materialUtils';
import type { Material, RGB, TextureComponent, TextureMapping, TextureType } from '@/core/types';

type Rand = () => number;

export const RANDOM_FAMILIES = ['metal', 'glass', 'stone', 'glossy', 'glow', 'pattern', 'planet', 'marble', 'wood', 'swirl', 'water', 'cloud'] as const;
export type RandomFamily = (typeof RANDOM_FAMILIES)[number];

const WEIGHTS: Record<RandomFamily, number> = {
  metal: 12, glass: 10, stone: 12, glossy: 9, glow: 6, pattern: 9, planet: 8, marble: 8, wood: 6, swirl: 10, water: 6, cloud: 4,
};

const between = (r: Rand, lo: number, hi: number) => lo + (hi - lo) * r();
const int = (r: Rand, lo: number, hi: number) => Math.floor(between(r, lo, hi + 1));
const pick = <T,>(r: Rand, items: readonly T[]): T => items[Math.min(items.length - 1, Math.floor(r() * items.length))];
const chance = (r: Rand, p: number) => r() < p;
const wrap = (h: number) => ((h % 1) + 1) % 1;
const round = (v: number, step = 1) => Math.round(v / step) * step;

function pickFamily(r: Rand): RandomFamily {
  const total = RANDOM_FAMILIES.reduce((s, f) => s + WEIGHTS[f], 0);
  let t = r() * total;
  for (const f of RANDOM_FAMILIES) {
    t -= WEIGHTS[f];
    if (t <= 0) return f;
  }
  return 'stone';
}

const hsv = (h: number, s: number, v: number): RGB => hsvToRgb(wrap(h), Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, v)));

/** Gradient with `n` evenly spread stops from a list of colors. */
function gradientOf(colors: RGB[]): TextureComponent['gradient'] {
  const n = Math.max(2, Math.min(4, colors.length));
  return colors.slice(0, n).map((color, i) => ({ at: round(i / (n - 1), 0.01), color }));
}

function component(r: Rand, overrides: Partial<TextureComponent>): TextureComponent {
  return makeComponent({
    octaves: int(r, 3, 7),
    roughness: round(between(r, 0.4, 0.65), 0.01),
    warp: 0,
    contrast: 0.5,
    bias: 0,
    seed: int(r, 1, 99999),
    bump: 0.6,
    ...overrides,
  });
}

const HUE_NAMES: [number, string][] = [
  [0.03, 'Crimson'], [0.07, 'Ember'], [0.11, 'Amber'], [0.15, 'Gold'], [0.22, 'Lime'], [0.33, 'Jade'],
  [0.45, 'Teal'], [0.55, 'Azure'], [0.64, 'Cobalt'], [0.74, 'Violet'], [0.85, 'Magenta'], [0.95, 'Rose'], [1.01, 'Crimson'],
];

const hueName = (h: number) => HUE_NAMES.find(([limit]) => wrap(h) < limit)?.[1] ?? 'Crimson';

const NOUNS: Record<RandomFamily, string[]> = {
  metal: ['Alloy', 'Chrome', 'Foil', 'Ingot', 'Plate', 'Gilt'],
  glass: ['Glass', 'Crystal', 'Prism', 'Lens', 'Gem'],
  stone: ['Rock', 'Stone', 'Shale', 'Bedrock', 'Boulder', 'Crag'],
  glossy: ['Enamel', 'Lacquer', 'Plastic', 'Gloss', 'Paint'],
  glow: ['Glow', 'Neon', 'Beacon', 'Ember', 'Halo'],
  pattern: ['Tiles', 'Pattern', 'Print', 'Motif', 'Weave'],
  planet: ['World', 'Planet', 'Moon', 'Orb', 'Sphere'],
  marble: ['Marble', 'Onyx', 'Alabaster', 'Agate'],
  wood: ['Grain', 'Timber', 'Burl', 'Veneer'],
  swirl: ['Swirl', 'Dream', 'Vortex', 'Trip', 'Nebula'],
  water: ['Waters', 'Lagoon', 'Tide', 'Pool', 'Shallows'],
  cloud: ['Mist', 'Vapor', 'Cloud', 'Haze', 'Puff'],
};

const ADJECTIVES = ['Cosmic', 'Ancient', 'Electric', 'Molten', 'Frozen', 'Velvet', 'Lunar', 'Solar', 'Hidden', 'Feral', 'Dusky', 'Lucid'];

function nameFor(r: Rand, family: RandomFamily, hue: number): string {
  const noun = pick(r, NOUNS[family]);
  return chance(r, 0.6) ? `${hueName(hue)} ${noun}` : `${pick(r, ADJECTIVES)} ${noun}`;
}

// --- families ----------------------------------------------------------------

function metal(r: Rand, h: number): Partial<Material> {
  const s = chance(r, 0.3) ? between(r, 0.02, 0.12) : between(r, 0.25, 0.6);
  const base = hsv(h, s, between(r, 0.65, 0.95));
  const out: Partial<Material> = {
    diffuseColor: base,
    specularColor: hsv(h, s * 0.3, 1),
    diffusion: round(between(r, 10, 35)),
    ambience: 2,
    specularity: round(between(r, 85, 100)),
    specularHalo: round(between(r, 72, 95)),
    metallicity: round(between(r, 65, 100)),
    reflection: round(between(r, 55, 88)),
    blur: chance(r, 0.3) ? round(between(r, 10, 35)) : 0,
  };
  const style = r();
  if (style < 0.3) {
    out.components = [component(r, { type: 'voronoi', mapping: 'object', scale: round(between(r, 0.1, 0.3), 0.01), octaves: 1, bump: -0.8, gradient: gradientOf([base, base]) })];
    out.drivers = { bumpHeight: 0 };
    out.bumpHeight = round(between(r, 25, 55));
  } else if (style < 0.55) {
    out.components = [component(r, {
      type: pick(r, ['turbulence', 'fbm'] as const), mapping: 'object', scale: round(between(r, 0.4, 1), 0.01), warp: round(between(r, 0.2, 0.6), 0.01),
      gradient: gradientOf([hsv(h, 0.6, 0.85), hsv(h + 0.15, 0.6, 0.9), hsv(h + 0.3, 0.55, 0.95)]),
    })];
    out.drivers = { diffuseColor: 0 };
  }
  return out;
}

function glassy(r: Rand, h: number): Partial<Material> {
  const tint = hsv(h, between(r, 0.15, 0.85), between(r, 0.75, 1));
  const frosted = chance(r, 0.25);
  return {
    diffuseColor: hsv(h, 0.6, 0.4),
    ambientColor: [0, 0, 0],
    transparentColor: tint,
    volumeColor: tint,
    diffusion: frosted ? 15 : 4,
    ambience: 0,
    specularity: round(between(r, 88, 100)),
    specularHalo: round(between(r, 88, 98)),
    reflection: round(between(r, 8, 20)),
    transparency: round(between(r, 80, 95)),
    refraction: round(between(r, 125, 230)),
    blur: frosted ? round(between(r, 35, 70)) : 0,
  };
}

const STONE_HUES = [0.04, 0.07, 0.09, 0.11, 0.58, 0.3];

function stone(r: Rand, h: number): Partial<Material> {
  const hue = chance(r, 0.7) ? pick(r, STONE_HUES) : h;
  const s = between(r, 0.08, 0.45);
  const v = between(r, 0.35, 0.7);
  const type = pick(r, ['granite', 'fbm', 'ridged', 'voronoi', 'strata', 'spots'] as const);
  const mapping: TextureMapping = type === 'strata' ? 'world' : 'object';
  const colors = [hsv(hue, s, v * 0.45), hsv(hue + 0.02, s, v), hsv(hue - 0.02, s * 0.7, Math.min(1, v * 1.4))];
  if (chance(r, 0.4)) colors.splice(1, 0, hsv(hue + between(r, -0.1, 0.1), s * 1.2, v * 0.75));
  return {
    diffuseColor: colors[1],
    diffusion: round(between(r, 78, 92)),
    ambience: round(between(r, 5, 12)),
    specularity: round(between(r, 4, 30)),
    specularHalo: round(between(r, 20, 60)),
    bumpHeight: round(between(r, 20, 60)),
    components: [
      component(r, { type, mapping, scale: type === 'strata' ? round(between(r, 0.3, 1.5), 0.01) : round(between(r, 0.2, 0.7), 0.01), warp: round(between(r, 0, 0.4), 0.01), contrast: round(between(r, 0.5, 0.65), 0.01), gradient: gradientOf(colors) }),
      component(r, { type: pick(r, ['fbm', 'ridged', 'voronoi'] as const), mapping: 'object', scale: round(between(r, 0.15, 0.5), 0.01), bump: chance(r, 0.5) ? 0.8 : -0.8 }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 1 },
    altitude: chance(r, 0.15) ? { color: chance(r, 0.5) ? [0.95, 0.96, 1] : hsv(0.27, 0.55, 0.5), start: round(between(r, 0.45, 0.7), 0.01), softness: 0.15, maxSlope: 0.6 } : undefined,
  };
}

function glossy(r: Rand, h: number): Partial<Material> {
  const base = hsv(h, between(r, 0.5, 0.95), between(r, 0.55, 0.95));
  const out: Partial<Material> = {
    diffuseColor: base,
    ambientColor: hsv(h, 0.6, 0.3),
    diffusion: round(between(r, 72, 88)),
    ambience: round(between(r, 6, 14)),
    specularity: round(between(r, 50, 90)),
    specularHalo: round(between(r, 45, 90)),
    reflection: chance(r, 0.5) ? round(between(r, 5, 20)) : 0,
  };
  if (chance(r, 0.35)) {
    out.components = [component(r, {
      type: pick(r, ['spots', 'checker', 'grid', 'waves'] as const), mapping: 'object', scale: round(between(r, 0.15, 0.4), 0.01), octaves: 1,
      contrast: 0.9, gradient: gradientOf([base, hsv(h + pick(r, [0.5, 0.33, 0]), 0.15, 0.97)]),
    })];
    out.drivers = { diffuseColor: 0 };
  }
  return out;
}

function glow(r: Rand, h: number): Partial<Material> {
  const c = hsv(h, between(r, 0.6, 1), 1);
  const out: Partial<Material> = {
    diffuseColor: c,
    ambientColor: c,
    diffusion: round(between(r, 10, 40)),
    ambience: round(between(r, 75, 100)),
    specularity: round(between(r, 20, 60)),
    specularHalo: 60,
  };
  if (chance(r, 0.6)) {
    out.components = [component(r, {
      type: pick(r, ['ridged', 'turbulence', 'grid', 'voronoi'] as const), mapping: 'object', scale: round(between(r, 0.2, 0.6), 0.01),
      warp: round(between(r, 0.2, 0.8), 0.01), contrast: 0.7, gradient: gradientOf([hsv(h + 0.05, 0.9, 0.1), c, hsv(h - 0.05, 0.3, 1)]),
    })];
    out.drivers = { ambience: 0, ambientColor: 0, diffuseColor: 0 };
  }
  return out;
}

function pattern(r: Rand, h: number): Partial<Material> {
  const type = pick(r, ['checker', 'grid', 'spots', 'waves', 'voronoi'] as const);
  const a = hsv(h, between(r, 0.5, 0.9), between(r, 0.5, 0.9));
  const b = hsv(h + pick(r, [0.5, 0.33, 0.12]), between(r, 0.1, 0.7), between(r, 0.85, 1));
  const world = chance(r, 0.4);
  return {
    diffuseColor: a,
    diffusion: round(between(r, 75, 88)),
    ambience: round(between(r, 6, 14)),
    specularity: round(between(r, 20, 70)),
    specularHalo: round(between(r, 40, 80)),
    reflection: chance(r, 0.3) ? round(between(r, 10, 30)) : 0,
    components: [component(r, {
      type, mapping: world ? 'world' : 'object', scale: world ? round(between(r, 0.8, 2.5), 0.01) : round(between(r, 0.12, 0.4), 0.01),
      octaves: type === 'voronoi' || type === 'waves' ? 2 : 1, contrast: round(between(r, 0.7, 0.95), 0.01), warp: chance(r, 0.25) ? round(between(r, 0.2, 0.6), 0.01) : 0,
      gradient: gradientOf([a, b]),
    })],
    drivers: { diffuseColor: 0 },
  };
}

function planet(r: Rand, h: number): Partial<Material> {
  const gas = chance(r, 0.45);
  const colors = gas
    ? [hsv(h, 0.5, 0.45), hsv(h + 0.04, 0.45, 0.8), hsv(h + 0.08, 0.2, 0.97), hsv(h - 0.04, 0.6, 0.6)]
    : [hsv(h, 0.6, 0.25), hsv(h + 0.03, 0.55, 0.55), hsv(h + 0.06, 0.4, 0.8)];
  return {
    diffuseColor: colors[1],
    diffusion: 88,
    ambience: 6,
    specularity: round(between(r, 4, 25)),
    specularHalo: 40,
    components: [component(r, {
      type: gas ? 'strata' : pick(r, ['fbm', 'ridged', 'voronoi'] as const), mapping: 'spherical',
      scale: gas ? round(between(r, 0.1, 0.25), 0.01) : round(between(r, 0.3, 0.7), 0.01), warp: round(between(r, 0.15, 0.5), 0.01), contrast: 0.6, gradient: gradientOf(colors),
    })],
    drivers: { diffuseColor: 0 },
    altitude: !gas && chance(r, 0.5) ? { color: [0.96, 0.97, 1], start: round(between(r, 0.86, 0.94), 0.01), softness: 0.05, maxSlope: 1 } : undefined,
  };
}

function marble(r: Rand, h: number): Partial<Material> {
  const dark = chance(r, 0.4);
  const base = dark ? hsv(h, between(r, 0.2, 0.6), between(r, 0.08, 0.25)) : hsv(h, between(r, 0.02, 0.25), between(r, 0.8, 0.96));
  const vein = dark ? hsv(h + 0.08, 0.15, 0.92) : hsv(h + between(r, -0.05, 0.05), between(r, 0.1, 0.5), between(r, 0.3, 0.55));
  return {
    diffuseColor: base,
    diffusion: 78,
    ambience: 8,
    specularity: round(between(r, 55, 85)),
    specularHalo: round(between(r, 75, 92)),
    reflection: round(between(r, 5, 18)),
    components: [component(r, {
      type: 'marble', mapping: 'object', scale: round(between(r, 0.3, 0.8), 0.01), warp: round(between(r, 0.1, 0.5), 0.01), contrast: 0.45,
      gradient: [{ at: 0, color: base }, { at: 0.8, color: base }, { at: 0.93, color: vein }, { at: 1, color: hsv(h, 0.1, dark ? 1 : 0.25) }],
    })],
    drivers: { diffuseColor: 0 },
  };
}

function wood(r: Rand): Partial<Material> {
  const h = between(r, 0.04, 0.09);
  const v = between(r, 0.35, 0.75);
  return {
    diffuseColor: hsv(h, 0.6, v),
    diffusion: 82,
    ambience: 8,
    specularity: round(between(r, 20, 70)),
    specularHalo: round(between(r, 50, 80)),
    reflection: chance(r, 0.4) ? round(between(r, 4, 12)) : 0,
    components: [component(r, {
      type: pick(r, ['strata', 'marble'] as const), mapping: 'object', scale: round(between(r, 0.06, 0.15), 0.01), warp: round(between(r, 0.2, 0.6), 0.01), contrast: 0.6,
      gradient: gradientOf([hsv(h, 0.7, v * 0.6), hsv(h + 0.01, 0.6, v), hsv(h + 0.02, 0.5, Math.min(1, v * 1.25))]),
    })],
    drivers: { diffuseColor: 0 },
  };
}

function swirl(r: Rand, h: number): Partial<Material> {
  const step = pick(r, [0.12, 0.2, 0.25, 0.33]);
  const sat = between(r, 0.35, 0.95);
  const colors = [0, 1, 2, 3].map((i) => hsv(h + i * step, sat, between(r, 0.75, 1)));
  return {
    diffuseColor: colors[0],
    ambientColor: colors[1],
    diffusion: round(between(r, 65, 85)),
    ambience: round(between(r, 10, 40)),
    specularity: round(between(r, 20, 60)),
    specularHalo: round(between(r, 40, 70)),
    components: [component(r, {
      type: pick(r, ['marble', 'fbm', 'turbulence', 'waves'] as const), mapping: 'object', scale: round(between(r, 0.2, 0.7), 0.01),
      warp: round(between(r, 0.5, 1), 0.01), contrast: round(between(r, 0.5, 0.65), 0.01), gradient: gradientOf(colors),
    })],
    drivers: { diffuseColor: 0, ...(chance(r, 0.4) ? { ambientColor: 0 } : {}) },
  };
}

function water(r: Rand): Partial<Material> {
  const h = between(r, 0.42, 0.62);
  return {
    diffuseColor: hsv(h, between(r, 0.6, 0.9), between(r, 0.2, 0.5)),
    transparentColor: hsv(h, 0.45, 0.85),
    volumeColor: hsv(h, 0.7, 0.4),
    diffusion: 35,
    ambience: 4,
    specularity: 85,
    specularHalo: 90,
    reflection: round(between(r, 45, 85)),
    transparency: round(between(r, 15, 55)),
    refraction: 133,
    bumpHeight: round(between(r, 8, 35)),
    components: [component(r, { type: 'waves', mapping: 'worldTop', scale: round(between(r, 1.5, 4), 0.1), octaves: int(r, 3, 6), warp: round(between(r, 0.1, 0.4), 0.01), bump: 1 })],
    drivers: { bumpHeight: 0 },
  };
}

function cloud(r: Rand, h: number): Partial<Material> {
  const c = chance(r, 0.6) ? hsv(h, 0.05, 1) : hsv(h, between(r, 0.2, 0.5), 1);
  return {
    mode: 'volume',
    volumeDensity: round(between(r, 25, 70)),
    diffuseColor: c,
    ambientColor: c,
    volumeColor: c,
    diffusion: 70,
    ambience: round(between(r, 20, 50)),
    specularity: 0,
    transparency: 100,
    components: [component(r, { type: pick(r, ['turbulence', 'fbm'] as const), mapping: 'object', scale: round(between(r, 0.35, 0.7), 0.01), warp: round(between(r, 0.2, 0.7), 0.01), contrast: 0.6 })],
    drivers: { transparency: 0 },
  };
}

const BUILDERS: Record<RandomFamily, (r: Rand, hue: number) => Partial<Material>> = {
  metal, glass: glassy, stone, glossy, glow, pattern, planet, marble, wood, swirl, water, cloud,
};

/** A random but pleasant material. Pass a seed for a reproducible result, or a family to force a style. */
export function randomMaterial(seed: number = randomSeed(), family?: RandomFamily): Material {
  const r = mulberry32(seed);
  const fam = family ?? pickFamily(r);
  const hue = r();
  const fields = BUILDERS[fam](r, hue);
  const m = makeMaterial({ ...fields, name: nameFor(r, fam, hue) });
  if (!m.altitude) delete m.altitude;
  return m;
}

/** The textured types the generator can emit (used by tests). */
export const RANDOM_TEXTURE_TYPES: TextureType[] = ['granite', 'fbm', 'ridged', 'voronoi', 'strata', 'spots', 'checker', 'grid', 'waves', 'turbulence', 'marble'];
