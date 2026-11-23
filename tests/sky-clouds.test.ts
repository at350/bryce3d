import { describe, expect, it } from 'vitest';
import { defaultCamera } from '@/core/defaults';
import type { Scene, Sky } from '@/core/types';
import { normalizeSky } from '@/io/normalize';
import { normalizeScene } from '@/io/serialize';
import { decodeShareHash, encodeShareLink } from '@/io/share';
import { packScene, unpackScene } from '@/io/shareCodec';
import { SKY_SLOTS, computeSkyParams } from '@/render/skyParams';
import { createDefaultScene } from '@/scenes/defaultScene';
import { setCloudCover, setCloudHeight, setCloudShape } from '@/sky/cloudEdit';
import { defaultSky, makeCloudLayer } from '@/sky/defaults';
import { cloudDensityAt, cloudParams, makeSkySampler } from '@/sky/model';
import { fbm } from '@/sky/noise';
import { SKY_PRESETS } from '@/sky/presets';
import { RANDOM_SKY_KINDS, randomSky } from '@/sky/random';
import { CLOUD_RANGES } from '@/sky/ranges';
import { sanitizeSky, skyProblems } from '@/sky/sanitize';

const BASE = 'https://bryce.example/app/';
const hashOf = (link: string) => link.slice(link.indexOf('#'));

/** A sky whose layers carry the given turbulence / glow. */
function styledSky(stratus: { turbulence: number; glow: number }, cumulus: { turbulence: number; glow: number }): Sky {
  const sky = defaultSky();
  return { ...sky, stratus: { ...sky.stratus, ...stratus }, cumulus: { ...sky.cumulus, ...cumulus } };
}

/** The default scene's sky as a file or link from before turbulence and glow existed. */
function legacySkyJson(): Record<string, unknown> {
  const strip = ({ turbulence: _t, glow: _g, ...rest }: Sky['stratus']) => rest;
  const sky = createDefaultScene().sky;
  return { ...sky, stratus: strip(sky.stratus), cumulus: strip(sky.cumulus) };
}

describe('cloud turbulence and glow: data model', () => {
  it('default to 0 on every layer, preset and sample', () => {
    expect(makeCloudLayer()).toMatchObject({ turbulence: 0, glow: 0 });
    for (const layer of [defaultSky().stratus, defaultSky().cumulus]) expect(layer).toMatchObject({ turbulence: 0, glow: 0 });
    expect(createDefaultScene().sky.stratus).toMatchObject({ turbulence: 0, glow: 0 });
  });

  it('are ranged 0..100 with their slider labels', () => {
    expect(CLOUD_RANGES.turbulence).toMatchObject({ min: 0, max: 100, label: 'Turbulence' });
    expect(CLOUD_RANGES.glow).toMatchObject({ min: 0, max: 100, label: 'Sun Glow' });
  });

  it('sanitizeSky clamps them and skyProblems reports them', () => {
    const s = sanitizeSky({ ...defaultSky(), stratus: { ...defaultSky().stratus, turbulence: 250, glow: -5 }, cumulus: { ...defaultSky().cumulus, turbulence: 'x' } });
    expect(s.stratus.turbulence).toBe(100);
    expect(s.stratus.glow).toBe(0);
    expect(s.cumulus.turbulence).toBe(0);
    expect(skyProblems(s)).toEqual([]);
    const bad = styledSky({ turbulence: 140, glow: 0 }, { turbulence: 0, glow: 0 });
    expect(skyProblems(bad).some((p) => p.startsWith('stratus.turbulence'))).toBe(true);
  });

  it('only the new presets use them, so existing presets look as before', () => {
    const styled = SKY_PRESETS.filter((p) => [p.sky.stratus, p.sky.cumulus].some((l) => l.turbulence > 0 || l.glow > 0)).map((p) => p.id);
    expect(styled.sort()).toEqual(['burning-edges', 'torn-gold']);
  });

  it('palette drags keep each layer\'s turbulence and glow', () => {
    const start = styledSky({ turbulence: 40, glow: 70 }, { turbulence: 15, glow: 0 });
    for (const next of [setCloudCover(start, 60), setCloudHeight(start, 1200), setCloudShape(start, 200, 250)]) {
      expect(next.stratus).toMatchObject({ turbulence: 40, glow: 70 });
      expect(next.cumulus).toMatchObject({ turbulence: 15, glow: 0 });
    }
  });
});

describe('cloud turbulence and glow: files and links', () => {
  it('a file from before them loads with 0', () => {
    const scene = normalizeScene({ ...createDefaultScene(), sky: legacySkyJson() });
    expect(scene.sky.stratus).toMatchObject({ turbulence: 0, glow: 0 });
    expect(scene.sky.cumulus).toMatchObject({ turbulence: 0, glow: 0 });
    expect(scene.sky.stratus.cover).toBe(createDefaultScene().sky.stratus.cover);
  });

  it('normalization keeps valid values and clamps or drops bad ones', () => {
    const sky = (stratus: Record<string, unknown>) => normalizeSky({ stratus }).stratus;
    expect(sky({ turbulence: 35, glow: 80 })).toMatchObject({ turbulence: 35, glow: 80 });
    expect(sky({ turbulence: 400, glow: -20 })).toMatchObject({ turbulence: 100, glow: 0 });
    expect(sky({ turbulence: 'lots', glow: null })).toMatchObject({ turbulence: 0, glow: 0 });
    expect(sky({ turbulence: Number.NaN, glow: Infinity })).toMatchObject({ turbulence: 0, glow: 0 });
  });

  it('share links carry them and round-trip', () => {
    const scene: Scene = { ...createDefaultScene(), sky: styledSky({ turbulence: 62.5, glow: 90 }, { turbulence: 0, glow: 33 }) };
    const back = decodeShareHash(hashOf(encodeShareLink(scene, { base: BASE })))!;
    expect(back.sky.stratus).toMatchObject({ turbulence: 62.5, glow: 90 });
    expect(back.sky.cumulus).toMatchObject({ turbulence: 0, glow: 33 });
  });

  it('share links leave them out when 0, and links from before them decode to 0', () => {
    const packed = packScene(createDefaultScene());
    for (const layer of [packed.k?.st, packed.k?.cu]) {
      expect(layer).not.toHaveProperty('turbulence');
      expect(layer).not.toHaveProperty('glow');
    }
    const raw = unpackScene(packed) as { sky: { stratus: Record<string, unknown> } };
    expect(normalizeScene(raw).sky.stratus).toMatchObject({ turbulence: 0, glow: 0 });
  });
});

describe('cloud turbulence and glow: renderer and previews', () => {
  const style = (sky: Sky) => {
    const i = SKY_SLOTS.indexOf('CLOUD_STYLE') * 4;
    return Array.from(computeSkyParams(sky, defaultCamera()).slice(i, i + 4));
  };

  it('pack into CLOUD_STYLE as 0..1, zero for disabled layers and old skies', () => {
    const v = style(styledSky({ turbulence: 50, glow: 100 }, { turbulence: 25, glow: 10 }));
    expect(v.map((x) => Math.round(x * 1000) / 1000)).toEqual([0.5, 1, 0.25, 0.1]);
    const off = styledSky({ turbulence: 50, glow: 100 }, { turbulence: 25, glow: 10 });
    expect(style({ ...off, stratus: { ...off.stratus, enabled: false } }).slice(0, 2)).toEqual([0, 0]);
    expect(style(legacySkyJson() as unknown as Sky)).toEqual([0, 0, 0, 0]);
  });

  it('leave every other sky uniform alone', () => {
    const a = computeSkyParams(defaultSky(), defaultCamera());
    const b = computeSkyParams(styledSky({ turbulence: 80, glow: 80 }, { turbulence: 80, glow: 80 }), defaultCamera());
    const i = SKY_SLOTS.indexOf('CLOUD_STYLE') * 4;
    expect(Array.from(b.slice(0, i))).toEqual(Array.from(a.slice(0, i)));
  });

  it('the preview model keeps the plain pattern at 0 and tears it above 0', () => {
    const plain = cloudParams(makeCloudLayer({ cover: 50, frequency: 80 }), 'stratus')!;
    // Turbulence 0 is the pattern the preview always drew.
    for (const [x, z] of [[0, 0], [1234, -560], [-4000, 2500]]) {
      const n = fbm(x * plain.scale / plain.stretch, z * plain.scale, plain.octaves, 0.55, plain.seed);
      const spread = Math.min(1, Math.max(0, (n - 0.5) * 2.4 + 0.5));
      const t = (spread - (plain.threshold - plain.softness)) / (2 * plain.softness);
      const expected = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
      expect(cloudDensityAt(plain, x, z).density).toBeCloseTo(expected, 12);
    }
    const torn = cloudParams(makeCloudLayer({ cover: 50, frequency: 80, turbulence: 70 }), 'stratus')!;
    let diff = 0;
    for (let i = 0; i < 400; i++) diff += Math.abs(cloudDensityAt(torn, i * 97, i * 53).density - cloudDensityAt(plain, i * 97, i * 53).density);
    expect(diff / 400).toBeGreaterThan(0.02);
  });

  it('the preview model lights clouds near the sun only when glow is on', () => {
    // Sun straight ahead (azimuth 0 looks toward -Z), low; full overcast so every ray meets cloud.
    const sky = (glow: number): Sky => ({
      ...defaultSky(), sunAzimuth: 0, sunAltitude: 12, sunGlow: 70, haze: 0,
      stratus: makeCloudLayer({ cover: 100, amplitude: 300, height: 1500, glow }), cumulus: makeCloudLayer({ enabled: false }),
    });
    const at = (s: Sky, deg: number) => {
      const a = (12 + deg) * Math.PI / 180;
      const out = [0, 0, 0];
      makeSkySampler(s)(0, Math.sin(a), -Math.cos(a), out);
      return out[0] + out[1] + out[2];
    };
    expect(at(sky(100), 6)).toBeGreaterThan(at(sky(0), 6) + 0.05);
    expect(at(sky(100), 70)).toBeCloseTo(at(sky(0), 70), 3);
  });
});

describe('cloud turbulence and glow: the sky dice', () => {
  const skies = Array.from({ length: 400 }, (_, i) => randomSky(i * 7919 + 3));
  const layers = skies.flatMap((s) => [s.stratus, s.cumulus]);

  it('sometimes rolls torn and sun-lit layers, mostly not', () => {
    const torn = layers.filter((l) => l.turbulence > 0).length;
    const lit = layers.filter((l) => l.glow > 0).length;
    expect(torn).toBeGreaterThan(20);
    expect(lit).toBeGreaterThan(20);
    expect(layers.some((l) => l.turbulence > 0 && l.glow > 0)).toBe(true);
    expect(torn).toBeLessThan(layers.length / 2);
    expect(lit).toBeLessThan(layers.length / 2);
  });

  it('styles only enabled layers, never glows a night sky, and stays deterministic', () => {
    for (const l of layers) if (!l.enabled) expect(l).toMatchObject({ turbulence: 0, glow: 0 });
    for (let seed = 0; seed < 60; seed++) {
      const night = randomSky(seed, 'night');
      expect(night.stratus.glow + night.cumulus.glow).toBe(0);
    }
    for (const { id } of RANDOM_SKY_KINDS) expect(randomSky(77, id)).toEqual(randomSky(77, id));
  });

  it('golden hours glow more often than plain days', () => {
    const share = (kind: 'day' | 'golden') => {
      const s = Array.from({ length: 200 }, (_, i) => randomSky(i + 1, kind));
      return s.filter((x) => x.stratus.glow > 0 || x.cumulus.glow > 0).length;
    };
    expect(share('golden')).toBeGreaterThan(share('day'));
  });
});
