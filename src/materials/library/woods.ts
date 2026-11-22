/** Leaves & Woods: grain, bark and foliage. */
import { treeMaterial } from '../defaults';
import { category, comp, grad, hex, mat } from './helpers';

const p = category('Leaves & Woods');

const leaves = (seed: number, gradient: ReturnType<typeof grad>) =>
  comp({ type: 'voronoi', mapping: 'object', scale: 0.22, octaves: 3, roughness: 0.5, contrast: 0.55, seed, bump: 0.8, gradient });

export const WOOD_PRESETS = [
  p('oak-grain', 'Oak Grain', 'Honey-toned oak with flowing growth rings under a satin finish.',
    mat('Oak Grain', {
      diffuseColor: hex('#a8703c'),
      diffusion: 82,
      ambience: 8,
      specularity: 35,
      specularHalo: 55,
      reflection: 4,
      bumpHeight: 6,
      components: [
        comp({ type: 'strata', mapping: 'object', scale: 0.1, octaves: 3, roughness: 0.45, warp: 0.3, contrast: 0.6, seed: 5, bump: 0.4,
          gradient: grad([0, '#6e4220'], [0.45, '#a06636'], [0.8, '#c48c52'], [1, '#d8a76a']) }),
      ],
      drivers: { diffuseColor: 0, bumpHeight: 0 },
    })),
  p('cherry-wood', 'Cherry Wood', 'Rich red-brown cherry, polished like a grand piano lid.',
    mat('Cherry Wood', {
      diffuseColor: hex('#7a2e1a'),
      diffusion: 78,
      ambience: 6,
      specularity: 70,
      specularHalo: 80,
      reflection: 12,
      components: [
        comp({ type: 'marble', mapping: 'object', scale: 0.08, octaves: 3, roughness: 0.4, warp: 0.25, contrast: 0.5, seed: 9,
          gradient: grad([0, '#4e1a0e'], [0.5, '#7a2e1a'], [1, '#a4502e']) }),
      ],
      drivers: { diffuseColor: 0 },
    })),
  p('tree-bark', 'Tree Bark', 'Deeply furrowed bark, rough enough to climb.',
    mat('Tree Bark', {
      diffuseColor: hex('#4a3828'),
      diffusion: 88,
      ambience: 6,
      specularity: 4,
      specularHalo: 20,
      bumpHeight: 70,
      components: [
        comp({ type: 'ridged', mapping: 'object', scale: 0.3, octaves: 5, roughness: 0.5, warp: 0.5, contrast: 0.6, seed: 13, bump: -1,
          gradient: grad([0, '#2a1e14'], [0.5, '#4e3a28'], [1, '#7a6650']) }),
      ],
      drivers: { diffuseColor: 0, bumpHeight: 0 },
    })),
  p('birch-bark', 'Birch Bark', 'Papery white birch marked with dark horizontal scars.',
    mat('Birch Bark', {
      diffuseColor: hex('#e8e4da'),
      diffusion: 85,
      ambience: 10,
      specularity: 8,
      specularHalo: 30,
      bumpHeight: 15,
      components: [
        comp({ type: 'strata', mapping: 'object', scale: 0.07, octaves: 2, roughness: 0.5, warp: 0.15, contrast: 0.5, seed: 17, bump: -0.5,
          gradient: grad([0, '#2a2420'], [0.12, '#6e685e'], [0.2, '#e2ddd2'], [1, '#f7f4ee']) }),
      ],
      drivers: { diffuseColor: 0, bumpHeight: 0 },
    })),
  p('driftwood', 'Driftwood', 'Sun-bleached driftwood, silvered and swirled by the sea.',
    mat('Driftwood', {
      diffuseColor: hex('#a8a296'),
      diffusion: 88,
      ambience: 9,
      specularity: 8,
      specularHalo: 30,
      bumpHeight: 18,
      components: [
        comp({ type: 'strata', mapping: 'object', scale: 0.12, octaves: 4, roughness: 0.5, warp: 0.6, contrast: 0.55, seed: 21, bump: 0.6,
          gradient: grad([0, '#6e685e'], [0.5, '#a39d90'], [1, '#d2cdc2']) }),
      ],
      drivers: { diffuseColor: 0, bumpHeight: 0 },
    })),
  p('summer-leaves', 'Summer Leaves', 'Sun-dappled clusters of bright summer leaves.', treeMaterial()),
  p('autumn-leaves', 'Autumn Leaves', 'A blaze of maple-red, pumpkin and gold foliage.',
    mat('Autumn Leaves', {
      diffuseColor: hex('#c0501e'),
      diffusion: 85,
      ambience: 9,
      specularity: 10,
      specularHalo: 30,
      bumpHeight: 30,
      components: [leaves(29, grad([0, '#f4c03a'], [0.35, '#e0701e'], [0.7, '#a8281a'], [1, '#4a1408']))],
      drivers: { diffuseColor: 0, bumpHeight: 0 },
    })),
  p('pine-needles', 'Pine Needles', 'Dark evergreen needles, cool and resinous.',
    mat('Pine Needles', {
      diffuseColor: hex('#1e3a22'),
      diffusion: 85,
      ambience: 6,
      specularity: 10,
      specularHalo: 30,
      bumpHeight: 35,
      components: [
        comp({ type: 'granite', mapping: 'object', scale: 0.1, octaves: 3, roughness: 0.5, contrast: 0.6, seed: 33, bump: 0.8,
          gradient: grad([0, '#0e1e10'], [0.5, '#1f3d24'], [1, '#4a6e3a']) }),
      ],
      drivers: { diffuseColor: 0, bumpHeight: 0 },
    })),
  p('velvet-moss', 'Velvet Moss', 'Thick, velvety moss, soft as a cushion.',
    mat('Velvet Moss', {
      diffuseColor: hex('#4c7a26'),
      diffusion: 90,
      ambience: 10,
      specularity: 4,
      specularHalo: 15,
      bumpHeight: 25,
      components: [
        comp({ type: 'fbm', mapping: 'object', scale: 0.25, octaves: 6, roughness: 0.6, warp: 0.3, contrast: 0.55, seed: 37,
          gradient: grad([0, '#2a4a14'], [0.5, '#4c7a26'], [1, '#86b03e']) }),
        comp({ type: 'granite', mapping: 'object', scale: 0.05, octaves: 2, seed: 38, bump: 0.7 }),
      ],
      drivers: { diffuseColor: 0, bumpHeight: 1 },
    })),
];
