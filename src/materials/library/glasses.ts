/** Glasses: transparency + refraction, tinted by the transparent color. */
import { glassMaterial } from '../defaults';
import { category, comp, glass, grad, hex } from './helpers';

const p = category('Glasses');

export const GLASS_PRESETS = [
  p('clear-glass', 'Clear Glass', 'Crystal-clear glass that bends the world upside down inside it.', glassMaterial()),
  p('ruby-glass', 'Ruby Glass', 'Deep cherry-red glass, glowing like a church window with the sun behind it.',
    glass('Ruby Glass', '#f0283c', 160, { diffuseColor: hex('#8a0614') })),
  p('emerald-glass', 'Emerald Glass', 'Bottle-green glass with a cool forest glow.',
    glass('Emerald Glass', '#22d070', 157, { diffuseColor: hex('#06602f') })),
  p('sapphire-glass', 'Sapphire Glass', 'Royal-blue sapphire with a high, sparkling refraction.',
    glass('Sapphire Glass', '#4a78ff', 177, { diffuseColor: hex('#0b2470'), reflection: 16 })),
  p('frosted-glass', 'Frosted Glass', 'Sandblasted glass: light passes through, but every detail melts into a milky blur.',
    glass('Frosted Glass', '#eef4fa', 150, {
      diffusion: 18,
      ambience: 6,
      ambientColor: hex('#dfe8f0'),
      specularity: 45,
      specularHalo: 35,
      transparency: 80,
      reflection: 8,
      blur: 65,
      bumpHeight: 6,
      components: [comp({ type: 'granite', mapping: 'object', scale: 0.04, octaves: 2, seed: 5, bump: 0.4, gradient: grad([0, '#e6edf4'], [1, '#ffffff']) })],
      drivers: { bumpHeight: 0 },
    })),
  p('diamond', 'Diamond', 'Ice-white brilliance with diamond\'s extreme 2.42 refraction: pure sparkle.',
    glass('Diamond', '#ffffff', 242, { reflection: 18, transparency: 96, specularity: 100, specularHalo: 100 })),
  p('amber-bottle', 'Amber Bottle', 'Honey-amber glass, warm as a sunlit apothecary bottle.',
    glass('Amber Bottle', '#f4a83a', 150, { diffuseColor: hex('#7a4206') })),
  p('smoked-glass', 'Smoked Glass', 'Tinted charcoal glass: sleek, glossy and a little mysterious.',
    glass('Smoked Glass', '#5c6168', 152, { transparency: 78, reflection: 22, diffuseColor: hex('#202328') })),
  p('soap-bubble', 'Soap Bubble', 'A paper-thin film swirling with oil-slick rainbows; barely there at all.',
    glass('Soap Bubble', '#ffffff', 101, {
      diffusion: 10,
      transparency: 94,
      reflection: 18,
      specularHalo: 92,
      components: [
        comp({ type: 'turbulence', mapping: 'object', scale: 0.7, octaves: 4, roughness: 0.5, warp: 0.6, seed: 77,
          gradient: grad([0, '#ff6fd8'], [0.33, '#5fd3ff'], [0.66, '#9dff7a'], [1, '#ffd35f']) }),
      ],
      drivers: { diffuseColor: 0, specularColor: 0, transparentColor: 0 },
    })),
  p('stained-glass', 'Stained Glass', 'Leaded cathedral glass: jewel-colored panes set in dark seams.',
    glass('Stained Glass', '#ffffff', 150, {
      diffusion: 12,
      transparency: 85,
      components: [
        comp({ type: 'voronoi', mapping: 'object', scale: 0.4, octaves: 1, contrast: 0.7, seed: 31,
          gradient: grad([0, '#f0b020'], [0.45, '#c81e3c'], [0.8, '#1f6fe0'], [0.94, '#1a1410']) }),
      ],
      drivers: { diffuseColor: 0, transparentColor: 0 },
    })),
];
