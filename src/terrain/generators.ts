/** Generator registry: ids, labels, hints, parameter specs and the dice. */
import { genCanyons, genCraters, genDunes, genMesas, genMosaic, genMounds, genSpikes } from './genFeatures';
import { genEroded, genFractal, genHills, genIslands, genRidged, genTerraces, genVolcano } from './genMountains';
import { clampHeightsInPlace } from './grid';
import { resolveParams, type ParamSpec, type Params } from './params';
import { mulberry32, subSeed } from './rng';

export interface GeneratorParamSpec extends ParamSpec {
  /** Range the dice picks from (absent = keep the default). */
  random?: [number, number];
}

export interface GeneratorDef {
  id: string;
  label: string;
  /** One line for the hint bar. */
  hint: string;
  /** Stable numeric code, used to reference a generator inside op params. Never reuse. */
  code: number;
  params: GeneratorParamSpec[];
  /** Noticeably slower (erosion); the editor runs it off the main thread with a busy state. */
  heavy?: boolean;
  run(seed: number, n: number, p: Params, onProgress?: (fraction: number) => void): Float32Array;
}

const freq = (d: number, random?: [number, number], max = 8): GeneratorParamSpec => ({
  key: 'frequency', label: 'Frequency', min: 0.5, max, default: d, precision: 1, random,
  hint: 'How many features fit across the terrain',
});
const rough = (d: number, random?: [number, number]): GeneratorParamSpec => ({
  key: 'roughness', label: 'Roughness', min: 0.2, max: 0.8, default: d, precision: 2, random,
  hint: 'How much fine detail each octave keeps',
});
const island = (d: number): GeneratorParamSpec => ({
  key: 'island', label: 'Island', min: 0, max: 1, default: d, precision: 2,
  hint: 'Fade the edges down to sea level',
});
const height = (d: number): GeneratorParamSpec => ({
  key: 'height', label: 'Height', min: 0.1, max: 1, default: d, precision: 2, hint: 'Overall height of the landform',
});

export const GENERATOR_DEFS: GeneratorDef[] = [
  {
    id: 'fractal', code: 1, label: 'Fractal', hint: 'Classic fractal mountain island: peaks, valleys and a wandering coast',
    params: [
      freq(2.2, [1.7, 3]), rough(0.5, [0.42, 0.6]),
      { key: 'octaves', label: 'Detail', min: 1, max: 10, default: 8, step: 1, hint: 'Number of noise octaves' },
      { key: 'warp', label: 'Warp', min: 0, max: 1, default: 0.35, precision: 2, random: [0.15, 0.6], hint: 'Swirl the noise for more organic shapes' },
      { key: 'ridges', label: 'Ridges', min: 0, max: 1, default: 0.3, precision: 2, random: [0.1, 0.55], hint: 'Blend in sharp ridgelines' },
      island(1),
      { key: 'sharpness', label: 'Sharpness', min: 0.5, max: 2.5, default: 1.25, precision: 2, random: [1, 1.6], hint: 'Sharper peaks and broader valleys' },
    ],
    run: genFractal,
  },
  {
    id: 'ridged', code: 2, label: 'Rugged', hint: 'Ridged multifractal peaks with knife-edge crests',
    params: [
      freq(1.7, [1.3, 2.4]), rough(0.55, [0.45, 0.65]),
      { key: 'octaves', label: 'Detail', min: 1, max: 10, default: 9, step: 1, hint: 'Number of noise octaves' },
      { key: 'warp', label: 'Warp', min: 0, max: 1, default: 0.3, precision: 2, random: [0.1, 0.5], hint: 'Swirl the ridges' },
      island(0.9),
      { key: 'sharpness', label: 'Sharpness', min: 0.5, max: 2.5, default: 1.15, precision: 2, random: [0.9, 1.5], hint: 'Sharper peaks' },
    ],
    run: genRidged,
  },
  {
    id: 'hills', code: 3, label: 'Rolling Hills', hint: 'Soft, low, grassy hills',
    params: [freq(1.5, [1.1, 2.2], 5), rough(0.38, [0.3, 0.45]), island(0.6), height(0.5)],
    run: genHills,
  },
  {
    id: 'canyons', code: 4, label: 'Canyons', hint: 'Plateau cut by winding river canyons with layered walls',
    params: [
      freq(1.4, [1, 2], 5),
      { key: 'width', label: 'Width', min: 0.03, max: 0.4, default: 0.14, precision: 2, random: [0.09, 0.2], hint: 'Canyon width' },
      { key: 'depth', label: 'Depth', min: 0.1, max: 1, default: 0.75, precision: 2, random: [0.6, 0.9], hint: 'How deep the rivers cut' },
      { key: 'layers', label: 'Layers', min: 1, max: 12, default: 5, step: 1, random: [3, 7], hint: 'Stair-stepped rock strata in the walls' },
      { key: 'wander', label: 'Wander', min: 0, max: 1.5, default: 0.6, precision: 2, random: [0.3, 1], hint: 'How much the rivers meander' },
    ],
    run: genCanyons,
  },
  {
    id: 'mesas', code: 5, label: 'Mesas', hint: 'Flat-topped buttes and subplateaus over a desert floor',
    params: [
      freq(1.6, [1.2, 2.4], 6),
      { key: 'level', label: 'Level', min: 0.3, max: 0.75, default: 0.52, precision: 2, random: [0.47, 0.58], hint: 'Where the cliffs start (higher = fewer mesas)' },
      { key: 'tiers', label: 'Tiers', min: 1, max: 4, default: 2, step: 1, random: [1, 3], hint: 'Number of stacked plateaus' },
      { key: 'cliff', label: 'Cliff', min: 0.005, max: 0.15, default: 0.035, precision: 3, random: [0.02, 0.05], hint: 'Cliff softness (lower = sheerer)' },
      height(0.8),
    ],
    run: genMesas,
  },
  {
    id: 'volcano', code: 6, label: 'Volcano', hint: 'Lone cone with a summit crater and lava gullies',
    params: [
      { key: 'radius', label: 'Radius', min: 0.3, max: 1.2, default: 0.85, precision: 2, random: [0.7, 1], hint: 'Base radius of the cone' },
      { key: 'crater', label: 'Crater', min: 0.05, max: 0.5, default: 0.18, precision: 2, random: [0.12, 0.26], hint: 'Crater radius' },
      { key: 'depth', label: 'Crater depth', min: 0, max: 0.6, default: 0.22, precision: 2, random: [0.12, 0.3], hint: 'Crater depth' },
      { key: 'ruggedness', label: 'Ruggedness', min: 0, max: 1.5, default: 0.6, precision: 2, random: [0.35, 0.9], hint: 'Gullies and rough flanks' },
      height(1),
    ],
    run: genVolcano,
  },
  {
    id: 'islands', code: 7, label: 'Archipelago', hint: 'A scatter of islands in a shallow sea',
    params: [
      freq(3.2, [2.6, 4]),
      { key: 'sea', label: 'Sea level', min: 0.2, max: 0.85, default: 0.55, precision: 2, random: [0.5, 0.62], hint: 'Higher sea = smaller islands' },
      { key: 'spread', label: 'Spread', min: 0, max: 1, default: 0.75, precision: 2, random: [0.5, 1], hint: 'How far the islands spread toward the edges' },
    ],
    run: genIslands,
  },
  {
    id: 'dunes', code: 8, label: 'Dunes', hint: 'Wind-blown sand ridges with steep slip faces',
    params: [
      freq(4.5, [3.2, 6], 16),
      { key: 'angle', label: 'Wind', min: 0, max: 180, default: 35, step: 1, random: [0, 180], hint: 'Wind direction in degrees' },
      { key: 'asymmetry', label: 'Asymmetry', min: 0.5, max: 0.95, default: 0.75, precision: 2, random: [0.65, 0.85], hint: 'Gentle windward slope vs steep lee face' },
      { key: 'chaos', label: 'Chaos', min: 0, max: 1.5, default: 0.55, precision: 2, random: [0.3, 0.9], hint: 'How much the crests wander and break' },
      height(0.45),
    ],
    run: genDunes,
  },
  {
    id: 'craters', code: 9, label: 'Craters', hint: 'Moonscape peppered with impact craters',
    params: [
      { key: 'count', label: 'Count', min: 1, max: 300, default: 70, step: 1, random: [40, 120], hint: 'Number of impacts' },
      { key: 'size', label: 'Size', min: 0.05, max: 0.6, default: 0.32, precision: 2, random: [0.22, 0.42], hint: 'Largest crater radius' },
      { key: 'depth', label: 'Depth', min: 0.1, max: 1.5, default: 0.6, precision: 2, random: [0.45, 0.8], hint: 'Crater depth' },
      height(0.6),
    ],
    run: genCraters,
  },
  {
    id: 'spikes', code: 10, label: 'Spikes', hint: 'A forest of sharp needles and crystal spires',
    params: [
      freq(9, [6, 13], 32),
      { key: 'sharpness', label: 'Sharpness', min: 1, max: 6, default: 2.4, precision: 1, random: [1.8, 3.2], hint: 'Needle sharpness' },
      { key: 'coverage', label: 'Coverage', min: 0.1, max: 1, default: 0.75, precision: 2, random: [0.55, 0.9], hint: 'Fraction of cells with a spike' },
      island(0.7), height(1),
    ],
    run: genSpikes,
  },
  {
    id: 'mounds', code: 11, label: 'Mounds', hint: 'Rounded boulders and domes',
    params: [
      freq(5, [3.5, 7], 20),
      { key: 'coverage', label: 'Coverage', min: 0.1, max: 1, default: 0.8, precision: 2, random: [0.6, 0.95], hint: 'Fraction of cells with a mound' },
      island(0.6), height(0.7),
    ],
    run: genMounds,
  },
  {
    id: 'terraces', code: 12, label: 'Terraces', hint: 'Stepped hillsides, like rice paddies',
    params: [
      freq(1.8, [1.4, 2.4], 5), rough(0.45, [0.4, 0.55]),
      { key: 'steps', label: 'Steps', min: 2, max: 30, default: 10, step: 1, random: [6, 14], hint: 'Number of terraces' },
      { key: 'flatness', label: 'Flatness', min: 0.05, max: 0.97, default: 0.7, precision: 2, random: [0.55, 0.85], hint: 'Share of each step that is flat' },
      island(1),
    ],
    run: genTerraces,
  },
  {
    id: 'mosaic', code: 13, label: 'Mosaic', hint: 'Flat-topped cell tiles, like basalt columns',
    params: [
      freq(10, [7, 14], 40),
      { key: 'variation', label: 'Variation', min: 0, max: 1, default: 0.35, precision: 2, random: [0.2, 0.5], hint: 'Random height jitter between cells' },
      { key: 'gap', label: 'Cracks', min: 0.005, max: 0.3, default: 0.06, precision: 3, random: [0.04, 0.09], hint: 'Width of the cracks between cells' },
      { key: 'jitter', label: 'Jitter', min: 0, max: 1, default: 0.85, precision: 2, hint: '0 = square tiles, 1 = irregular cells' },
      island(0.8),
    ],
    run: genMosaic,
  },
  {
    id: 'eroded', code: 14, label: 'Eroded', hint: 'Alpine range weathered by centuries of rain', heavy: true,
    params: [
      freq(2, [1.6, 2.6]), rough(0.5, [0.45, 0.58]),
      { key: 'erosion', label: 'Erosion', min: 0, max: 3, default: 1, precision: 2, random: [0.8, 1.3], hint: 'Amount of rain (droplets per cell)' },
      island(1),
    ],
    run: genEroded,
  },
];

/** "New": a flat canvas (not listed among the generator buttons). */
export const FLAT_GENERATOR: GeneratorDef = {
  id: 'flat', code: 0, label: 'New', hint: 'Start over from a flat, empty canvas',
  params: [{ key: 'level', label: 'Level', min: 0, max: 1, default: 0, precision: 2, hint: 'Height of the flat canvas' }],
  run: (_seed, n, p) => new Float32Array(n * n).fill(p.level),
};

const RANDOM_WEIGHTS: Record<string, number> = {
  fractal: 3, ridged: 3, eroded: 1.4, volcano: 1.5, islands: 2, canyons: 1.5, mesas: 1.5, terraces: 1,
  dunes: 1, craters: 1, hills: 1, spikes: 0.5, mounds: 0.6, mosaic: 0.6,
};

const byId = new Map<string, GeneratorDef>([...GENERATOR_DEFS, FLAT_GENERATOR].map((g) => [g.id, g]));
const byCode = new Map<number, GeneratorDef>([...GENERATOR_DEFS, FLAT_GENERATOR].map((g) => [g.code, g]));

export const getGenerator = (id: string): GeneratorDef | undefined => byId.get(id);
export const generatorByCode = (code: number): GeneratorDef | undefined => byCode.get(Math.round(code));

/** The dice: a generator and pleasing parameters, picked deterministically from a seed. */
export function resolveRandomGenerator(seed: number): { generator: string; params: Params } {
  const rnd = mulberry32(subSeed(seed, 0x51ce));
  const total = GENERATOR_DEFS.reduce((s, g) => s + (RANDOM_WEIGHTS[g.id] ?? 1), 0);
  let pick = rnd() * total;
  let def = GENERATOR_DEFS[0];
  for (const g of GENERATOR_DEFS) {
    pick -= RANDOM_WEIGHTS[g.id] ?? 1;
    if (pick <= 0) {
      def = g;
      break;
    }
  }
  const params: Params = {};
  for (const s of def.params) {
    if (!s.random) continue;
    const v = s.random[0] + (s.random[1] - s.random[0]) * rnd();
    params[s.key] = s.step === 1 ? Math.round(v) : Math.round(v * 1000) / 1000;
  }
  return { generator: def.id, params };
}

/** Run a generator by id ('random' resolves through the dice; unknown ids fall back to fractal). */
export function runGenerator(
  id: string,
  seed: number,
  n: number,
  params: Params | undefined,
  onProgress?: (fraction: number) => void,
): Float32Array {
  const size = Math.max(1, Math.round(n));
  if (size < 2) return new Float32Array(size * size);
  let def = byId.get(id);
  let given = params;
  if (id === 'random') {
    const r = resolveRandomGenerator(seed);
    def = byId.get(r.generator);
    given = { ...r.params, ...params };
  }
  def ??= GENERATOR_DEFS[0];
  const out = def.run(seed >>> 0, size, resolveParams(def.params, given), onProgress);
  return clampHeightsInPlace(out);
}
