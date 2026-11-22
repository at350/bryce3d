/** Pleasant starting textures for components created from the grid or the Add button. */
import { hsvToRgb, mulberry32, randomSeed, rgbToHsv } from '@/core/math';
import { makeComponent } from '@/core/materialUtils';
import type { Material, MaterialChannel, RGB, TextureComponent, TextureType } from '@/core/types';

const STARTERS: TextureType[] = ['fbm', 'turbulence', 'granite', 'voronoi', 'marble', 'spots', 'ridged'];

/** Darker and lighter variants of a color, for a two-tone gradient that keeps its character. */
function tonesOf(c: RGB): [RGB, RGB, RGB] {
  const [h, s, v] = rgbToHsv(c);
  const sat = Math.max(0.15, s);
  return [hsvToRgb(h, Math.min(1, sat * 1.1), Math.max(0.06, v * 0.45)), c, hsvToRgb(h, sat * 0.7, Math.min(1, v * 1.25 + 0.1))];
}

/**
 * A new component tuned for the channel that asked for it: color channels get a gradient
 * built around the channel's current color, bump gets a bumpy noise.
 */
export function newComponentFor(m: Material, channel: MaterialChannel | null, index: number, seed = randomSeed()): TextureComponent {
  const r = mulberry32(seed);
  const type = channel === 'bumpHeight' ? (r() < 0.5 ? 'fbm' : 'voronoi') : STARTERS[Math.floor(r() * STARTERS.length)];
  const colorChannel = channel === 'ambientColor' || channel === 'specularColor' || channel === 'transparentColor' ? channel : 'diffuseColor';
  const [dark, mid, light] = tonesOf(m[colorChannel]);
  return makeComponent({
    type,
    mapping: 'object',
    scale: type === 'granite' ? 0.2 : type === 'voronoi' ? 0.3 : 0.5,
    octaves: 6,
    roughness: 0.55,
    warp: type === 'marble' ? 0.3 : 0,
    contrast: 0.55,
    seed: Math.floor(r() * 99999) + index,
    bump: channel === 'bumpHeight' ? 0.8 : 0.5,
    gradient: [
      { at: 0, color: dark },
      { at: 0.55, color: mid },
      { at: 1, color: light },
    ],
  });
}
