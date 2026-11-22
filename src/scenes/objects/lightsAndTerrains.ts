/** Lights presets (ready-lit props) and Terrain presets (shaped landforms with materials). */
import { mulberry32 } from '@/core/math';
import type { SceneObject } from '@/core/types';
import { FAMILY, make, terrainBox } from '../build/kit';
import * as M from '../build/materials';
import { VOLCANO_POOL_LEVEL, terrain, volcanoCone } from '../build/terrains';
import { aimDown, lampPost } from './parts';
import type { ObjectPreset } from './types';

function spotStage(): SceneObject[] {
  const out: SceneObject[] = [
    make('cylinder', { name: 'Stage', at: [0, 0.3, 0], size: [5, 0.3, 5], material: M.gloss([0.12, 0.1, 0.14], 'Stage Lacquer'), family: FAMILY.gray }),
    make('sphere', { name: 'Star Performer', at: [0, 2.1, 0], size: 1.5, material: M.chrome(), family: FAMILY.blue }),
  ];
  const colors: [number, number, number][] = [[1, 0.35, 0.4], [0.35, 0.6, 1], [1, 0.85, 0.4]];
  colors.forEach((color, i) => {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const x = Math.sin(a) * 7;
    const z = Math.cos(a) * 7;
    out.push(
      make('spotLight', {
        name: `Spotlight ${i + 1}`,
        at: [x, 9, z],
        size: 0.6,
        rot: aimDown([x, 9, z], [0, 1.5, 0]),
        family: FAMILY.amber,
        light: { color, intensity: 220, coneAngle: 40, softness: 0.35, falloff: 'linear' },
      }),
    );
  });
  return out;
}

function campfire(): SceneObject[] {
  const rand = mulberry32(5);
  const out: SceneObject[] = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const s = 0.4 + rand() * 0.15;
    return make('stone', { name: `Hearth Stone ${i + 1}`, at: [Math.sin(a) * 1.6, s * 0.8, Math.cos(a) * 1.6], size: [s, s * 0.8, s], family: FAMILY.gray, stone: { seed: 600 + i }, material: M.granite([0.42, 0.4, 0.38]) });
  });
  out.push(
    make('cylinder', { name: 'Log', at: [0, 0.3, 0], size: [0.22, 1.1, 0.22], rot: [90, 0, 30], material: M.matte([0.3, 0.18, 0.1], 'Charred Wood'), family: FAMILY.brown }),
    make('cylinder', { name: 'Log', at: [0, 0.3, 0], size: [0.22, 1.1, 0.22], rot: [90, 0, -40], material: M.matte([0.3, 0.18, 0.1], 'Charred Wood'), family: FAMILY.brown }),
    make('cone', { name: 'Flame', at: [0, 1.05, 0], size: [0.55, 0.75, 0.55], material: M.glow([1, 0.55, 0.12], 'Flame'), family: FAMILY.amber }),
    make('cone', { name: 'Flame Tip', at: [0.15, 1.35, 0.1], size: [0.3, 0.6, 0.3], material: M.glow([1, 0.85, 0.35], 'Flame Core'), family: FAMILY.amber }),
    make('radialLight', { name: 'Fire Light', at: [0, 2.4, 0], size: 0.3, family: FAMILY.amber, light: { color: [1, 0.6, 0.25], intensity: 40, falloff: 'squared', visible: false } }),
  );
  return out;
}

function fireflies(): SceneObject[] {
  const rand = mulberry32(31);
  return Array.from({ length: 8 }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const d = rand() * 5;
    return make('radialLight', {
      name: `Firefly ${i + 1}`,
      at: [Math.sin(a) * d, 1 + rand() * 3, Math.cos(a) * d],
      size: 0.12,
      family: FAMILY.amber,
      light: { color: [0.85, 1, 0.45], intensity: 4, falloff: 'squared', visible: true, castShadows: false },
    });
  });
}

function volcano(): SceneObject[] {
  const box = terrainBox([0, 0], 0, 14, 11);
  return [
    make('terrain', { name: 'Volcano', ...box, family: FAMILY.brown, material: M.lavaRock(), terrain: volcanoCone(19, 128) }),
    make('disc', { name: 'Lava Pool', at: [0, 11 * VOLCANO_POOL_LEVEL, 0], size: [2.2, 1, 2.2], material: M.moltenLava(), family: FAMILY.amber }),
    make('radialLight', { name: 'Crater Glow', at: [0, 11 * VOLCANO_POOL_LEVEL + 2.2, 0], size: 0.4, family: FAMILY.amber, light: { color: [1, 0.45, 0.15], intensity: 120, falloff: 'linear', visible: false } }),
  ];
}

export const LIGHTS: ObjectPreset[] = [
  {
    id: 'lamp-post',
    name: 'Lamp Post',
    category: 'Lights',
    description: 'A wrought-iron street lamp with a warm, glowing lantern that lights the ground around it.',
    build: () => lampPost(),
    preview: { night: true },
  },
  {
    id: 'spotlit-stage',
    name: 'Spotlit Stage',
    category: 'Lights',
    description: 'A round stage, a chrome star and three colored spotlights aimed at center stage.',
    build: spotStage,
    preview: { night: true, elevation: 35 },
  },
  {
    id: 'campfire',
    name: 'Campfire',
    category: 'Lights',
    description: 'A ring of hearth stones, crossed logs, glowing flames and a flickering orange light.',
    build: campfire,
    preview: { night: true },
  },
  {
    id: 'fireflies',
    name: 'Fireflies',
    category: 'Lights',
    description: 'Eight tiny visible lights drifting at knee height. Magic for dusk scenes.',
    build: fireflies,
    preview: { night: true },
  },
];

export const TERRAINS: ObjectPreset[] = [
  {
    id: 'canyon-block',
    name: 'Canyon Block',
    category: 'Terrains',
    description: 'A slab of layered sandstone cut by a winding river gorge with stepped walls.',
    build: () => [make('terrain', { name: 'Canyon', ...terrainBox([0, 0], 0, 16, 9), family: FAMILY.brown, material: M.canyonStrata(), terrain: terrain({ kind: 'canyon', seed: 12 }) })],
  },
  {
    id: 'volcano',
    name: 'Volcano',
    category: 'Terrains',
    description: 'A basalt cone with glowing cracks and a pool of molten lava in its crater.',
    build: volcano,
  },
  {
    id: 'archipelago',
    name: 'Archipelago',
    category: 'Terrains',
    description: 'A scatter of rocky islets. Raise a water plane through it to taste.',
    build: () => [make('terrain', { name: 'Archipelago', ...terrainBox([0, 0], 0, 22, 5), family: FAMILY.brown, material: M.islandRock(), terrain: terrain({ kind: 'islands', seed: 808 }) })],
  },
  {
    id: 'snowy-peak',
    name: 'Snowy Peak',
    category: 'Terrains',
    description: 'A rugged fractal mountain with snow on every ledge above the tree line.',
    build: () => [make('terrain', { name: 'Snowy Peak', ...terrainBox([0, 0], 0, 16, 14), family: FAMILY.brown, material: M.snowyRock(), terrain: terrain({ kind: 'alpine', seed: 1234 }) })],
  },
  {
    id: 'dune-sea',
    name: 'Dune Sea',
    category: 'Terrains',
    description: 'Soft wind-sculpted dunes in warm desert sand.',
    build: () => [make('terrain', { name: 'Dunes', ...terrainBox([0, 0], 0, 20, 3), family: FAMILY.amber, material: M.desertSand(), terrain: terrain({ kind: 'dunes', seed: 55 }) })],
  },
  {
    id: 'mesa',
    name: 'Mesa',
    category: 'Terrains',
    description: 'A flat-topped butte in banded canyon rock, straight out of a western.',
    build: () => [make('terrain', { name: 'Mesa', ...terrainBox([0, 0], 0, 14, 8), family: FAMILY.brown, material: M.canyonStrata(), terrain: terrain({ kind: 'mesa', seed: 71, clipHigh: 0.78 }) })],
  },
];
