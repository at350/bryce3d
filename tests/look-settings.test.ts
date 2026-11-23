import { describe, expect, it } from 'vitest';
import { defaultRenderSettings } from '@/core/defaults';
import { normalizeRender, normalizeSky } from '@/io/normalize';
import { deserializeScene, normalizeScene, serializeScene } from '@/io/serialize';
import { decodeShareHash, encodeShareLink } from '@/io/share';
import { packScene, unpackScene } from '@/io/shareCodec';
import { edgeMasked, extendPasses, planPasses } from '@/render/scheduler';
import { createDefaultScene } from '@/scenes/defaultScene';
import { SAMPLE_SCENES } from '@/scenes/samples';
import { CLOUD_RANGES } from '@/sky/ranges';
import { RANDOM_SKY_KINDS, randomSky } from '@/sky/random';

const BASE = 'https://bryce.example/app/';
const hashOf = (link: string) => link.slice(link.indexOf('#'));

describe('render look settings: normalization', () => {
  it('reads non-finite and non-numeric softness as the default, and clamps the rest', () => {
    for (const bad of [NaN, Infinity, -Infinity, null, undefined, '50', {}, []]) expect(normalizeRender({ softness: bad }).softness).toBe(30);
    expect(normalizeRender({ softness: 0 }).softness).toBe(0);
    expect(normalizeRender({ softness: 100 }).softness).toBe(100);
    expect(normalizeRender({ softness: 100.5 }).softness).toBe(100);
    expect(normalizeRender({ softness: -0.5 }).softness).toBe(0);
    expect(normalizeRender({ softness: 42.5 }).softness).toBe(42.5);
  });

  it('accepts only the two anti-aliasing modes', () => {
    for (const bad of ['Full', 'EDGES', '', 0, true, null, undefined, [], {}]) expect(normalizeRender({ antialias: bad }).antialias).toBe('full');
    expect(normalizeRender({ antialias: 'full' }).antialias).toBe('full');
    expect(normalizeRender({ antialias: 'edges' }).antialias).toBe('edges');
  });

  it('survives a non-object render block', () => {
    for (const raw of [null, undefined, 5, 'x', []]) expect(normalizeRender(raw)).toMatchObject({ antialias: 'full', softness: 30 });
  });

  it('keeps the new defaults in the default settings', () => {
    expect(defaultRenderSettings()).toMatchObject({ antialias: 'full', softness: 30 });
    expect(normalizeRender(defaultRenderSettings())).toEqual(defaultRenderSettings());
  });

  it('reads cloud turbulence and glow as 0 when missing or bad, and clamps them to 0..100', () => {
    const read = (stratus: unknown) => normalizeSky({ stratus }).stratus;
    expect(read({})).toMatchObject({ turbulence: 0, glow: 0 });
    for (const bad of [NaN, Infinity, -Infinity, null, '60', {}]) expect(read({ turbulence: bad, glow: bad })).toMatchObject({ turbulence: 0, glow: 0 });
    expect(read({ turbulence: 250, glow: -4 })).toMatchObject({ turbulence: 100, glow: 0 });
    expect(read({ turbulence: 33.5, glow: 100 })).toMatchObject({ turbulence: 33.5, glow: 100 });
    expect(normalizeSky({ cumulus: { turbulence: 80, glow: 20 } }).cumulus).toMatchObject({ turbulence: 80, glow: 20 });
  });
});

describe('render look settings: files and share links', () => {
  it('round-trips the new fields through a saved file', () => {
    const scene = createDefaultScene();
    const custom = {
      ...scene,
      render: { ...scene.render, antialias: 'full' as const, softness: 65 },
      sky: { ...scene.sky, stratus: { ...scene.sky.stratus, turbulence: 44, glow: 71 }, cumulus: { ...scene.sky.cumulus, turbulence: 12, glow: 3 } },
    };
    const back = deserializeScene(serializeScene(custom));
    expect(back.render).toMatchObject({ antialias: 'full', softness: 65 });
    expect(back.sky.stratus).toMatchObject({ turbulence: 44, glow: 71 });
    expect(back.sky.cumulus).toMatchObject({ turbulence: 12, glow: 3 });
  });

  it('opens a file from before the new fields with the defaults', () => {
    const scene = createDefaultScene();
    const { antialias: _a, softness: _s, ...render } = scene.render;
    const strip = ({ turbulence: _t, glow: _g, ...rest }: typeof scene.sky.stratus) => rest;
    const old = normalizeScene({ ...scene, render, sky: { ...scene.sky, stratus: strip(scene.sky.stratus), cumulus: strip(scene.sky.cumulus) } });
    expect(old.render).toMatchObject({ antialias: 'full', softness: 30 });
    expect(old.sky.stratus).toMatchObject({ turbulence: 0, glow: 0 });
    expect(old.sky.cumulus).toMatchObject({ turbulence: 0, glow: 0 });
  });

  it('round-trips every combination of the render and cloud settings through a link', () => {
    const scene = createDefaultScene();
    for (const antialias of ['edges', 'full'] as const) {
      for (const softness of [0, 30, 100]) {
        for (const [turbulence, glow] of [[0, 0], [60, 0], [0, 100], [90, 90]]) {
          const s = {
            ...scene,
            render: { ...scene.render, antialias, softness },
            sky: { ...scene.sky, stratus: { ...scene.sky.stratus, turbulence, glow }, cumulus: { ...scene.sky.cumulus, turbulence: glow, glow: turbulence } },
          };
          const back = decodeShareHash(hashOf(encodeShareLink(s, { base: BASE })))!;
          expect(back.render).toEqual(s.render);
          expect(back.sky.stratus).toMatchObject({ turbulence, glow });
          expect(back.sky.cumulus).toMatchObject({ turbulence: glow, glow: turbulence });
        }
      }
    }
  });

  it('keeps default links free of the new fields', () => {
    const text = JSON.stringify(packScene(createDefaultScene()));
    expect(text).not.toMatch(/"(antialias|turbulence|glow)"/);
    expect(packScene(createDefaultScene()).r).toBeUndefined();
  });

  it('decodes a payload from the old codec to the defaults, for every sample scene', () => {
    for (const sample of SAMPLE_SCENES) {
      const scene = sample.build();
      const packed = JSON.parse(JSON.stringify(packScene(scene)));
      if (packed.r) { delete packed.r.antialias; delete packed.r.softness; }
      const back = normalizeScene(unpackScene(packed));
      expect(back.render.antialias).toBe(scene.render.antialias);
      expect(back.render.softness).toBe(scene.render.softness);
    }
    const legacy = normalizeScene(unpackScene({ ...packScene(createDefaultScene()), r: { width: 320 } }));
    expect(legacy.render).toMatchObject({ width: 320, antialias: 'full', softness: 30 });
  });
});

describe('edge-pass planning', () => {
  it('never masks a draft-like single sample or a mosaic pass, and masks every later sample pass', () => {
    for (const mosaic of [true, false]) {
      const passes = planPasses(mosaic, 1);
      expect(passes.some((p) => edgeMasked(p, true))).toBe(false);
    }
    const passes = planPasses(true, 6);
    const masked = passes.filter((p) => edgeMasked(p, true));
    expect(masked.length).toBe(5);
    expect(masked.every((p) => p.kind === 'sample' && p.sample >= 2)).toBe(true);
    expect(passes.filter((p) => p.kind !== 'sample').some((p) => edgeMasked(p, true))).toBe(false);
  });

  it('masks resumed passes and none at all in full mode', () => {
    const resumed = extendPasses(planPasses(false, 1), 3);
    expect(resumed.filter((p) => edgeMasked(p, true)).length).toBe(3);
    expect(resumed.some((p) => edgeMasked(p, false))).toBe(false);
  });
});

describe('sky dice and ranges: turbulence and glow', () => {
  it('stay inside their ranges across many seeds and moods', () => {
    const t = CLOUD_RANGES.turbulence, g = CLOUD_RANGES.glow;
    expect([t.min, t.max, g.min, g.max]).toEqual([0, 100, 0, 100]);
    for (let seed = 1; seed <= 300; seed++) {
      for (const { id: kind } of RANDOM_SKY_KINDS) {
        const sky = randomSky(seed, kind);
        for (const layer of [sky.stratus, sky.cumulus]) {
          expect(layer.turbulence).toBeGreaterThanOrEqual(t.min);
          expect(layer.turbulence).toBeLessThanOrEqual(t.max);
          expect(layer.glow).toBeGreaterThanOrEqual(g.min);
          expect(layer.glow).toBeLessThanOrEqual(g.max);
          expect(Number.isFinite(layer.turbulence + layer.glow)).toBe(true);
        }
      }
    }
  });

  it('is deterministic per seed and sometimes, but not always, torn or glowing', () => {
    expect(randomSky(77, 'golden')).toEqual(randomSky(77, 'golden'));
    let torn = 0, lit = 0, total = 0;
    for (let seed = 1; seed <= 200; seed++) for (const layer of [randomSky(seed).stratus, randomSky(seed).cumulus]) { total++; if (layer.turbulence > 0) torn++; if (layer.glow > 0) lit++; }
    expect(torn).toBeGreaterThan(0);
    expect(lit).toBeGreaterThan(0);
    expect(torn).toBeLessThan(total);
    expect(lit).toBeLessThan(total);
  });
});
