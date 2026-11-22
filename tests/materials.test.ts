import { describe, expect, it } from 'vitest';
import { cloneMaterial, defaultMaterial, makeComponent, makeMaterial } from '@/core/materialUtils';
import type { Material, ObjectType, TextureComponent } from '@/core/types';
import { DRIVABLE_CHANNELS, TEXTURE_MAPPINGS, TEXTURE_TYPES } from '@/materials/channels';
import { renderMaterialPixels } from '@/materials/cpuPreview';
import { defaultMaterialFor } from '@/materials/defaults';
import {
  addComponent,
  addStop,
  driverOf,
  removeComponent,
  removeStop,
  reverseGradient,
  setAltitude,
  setMode,
  setStopPosition,
  toggleDriver,
} from '@/materials/edit';
import { MATERIAL_CATEGORIES, MATERIAL_PRESETS, getMaterialPreset, presetsInCategory } from '@/materials/presets';
import { materialPreviewScene } from '@/materials/previewScene';
import { RANDOM_FAMILIES, randomMaterial } from '@/materials/random';
import { componentField, evalComponent, fieldToPixels, sampleGradient } from '@/materials/texturePreview';
import { sanitizeMaterial, validateMaterial } from '@/materials/validate';

const component = (overrides: Partial<TextureComponent> = {}) => makeComponent(overrides);

describe('material presets', () => {
  it('has 60+ presets with unique ids in known categories, every category populated', () => {
    expect(MATERIAL_PRESETS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(MATERIAL_PRESETS.map((p) => p.id)).size).toBe(MATERIAL_PRESETS.length);
    for (const p of MATERIAL_PRESETS) expect(MATERIAL_CATEGORIES).toContain(p.category);
    for (const c of MATERIAL_CATEGORIES) expect(presetsInCategory(c).length).toBeGreaterThanOrEqual(5);
  });

  it('every preset is a valid material with a name and a description', () => {
    for (const p of MATERIAL_PRESETS) {
      expect(validateMaterial(p.material), p.id).toEqual([]);
      expect(p.material.name).toBe(p.name);
      expect(p.description && p.description.length > 20, p.id).toBe(true);
    }
  });

  it('drivers only reference existing components; gradients are sorted with 2..4 stops', () => {
    for (const p of MATERIAL_PRESETS) {
      const m = p.material;
      for (const [ch, d] of Object.entries(m.drivers)) {
        expect(DRIVABLE_CHANNELS, `${p.id}.${ch}`).toContain(ch);
        expect(d! < m.components.length, `${p.id}.${ch}`).toBe(true);
      }
      for (const c of m.components) {
        expect(c.gradient.length).toBeGreaterThanOrEqual(2);
        expect(c.gradient.length).toBeLessThanOrEqual(4);
        for (let i = 1; i < c.gradient.length; i++) expect(c.gradient[i].at).toBeGreaterThanOrEqual(c.gradient[i - 1].at);
      }
    }
  });

  it('uses every texture type and every mapping somewhere', () => {
    const comps = MATERIAL_PRESETS.flatMap((p) => p.material.components);
    for (const t of TEXTURE_TYPES) expect(comps.some((c) => c.type === t), t).toBe(true);
    for (const m of TEXTURE_MAPPINGS) expect(comps.some((c) => c.mapping === m), m).toBe(true);
  });

  it('includes the Bryce classics and keeps the foundation ids', () => {
    for (const id of ['default', 'greystone', 'mountain-rock', 'sandy-plain', 'blue-lagoon', 'chrome', 'clear-glass']) expect(getMaterialPreset(id), id).toBeDefined();
    const names = MATERIAL_PRESETS.map((p) => p.name.toLowerCase()).join('|');
    for (const word of ['chrome', 'gold', 'glass', 'ocean', 'lagoon', 'lake', 'lava', 'marble', 'strata', 'canyon', 'snow', 'moon', 'grass', 'dune', 'checker', 'planet', 'neon', 'fog']) {
      expect(names.includes(word), word).toBe(true);
    }
    expect(MATERIAL_PRESETS.some((p) => p.material.mode === 'volume')).toBe(true);
    expect(MATERIAL_PRESETS.some((p) => p.material.altitude)).toBe(true);
  });

  it('presets are not shared with the materials handed to new objects', () => {
    const a = defaultMaterialFor('water');
    const b = defaultMaterialFor('water');
    expect(a).not.toBe(b);
    expect(a.components[0]).not.toBe(b.components[0]);
  });

  it('per-type defaults are valid', () => {
    const types: ObjectType[] = ['sphere', 'cube', 'water', 'ground', 'cloud', 'terrain', 'lattice', 'stone', 'tree', 'torus'];
    for (const t of types) expect(validateMaterial(defaultMaterialFor(t)), t).toEqual([]);
    expect(defaultMaterialFor('cloud').mode).toBe('volume');
  });
});

describe('randomMaterial', () => {
  it('is deterministic for a seed', () => {
    for (const seed of [1, 42, 1994, 123456789]) expect(randomMaterial(seed)).toEqual(randomMaterial(seed));
  });

  it('always produces valid materials', () => {
    for (let seed = 0; seed < 400; seed++) {
      const m = randomMaterial(seed);
      expect(validateMaterial(m), `seed ${seed}: ${m.name}`).toEqual([]);
    }
    for (const family of RANDOM_FAMILIES) {
      for (let seed = 0; seed < 25; seed++) expect(validateMaterial(randomMaterial(seed, family)), `${family} ${seed}`).toEqual([]);
    }
  });

  it('is varied', () => {
    const names = new Set<string>();
    const looks = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const m = randomMaterial(seed);
      names.add(m.name);
      looks.add(`${m.mode}:${m.components[0]?.type ?? 'flat'}:${Math.round(m.reflection / 25)}:${Math.round(m.transparency / 25)}`);
    }
    expect(names.size).toBeGreaterThan(25);
    expect(looks.size).toBeGreaterThan(12);
  });
});

describe('texture evaluator', () => {
  it('stays within 0..1 for every type, mapping and extreme parameter', () => {
    const points: [number, number, number][] = [
      [0, 0, 0], [1.3, -2.7, 4.1], [-50.2, 3.3, 17.9], [0.001, 9.99, -0.5], [1000, -1000, 333],
    ];
    for (const type of TEXTURE_TYPES) {
      for (const mapping of TEXTURE_MAPPINGS) {
        for (const [contrast, bias, warp, roughness, octaves] of [[0.5, 0, 0, 0.5, 6], [1, 1, 1, 1, 10], [0, -1, 0.5, 0, 1], [0.9, -0.4, 1, 0.8, 3]]) {
          const c = component({ type, mapping, contrast, bias, warp, roughness, octaves, scale: 0.7, seed: 99 });
          for (const [x, y, z] of points) {
            const v = evalComponent(c, x, y, z, x / 2, y / 2, z / 2);
            expect(Number.isFinite(v), `${type}/${mapping}`).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('is deterministic, seed-dependent and actually varies', () => {
    const c = component({ type: 'fbm', mapping: 'world', scale: 1, seed: 5 });
    const a = evalComponent(c, 0.3, 0.7, 1.1, 0, 0, 0);
    expect(evalComponent(c, 0.3, 0.7, 1.1, 0, 0, 0)).toBe(a);
    const values = new Set<number>();
    for (let i = 0; i < 50; i++) values.add(Math.round(evalComponent(c, i * 0.37, i * 0.11, i * 0.23, 0, 0, 0) * 100));
    expect(values.size).toBeGreaterThan(10);
    const other = component({ type: 'fbm', mapping: 'world', scale: 1, seed: 6 });
    let diff = 0;
    for (let i = 0; i < 20; i++) diff += Math.abs(evalComponent(c, i * 0.5, 0.2, 0.1, 0, 0, 0) - evalComponent(other, i * 0.5, 0.2, 0.1, 0, 0, 0));
    expect(diff).toBeGreaterThan(0.5);
  });

  it('survives degenerate components (zero scale, NaN seed, odd octaves)', () => {
    const c = component({ scale: 0, seed: Number.NaN, octaves: 0 });
    const v = evalComponent(c, 1, 2, 3, 1, 2, 3);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('checker alternates and grid draws thin lines', () => {
    const checker = component({ type: 'checker', mapping: 'world', scale: 1, contrast: 0.5 });
    expect(evalComponent(checker, 0.5, 0.5, 0.5, 0, 0, 0)).not.toBe(evalComponent(checker, 1.5, 0.5, 0.5, 0, 0, 0));
    const grid = component({ type: 'grid', mapping: 'worldTop', scale: 1, octaves: 1, seed: 7 });
    let lines = 0;
    const n = 60;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (evalComponent(grid, (i / n) * 3, 0, (j / n) * 3, 0, 0, 0) > 0.5) lines++;
    expect(lines / (n * n)).toBeGreaterThan(0.08);
    expect(lines / (n * n)).toBeLessThan(0.4);
  });

  it('voronoi is a cell distance: low at cell centers, high toward the borders', () => {
    const cells = component({ type: 'voronoi', mapping: 'world', scale: 1, octaves: 1, seed: 3 });
    const values: number[] = [];
    for (let i = 0; i < 400; i++) values.push(evalComponent(cells, i * 0.137, i * 0.071, i * 0.053, 0, 0, 0));
    expect(Math.min(...values)).toBeLessThan(0.25);
    expect(Math.max(...values)).toBeGreaterThan(0.75);
  });

  it('samples gradients with clamping and interpolation', () => {
    const g = [{ at: 0.2, color: [0, 0, 0] as [number, number, number] }, { at: 0.8, color: [1, 0.5, 0] as [number, number, number] }];
    expect(sampleGradient(g, 0)).toEqual([0, 0, 0]);
    expect(sampleGradient(g, 1)).toEqual([1, 0.5, 0]);
    const mid = sampleGradient(g, 0.5);
    expect(mid[0]).toBeCloseTo(0.5);
    expect(mid[1]).toBeCloseTo(0.25);
  });

  it('builds swatch fields and pixels for every mapping', () => {
    for (const mapping of TEXTURE_MAPPINGS) {
      const c = component({ type: 'marble', mapping, scale: 0.5 });
      const field = componentField(c, 16);
      expect(field.length).toBe(256);
      for (const v of field) expect(v >= 0 && v <= 1).toBe(true);
      for (const mode of ['color', 'alpha', 'bump'] as const) {
        const px = fieldToPixels(c, field, 16, mode);
        expect(px.length).toBe(16 * 16 * 4);
        expect(px[3]).toBe(255);
      }
    }
  });
});

describe('material editing helpers', () => {
  const base = (): Material =>
    makeMaterial({
      components: [component({ seed: 1 }), component({ seed: 2 }), component({ seed: 3 })],
      drivers: { diffuseColor: 0, bumpHeight: 1, reflection: 2, ambience: 1 },
    });

  it('removing a component releases its channels and shifts later drivers down', () => {
    const m = removeComponent(base(), 1);
    expect(m.components.map((c) => c.seed)).toEqual([1, 3]);
    expect(m.drivers).toEqual({ diffuseColor: 0, reflection: 1 });
    expect(validateMaterial(m)).toEqual([]);
  });

  it('toggles drivers like Bryce component indicators and creates missing components', () => {
    let m = defaultMaterial();
    m = toggleDriver(m, 'diffuseColor', 1, (i) => component({ seed: 10 + i }));
    expect(m.components.length).toBe(2);
    expect(driverOf(m, 'diffuseColor')).toBe(1);
    m = toggleDriver(m, 'diffuseColor', 1, () => component());
    expect(driverOf(m, 'diffuseColor')).toBe(-1);
    expect(validateMaterial(m)).toEqual([]);
  });

  it('never exceeds three components', () => {
    let m = base();
    m = addComponent(m, component());
    expect(m.components.length).toBe(3);
  });

  it('edits gradients without breaking order or limits', () => {
    let m = makeMaterial({ components: [component()] });
    m = addStop(m, 0);
    m = addStop(m, 0);
    expect(m.components[0].gradient.length).toBe(4);
    expect(addStop(m, 0)).toBe(m);
    m = setStopPosition(m, 0, 1, 2);
    const g = m.components[0].gradient;
    expect(g[1].at).toBeLessThanOrEqual(g[2].at);
    m = removeStop(removeStop(m, 0, 1), 0, 1);
    expect(m.components[0].gradient.length).toBe(2);
    expect(removeStop(m, 0, 0)).toBe(m);
    m = reverseGradient(m, 0);
    expect(validateMaterial(m)).toEqual([]);
  });

  it('switches modes and altitude blends immutably', () => {
    const m = defaultMaterial();
    const v = setMode(m, 'volume');
    expect(v.mode).toBe('volume');
    expect(v.volumeDensity).toBeGreaterThan(0);
    expect(m.mode).toBe('surface');
    const a = setAltitude(m, { start: 0.3 });
    expect(a.altitude?.start).toBe(0.3);
    expect(setAltitude(a, null).altitude).toBeUndefined();
    expect(validateMaterial(a)).toEqual([]);
  });
});

describe('sanitizeMaterial', () => {
  it('repairs broken input into a valid material', () => {
    const broken = {
      name: '',
      diffuseColor: [2, -1, 'x'],
      diffusion: 500,
      refraction: 10,
      components: [{ type: 'nope', gradient: [{ at: 0.9, color: [1, 1, 1] }, { at: 0.1, color: [0, 0, 0] }] }, null, 5, {}, {}],
      drivers: { diffuseColor: 2, bogus: 0, reflection: 7 },
      altitude: { start: 9 },
      mode: 'volume',
    };
    const m = sanitizeMaterial(broken);
    expect(validateMaterial(m)).toEqual([]);
    expect(m.components.length).toBe(3);
    expect(m.mode).toBe('volume');
    expect(m.drivers.diffuseColor).toBe(2);
    expect(sanitizeMaterial(null)).toEqual(defaultMaterial());
  });

  it('round-trips a valid material unchanged', () => {
    const m = cloneMaterial(getMaterialPreset('lava-flow')!.material);
    expect(sanitizeMaterial(JSON.parse(JSON.stringify(m)))).toEqual(JSON.parse(JSON.stringify(m)));
  });
});

describe('preview scene and CPU preview', () => {
  it('builds a scene with the material on the subject for each shape', () => {
    const m = getMaterialPreset('chrome')!.material;
    for (const shape of ['sphere', 'cube', 'plane'] as const) {
      const scene = materialPreviewScene(m, { shape });
      expect(scene.objects.length).toBe(2);
      expect(scene.objects[1].material).toBe(m);
      expect(scene.render.width / scene.render.height).toBe(1);
    }
    const a = materialPreviewScene(m, { shape: 'sphere' });
    const b = materialPreviewScene(m, { shape: 'sphere', yaw: 30 });
    expect(a.objects[0]).toBe(b.objects[0]);
    expect(a.objects[1]).toBe(b.objects[1]);
    expect(a.camera.position).not.toEqual(b.camera.position);
  });

  it('renders thumbnails of surface and volume materials', () => {
    for (const id of ['chrome', 'clear-glass', 'lava-flow', 'cumulus-puff', 'canyon-layers']) {
      const px = renderMaterialPixels(getMaterialPreset(id)!.material, 12, 12, { maxOctaves: 3 });
      expect(px.length).toBe(12 * 12 * 4);
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
      expect(sum).toBeGreaterThan(0);
    }
    const swatch = renderMaterialPixels(getMaterialPreset('canyon-layers')!.material, 8, 8, { shape: 'swatch' });
    expect(swatch[3]).toBe(255);
  });

  it('renders the plane thumbnails that water and ground presets ask for', () => {
    const planes = MATERIAL_PRESETS.filter((p) => p.preview === 'plane');
    expect(planes.length).toBeGreaterThan(8);
    for (const p of planes.slice(0, 4)) {
      const px = renderMaterialPixels(p.material, 10, 10, { shape: 'plane', maxOctaves: 3 });
      // Sky at the top, the material below: the two halves differ.
      const top = px[0] + px[1] + px[2];
      const bottom = px[(9 * 10) * 4] + px[(9 * 10) * 4 + 1] + px[(9 * 10) * 4 + 2];
      expect(top).not.toBe(bottom);
    }
  });
});
