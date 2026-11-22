import { describe, expect, it } from 'vitest';
import { defaultCamera } from '@/core/defaults';
import { directionToAzAlt, sunDirection } from '@/core/math';
import type { Sky } from '@/core/types';
import { defaultSky, makeCloudLayer } from '@/sky/defaults';
import { SKY_CATEGORIES, SKY_PRESETS, getSkyPreset, skyPresetsIn } from '@/sky/presets';
import { skyPreviewScene } from '@/sky/previewScene';
import { RANDOM_SKY_KINDS, randomSky } from '@/sky/random';
import { CLOUD_RANGES, SKY_RANGES } from '@/sky/ranges';
import { cloneSky, sanitizeSky, skiesEqual, skyProblems } from '@/sky/sanitize';
import { cameraHeading, describeSun, effectiveSunAzimuth, flipSunMoon, linkSunToViewPatch, rollSun } from '@/sky/sun';

describe('sky defaults and ranges', () => {
  it('the default sky is complete and valid', () => {
    expect(skyProblems(defaultSky())).toEqual([]);
  });

  it('every ranged field exists on the default sky / cloud layer as a number', () => {
    const sky = defaultSky();
    for (const k of Object.keys(SKY_RANGES)) expect(typeof sky[k as keyof Sky]).toBe('number');
    const layer = makeCloudLayer();
    for (const k of Object.keys(CLOUD_RANGES)) expect(typeof layer[k as keyof typeof layer]).toBe('number');
  });

  it('defaultSky returns fresh objects', () => {
    const a = defaultSky();
    const b = defaultSky();
    expect(a).not.toBe(b);
    expect(a.cumulus).not.toBe(b.cumulus);
    expect(a.horizonColor).not.toBe(b.horizonColor);
  });
});

describe('sky presets', () => {
  it('has 40+ presets with unique ids and names', () => {
    expect(SKY_PRESETS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(SKY_PRESETS.map((p) => p.id)).size).toBe(SKY_PRESETS.length);
    expect(new Set(SKY_PRESETS.map((p) => p.name)).size).toBe(SKY_PRESETS.length);
  });

  it('every preset is a complete, in-range sky with a description', () => {
    for (const p of SKY_PRESETS) {
      expect(skyProblems(p.sky), p.id).toEqual([]);
      expect(p.description && p.description.length > 20, p.id).toBe(true);
      expect(SKY_CATEGORIES, p.id).toContain(p.category);
    }
  });

  it('every category is populated', () => {
    for (const c of SKY_CATEGORIES) expect(skyPresetsIn(c).length, c).toBeGreaterThanOrEqual(3);
  });

  it('presets exercise every part of the sky model', () => {
    const skies = SKY_PRESETS.map((p) => p.sky);
    for (const mode of ['soft', 'darker', 'custom', 'off'] as const) expect(skies.some((s) => s.mode === mode), mode).toBe(true);
    expect(skies.some((s) => s.rainbow)).toBe(true);
    expect(skies.some((s) => s.stars >= 80)).toBe(true);
    expect(skies.some((s) => s.fogDensity >= 40)).toBe(true);
    expect(skies.some((s) => s.haze >= 60)).toBe(true);
    expect(skies.some((s) => s.sunAltitude < -5 && s.moonPhase > 0.3 && s.moonPhase < 0.7)).toBe(true);
    expect(skies.some((s) => s.moonPhase < 0.25 && s.moonPhase > 0)).toBe(true);
    expect(skies.some((s) => s.linkSunToView)).toBe(true);
    expect(skies.some((s) => s.stratus.enabled && s.cumulus.enabled)).toBe(true);
    expect(skies.some((s) => !s.stratus.enabled && !s.cumulus.enabled)).toBe(true);
    expect(skies.some((s) => s.shadowIntensity <= 20)).toBe(true);
    expect(skies.some((s) => s.ambient >= 60)).toBe(true);
  });

  it('gives each preset its own cloud pattern', () => {
    const offsets = new Set(SKY_PRESETS.map((p) => p.sky.cumulus.offset.join(',')));
    expect(offsets.size).toBeGreaterThan(SKY_PRESETS.length * 0.9);
  });

  it('includes the classics by id', () => {
    for (const id of ['soft-daylight', 'golden-hour', 'blood-red-sunset', 'moonlit-night', 'starfield', 'stormy', 'monolith-sea', 'vaporwave', 'deep-space', 'total-eclipse']) {
      expect(getSkyPreset(id), id).toBeDefined();
    }
    expect(getSkyPreset('nope')).toBeUndefined();
  });
});

describe('randomSky', () => {
  it('is deterministic for a seed', () => {
    expect(randomSky(1234)).toEqual(randomSky(1234));
    expect(randomSky(99, 'night')).toEqual(randomSky(99, 'night'));
  });

  it('varies with the seed', () => {
    const a = randomSky(1);
    const b = randomSky(2);
    expect(skiesEqual(a, b)).toBe(false);
  });

  it('always produces a valid sky', () => {
    for (let seed = 0; seed < 400; seed++) expect(skyProblems(randomSky(seed)), String(seed)).toEqual([]);
    for (const { id } of RANDOM_SKY_KINDS) for (let seed = 0; seed < 60; seed++) expect(skyProblems(randomSky(seed, id)), `${id}:${seed}`).toEqual([]);
  });

  it('covers day, sunset, night and alien moods', () => {
    const skies = Array.from({ length: 300 }, (_, i) => randomSky(i * 7919 + 1));
    expect(skies.some((s) => s.sunAltitude < -5)).toBe(true);
    expect(skies.some((s) => s.sunAltitude > 25)).toBe(true);
    expect(skies.some((s) => s.sunAltitude > -3 && s.sunAltitude < 15 && s.linkSunToView)).toBe(true);
    expect(skies.some((s) => s.mode === 'custom')).toBe(true);
    expect(skies.some((s) => s.mode !== 'custom')).toBe(true);
    expect(skies.some((s) => s.cumulus.enabled)).toBe(true);
    expect(skies.some((s) => !s.cumulus.enabled && !s.stratus.enabled)).toBe(true);
  });

  it('honors a requested mood', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(randomSky(seed, 'night').sunAltitude).toBeLessThan(0);
      const g = randomSky(seed, 'golden');
      expect(g.sunAltitude).toBeGreaterThanOrEqual(-2);
      expect(g.sunAltitude).toBeLessThanOrEqual(14);
      expect(randomSky(seed, 'day').sunAltitude).toBeGreaterThanOrEqual(25);
    }
  });
});

describe('sanitizeSky', () => {
  it('turns garbage into the fallback', () => {
    expect(sanitizeSky(null)).toEqual(defaultSky());
    expect(sanitizeSky('sky')).toEqual(defaultSky());
    expect(skyProblems(sanitizeSky([1, 2, 3]))).toEqual([]);
  });

  it('clamps, wraps and repairs fields', () => {
    const s = sanitizeSky({
      mode: 'weird',
      haze: 500,
      fogDensity: -4,
      sunAzimuth: -30,
      sunAltitude: 120,
      zenithColor: [2, -1, 0.5],
      horizonColor: [NaN, 0, 0],
      stratus: { enabled: false, cover: 900, offset: [Infinity, 2] },
      rainbow: 'yes',
    });
    expect(s.mode).toBe('soft');
    expect(s.haze).toBe(100);
    expect(s.fogDensity).toBe(0);
    expect(s.sunAzimuth).toBeCloseTo(330);
    expect(s.sunAltitude).toBe(90);
    expect(s.zenithColor).toEqual([1, 0, 0.5]);
    expect(s.horizonColor).toEqual(defaultSky().horizonColor);
    expect(s.stratus.enabled).toBe(false);
    expect(s.stratus.cover).toBe(100);
    expect(s.stratus.offset).toEqual(defaultSky().stratus.offset);
    expect(s.rainbow).toBe(false);
    expect(skyProblems(s)).toEqual([]);
  });

  it('keeps valid skies intact', () => {
    for (const p of SKY_PRESETS.slice(0, 10)) expect(skiesEqual(sanitizeSky(p.sky), p.sky)).toBe(true);
  });

  it('reports problems precisely', () => {
    const bad = { ...defaultSky(), haze: 120, extra: 1 } as unknown;
    const problems = skyProblems(bad);
    expect(problems.some((p) => p.startsWith('haze'))).toBe(true);
    expect(problems.some((p) => p.includes('extra'))).toBe(true);
  });

  it('cloneSky is deep', () => {
    const a = defaultSky();
    const b = cloneSky(a);
    b.cumulus.offset[0] = 999;
    b.sunColor[0] = 0;
    expect(a.cumulus.offset[0]).toBe(0);
    expect(a.sunColor[0]).toBe(1);
    expect(skiesEqual(a, cloneSky(a))).toBe(true);
  });
});

describe('sun control math', () => {
  const zenith = { sunAzimuth: 0, sunAltitude: 90 };

  it('dragging right from the zenith moves the sun toward azimuth 90', () => {
    const p = rollSun(zenith, 20, 0, 60);
    expect(p.sunAzimuth).toBeCloseTo(90, 3);
    expect(p.sunAltitude).toBeCloseTo(30, 3);
  });

  it('dragging down moves the sun toward azimuth 180 (behind the camera)', () => {
    const p = rollSun(zenith, 0, 30, 60);
    expect(p.sunAzimuth).toBeCloseTo(180, 3);
    expect(p.sunAltitude).toBeCloseTo(0, 3);
  });

  it('pushing past the rim sets the sun', () => {
    const p = rollSun({ sunAzimuth: 90, sunAltitude: 10 }, 15, 0, 60);
    expect(p.sunAltitude).toBeLessThan(0);
  });

  it('a zero drag changes nothing', () => {
    expect(rollSun({ sunAzimuth: 33, sunAltitude: 12 }, 0, 0, 60)).toEqual({ sunAzimuth: 33, sunAltitude: 12 });
  });

  it('flipping twice is the identity, and the moon lands where the sun was', () => {
    const p = { sunAzimuth: 215, sunAltitude: 38 };
    const f = flipSunMoon(p);
    expect(f).toEqual({ sunAzimuth: 35, sunAltitude: -38 });
    const back = flipSunMoon(f);
    expect(back.sunAzimuth).toBeCloseTo(215);
    expect(back.sunAltitude).toBeCloseTo(38);
    const moon = sunDirection(f.sunAzimuth, f.sunAltitude).map((v) => -v) as [number, number, number];
    const m = directionToAzAlt(moon);
    expect(m.azimuth).toBeCloseTo(215);
    expect(m.altitude).toBeCloseTo(38);
  });

  it('linking to the view keeps the sun put in the world', () => {
    const cam = { position: [10, 5, 10] as [number, number, number], target: [0, 5, 0] as [number, number, number], roll: 0, fov: 50 };
    expect(cameraHeading(cam)).toBeCloseTo(315);
    const sky = { sunAzimuth: 200, linkSunToView: false };
    const before = effectiveSunAzimuth(sky, cam);
    const linked = { ...sky, ...linkSunToViewPatch(sky, true, cam) };
    expect(linked.linkSunToView).toBe(true);
    expect(effectiveSunAzimuth(linked, cam)).toBeCloseTo(before);
    const unlinked = { ...linked, ...linkSunToViewPatch(linked, false, cam) };
    expect(unlinked.sunAzimuth).toBeCloseTo(200);
  });

  it('the default camera faces azimuth 0', () => {
    expect(cameraHeading(defaultCamera())).toBeCloseTo(0);
  });

  it('describes the sun and the moon', () => {
    expect(describeSun({ sunAzimuth: 215, sunAltitude: 38 })).toBe('Sun: azimuth 215°, altitude 38°, daylight');
    expect(describeSun({ sunAzimuth: 195, sunAltitude: -16 })).toMatch(/^Moon: azimuth 15°, altitude 16°/);
  });
});

describe('sky preview scene', () => {
  it('wraps the sky in a stable stage', () => {
    const a = skyPreviewScene(defaultSky());
    const sky = SKY_PRESETS[3].sky;
    const b = skyPreviewScene(sky);
    expect(b.sky).toBe(sky);
    expect(b.objects).toBe(a.objects);
    expect(b.objects.map((o) => o.type).sort()).toEqual(['sphere', 'terrain', 'water']);
    expect(b.camera.fov).toBeGreaterThan(40);
  });
});
