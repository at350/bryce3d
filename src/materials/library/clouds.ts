/**
 * Clouds & Fogs: volume materials. Convention (shared with the default cloud plane): the
 * transparency channel driven by a component modulates the base density, so puffs form
 * where the texture is bright; an undriven volume has uniform density.
 */
import { cloudPlaneMaterial } from '../defaults';
import { category, comp, grad, hex, volume } from './helpers';

const p = category('Clouds & Fogs');

const puffs = (scale: number, seed: number, octaves = 6, warp = 0.3) =>
  comp({ type: 'turbulence', mapping: 'object', scale, octaves, roughness: 0.55, warp, contrast: 0.6, seed, gradient: grad([0, '#c8ccd6'], [1, '#ffffff']) });

export const CLOUD_PRESETS = [
  p('cumulus-puff', 'Cumulus Puff', 'A fluffy fair-weather cloud you can fly straight through.',
    volume('Cumulus Puff', '#f6f8ff', 60, { ambience: 35, components: [puffs(0.55, 3)], drivers: { transparency: 0, diffuseColor: 0 } })),
  p('cloud-bank', 'Cloud Bank', 'A broad, soft layer of cloud, made for infinite cloud planes.', cloudPlaneMaterial()),
  p('ground-fog', 'Ground Fog', 'An even, milky fog that swallows whatever stands inside it.',
    volume('Ground Fog', '#e4e8ee', 22, { ambience: 45 })),
  p('chimney-smoke', 'Chimney Smoke', 'Billowing gray smoke with dark, curling folds.',
    volume('Chimney Smoke', '#5d6066', 45, {
      ambience: 12,
      components: [
        comp({ type: 'turbulence', mapping: 'object', scale: 0.4, octaves: 6, roughness: 0.6, warp: 0.7, contrast: 0.62, seed: 9, gradient: grad([0, '#3a3c40'], [1, '#8a8d93']) }),
      ],
      drivers: { transparency: 0, diffuseColor: 0 },
    })),
  p('thunderhead', 'Thunderhead', 'A brooding storm cloud, dark-bellied and heavy with rain.',
    volume('Thunderhead', '#6c7280', 75, {
      ambience: 10,
      components: [
        comp({ type: 'fbm', mapping: 'object', scale: 0.5, octaves: 7, roughness: 0.6, warp: 0.4, contrast: 0.65, seed: 13, gradient: grad([0, '#3a3f4a'], [0.6, '#6c7280'], [1, '#c4c8d2']) }),
      ],
      drivers: { transparency: 0, diffuseColor: 0 },
    })),
  p('nebula-dust', 'Nebula Dust', 'Glowing interstellar gas in magenta and teal: a nursery for new stars.',
    volume('Nebula Dust', '#c04ad8', 38, {
      ambience: 80,
      components: [
        comp({ type: 'turbulence', mapping: 'object', scale: 0.5, octaves: 6, roughness: 0.55, warp: 0.8, contrast: 0.6, seed: 21,
          gradient: grad([0, '#1a1050'], [0.4, '#c03ad0'], [0.75, '#30c8d0'], [1, '#fff0ff']) }),
      ],
      drivers: { transparency: 0, diffuseColor: 0, ambientColor: 0 },
    })),
  p('wispy-steam', 'Wispy Steam', 'Thin wisps of steam curling up from a hot spring.',
    volume('Wispy Steam', '#ffffff', 18, { ambience: 50, components: [puffs(0.35, 31, 5, 0.8)], drivers: { transparency: 0 } })),
  p('sunset-cloud', 'Sunset Cloud', 'A cloud lit from within by the last orange light of the day.',
    volume('Sunset Cloud', '#ffb08a', 55, {
      ambientColor: hex('#ff6a4a'),
      ambience: 45,
      components: [
        comp({ type: 'turbulence', mapping: 'object', scale: 0.5, octaves: 6, roughness: 0.55, warp: 0.35, contrast: 0.6, seed: 41,
          gradient: grad([0, '#b04a6a'], [0.5, '#ff8a5a'], [1, '#ffe0b0']) }),
      ],
      drivers: { transparency: 0, diffuseColor: 0 },
    })),
  p('cotton-candy-cloud', 'Cotton Candy', 'A sugary pink puff straight from the fairground.',
    volume('Cotton Candy', '#ffb6dc', 58, { ambience: 40, ambientColor: hex('#ffc8e8'), components: [puffs(0.45, 51)], drivers: { transparency: 0 } })),
];
