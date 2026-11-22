/**
 * The Skies preset library: original skies in Bryce's spirit (no original Bryce preset
 * data). Sun azimuths assume Bryce's convention (0 = straight ahead of the default
 * camera). Skies whose sun or moon is the subject set linkSunToView so the light stays
 * in frame from any camera.
 */
import { mulberry32 } from '@/core/math';
import type { CloudLayer, RGB, Sky } from '@/core/types';
import { hex } from './color';
import { defaultCumulus, defaultSky, defaultStratus } from './defaults';

export interface SkyPreset {
  id: string;
  name: string;
  category: string;
  description?: string;
  sky: Sky;
}

export const SKY_CATEGORIES: string[] = ['Daytime', 'Sunsets & Sunrises', 'Night', 'Weather', 'Alien & Surreal', '90s CD Covers', 'Studio'];

type CloudSpec = Partial<CloudLayer> | false;

/** What a preset must decide explicitly; everything else falls back to the default sky. */
interface SkySpec extends Partial<Omit<Sky, 'stratus' | 'cumulus'>> {
  mode: Sky['mode'];
  horizonColor: RGB;
  zenithColor: RGB;
  skyDomeColor: RGB;
  sunColor: RGB;
  sunAzimuth: number;
  sunAltitude: number;
  haze: number;
  hazeColor: RGB;
  shadowIntensity: number;
  ambient: number;
  ambientColor: RGB;
  stratus: CloudSpec;
  cumulus: CloudSpec;
}

function idSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Each preset gets its own patch of the cloud field unless it picks an offset. */
function autoOffset(seed: number): [number, number] {
  const r = mulberry32(seed);
  return [Math.round((r() - 0.5) * 8000), Math.round((r() - 0.5) * 8000)];
}

function layer(base: CloudLayer, spec: CloudSpec, seed: number): CloudLayer {
  if (spec === false) return { ...base, enabled: false, offset: autoOffset(seed) };
  return { ...base, offset: autoOffset(seed), ...spec, enabled: spec.enabled ?? true };
}

function preset(id: string, name: string, category: string, description: string, spec: SkySpec): SkyPreset {
  const seed = idSeed(id);
  const { stratus, cumulus, ...rest } = spec;
  const sky: Sky = {
    ...defaultSky(),
    ...rest,
    stratus: layer(defaultStratus(), stratus, seed),
    cumulus: layer(defaultCumulus(), cumulus, seed ^ 0x5bd1e995),
  };
  return { id, name, category, description, sky };
}

const DAY = 'Daytime';
const DUSK = 'Sunsets & Sunrises';
const NIGHT = 'Night';
const WEATHER = 'Weather';
const ALIEN = 'Alien & Surreal';
const CD = '90s CD Covers';
const STUDIO = 'Studio';

export const SKY_PRESETS: SkyPreset[] = [
  // --- Daytime --------------------------------------------------------------
  preset('soft-daylight', 'Soft Daylight', DAY,
    'The gentle everyday sky: powder blue overhead, milky at the horizon, a scatter of fair-weather puffs drifting by.', {
      mode: 'soft',
      horizonColor: hex('#cddbee'), zenithColor: hex('#3a6cc8'), skyDomeColor: hex('#9cb8e6'),
      sunColor: hex('#fff5e2'), sunSize: 30, sunGlow: 35, sunAzimuth: 215, sunAltitude: 40,
      haze: 18, hazeColor: hex('#dae2f0'),
      shadowIntensity: 72, ambient: 32, ambientColor: hex('#9db2d8'),
      stratus: { cover: 18, height: 1900, frequency: 55, amplitude: 55, shading: 0.2 },
      cumulus: { cover: 34, height: 700, frequency: 125, amplitude: 170, shading: 0.6 },
    }),
  preset('deep-blue-noon', 'Deep Blue Noon', DAY,
    'High summer sun straight overhead, a sky so blue it looks painted on, and crisp inky shadows.', {
      mode: 'darker',
      horizonColor: hex('#a6caee'), zenithColor: hex('#2a5ec4'), skyDomeColor: hex('#5c88d8'),
      sunColor: hex('#fff9ec'), sunSize: 22, sunGlow: 24, sunAzimuth: 165, sunAltitude: 72,
      haze: 8, hazeColor: hex('#c6daf2'),
      shadowIntensity: 88, ambient: 22, ambientColor: hex('#7c9cd8'),
      stratus: false,
      cumulus: { cover: 24, height: 800, frequency: 185, amplitude: 230, shading: 0.65 },
    }),
  preset('high-altitude-cobalt', 'High-Altitude Cobalt', DAY,
    'The thin air of a mountain summit: cobalt deepening to violet overhead, a razor-sharp sun and almost no haze.', {
      mode: 'custom',
      horizonColor: hex('#78aceb'), zenithColor: hex('#0b1f70'), skyDomeColor: hex('#3a64cc'),
      sunColor: hex('#ffffff'), sunSize: 14, sunGlow: 18, sunAzimuth: 200, sunAltitude: 55,
      haze: 4, hazeColor: hex('#a8c8f0'),
      shadowIntensity: 92, ambient: 18, ambientColor: hex('#5a78c8'),
      stratus: { cover: 8, height: 2800, frequency: 40, amplitude: 40, shading: 0.1 },
      cumulus: false,
    }),
  preset('fair-weather-puffs', 'Fair-Weather Puffs', DAY,
    'Cotton-ball cumulus marching across a friendly blue sky. The picnic-poster classic.', {
      mode: 'soft',
      horizonColor: hex('#d2e2f2'), zenithColor: hex('#2f68c8'), skyDomeColor: hex('#8cb2e8'),
      sunColor: hex('#fff6e6'), sunSize: 28, sunGlow: 30, sunAzimuth: 140, sunAltitude: 50,
      haze: 14, hazeColor: hex('#dfe8f4'),
      shadowIntensity: 75, ambient: 32, ambientColor: hex('#a0b8de'),
      stratus: false,
      cumulus: { cover: 48, height: 650, frequency: 150, amplitude: 260, shading: 0.7 },
    }),
  preset('lazy-summer-haze', 'Lazy Summer Haze', DAY,
    'A muggy August afternoon: warm milky haze swallows the horizon and the light goes soft and golden.', {
      mode: 'soft',
      horizonColor: hex('#e8e2d2'), zenithColor: hex('#5a86c4'), skyDomeColor: hex('#c8c4b4'),
      sunColor: hex('#fff0d2'), sunSize: 34, sunGlow: 55, sunAzimuth: 200, sunAltitude: 46,
      haze: 46, hazeColor: hex('#eadcc0'),
      fogDensity: 8, fogHeight: 6, fogColor: hex('#e6dcc6'),
      shadowIntensity: 58, ambient: 42, ambientColor: hex('#d8c8a8'),
      stratus: { cover: 30, height: 2000, frequency: 40, amplitude: 50, shading: 0.15, color: hex('#fff8ea') },
      cumulus: false,
    }),
  preset('mackerel-sky', 'Mackerel Sky', DAY,
    'Rows of tiny high cloudlets like fish scales, the old sailor\'s sign that the weather is about to turn.', {
      mode: 'custom',
      horizonColor: hex('#bad4ee'), zenithColor: hex('#2e64c2'), skyDomeColor: hex('#7aa4e0'),
      sunColor: hex('#fff4e0'), sunSize: 26, sunGlow: 40, sunAzimuth: 230, sunAltitude: 35,
      haze: 15, hazeColor: hex('#d6e4f2'),
      shadowIntensity: 70, ambient: 32, ambientColor: hex('#98b2da'),
      stratus: { cover: 56, height: 2600, frequency: 320, amplitude: 140, shading: 0.35 },
      cumulus: false,
    }),
  preset('arctic-glare', 'Arctic Glare', DAY,
    'Low polar sun, blinding white haze and pale blue shadows on the snow. Bring sunglasses.', {
      mode: 'custom',
      horizonColor: hex('#f0f7fc'), zenithColor: hex('#7cb2e4'), skyDomeColor: hex('#cde4f6'),
      sunColor: hex('#fffdf4'), sunSize: 30, sunGlow: 70, sunAzimuth: 160, sunAltitude: 14,
      haze: 38, hazeColor: hex('#f4faff'),
      fogDensity: 15, fogHeight: 3, fogColor: hex('#eef6fb'),
      shadowIntensity: 55, ambient: 55, ambientColor: hex('#cfe2f5'),
      stratus: { cover: 34, height: 2200, frequency: 70, amplitude: 40, shading: 0.1, color: hex('#f6fbff') },
      cumulus: false,
    }),
  preset('tropical-afternoon', 'Tropical Afternoon', DAY,
    'Hot lagoon light: a turquoise horizon, towering white cumulus and deep blue straight overhead.', {
      mode: 'darker',
      horizonColor: hex('#b4eef2'), zenithColor: hex('#3a7ad0'), skyDomeColor: hex('#62b8d8'),
      sunColor: hex('#fffaf0'), sunSize: 26, sunGlow: 35, sunAzimuth: 120, sunAltitude: 60,
      haze: 20, hazeColor: hex('#cdeef0'),
      shadowIntensity: 80, ambient: 34, ambientColor: hex('#8ed0dc'),
      stratus: false,
      cumulus: { cover: 40, height: 900, frequency: 80, amplitude: 300, shading: 0.75 },
    }),
  preset('alpine-morning', 'Alpine Morning', DAY,
    'Crisp mountain air with a pool of morning fog still sleeping in the valleys.', {
      mode: 'custom',
      horizonColor: hex('#d8e6f2'), zenithColor: hex('#386ec0'), skyDomeColor: hex('#94b6e0'),
      sunColor: hex('#fff2dc'), sunSize: 28, sunGlow: 45, sunAzimuth: 120, sunAltitude: 22,
      haze: 12, hazeColor: hex('#e2ecf6'),
      fogDensity: 45, fogHeight: 5, fogColor: hex('#e9eef4'),
      shadowIntensity: 78, ambient: 28, ambientColor: hex('#9fb6da'),
      stratus: { cover: 20, height: 2400, frequency: 50, amplitude: 45, shading: 0.15 },
      cumulus: { cover: 16, height: 600, frequency: 140, amplitude: 200, shading: 0.6 },
    }),

  // --- Sunsets & Sunrises ---------------------------------------------------
  preset('golden-hour', 'Golden Hour', DUSK,
    'The hour photographers wait for: honeyed light, long shadows and clouds edged in gold.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ffc674'), zenithColor: hex('#3c5c9c'), skyDomeColor: hex('#eeb87a'),
      sunColor: hex('#ffd27c'), sunSize: 34, sunGlow: 62, sunAzimuth: 15, sunAltitude: 9,
      haze: 30, hazeColor: hex('#ffd9a2'),
      shadowIntensity: 70, ambient: 38, ambientColor: hex('#e6b88a'),
      stratus: { cover: 30, height: 2000, frequency: 50, amplitude: 60, shading: 0.3, color: hex('#ffe0b0') },
      cumulus: { cover: 20, height: 750, frequency: 120, amplitude: 180, shading: 0.55, color: hex('#ffd6a6') },
    }),
  preset('blood-red-sunset', 'Blood-Red Sunset', DUSK,
    'A swollen crimson sun sinking into smoke and streaked cloud. Dramatic, ominous, gloriously over the top.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ff3c14'), zenithColor: hex('#3a0a1e'), skyDomeColor: hex('#c2342a'),
      sunColor: hex('#ff5c22'), sunSize: 44, sunGlow: 80, sunAzimuth: 10, sunAltitude: 3,
      haze: 40, hazeColor: hex('#ff5c32'),
      fogDensity: 10, fogHeight: 2, fogColor: hex('#b03222'),
      moonColor: hex('#ffd0c0'),
      shadowIntensity: 80, ambient: 30, ambientColor: hex('#8c2c2c'),
      stratus: { cover: 40, height: 2200, frequency: 45, amplitude: 70, shading: 0.5, color: hex('#ff7052') },
      cumulus: { cover: 24, height: 800, frequency: 110, amplitude: 220, shading: 0.8, color: hex('#6a1a28') },
    }),
  preset('purple-dusk', 'Purple Dusk', DUSK,
    'The last minutes of twilight: violet overhead, a rose-pink horizon and the first stars pricking through.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#e270a2'), zenithColor: hex('#25104e'), skyDomeColor: hex('#7c4cb2'),
      sunColor: hex('#ff8ab2'), sunSize: 26, sunGlow: 70, sunAzimuth: 12, sunAltitude: 1,
      stars: 25, moonColor: hex('#f4e6ff'), moonPhase: 0.3,
      haze: 35, hazeColor: hex('#da82b2'),
      shadowIntensity: 60, ambient: 30, ambientColor: hex('#6c4c9c'),
      stratus: { cover: 34, height: 2100, frequency: 40, amplitude: 50, shading: 0.25, color: hex('#f2a2ca') },
      cumulus: false,
    }),
  preset('peach-dawn', 'Peach Dawn', DUSK,
    'A soft pastel sunrise: peach and powder blue, with a pink mist lifting off the water.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ffc2a2'), zenithColor: hex('#6a8cc8'), skyDomeColor: hex('#f2c8ba'),
      sunColor: hex('#fff0d2'), sunSize: 30, sunGlow: 55, sunAzimuth: 350, sunAltitude: 6,
      haze: 30, hazeColor: hex('#ffe2d2'),
      fogDensity: 35, fogHeight: 4, fogColor: hex('#f8dacb'),
      shadowIntensity: 55, ambient: 45, ambientColor: hex('#eec8c2'),
      stratus: { cover: 28, height: 1900, frequency: 55, amplitude: 45, shading: 0.15, color: hex('#ffe6da') },
      cumulus: false,
    }),
  preset('sunrise-over-the-sea', 'Sunrise Over the Sea', DUSK,
    'A soft-sky sunrise: drop the sun onto the horizon in front of you and let the atmosphere do the rest.', {
      mode: 'soft', linkSunToView: true,
      horizonColor: hex('#ffb272'), zenithColor: hex('#5a78b8'), skyDomeColor: hex('#e8b890'),
      sunColor: hex('#ffe0a8'), sunSize: 32, sunGlow: 65, sunAzimuth: 0, sunAltitude: 4,
      haze: 25, hazeColor: hex('#ffd2a2'),
      shadowIntensity: 68, ambient: 36, ambientColor: hex('#d8a888'),
      stratus: { cover: 22, height: 2100, frequency: 50, amplitude: 55, shading: 0.25, color: hex('#ffe2c4') },
      cumulus: { cover: 30, height: 650, frequency: 120, amplitude: 200, shading: 0.65, color: hex('#ffcaa2') },
    }),
  preset('ember-horizon', 'Ember Horizon', DUSK,
    'The sun has just slipped away; the horizon still smolders orange under a deep navy sky.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ff7c1c'), zenithColor: hex('#101830'), skyDomeColor: hex('#523252'),
      sunColor: hex('#ff6c12'), sunSize: 30, sunGlow: 90, sunAzimuth: 8, sunAltitude: -2,
      stars: 18, moonColor: hex('#ffe8d0'), moonPhase: 0.2,
      haze: 45, hazeColor: hex('#ff8c32'),
      shadowIntensity: 85, ambient: 18, ambientColor: hex('#5a3a4a'),
      stratus: { cover: 44, height: 2000, frequency: 38, amplitude: 90, shading: 0.9, color: hex('#3a1c2a') },
      cumulus: false,
    }),
  preset('wildfire-smoke', 'Wildfire Smoke', DUSK,
    'A tiny scarlet sun burning through brown smoke. Apocalyptic, and strangely beautiful.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ff9c2c'), zenithColor: hex('#5a3a2a'), skyDomeColor: hex('#c8784c'),
      sunColor: hex('#ff4212'), sunSize: 26, sunGlow: 40, sunAzimuth: 20, sunAltitude: 12,
      haze: 70, hazeColor: hex('#d07232'),
      fogDensity: 15, fogHeight: 6, fogColor: hex('#a25c32'),
      shadowIntensity: 50, ambient: 40, ambientColor: hex('#b07242'),
      stratus: false,
      cumulus: false,
    }),
  preset('tangerine-dream', 'Tangerine Dream', DUSK,
    'Electric orange melting into magenta: a sunset with every dial turned all the way up.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ffb22c'), zenithColor: hex('#a0207c'), skyDomeColor: hex('#ff7c4c'),
      sunColor: hex('#fff2a2'), sunSize: 40, sunGlow: 75, sunAzimuth: 15, sunAltitude: 14,
      haze: 20, hazeColor: hex('#ffb262'),
      shadowIntensity: 70, ambient: 40, ambientColor: hex('#e27c5c'),
      stratus: { cover: 36, height: 2300, frequency: 35, amplitude: 80, shading: 0.3, color: hex('#ffd08c') },
      cumulus: { cover: 18, height: 800, frequency: 140, amplitude: 200, shading: 0.6, color: hex('#ff9c8c') },
    }),
  preset('lavender-morning', 'Lavender Morning', DUSK,
    'A hushed violet sunrise over still water; everything smells faintly of soap and possibility.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#f2c8e2'), zenithColor: hex('#5c62b4'), skyDomeColor: hex('#c2a8e0'),
      sunColor: hex('#fff2fa'), sunSize: 30, sunGlow: 60, sunAzimuth: 345, sunAltitude: 7,
      haze: 32, hazeColor: hex('#eed4ec'),
      fogDensity: 25, fogHeight: 3, fogColor: hex('#e2cce8'),
      shadowIntensity: 55, ambient: 42, ambientColor: hex('#b8a2d8'),
      stratus: { cover: 30, height: 2000, frequency: 45, amplitude: 55, shading: 0.2, color: hex('#fbe8f6') },
      cumulus: false,
    }),

  // --- Night ----------------------------------------------------------------
  preset('moonlit-night', 'Moonlit Night', NIGHT,
    'A full moon floods the land with silver-blue light; a few thin clouds catch its glow.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#1c2a52'), zenithColor: hex('#050a1e'), skyDomeColor: hex('#162242'),
      sunColor: hex('#fff4e0'), sunAzimuth: 195, sunAltitude: -16,
      moonColor: hex('#eef0ff'), moonSize: 34, moonPhase: 0.5, stars: 55,
      haze: 10, hazeColor: hex('#2a3a62'),
      shadowIntensity: 70, ambient: 22, ambientColor: hex('#3a4a7c'),
      stratus: { cover: 25, height: 1900, frequency: 50, amplitude: 50, shading: 0.4, color: hex('#8090b2') },
      cumulus: false,
    }),
  preset('starfield', 'Starfield', NIGHT,
    'A moonless desert night with the stars switched all the way on.', {
      mode: 'custom',
      horizonColor: hex('#0a1028'), zenithColor: hex('#01020a'), skyDomeColor: hex('#060a1c'),
      sunColor: hex('#fff4e0'), sunAzimuth: 160, sunAltitude: -50,
      moonColor: hex('#e8ecff'), moonSize: 26, moonPhase: 0, stars: 100,
      haze: 4, hazeColor: hex('#101830'),
      shadowIntensity: 40, ambient: 12, ambientColor: hex('#1c2244'),
      stratus: false,
      cumulus: false,
    }),
  preset('harvest-moon', 'Harvest Moon', NIGHT,
    'A huge amber moon rising over the hills on a warm autumn night.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#4c3252'), zenithColor: hex('#0e1430'), skyDomeColor: hex('#3a2a4a'),
      sunColor: hex('#fff0d8'), sunAzimuth: 165, sunAltitude: -8,
      moonColor: hex('#ffb24c'), moonSize: 60, moonPhase: 0.5, stars: 30,
      haze: 25, hazeColor: hex('#5c3a42'),
      shadowIntensity: 65, ambient: 20, ambientColor: hex('#5c4262'),
      stratus: { cover: 20, height: 1800, frequency: 45, amplitude: 50, shading: 0.5, color: hex('#6c5262') },
      cumulus: false,
    }),
  preset('crescent-moon', 'Crescent Moon', NIGHT,
    'A thin silver crescent hanging in a deep blue evening sky.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#3a5a92'), zenithColor: hex('#0a1842'), skyDomeColor: hex('#24386c'),
      sunColor: hex('#fff0d8'), sunAzimuth: 160, sunAltitude: -14,
      moonColor: hex('#fff8e2'), moonSize: 30, moonPhase: 0.15, stars: 45,
      haze: 15, hazeColor: hex('#2c4272'),
      shadowIntensity: 55, ambient: 18, ambientColor: hex('#34487c'),
      stratus: false,
      cumulus: { cover: 14, height: 700, frequency: 130, amplitude: 180, shading: 0.7, color: hex('#2c3252') },
    }),
  preset('blue-hour', 'Blue Hour', NIGHT,
    'The deep, glowing blue just after sunset, when the whole world looks like it is underwater.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#4a6cb0'), zenithColor: hex('#10235e'), skyDomeColor: hex('#2a4890'),
      sunColor: hex('#ffd8b0'), sunGlow: 50, sunAzimuth: 10, sunAltitude: -5,
      moonColor: hex('#e8f0ff'), moonPhase: 0.3, stars: 20,
      haze: 20, hazeColor: hex('#4262a2'),
      fogDensity: 20, fogHeight: 3, fogColor: hex('#32426c'),
      shadowIntensity: 50, ambient: 25, ambientColor: hex('#3c5292'),
      stratus: { cover: 20, height: 2000, frequency: 45, amplitude: 50, shading: 0.3, color: hex('#7a8ac2') },
      cumulus: false,
    }),
  preset('aurora-veil', 'Aurora Veil', NIGHT,
    'Green curtains of light ripple across a violet polar night, with stars burning through.', {
      mode: 'custom',
      horizonColor: hex('#127a5c'), zenithColor: hex('#0e0630'), skyDomeColor: hex('#3a2a7a'),
      sunColor: hex('#fff0e0'), sunAzimuth: 180, sunAltitude: -40,
      moonColor: hex('#e0fff2'), moonPhase: 0, stars: 80,
      haze: 30, hazeColor: hex('#36ffb0'),
      shadowIntensity: 30, ambient: 20, ambientColor: hex('#2a6a5c'),
      stratus: { cover: 42, height: 2800, frequency: 30, amplitude: 120, shading: 0, color: hex('#5cffb2') },
      cumulus: false,
    }),
  preset('cloudy-night', 'Silver-Lined Night', NIGHT,
    'Ragged clouds race past a bright moon, their edges lit silver.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#1c2232'), zenithColor: hex('#0a0e1a'), skyDomeColor: hex('#1a2032'),
      sunColor: hex('#fff0d8'), sunAzimuth: 200, sunAltitude: -24,
      moonColor: hex('#f2f4ff'), moonSize: 30, moonPhase: 0.62, stars: 15,
      haze: 12, hazeColor: hex('#2a3246'),
      shadowIntensity: 60, ambient: 20, ambientColor: hex('#384260'),
      stratus: false,
      cumulus: { cover: 55, height: 750, frequency: 100, amplitude: 240, shading: 0.7, color: hex('#4c5672') },
    }),

  // --- Weather --------------------------------------------------------------
  preset('stormy', 'Stormy', WEATHER,
    'Bruised, boiling clouds roll in low and the light turns to pewter. Batten down the hatches.', {
      mode: 'darker',
      horizonColor: hex('#6c7488'), zenithColor: hex('#3c424e'), skyDomeColor: hex('#4a5062'),
      sunColor: hex('#c2c6d2'), sunSize: 20, sunGlow: 10, sunAzimuth: 200, sunAltitude: 30,
      haze: 45, hazeColor: hex('#6a7082'),
      fogDensity: 25, fogHeight: 6, fogColor: hex('#5a6072'),
      shadowIntensity: 35, ambient: 35, ambientColor: hex('#6a7088'),
      stratus: { cover: 60, height: 1500, frequency: 40, amplitude: 70, shading: 0.6, color: hex('#6a7082') },
      cumulus: { cover: 82, height: 600, frequency: 90, amplitude: 320, shading: 0.9, color: hex('#555a66') },
    }),
  preset('overcast', 'Overcast', WEATHER,
    'A seamless gray lid of cloud. Soft, nearly shadowless light, perfect for showing off materials.', {
      mode: 'custom',
      horizonColor: hex('#c8ccd2'), zenithColor: hex('#8a929e'), skyDomeColor: hex('#a8b0ba'),
      sunColor: hex('#f2f2f0'), sunSize: 10, sunGlow: 20, sunAzimuth: 190, sunAltitude: 45,
      haze: 40, hazeColor: hex('#c8ccd2'),
      shadowIntensity: 20, ambient: 60, ambientColor: hex('#b8c0cc'),
      stratus: { cover: 95, height: 1200, frequency: 30, amplitude: 40, shading: 0.4, color: hex('#d8dce2') },
      cumulus: false,
    }),
  preset('foggy-morning', 'Foggy Morning', WEATHER,
    'Thick white fog hugs the ground while the sun tries to burn through from above.', {
      mode: 'custom',
      horizonColor: hex('#e8ecf0'), zenithColor: hex('#9ab0c8'), skyDomeColor: hex('#c8d4e0'),
      sunColor: hex('#fff6e8'), sunSize: 30, sunGlow: 45, sunAzimuth: 160, sunAltitude: 15,
      haze: 55, hazeColor: hex('#eef0f2'),
      fogDensity: 55, fogHeight: 6, fogColor: hex('#e6eaee'),
      shadowIntensity: 40, ambient: 50, ambientColor: hex('#d8dee6'),
      stratus: { cover: 30, height: 1600, frequency: 40, amplitude: 40, shading: 0.2, color: hex('#f4f6f8') },
      cumulus: false,
    }),
  preset('misty-lake', 'Misty Lake', WEATHER,
    'A thin veil of mist floats just above still water in the cool hour after dawn.', {
      mode: 'custom',
      horizonColor: hex('#d2dde6'), zenithColor: hex('#6e8eb0'), skyDomeColor: hex('#a8bccf'),
      sunColor: hex('#ffe8c8'), sunSize: 28, sunGlow: 50, sunAzimuth: 95, sunAltitude: 10,
      haze: 30, hazeColor: hex('#dce4ec'),
      fogDensity: 55, fogHeight: 2.5, fogColor: hex('#dfe6ec'),
      shadowIntensity: 50, ambient: 42, ambientColor: hex('#b8c8d8'),
      stratus: { cover: 25, height: 1800, frequency: 45, amplitude: 45, shading: 0.2, color: hex('#f0f0f4') },
      cumulus: false,
    }),
  preset('desert-haze', 'Desert Haze', WEATHER,
    'Heat shimmer and fine dust bleach the horizon to sand while the sun hammers down.', {
      mode: 'custom',
      horizonColor: hex('#f0d8a8'), zenithColor: hex('#6a90c0'), skyDomeColor: hex('#e0c8a0'),
      sunColor: hex('#fff0d0'), sunSize: 30, sunGlow: 55, sunAzimuth: 200, sunAltitude: 42,
      haze: 60, hazeColor: hex('#f2dcb0'),
      fogDensity: 15, fogHeight: 4, fogColor: hex('#e0c090'),
      shadowIntensity: 82, ambient: 40, ambientColor: hex('#e0c8a0'),
      stratus: false,
      cumulus: false,
    }),
  preset('after-the-rain', 'After the Rain', WEATHER,
    'The storm retreats, the air is washed clean, and a rainbow arcs over the hills in front of you.', {
      mode: 'soft', linkSunToView: true, rainbow: true,
      horizonColor: hex('#c8d8e8'), zenithColor: hex('#3e6cb0'), skyDomeColor: hex('#8ca8d2'),
      sunColor: hex('#fff6e0'), sunSize: 28, sunGlow: 40, sunAzimuth: 180, sunAltitude: 20,
      haze: 10, hazeColor: hex('#d8e4ee'),
      shadowIntensity: 70, ambient: 34, ambientColor: hex('#9cb0cc'),
      stratus: false,
      cumulus: { cover: 45, height: 700, frequency: 100, amplitude: 260, shading: 0.85, color: hex('#7a8496') },
    }),
  preset('thunderhead', 'Thunderhead', WEATHER,
    'A towering anvil cloud builds over the plains: blinding white on top, slate gray underneath.', {
      mode: 'custom',
      horizonColor: hex('#c8b8a0'), zenithColor: hex('#3a5a8a'), skyDomeColor: hex('#8a96aa'),
      sunColor: hex('#fff0d8'), sunSize: 26, sunGlow: 35, sunAzimuth: 120, sunAltitude: 25,
      haze: 25, hazeColor: hex('#d8ccb8'),
      shadowIntensity: 80, ambient: 30, ambientColor: hex('#8c98ac'),
      stratus: false,
      cumulus: { cover: 50, height: 500, frequency: 40, amplitude: 380, shading: 0.95, color: hex('#f0ece4') },
    }),
  preset('whiteout', 'Whiteout', WEATHER,
    'Snow-heavy skies and a horizon where the land and the air become one soft white blur.', {
      mode: 'custom',
      horizonColor: hex('#e8ecf0'), zenithColor: hex('#b8c0ca'), skyDomeColor: hex('#d8dee6'),
      sunColor: hex('#f4f6fa'), sunSize: 10, sunGlow: 30, sunAzimuth: 180, sunAltitude: 30,
      haze: 70, hazeColor: hex('#f0f2f4'),
      fogDensity: 20, fogHeight: 30, fogColor: hex('#e8ecf0'),
      shadowIntensity: 15, ambient: 70, ambientColor: hex('#e0e6ee'),
      stratus: { cover: 70, height: 1400, frequency: 35, amplitude: 40, shading: 0.3, color: hex('#e6eaee') },
      cumulus: { cover: 80, height: 650, frequency: 90, amplitude: 160, shading: 0.5, color: hex('#d0d4da') },
    }),
  preset('sandstorm', 'Sandstorm', WEATHER,
    'A wall of orange dust has swallowed the sky; the sun is a pale coin glimpsed through the murk.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#d8a060'), zenithColor: hex('#a06a3a'), skyDomeColor: hex('#c88a50'),
      sunColor: hex('#ffe0a0'), sunSize: 20, sunGlow: 30, sunAzimuth: 20, sunAltitude: 18,
      haze: 80, hazeColor: hex('#d09a5a'),
      fogDensity: 20, fogHeight: 15, fogColor: hex('#c88a4a'),
      shadowIntensity: 30, ambient: 50, ambientColor: hex('#c08050'),
      stratus: false,
      cumulus: false,
    }),

  // --- Alien & Surreal ------------------------------------------------------
  preset('teal-dream', 'Teal Dream', ALIEN,
    'A dreamy aquamarine sky that glows like the inside of a breaking wave.', {
      mode: 'custom',
      horizonColor: hex('#80ffe0'), zenithColor: hex('#0a5a5a'), skyDomeColor: hex('#2ab0a0'),
      sunColor: hex('#fff0f8'), sunSize: 26, sunGlow: 50, sunAzimuth: 25, sunAltitude: 30,
      moonColor: hex('#ffd0f0'),
      haze: 30, hazeColor: hex('#a0ffe8'),
      fogDensity: 10, fogHeight: 3, fogColor: hex('#60d0c0'),
      shadowIntensity: 60, ambient: 40, ambientColor: hex('#40b0a0'),
      stratus: { cover: 40, height: 1800, frequency: 45, amplitude: 70, shading: 0.25, color: hex('#c8fff0') },
      cumulus: false,
    }),
  preset('pink-alien', 'Pink Alien', ALIEN,
    'Bubblegum skies, pink cumulus and a cold cyan sun. You are definitely not in Kansas anymore.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ff9ad8'), zenithColor: hex('#6a0a4a'), skyDomeColor: hex('#ff62b2'),
      sunColor: hex('#c8ffff'), sunSize: 22, sunGlow: 60, sunAzimuth: 20, sunAltitude: 24,
      moonColor: hex('#a2ff82'), moonSize: 50, moonPhase: 0.35, stars: 20,
      haze: 35, hazeColor: hex('#ffb2e2'),
      shadowIntensity: 65, ambient: 45, ambientColor: hex('#e072b2'),
      stratus: false,
      cumulus: { cover: 35, height: 750, frequency: 100, amplitude: 220, shading: 0.6, color: hex('#ffc2e8') },
    }),
  preset('green-alien', 'Green Alien', ALIEN,
    'A toxic lime atmosphere under a fat yellow sun. Breathing is not recommended.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#b8ff62'), zenithColor: hex('#0a2a0a'), skyDomeColor: hex('#62c242'),
      sunColor: hex('#fff062'), sunSize: 50, sunGlow: 70, sunAzimuth: 15, sunAltitude: 20,
      moonColor: hex('#ff82ff'),
      haze: 40, hazeColor: hex('#c2ff72'),
      fogDensity: 20, fogHeight: 4, fogColor: hex('#82c242'),
      shadowIntensity: 70, ambient: 35, ambientColor: hex('#72a242'),
      stratus: { cover: 45, height: 2000, frequency: 70, amplitude: 90, shading: 0.3, color: hex('#d8ff92') },
      cumulus: false,
    }),
  preset('total-eclipse', 'Total Eclipse', ALIEN,
    'Day turns to night: a blazing white corona hangs in a black sky ringed by a 360-degree sunset.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#6a3a2c'), zenithColor: hex('#020208'), skyDomeColor: hex('#1a1424'),
      sunColor: hex('#aab4cc'), sunSize: 6, sunGlow: 100, sunAzimuth: 0, sunAltitude: 15,
      moonColor: hex('#d0d0e0'), stars: 60,
      haze: 25, hazeColor: hex('#8a4a2a'),
      shadowIntensity: 90, ambient: 10, ambientColor: hex('#2a2238'),
      stratus: false,
      cumulus: false,
    }),
  preset('underwater', 'Underwater Teal', ALIEN,
    'Sunlight filtering down through green-teal water, with rippling light overhead. Glub.', {
      mode: 'custom',
      horizonColor: hex('#2a9a9a'), zenithColor: hex('#0a4a5a'), skyDomeColor: hex('#208080'),
      sunColor: hex('#c2fff0'), sunSize: 40, sunGlow: 80, sunAzimuth: 170, sunAltitude: 70,
      haze: 70, hazeColor: hex('#30a0a0'),
      fogDensity: 24, fogHeight: 40, fogColor: hex('#1a7a80'),
      shadowIntensity: 30, ambient: 55, ambientColor: hex('#42a2a2'),
      stratus: { cover: 50, height: 300, frequency: 220, amplitude: 120, shading: 0.1, color: hex('#a2fff0') },
      cumulus: false,
    }),
  preset('martian-noon', 'Martian Noon', ALIEN,
    'A butterscotch dust sky over a red desert, lit by a small, pale, faraway sun.', {
      mode: 'custom',
      horizonColor: hex('#e8b888'), zenithColor: hex('#c08a5a'), skyDomeColor: hex('#d0a070'),
      sunColor: hex('#e8f0ff'), sunSize: 16, sunGlow: 30, sunAzimuth: 200, sunAltitude: 50,
      moonColor: hex('#c2b2a2'), moonSize: 14,
      haze: 50, hazeColor: hex('#d8a878'),
      fogDensity: 20, fogHeight: 5, fogColor: hex('#c89062'),
      shadowIntensity: 80, ambient: 45, ambientColor: hex('#c08862'),
      stratus: { cover: 15, height: 2400, frequency: 60, amplitude: 40, shading: 0.1, color: hex('#f2dac2') },
      cumulus: false,
    }),
  preset('martian-sunset', 'Martian Sunset', ALIEN,
    'On Mars the sunsets are blue: a cold sapphire halo glowing in a rust-brown dusk.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#6a9ad8'), zenithColor: hex('#4a3020'), skyDomeColor: hex('#7a5a4a'),
      sunColor: hex('#c8e0ff'), sunSize: 18, sunGlow: 85, sunAzimuth: 10, sunAltitude: 4,
      moonColor: hex('#d8c8b8'), moonSize: 12, stars: 10,
      haze: 40, hazeColor: hex('#7aa2d2'),
      shadowIntensity: 75, ambient: 25, ambientColor: hex('#6a5042'),
      stratus: false,
      cumulus: false,
    }),
  preset('acid-sky', 'Acid Sky', ALIEN,
    'Neon magenta meets electric cyan, with a rainbow thrown in because why not.', {
      mode: 'custom', rainbow: true,
      horizonColor: hex('#00ffd2'), zenithColor: hex('#ff00a2'), skyDomeColor: hex('#8a42ff'),
      sunColor: hex('#ffff22'), sunSize: 45, sunGlow: 90, sunAzimuth: 160, sunAltitude: 30,
      moonColor: hex('#22ffff'), stars: 30,
      haze: 30, hazeColor: hex('#a2ffe2'),
      shadowIntensity: 60, ambient: 50, ambientColor: hex('#c242ff'),
      stratus: { cover: 35, height: 2200, frequency: 50, amplitude: 80, shading: 0.2, color: hex('#82ffff') },
      cumulus: { cover: 40, height: 700, frequency: 160, amplitude: 300, shading: 0.6, color: hex('#ff82ff') },
    }),
  preset('red-giant', 'Red Giant', ALIEN,
    'A bloated, dying sun hangs huge and low, bathing an ancient world in rusty red light.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ff4c1c'), zenithColor: hex('#1a0508'), skyDomeColor: hex('#8a1c12'),
      sunColor: hex('#ff3c1c'), sunSize: 100, sunGlow: 90, sunAzimuth: 10, sunAltitude: 18,
      moonColor: hex('#ffc2a2'), stars: 25,
      haze: 40, hazeColor: hex('#ff5c2c'),
      shadowIntensity: 75, ambient: 30, ambientColor: hex('#a23222'),
      stratus: { cover: 25, height: 2200, frequency: 40, amplitude: 70, shading: 0.4, color: hex('#ff6c42') },
      cumulus: false,
    }),

  // --- 90s CD Covers --------------------------------------------------------
  preset('monolith-sea', 'Monolith Sea', CD,
    'The reel\'s unforgettable look: a teal sky streaked with cloud over a hot-pink horizon and a sea to match.', {
      mode: 'custom',
      horizonColor: hex('#ffa2ba'), zenithColor: hex('#1a8a7a'), skyDomeColor: hex('#52c8b2'),
      sunColor: hex('#fff2f2'), sunSize: 20, sunGlow: 40, sunAzimuth: 200, sunAltitude: 35,
      moonColor: hex('#ffe2f0'),
      haze: 35, hazeColor: hex('#ffbacb'),
      fogDensity: 10, fogHeight: 2, fogColor: hex('#ffc2d2'),
      shadowIntensity: 65, ambient: 40, ambientColor: hex('#62b2a2'),
      stratus: { cover: 55, height: 1400, frequency: 40, amplitude: 110, shading: 0.3, color: hex('#c8fff0') },
      cumulus: { cover: 15, height: 700, frequency: 130, amplitude: 170, shading: 0.5, color: hex('#e8fff8') },
    }),
  preset('vaporwave', 'Vaporwave', CD,
    'Hot-pink horizon, purple night and a giant sunset dead center. Very A E S T H E T I C.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ff6ac8'), zenithColor: hex('#2a0a5a'), skyDomeColor: hex('#8a3aaa'),
      sunColor: hex('#ffd23c'), sunSize: 60, sunGlow: 60, sunAzimuth: 0, sunAltitude: 8,
      moonColor: hex('#9cf2ff'), stars: 25,
      haze: 20, hazeColor: hex('#ff8ad8'),
      fogDensity: 10, fogHeight: 1.5, fogColor: hex('#c242a2'),
      shadowIntensity: 60, ambient: 45, ambientColor: hex('#a242c2'),
      stratus: false,
      cumulus: false,
    }),
  preset('deep-space', 'Deep Space', CD,
    'Black vacuum, hard white sunlight and a billion stars. For chrome spheres floating in the void.', {
      mode: 'custom',
      horizonColor: hex('#06061a'), zenithColor: hex('#000004'), skyDomeColor: hex('#0a0a22'),
      sunColor: hex('#ffffff'), sunSize: 10, sunGlow: 25, sunAzimuth: 110, sunAltitude: 25,
      moonColor: hex('#d8e2ff'), moonPhase: 0.5, stars: 100,
      haze: 0, hazeColor: hex('#0a0a22'),
      shadowIntensity: 100, ambient: 5, ambientColor: hex('#101032'),
      stratus: false,
      cumulus: false,
    }),
  preset('cobalt-dream', 'Cobalt Dream', CD,
    'Everything is blue and violet, even the light: the definitive alien-floating-worlds album sky.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#8a8aff'), zenithColor: hex('#1a1a7a'), skyDomeColor: hex('#4a4ad2'),
      sunColor: hex('#e8e2ff'), sunSize: 28, sunGlow: 60, sunAzimuth: 30, sunAltitude: 30,
      moonColor: hex('#ffe2ff'),
      haze: 30, hazeColor: hex('#9a9aff'),
      shadowIntensity: 65, ambient: 45, ambientColor: hex('#5a5ad2'),
      stratus: { cover: 45, height: 2000, frequency: 50, amplitude: 90, shading: 0.3, color: hex('#b2aaff') },
      cumulus: { cover: 25, height: 750, frequency: 120, amplitude: 200, shading: 0.6, color: hex('#d2caff') },
    }),
  preset('ambient-lagoon', 'Ambient Lagoon', CD,
    'A pristine blue sky over a calm sea: the backdrop of a thousand meditation CDs.', {
      mode: 'custom',
      horizonColor: hex('#eaf4ff'), zenithColor: hex('#1a5ac8'), skyDomeColor: hex('#6aa2e8'),
      sunColor: hex('#ffffff'), sunSize: 28, sunGlow: 40, sunAzimuth: 150, sunAltitude: 45,
      haze: 25, hazeColor: hex('#ffffff'),
      shadowIntensity: 70, ambient: 40, ambientColor: hex('#8ab2e8'),
      stratus: false,
      cumulus: { cover: 30, height: 800, frequency: 90, amplitude: 250, shading: 0.6 },
    }),
  preset('trance-nebula', 'Trance Nebula', CD,
    'Magenta and electric-blue nebula wisps swirl through a star-crowded sky.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#6a2a9a'), zenithColor: hex('#0a0428'), skyDomeColor: hex('#3a1a6a'),
      sunColor: hex('#a2e2ff'), sunSize: 8, sunGlow: 70, sunAzimuth: 340, sunAltitude: 20,
      moonColor: hex('#ffc2f2'), stars: 85,
      haze: 15, hazeColor: hex('#7a3aaa'),
      shadowIntensity: 70, ambient: 30, ambientColor: hex('#6a42a2'),
      stratus: { cover: 50, height: 2800, frequency: 25, amplitude: 160, shading: 0.1, color: hex('#ff72d2') },
      cumulus: { cover: 20, height: 900, frequency: 150, amplitude: 200, shading: 0.3, color: hex('#62a2ff') },
    }),
  preset('floating-worlds', 'Floating Worlds', CD,
    'Lilac and magenta skies for alien temples and orbs that hover over impossible landscapes.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#f2a2d8'), zenithColor: hex('#4a1a7a'), skyDomeColor: hex('#a262c2'),
      sunColor: hex('#fff0d2'), sunSize: 30, sunGlow: 55, sunAzimuth: 15, sunAltitude: 25,
      moonColor: hex('#d2f2ff'), stars: 10,
      haze: 30, hazeColor: hex('#f2b2e2'),
      shadowIntensity: 70, ambient: 40, ambientColor: hex('#a26ab2'),
      stratus: { cover: 30, height: 2100, frequency: 45, amplitude: 70, shading: 0.25, color: hex('#ffdaff') },
      cumulus: { cover: 35, height: 750, frequency: 110, amplitude: 230, shading: 0.7, color: hex('#ffcaf2') },
    }),
  preset('chrome-horizon', 'Chrome Horizon', CD,
    'The classic ray-tracer demo sky: inky blue down to a razor-white horizon, made for chrome and checkerboards.', {
      mode: 'custom',
      horizonColor: hex('#f2f8ff'), zenithColor: hex('#050a32'), skyDomeColor: hex('#4262a2'),
      sunColor: hex('#ffffff'), sunSize: 20, sunGlow: 30, sunAzimuth: 200, sunAltitude: 20,
      stars: 20,
      haze: 5, hazeColor: hex('#e2ecff'),
      shadowIntensity: 90, ambient: 30, ambientColor: hex('#6a82c2'),
      stratus: false,
      cumulus: false,
    }),
  preset('two-tone-cover', 'Two-Tone Cover', CD,
    'Two flat colors and nothing else: the pure graphic gradient behind every 90s logo and lens flare.', {
      mode: 'custom',
      horizonColor: hex('#ff8a3a'), zenithColor: hex('#2a1a8a'), skyDomeColor: hex('#8a5a9a'),
      sunColor: hex('#fff2e2'), sunSize: 12, sunGlow: 20, sunAzimuth: 200, sunAltitude: 40,
      haze: 5, hazeColor: hex('#ffa262'),
      shadowIntensity: 70, ambient: 35, ambientColor: hex('#a27292'),
      stratus: false,
      cumulus: false,
    }),
  preset('new-age-dawn', 'New Age Dawn', CD,
    'Turquoise and gold light pouring over a misty sea: pure late-night infomercial serenity.', {
      mode: 'custom', linkSunToView: true,
      horizonColor: hex('#ffe2a2'), zenithColor: hex('#2a8aa2'), skyDomeColor: hex('#82cab2'),
      sunColor: hex('#fff8e2'), sunSize: 40, sunGlow: 80, sunAzimuth: 5, sunAltitude: 12,
      haze: 30, hazeColor: hex('#fff2c2'),
      fogDensity: 25, fogHeight: 3, fogColor: hex('#e2f2e2'),
      shadowIntensity: 55, ambient: 40, ambientColor: hex('#a2d2c2'),
      stratus: { cover: 35, height: 2000, frequency: 40, amplitude: 60, shading: 0.2, color: hex('#fff2d2') },
      cumulus: false,
    }),

  // --- Studio ---------------------------------------------------------------
  preset('black-velvet', 'Black Velvet', STUDIO,
    'Atmosphere off: objects float on pure black, lit by a crisp white key light. Jewelry-ad drama.', {
      mode: 'off',
      horizonColor: hex('#000000'), zenithColor: hex('#000000'), skyDomeColor: hex('#202020'),
      sunColor: hex('#ffffff'), sunSize: 0, sunGlow: 0, sunAzimuth: 135, sunAltitude: 45,
      haze: 0, hazeColor: hex('#000000'),
      shadowIntensity: 85, ambient: 15, ambientColor: hex('#808080'),
      stratus: false,
      cumulus: false,
    }),
  preset('paper-white', 'Paper White', STUDIO,
    'Atmosphere off on a bright seamless white: soft shadows, catalog-clean, great for chess pieces.', {
      mode: 'off',
      horizonColor: hex('#f4f4f2'), zenithColor: hex('#f4f4f2'), skyDomeColor: hex('#ffffff'),
      sunColor: hex('#fffaf2'), sunSize: 0, sunGlow: 0, sunAzimuth: 150, sunAltitude: 55,
      haze: 0, hazeColor: hex('#ffffff'),
      shadowIntensity: 40, ambient: 60, ambientColor: hex('#e8ecf2'),
      stratus: false,
      cumulus: false,
    }),
  preset('blueprint', 'Blueprint', STUDIO,
    'A flat engineering-blue backdrop with cool, even light. Very technical, very 1995 software box.', {
      mode: 'off',
      horizonColor: hex('#1a3a8a'), zenithColor: hex('#1a3a8a'), skyDomeColor: hex('#3a5aa2'),
      sunColor: hex('#f2f8ff'), sunSize: 0, sunGlow: 0, sunAzimuth: 210, sunAltitude: 50,
      haze: 0, hazeColor: hex('#1a3a8a'),
      shadowIntensity: 65, ambient: 40, ambientColor: hex('#6a8ad2'),
      stratus: false,
      cumulus: false,
    }),
];

export function getSkyPreset(id: string): SkyPreset | undefined {
  return SKY_PRESETS.find((p) => p.id === id);
}

/** Presets of one category, in library order. */
export function skyPresetsIn(category: string): SkyPreset[] {
  return SKY_PRESETS.filter((p) => p.category === category);
}
