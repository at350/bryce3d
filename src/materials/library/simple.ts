/** Simple & Fast: flat, quick-rendering looks (few or no textures). */
import { defaultMaterial } from '@/core/materialUtils';
import { category, comp, grad, hex, mat } from './helpers';

const p = category('Simple & Fast');

export const SIMPLE_PRESETS = [
  p('default', 'Default Matte', 'The plain light-gray matte every new object starts with: an honest blank canvas.', defaultMaterial()),
  p('red-plastic', 'Red Plastic', 'Toy-brick red with a crisp white highlight. Glossy, cheerful and fast to render.',
    mat('Red Plastic', { diffuseColor: hex('#c8231d'), ambientColor: hex('#5a0d0a'), diffusion: 82, ambience: 10, specularity: 70, specularHalo: 72 })),
  p('blue-enamel', 'Blue Enamel', 'Deep cobalt enamel with a wet, lacquered sheen and a hint of reflection.',
    mat('Blue Enamel', { diffuseColor: hex('#1d49b5'), ambientColor: hex('#0b1d4a'), diffusion: 78, ambience: 8, specularity: 85, specularHalo: 88, reflection: 14 })),
  p('terracotta', 'Terracotta', 'Sun-baked flowerpot clay: warm orange, dry and chalky, with faint mottling.',
    mat('Terracotta', {
      diffuseColor: hex('#b6573a'),
      diffusion: 90,
      ambience: 8,
      specularity: 6,
      specularHalo: 20,
      components: [comp({ type: 'fbm', mapping: 'object', scale: 0.45, octaves: 5, contrast: 0.45, seed: 41, gradient: grad([0, '#a24b31'], [1, '#c96a47']) })],
      drivers: { diffuseColor: 0 },
    })),
  p('porcelain', 'Porcelain', 'Bone-white porcelain under a smooth glaze that catches a soft window glint.',
    mat('Porcelain', { diffuseColor: hex('#f4f1ea'), ambientColor: hex('#e8e4dc'), diffusion: 80, ambience: 14, specularity: 72, specularHalo: 82, reflection: 8 })),
  p('rubber-duck', 'Rubber Duck', 'Squeaky bath-toy yellow with a broad, rubbery highlight.',
    mat('Rubber Duck', { diffuseColor: hex('#ffd21c'), ambientColor: hex('#6b5200'), diffusion: 85, ambience: 10, specularity: 45, specularHalo: 40 })),
  p('velvet-black', 'Velvet Black', 'Light-swallowing black for silhouettes and brooding monoliths.',
    mat('Velvet Black', { diffuseColor: hex('#0c0c0f'), diffusion: 70, ambience: 0, specularity: 10, specularHalo: 25 })),
  p('satin-pearl', 'Satin Pearl', 'Creamy pearl with a wide, rosy sheen that rolls across the surface.',
    mat('Satin Pearl', {
      diffuseColor: hex('#efe6df'),
      specularColor: hex('#fff4ee'),
      specularHaloColor: hex('#ffc4d6'),
      diffusion: 78,
      ambience: 12,
      specularity: 55,
      specularHalo: 28,
      metallicity: 20,
      reflection: 10,
    })),
  p('pure-glow', 'Pure Glow', 'Fully self-lit white that ignores every light and glows like a lamp.',
    mat('Pure Glow', { diffuseColor: [1, 1, 1], ambientColor: [1, 1, 1], diffusion: 0, ambience: 100, specularity: 0 })),
  p('mint-gloss', 'Mint Gloss', 'Retro kitchen-appliance mint, smooth and shiny as a 1950s fridge.',
    mat('Mint Gloss', { diffuseColor: hex('#9fe2c5'), ambientColor: hex('#2f5c4a'), diffusion: 80, ambience: 10, specularity: 70, specularHalo: 75, reflection: 6 })),
  p('tile-floor', 'Tile Floor', 'Glazed white tiles with gray grout, laid square to the object like a bathroom floor.',
    mat('Tile Floor', {
      diffuseColor: hex('#eeeeea'),
      diffusion: 80,
      ambience: 10,
      specularity: 60,
      specularHalo: 80,
      reflection: 12,
      bumpHeight: 10,
      components: [comp({ type: 'grid', mapping: 'objectTop', scale: 0.25, octaves: 1, roughness: 0.4, seed: 1, bump: -1, gradient: grad([0, '#f0f0ec'], [1, '#8a8a86']) })],
      drivers: { diffuseColor: 0, bumpHeight: 0 },
    }), 'plane'),
];
