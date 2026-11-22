/**
 * What each library shows and does: presets as uniform items (name, category, description,
 * thumbnail job) plus the kind's apply rule.
 *   objects   -> added on the ground in front of the active camera, facing it, selected
 *   materials -> applied to the selected objects (blocked with a hint when none)
 *   skies     -> replace the sky
 *   scenes    -> replace the scene (the window asks first when there are unsaved edits)
 */
import { getActiveCamera } from '@/core/cameraOps';
import { defaultRenderSettings } from '@/core/defaults';
import { DEG } from '@/core/math';
import { cloneMaterial } from '@/core/materialUtils';
import { hasMaterial } from '@/core/objects';
import { useStore } from '@/core/store';
import type { LibraryKind, Scene, SceneObject } from '@/core/types';
import { markClean } from '@/io/dirty';
import { MATERIAL_CATEGORIES, MATERIAL_PRESETS } from '@/materials/presets';
import { materialPreviewScene } from '@/materials/previewScene';
import { cam, make } from '@/scenes/build/kit';
import { matte } from '@/scenes/build/materials';
import { boundsCenter, boundsRadius, groupBounds, placeInView } from '@/scenes/build/placement';
import { studioDusk, studioSky } from '@/scenes/build/skies';
import { OBJECT_CATEGORIES, OBJECT_PRESETS, type ObjectPreset } from '@/scenes/objectLibrary';
import { SAMPLE_SCENES, SCENE_CATEGORIES } from '@/scenes/samples';
import { SKY_CATEGORIES, SKY_PRESETS } from '@/sky/presets';
import { skyPreviewScene } from '@/sky/previewScene';
import { paintMaterialBall, paintObjects, paintSky } from './fallbackArt';
import type { ThumbJob } from './thumbnails';

export interface LibraryItem {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Short facts shown under the description. */
  meta?: string;
  /** Thumbnail tile and large preview jobs. */
  thumb: ThumbJob;
  large: ThumbJob;
  apply: () => void;
}

export interface LibrarySpec {
  kind: LibraryKind;
  title: string;
  categories: string[];
  items: LibraryItem[];
  /** Tile shape. */
  wide: boolean;
  /** Why Apply is unavailable right now (null when it is available). */
  blocked: () => string | null;
  /** Ask before applying (scenes with unsaved edits). */
  needsConfirm: boolean;
}

const TILE = { square: [96, 96], wide: [112, 84] } as const;
const LARGE = { square: [132, 132], wide: [176, 132] } as const;

function jobs(key: string, wide: boolean, scene: () => Scene, fallback: ThumbJob['fallback']): { thumb: ThumbJob; large: ThumbJob } {
  const [tw, th] = wide ? TILE.wide : TILE.square;
  const [lw, lh] = wide ? LARGE.wide : LARGE.square;
  return {
    thumb: { key: `${key}@${tw}`, width: tw, height: th, scene, fallback },
    large: { key: `${key}@${lw}`, width: lw, height: lh, scene, fallback },
  };
}

/** Categories in order, plus any a preset uses that the list forgot. */
function categoriesOf(listed: string[], items: { category: string }[]): string[] {
  const out = [...listed];
  for (const it of items) if (!out.includes(it.category)) out.push(it.category);
  return out.filter((c) => items.some((it) => it.category === c));
}

const status = (text: string) => useStore.getState().showStatus(text);

// --- objects -------------------------------------------------------------------------

const STUDIO_FLOOR = matte([0.6, 0.6, 0.62], 'Studio Floor');

/** A small studio: the preset's objects on a gray floor, framed from a 3/4 view. */
export function objectPreviewScene(preset: ObjectPreset, objects: SceneObject[] = preset.build()): Scene {
  const b = groupBounds(objects) ?? { min: [-1, 0, -1], max: [1, 2, 1] };
  const center = boundsCenter(b);
  const radius = Math.max(0.6, boundsRadius(b));
  const fov = 30;
  const yaw = (preset.preview?.yaw ?? 28) * DEG;
  const elev = (preset.preview?.elevation ?? 18) * DEG;
  const dist = (radius / Math.sin((fov / 2) * DEG)) * 1.02;
  const dir = [Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev)];
  return {
    version: 1,
    name: preset.name,
    objects: [make('ground', { name: 'Studio Floor', material: STUDIO_FLOOR }), ...objects],
    sky: preset.preview?.night ? studioDusk() : studioSky(),
    camera: cam([center[0] + dir[0] * dist, center[1] + dir[1] * dist, center[2] + dir[2] * dist], center, fov),
    render: defaultRenderSettings(),
  };
}

function objectsSpec(): LibrarySpec {
  const items = OBJECT_PRESETS.map<LibraryItem>((p) => {
    const count = p.build().length;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description ?? '',
      meta: `${count} object${count === 1 ? '' : 's'}`,
      ...jobs(`objects:${p.id}`, false, () => objectPreviewScene(p), (ctx, w, h) => paintObjects(ctx, w, h, p.build())),
      apply: () => {
        const placed = placeInView(p.build(), getActiveCamera());
        useStore.getState().addObjects(placed);
        status(`Added "${p.name}"${placed.length > 1 ? ` (${placed.length} objects, selected)` : ''}`);
      },
    };
  });
  return { kind: 'objects', title: 'Objects', categories: categoriesOf(OBJECT_CATEGORIES, items), items, wide: false, blocked: () => null, needsConfirm: false };
}

// --- materials -------------------------------------------------------------------------

const materialTargets = () => {
  const s = useStore.getState();
  return s.scene.objects.filter((o) => s.selection.includes(o.id) && hasMaterial(o.type)).map((o) => o.id);
};

function materialsSpec(): LibrarySpec {
  const items = MATERIAL_PRESETS.map<LibraryItem>((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description ?? '',
    meta: p.material.mode === 'volume' ? 'Volume material' : p.material.components.length ? `${p.material.components.length} texture component${p.material.components.length > 1 ? 's' : ''}` : 'Flat colors',
    ...jobs(`materials:${p.id}`, false, () => materialPreviewScene(p.material), (ctx, w, h) => paintMaterialBall(ctx, w, h, p.material)),
    apply: () => {
      const ids = materialTargets();
      if (!ids.length) return;
      useStore.getState().setMaterial(ids, { ...cloneMaterial(p.material), name: p.name });
      status(`Applied "${p.name}" to ${ids.length} object${ids.length > 1 ? 's' : ''}`);
    },
  }));
  return {
    kind: 'materials',
    title: 'Materials',
    categories: categoriesOf(MATERIAL_CATEGORIES, items),
    items,
    wide: false,
    blocked: () => (materialTargets().length ? null : 'Select an object in the scene first: materials apply to the selection.'),
    needsConfirm: false,
  };
}

// --- skies -------------------------------------------------------------------------------

function skiesSpec(): LibrarySpec {
  const items = SKY_PRESETS.map<LibraryItem>((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description ?? '',
    meta: `Sun ${Math.round(p.sky.sunAltitude)}° high${p.sky.stars > 0 && p.sky.sunAltitude < 0 ? ', stars' : ''}${p.sky.fogDensity > 0 ? ', fog' : ''}`,
    ...jobs(`skies:${p.id}`, true, () => skyPreviewScene(p.sky), (ctx, w, h) => paintSky(ctx, w, h, p.sky)),
    apply: () => {
      useStore.getState().setSky(structuredClone(p.sky));
      status(`Sky: "${p.name}"`);
    },
  }));
  return { kind: 'skies', title: 'Skies', categories: categoriesOf(SKY_CATEGORIES, items), items, wide: true, blocked: () => null, needsConfirm: false };
}

// --- scenes ---------------------------------------------------------------------------------

function scenesSpec(): LibrarySpec {
  const items = SAMPLE_SCENES.map<LibraryItem>((p) => ({
    id: p.id,
    name: p.name,
    category: p.category ?? 'Samples',
    description: p.description,
    ...jobs(`scenes:${p.id}`, true, p.build, (ctx, w, h) => {
      const scene = p.build();
      const sea = scene.objects.find((o) => o.type === 'water' || o.type === 'ground');
      paintSky(ctx, w, h, scene.sky, 0.6, sea ? sea.material.diffuseColor : [0.3, 0.3, 0.3]);
    }),
    apply: () => {
      const scene = p.build();
      const s = useStore.getState();
      s.loadScene(scene, { keepHistory: true });
      markClean(scene);
      status(`Opened "${p.name}". Undo brings your previous scene back.`);
    },
  }));
  return { kind: 'scenes', title: 'Scenes', categories: categoriesOf(SCENE_CATEGORIES, items), items, wide: true, blocked: () => null, needsConfirm: true };
}

const builders: Record<LibraryKind, () => LibrarySpec> = { objects: objectsSpec, materials: materialsSpec, skies: skiesSpec, scenes: scenesSpec };
const specs = new Map<LibraryKind, LibrarySpec>();

/** The (cached) library description for a kind. */
export function librarySpec(kind: LibraryKind): LibrarySpec {
  let spec = specs.get(kind);
  if (!spec) {
    spec = builders[kind]();
    specs.set(kind, spec);
  }
  return spec;
}
