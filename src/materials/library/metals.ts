/** Metals: reflection tinted by the diffuse color through metallicity. */
import { chromeMaterial } from '../defaults';
import { category, comp, grad, hex, metal } from './helpers';

const p = category('Metals');

export const METAL_PRESETS = [
  p('chrome', 'Chrome Mirror', 'A flawless mirror ball, the quintessential Bryce sphere: it holds the whole sky.', chromeMaterial()),
  p('polished-gold', 'Polished Gold', 'Bullion-bright gold that warms every reflection to a rich yellow.',
    metal('Polished Gold', '#ffc23e', { specularColor: hex('#fff2b8'), metallicity: 100, reflection: 82, diffusion: 25, specularHalo: 90 })),
  p('old-brass', 'Old Brass', 'Warm, faintly hazy brass with soft tarnish, like a ship\'s compass.',
    metal('Old Brass', '#c7a04a', {
      reflection: 58,
      blur: 14,
      specularHalo: 70,
      components: [comp({ type: 'fbm', mapping: 'object', scale: 0.5, octaves: 5, contrast: 0.55, seed: 7, gradient: grad([0, '#8c7034'], [0.6, '#c39b48'], [1, '#d9b765']) })],
      drivers: { diffuseColor: 0 },
    })),
  p('copper-kettle', 'Copper Kettle', 'Rosy polished copper throwing glowing orange reflections.',
    metal('Copper Kettle', '#de7a4b', { specularColor: hex('#ffd0b0'), metallicity: 96, reflection: 74, blur: 5 })),
  p('brushed-steel', 'Brushed Steel', 'Satin stainless steel with fine machined streaks and softly blurred reflections.',
    metal('Brushed Steel', '#a2a8b0', {
      diffusion: 30,
      specularHalo: 48,
      metallicity: 55,
      reflection: 55,
      blur: 38,
      bumpHeight: 8,
      components: [comp({ type: 'strata', mapping: 'object', scale: 0.025, octaves: 3, roughness: 0.6, contrast: 0.55, seed: 3, bump: 0.3, gradient: grad([0, '#8f959d'], [1, '#b8bec6']) })],
      drivers: { diffuseColor: 0, bumpHeight: 0 },
    })),
  p('sterling-silver', 'Sterling Silver', 'Bright, cool silver: a touch softer and warmer than chrome.',
    metal('Sterling Silver', '#e3e5e9', { metallicity: 35, reflection: 86, specularity: 96, specularHalo: 92, diffusion: 12 })),
  p('verdigris-bronze', 'Verdigris Bronze', 'Antique bronze blooming with sea-green patina; only the worn high spots still shine.',
    metal('Verdigris Bronze', '#a8783c', {
      diffusion: 60,
      metallicity: 70,
      reflection: 45,
      specularHalo: 60,
      bumpHeight: 12,
      components: [
        comp({ type: 'fbm', mapping: 'object', scale: 0.55, octaves: 6, roughness: 0.55, contrast: 0.78, seed: 19, bump: 0.4,
          gradient: grad([0, '#3f9a82'], [0.44, '#62ae90'], [0.56, '#8a6a38'], [1, '#b8873f']) }),
      ],
      drivers: { diffuseColor: 0, reflection: 0, bumpHeight: 0 },
    })),
  p('gunmetal', 'Gunmetal', 'Dark blued steel with a cool, moody gleam.',
    metal('Gunmetal', '#4b515b', { metallicity: 70, reflection: 48, blur: 10, specularHalo: 78 })),
  p('rose-gold', 'Rose Gold', 'Blush-pink gold straight from the jewelry box.',
    metal('Rose Gold', '#eba291', { specularColor: hex('#ffe0d6'), metallicity: 100, reflection: 76 })),
  p('hammered-pewter', 'Hammered Pewter', 'Soft gray pewter covered in hand-hammered dimples.',
    metal('Hammered Pewter', '#8e9298', {
      diffusion: 40,
      metallicity: 50,
      reflection: 42,
      blur: 18,
      specularHalo: 62,
      bumpHeight: 45,
      components: [comp({ type: 'voronoi', mapping: 'object', scale: 0.16, octaves: 1, contrast: 0.5, seed: 23, bump: 0.8, gradient: grad([0, '#7a7e84'], [1, '#9a9ea4']) })],
      drivers: { bumpHeight: 0 },
    })),
  p('anodized-titanium', 'Anodized Titanium', 'Heat-tinted titanium shimmering through violet, blue and gold.',
    metal('Anodized Titanium', '#5a6fd0', {
      metallicity: 100,
      reflection: 62,
      components: [
        comp({ type: 'turbulence', mapping: 'object', scale: 0.9, octaves: 4, roughness: 0.45, warp: 0.35, seed: 11,
          gradient: grad([0, '#7b3fc4'], [0.35, '#2f6de0'], [0.7, '#2fc0c8'], [1, '#e8c04a']) }),
      ],
      drivers: { diffuseColor: 0 },
    })),
];
