/** Scenes for the renderer dev harness (dev/renderer-test.html). Not part of the app build. */
import { createObject, defaultCamera, defaultRenderSettings } from '@/core/defaults';
import { makeComponent, makeMaterial } from '@/core/materialUtils';
import type { Material, ObjectType, Scene, SceneObject, TextureType } from '@/core/types';
import { chromeMaterial, glassMaterial } from '@/materials/defaults';
import { createDefaultScene } from '@/scenes/defaultScene';
import { defaultSky } from '@/sky/defaults';
import { createTerrainData } from '@/terrain';

function scene(name: string, objects: SceneObject[], patch: Partial<Scene> = {}): Scene {
  return { version: 1, name, objects, sky: defaultSky(), camera: defaultCamera(), render: defaultRenderSettings(), ...patch };
}

function builder() {
  const objects: SceneObject[] = [];
  const add = (type: ObjectType, overrides: Partial<SceneObject> = {}) => {
    const o = createObject(type, overrides, objects);
    objects.push(o);
    return o;
  };
  return { objects, add };
}

const t = (position: [number, number, number], scale: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => ({ position, rotation, scale });

const gold = (): Material =>
  makeMaterial({ name: 'Gold', diffuseColor: [0.95, 0.72, 0.25], diffusion: 25, specularity: 90, specularHalo: 85, metallicity: 85, reflection: 70, specularColor: [1, 0.9, 0.6] });

const red = (): Material => makeMaterial({ name: 'Red Plastic', diffuseColor: [0.85, 0.12, 0.08], specularity: 60, specularHalo: 70, reflection: 8 });

const neon = (): Material => makeMaterial({ name: 'Neon', diffuseColor: [0.2, 1, 0.8], ambientColor: [0.2, 1, 0.8], ambience: 100, diffusion: 10 });

function textureMaterial(type: TextureType): Material {
  const palette: Record<TextureType, [number, number, number][]> = {
    fbm: [[0.1, 0.2, 0.5], [0.9, 0.9, 0.95]],
    ridged: [[0.15, 0.1, 0.08], [0.85, 0.7, 0.5]],
    turbulence: [[0.95, 0.95, 1], [0.2, 0.3, 0.7]],
    voronoi: [[0.05, 0.3, 0.05], [0.6, 0.9, 0.3]],
    marble: [[0.95, 0.93, 0.9], [0.25, 0.25, 0.3]],
    strata: [[0.55, 0.25, 0.1], [0.95, 0.75, 0.5]],
    spots: [[0.95, 0.8, 0.4], [0.15, 0.1, 0.05]],
    granite: [[0.3, 0.3, 0.32], [0.85, 0.82, 0.8]],
    waves: [[0.05, 0.2, 0.45], [0.6, 0.85, 1]],
    checker: [[0.05, 0.05, 0.05], [0.95, 0.95, 0.95]],
    grid: [[0.1, 0.1, 0.2], [0.3, 1, 0.9]],
  };
  const stops = palette[type];
  return makeMaterial({
    name: type,
    specularity: 30,
    bumpHeight: 30,
    components: [
      makeComponent({
        type,
        mapping: 'object',
        scale: type === 'checker' || type === 'grid' ? 0.5 : 0.8,
        gradient: [
          { at: 0, color: stops[0] },
          { at: 1, color: stops[1] },
        ],
        bump: 0.6,
      }),
    ],
    drivers: { diffuseColor: 0, bumpHeight: 0 },
  });
}

function showcase(): Scene {
  const { objects, add } = builder();
  add('ground', { transform: t([0, -2, 0], [1, 1, 1]) });
  add('water', { transform: t([0, 0, 0], [1, 1, 1]) });
  add('terrain', { name: 'Peaks', terrain: createTerrainData('fractal', 7), transform: t([0, 5, -60], [40, 9, 20]) });
  add('sphere', { name: 'Chrome', material: chromeMaterial(), transform: t([-14, 3, 6], [3, 3, 3]) });
  add('sphere', { name: 'Glass', material: glassMaterial(), transform: t([-6, 2.6, 12], [2.5, 2.5, 2.5]) });
  add('cube', { material: red(), transform: t([2, 2, 4], [2, 2, 2], [0, 35, 0]) });
  add('cylinder', { material: gold(), transform: t([8, 3, 4], [1.5, 3, 1.5]) });
  add('cone', { material: textureMaterial('marble'), transform: t([14, 3, 6], [2, 3, 2]) });
  add('pyramid', { material: textureMaterial('strata'), transform: t([20, 3, 0], [3, 3, 3], [0, 20, 0]) });
  add('torus', { material: gold(), torus: { minorRadius: 0.25 }, transform: t([0, 6, -6], [3.5, 3.5, 3.5], [70, 0, 10]) });
  add('disc', { material: textureMaterial('checker'), transform: t([-20, 0.2, 14], [3, 1, 3]) });
  add('square', { material: textureMaterial('grid'), transform: t([-12, 7, -8], [3, 1, 3], [80, 20, 0]) });
  add('lattice', { terrain: createTerrainData('fractal', 42), transform: t([-24, 12, -16], [8, 3, 8]) });
  add('stone', { stone: { seed: 5, lumpiness: 0.7, roughness: 0.6 }, transform: t([4, 0.8, 14], [2.2, 1.4, 1.8]) });
  const crowns = ['round', 'cone', 'palm', 'willow'] as const;
  crowns.forEach((crown, i) =>
    add('tree', {
      tree: { seed: 11 + i, trunkHeight: crown === 'palm' ? 0.7 : 0.4, trunkWidth: 0.08, crown, crownNoise: 0.6, trunkColor: [0.35, 0.24, 0.14] },
      transform: t([26 + i * 7, 4, -10], [2.8, 4, 2.8]),
    }),
  );
  add('sphere', { name: 'Neon', material: neon(), transform: t([-2, 9, -14], [1.2, 1.2, 1.2]) });
  add('radialLight', { light: { color: [1, 0.6, 0.3], intensity: 140, falloff: 'squared', coneAngle: 45, softness: 0.3, visible: true, castShadows: true }, transform: t([-8, 6, 2], [0.5, 0.5, 0.5]) });
  add('spotLight', { light: { color: [0.4, 0.6, 1], intensity: 180, falloff: 'linear', coneAngle: 30, softness: 0.4, visible: false, castShadows: true }, transform: t([2, 14, 4], [0.6, 0.6, 0.6]) });
  add('squareSpotLight', { light: { color: [1, 0.3, 0.6], intensity: 160, falloff: 'linear', coneAngle: 25, softness: 0.2, visible: false, castShadows: true }, transform: t([14, 12, 6], [0.6, 0.6, 0.6]) });
  add('cloud', { transform: t([0, 40, 0], [1, 6, 1]) });
  return scene('Showcase', objects, {
    camera: { position: [0, 12, 46], target: [2, 4, 0], roll: 0, fov: 55 },
    sky: { ...defaultSky(), sunAzimuth: 200, sunAltitude: 32 },
  });
}

function textureGallery(): Scene {
  const { objects, add } = builder();
  add('ground', {
    material: makeMaterial({
      name: 'Floor',
      components: [makeComponent({ type: 'checker', mapping: 'worldTop', scale: 4, gradient: [{ at: 0, color: [0.3, 0.3, 0.33] }, { at: 1, color: [0.75, 0.75, 0.78] }] })],
      drivers: { diffuseColor: 0 },
    }),
  });
  const types: TextureType[] = ['fbm', 'ridged', 'turbulence', 'voronoi', 'marble', 'strata', 'spots', 'granite', 'waves', 'checker', 'grid'];
  types.forEach((ty, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    add('sphere', { name: ty, material: textureMaterial(ty), transform: t([(col - 1.5) * 7, 2.6, -row * 7], [2.6, 2.6, 2.6]) });
  });
  add('cube', { material: makeMaterial({ ...textureMaterial('fbm'), components: [makeComponent({ type: 'fbm', mapping: 'spherical', scale: 0.4, gradient: [{ at: 0, color: [0.1, 0.3, 0.8] }, { at: 0.5, color: [0.2, 0.6, 0.2] }, { at: 0.7, color: [0.6, 0.5, 0.3] }, { at: 1, color: [1, 1, 1] }] })], drivers: { diffuseColor: 0 } }), transform: t([10.5, 2.6, -14], [2.4, 2.4, 2.4], [20, 30, 0]) });
  return scene('Textures', objects, { camera: { position: [0, 16, 26], target: [0, 2, -7], roll: 0, fov: 50 } });
}

function withSky(base: Scene, patch: Partial<Scene['sky']>, name: string): Scene {
  return { ...base, name, sky: { ...base.sky, ...patch } };
}

export function testScenes(): Record<string, () => Scene> {
  return {
    startup: () => createDefaultScene(),
    showcase,
    textures: textureGallery,
    soft: () => withSky(createDefaultScene(), { ...defaultSky() }, 'Soft'),
    sunset: () => withSky(createDefaultScene(), { ...defaultSky(), sunAzimuth: 10, sunAltitude: 4, sunGlow: 70, sunSize: 45, haze: 35 }, 'Sunset'),
    night: () => withSky(createDefaultScene(), { ...defaultSky(), sunAzimuth: 195, sunAltitude: -22, moonPhase: 0.42, moonSize: 45, stars: 85 }, 'Night'),
    fog: () => withSky(createDefaultScene(), { ...defaultSky(), fogDensity: 55, fogHeight: 5, haze: 45, fogColor: [0.85, 0.86, 0.9] }, 'Fog'),
    cloudplane: () => {
      const s = createDefaultScene();
      return { ...s, name: 'Cloud plane', objects: [...s.objects, createObject('cloud', { transform: t([0, 34, 0], [1, 5, 1]) })], sky: { ...defaultSky() } };
    },
    alien: () =>
      withSky(createDefaultScene(), {
        mode: 'custom',
        zenithColor: [0.25, 0.05, 0.35],
        horizonColor: [0.95, 0.45, 0.6],
        skyDomeColor: [0.8, 0.4, 0.9],
        sunColor: [1, 0.85, 0.6],
        sunAltitude: 12,
        sunAzimuth: 20,
        rainbow: true,
        haze: 30,
        hazeColor: [0.95, 0.6, 0.75],
      }, 'Alien'),
    rainbow: () => withSky(createDefaultScene(), { sunAzimuth: 180, sunAltitude: 18, rainbow: true }, 'Rainbow'),
    empty: () => scene('Empty', []),
  };
}
