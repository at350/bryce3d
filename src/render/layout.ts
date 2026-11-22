/**
 * Texel layouts shared by the CPU packer (pack.ts) and the GLSL sources. Every record is
 * a run of RGBA32F texels in one row of a data texture; the shader reads them with
 * texelFetch(tex, ivec2(texel, row), 0). The TS constants and the generated GLSL defines
 * live in this one file so the two sides cannot drift apart.
 */

/** Scene limits. Objects beyond MAX_OBJECTS (and lights beyond MAX_LIGHTS) are dropped. */
export const MAX_OBJECTS = 256;
export const MAX_LIGHTS = 16;
/** Object rows also hold one glowing ball per visible light. */
export const MAX_OBJECT_ROWS = MAX_OBJECTS + MAX_LIGHTS;
export const MAX_MATERIALS = MAX_OBJECTS;
export const MAX_TERRAIN_LAYERS = 16;

/** Object record: header, world bounds, 3 rows of the world->object matrix, 3 param texels. */
export const OBJ_TEXELS = 8;
export const OBJ = {
  HEADER: 0, // type id, material row, flags, characteristic size (world units)
  BOUNDS: 1, // world bounding sphere center xyz, radius (-1 = infinite)
  INV0: 2, // world->object matrix rows (xyz = 3x3 part, w = translation)
  INV1: 3,
  INV2: 4,
  P0: 5,
  P1: 6,
  P2: 7,
} as const;

export const OBJ_FLAG = {
  VOLUME: 1,
  TRANSPARENT: 2,
  NO_SHADOW: 4,
  FLAT: 8,
} as const;

/** Numeric type ids used in the shader. */
export const TYPE_ID = {
  sphere: 1,
  cube: 2,
  cylinder: 3,
  cone: 4,
  torus: 5,
  pyramid: 6,
  disc: 7,
  square: 8,
  water: 9,
  ground: 10,
  cloud: 11,
  terrain: 12,
  lattice: 13,
  stone: 14,
  tree: 15,
  lightBall: 16,
} as const;

/** Material record. Colors are linear RGB; value channels are normalized to 0..1. */
export const MAT_TEXELS = 34;
export const MAT = {
  DIFFUSE: 0, // rgb, diffusion
  AMBIENT: 1, // rgb, ambience
  SPECULAR: 2, // rgb, specularity
  HALO: 3, // rgb, specular halo tightness
  TRANSPARENT: 4, // rgb, transparency
  VOLUME: 5, // rgb, volume density
  MISC: 6, // metallicity, bump height (-1..1), reflection, IOR
  MISC2: 7, // blur, mode (1 = volume), component count, used-component bitmask
  ALT0: 8, // altitude color rgb, start
  ALT1: 9, // softness, max slope, enabled, 0
  DRV0: 10, // drivers: diffuseColor, ambientColor, specularColor, transparentColor
  DRV1: 11, // drivers: diffusion, ambience, specularity, reflection
  DRV2: 12, // drivers: transparency, bumpHeight, 0, 0
  COMP0: 13, // component A starts here; COMP_TEXELS per component
} as const;

/** Texture component: kind/mapping/scale/octaves, shape, seed offset + bump, 4 gradient stops. */
export const COMP_TEXELS = 7;
export const MAX_COMPONENTS = 3;
export const MAX_GRADIENT_STOPS = 4;

export const TEXTURE_TYPE_ID = {
  fbm: 0,
  ridged: 1,
  turbulence: 2,
  voronoi: 3,
  marble: 4,
  strata: 5,
  spots: 6,
  granite: 7,
  waves: 8,
  checker: 9,
  grid: 10,
} as const;

export const MAPPING_ID = {
  world: 0,
  object: 1,
  worldTop: 2,
  objectTop: 3,
  spherical: 4,
} as const;

/** Light record. */
export const LIGHT_TEXELS = 6;
export const LIGHT = {
  POS: 0, // type id, position xyz
  DIR: 1, // emission direction xyz (local -Y), cos(half cone)
  COLOR: 2, // linear rgb * intensity, falloff id
  AXIS: 3, // local X axis xyz, tan(half cone)
  MISC: 4, // softness, casts shadows, soft-shadow radius, beam half-width (parallel)
  EXTRA: 5, // visible (1/0), glow ball radius, 0, 0
} as const;

export const LIGHT_TYPE_ID = {
  radialLight: 1,
  spotLight: 2,
  squareSpotLight: 3,
  parallelLight: 4,
} as const;

export const FALLOFF_ID = { none: 0, linear: 1, squared: 2 } as const;

/** GLSL #defines mirroring the constants above. */
export function layoutDefines(): string {
  const lines: string[] = [];
  const def = (name: string, value: number) => lines.push(`#define ${name} ${value}`);
  def('MAX_OBJECT_ROWS', MAX_OBJECT_ROWS);
  def('MAX_LIGHTS', MAX_LIGHTS);
  for (const [k, v] of Object.entries(OBJ)) def(`OBJ_${k}`, v);
  for (const [k, v] of Object.entries(OBJ_FLAG)) def(`FLAG_${k}`, v);
  for (const [k, v] of Object.entries(TYPE_ID)) def(`T_${k.toUpperCase()}`, v);
  for (const [k, v] of Object.entries(MAT)) def(`MAT_${k}`, v);
  def('COMP_TEXELS', COMP_TEXELS);
  for (const [k, v] of Object.entries(TEXTURE_TYPE_ID)) def(`TEX_${k.toUpperCase()}`, v);
  for (const [k, v] of Object.entries(MAPPING_ID)) def(`MAP_${k.toUpperCase()}`, v);
  for (const [k, v] of Object.entries(LIGHT)) def(`LIGHT_${k}`, v);
  for (const [k, v] of Object.entries(LIGHT_TYPE_ID)) def(`LT_${k.toUpperCase()}`, v);
  return lines.join('\n');
}
