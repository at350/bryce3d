/** Object and polygon counts for the Text Display Area (Bryce-style "2 objects / 1 polygon"). */
import { isInfinitePlane, isLight } from '@/core/objects';
import type { SceneObject } from '@/core/types';

const PRIMITIVE_POLYS: Record<string, number> = {
  sphere: 960,
  cube: 12,
  cylinder: 128,
  cone: 64,
  torus: 1536,
  pyramid: 6,
  disc: 64,
  square: 2,
  stone: 2560,
  tree: 3840,
};

/** Rough polygon count of an object as Bryce would report it (planes count as one). */
export function polygonEstimate(o: SceneObject): number {
  if (isLight(o.type)) return 0;
  if (isInfinitePlane(o.type)) return 1;
  if (o.type === 'terrain' || o.type === 'lattice') {
    const n = o.terrain?.resolution ?? 128;
    const tris = 2 * (n - 1) * (n - 1);
    return o.type === 'lattice' ? tris * 2 : tris;
  }
  return PRIMITIVE_POLYS[o.type] ?? 100;
}

export function scenePolygons(objects: SceneObject[]): number {
  return objects.reduce((sum, o) => sum + polygonEstimate(o), 0);
}

export function formatPolygons(n: number): string {
  if (n === 1) return '1 polygon';
  if (n < 10_000) return `${n.toLocaleString('en-US')} polygons`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)} K polygons`;
  return `${(n / 1_000_000).toFixed(2)} mil polygons`;
}

export const formatObjects = (n: number) => (n === 1 ? '1 object' : `${n} objects`);

/** "1:23" style elapsed time for renders. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
