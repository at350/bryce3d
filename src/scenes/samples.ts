/** The sample scene gallery (File > Sample Scenes, the Scenes library). */
import type { Scene } from '@/core/types';
import { createDefaultScene } from './defaultScene';
import { alienFloatingWorlds, chromeSphereLagoon, frozenFjord, monolithSea, tangerineTide, tropicalCove } from './gallery/seas';
import { cosmicChess, lavaPlanet, orbitalGarden, vaporwaveGrid } from './gallery/alien';
import { canyonRiver, desertPyramids, moonlitPeaks } from './gallery/lands';
import { eyeballMeadow, glassOrbsCheckerboard, oracleRuins } from './gallery/classics';

export interface SampleScene {
  id: string;
  name: string;
  description: string;
  build: () => Scene;
  /** Gallery section in the Scenes library. */
  category?: string;
}

export const SCENE_CATEGORIES: string[] = ['Seas & Islands', 'Alien Worlds', 'Lands', 'Classics & Surreal'];

export const SAMPLE_SCENES: SampleScene[] = [
  {
    id: 'first-light',
    name: 'First Light',
    category: 'Seas & Islands',
    description: 'The startup poster: a snow-capped island, a chrome sphere over a violet sea and a grassy rock drifting toward the low sun.',
    build: () => ({ ...createDefaultScene(), name: 'First Light' }),
  },
  {
    id: 'monolith-sea',
    name: 'Monolith Sea',
    category: 'Seas & Islands',
    description: 'A black monolith rises from a choppy teal sea under a pink and teal sky. Silent, enormous, patient.',
    build: monolithSea,
  },
  {
    id: 'alien-floating-worlds',
    name: 'Alien Floating Worlds',
    category: 'Alien Worlds',
    description: 'Cobalt-blue dream: a giant glass sphere floats over jagged isles, a lilac dome sinks into the mirror sea and rocks drift overhead.',
    build: alienFloatingWorlds,
  },
  {
    id: 'chrome-sphere-lagoon',
    name: 'Chrome Sphere Lagoon',
    category: 'Seas & Islands',
    description: 'Turquoise shallows over white sand, rocky isles all around and chrome spheres hovering in the noon light.',
    build: chromeSphereLagoon,
  },
  {
    id: 'lava-planet',
    name: 'Lava Planet',
    category: 'Alien Worlds',
    description: 'A basalt volcano glowing from within, a sea of molten rock and a black mirror sphere hanging in the red haze.',
    build: lavaPlanet,
  },
  {
    id: 'canyon-river',
    name: 'Canyon River',
    category: 'Lands',
    description: 'From the rim of a terraced sandstone gorge, a jade river winds away into the golden afternoon.',
    build: canyonRiver,
  },
  {
    id: 'moonlit-peaks',
    name: 'Moonlit Peaks',
    category: 'Lands',
    description: 'Snowy alpine peaks under a full moon and a sky full of stars, mist pooling on a black lake.',
    build: moonlitPeaks,
  },
  {
    id: 'desert-pyramids',
    name: 'Desert Pyramids',
    category: 'Lands',
    description: 'Three sandstone pyramids on a golden plain, a gilded obelisk and a tiny palm oasis catching the low sun.',
    build: desertPyramids,
  },
  {
    id: 'glass-orbs-checkerboard',
    name: 'Glass Orbs & Checkerboard',
    category: 'Classics & Surreal',
    description: 'The ray tracer classic: glass, gold and mirror balls on an infinite checkerboard under a clear blue sky.',
    build: glassOrbsCheckerboard,
  },
  {
    id: 'tropical-cove',
    name: 'Tropical Cove',
    category: 'Seas & Islands',
    description: 'Purple crags, turquoise shallows and a far sandy shore: a love letter to the Bryce 2 box cover.',
    build: tropicalCove,
  },
  {
    id: 'eyeball-meadow',
    name: 'Eyeball Meadow',
    category: 'Classics & Surreal',
    description: 'A giant glossy eye rests in a summer meadow and watches you back. Its smaller cousins hide in the grass.',
    build: eyeballMeadow,
  },
  {
    id: 'frozen-fjord',
    name: 'Frozen Fjord',
    category: 'Seas & Islands',
    description: 'Still black water between towering ice walls; icebergs drift in the fog under a pale overcast sky.',
    build: frozenFjord,
  },
  {
    id: 'vaporwave-grid',
    name: 'Vaporwave Grid',
    category: 'Alien Worlds',
    description: 'An endless neon grid runs toward a huge pink sun. Chrome pyramids, a mirror orb and palm silhouettes. Very 1994.',
    build: vaporwaveGrid,
  },
  {
    id: 'cosmic-chess',
    name: 'Cosmic Chess',
    category: 'Alien Worlds',
    description: 'A chessboard adrift among the stars, mid-game, with a ringed ice giant looming on the horizon.',
    build: cosmicChess,
  },
  {
    id: 'orbital-garden',
    name: 'Orbital Garden',
    category: 'Alien Worlds',
    description: 'A chrome ring cradles a gilded crystal inside a glass moon while satellites orbit over a pastel sea.',
    build: orbitalGarden,
  },
  {
    id: 'tangerine-tide',
    name: 'Tangerine Tide',
    category: 'Seas & Islands',
    description: 'Glossy tangerine spheres skip across a summer sea, smaller and smaller toward the horizon.',
    build: tangerineTide,
  },
  {
    id: 'oracle-ruins',
    name: 'Oracle Ruins',
    category: 'Classics & Surreal',
    description: 'A golden oracle orb hovers over frosted marble ruins; amethyst crystals and green blades break the snow.',
    build: oracleRuins,
  },
];

export function getSampleScene(id: string): SampleScene | undefined {
  return SAMPLE_SCENES.find((s) => s.id === id);
}
