/** Object-type metadata shared by the palettes, viewport, renderer and libraries. */
import type { InfinitePlaneType, LightType, ObjectType, PrimitiveType } from './types';

export const OBJECT_LABELS: Record<ObjectType, string> = {
  sphere: 'Sphere',
  cube: 'Cube',
  cylinder: 'Cylinder',
  cone: 'Cone',
  torus: 'Torus',
  pyramid: 'Pyramid',
  disc: 'Disc',
  square: 'Square',
  water: 'Water Plane',
  ground: 'Ground Plane',
  cloud: 'Cloud Plane',
  terrain: 'Terrain',
  lattice: 'Symmetrical Lattice',
  stone: 'Stone',
  tree: 'Tree',
  radialLight: 'Radial Light',
  spotLight: 'Spotlight',
  squareSpotLight: 'Square Spotlight',
  parallelLight: 'Parallel Light',
};

/** Short base names used when naming new objects ("Sphere 2", "Water 1"). */
export const OBJECT_BASE_NAMES: Record<ObjectType, string> = {
  ...OBJECT_LABELS,
  water: 'Water',
  ground: 'Ground',
  cloud: 'Cloud',
  lattice: 'Lattice',
};

export const PRIMITIVE_TYPES: PrimitiveType[] = ['sphere', 'cube', 'cylinder', 'cone', 'torus', 'pyramid', 'disc', 'square'];
export const INFINITE_PLANE_TYPES: InfinitePlaneType[] = ['water', 'cloud', 'ground'];
export const LIGHT_TYPES: LightType[] = ['radialLight', 'spotLight', 'squareSpotLight', 'parallelLight'];

export const isPrimitive = (t: ObjectType): t is PrimitiveType => (PRIMITIVE_TYPES as string[]).includes(t);
export const isInfinitePlane = (t: ObjectType): t is InfinitePlaneType => t === 'water' || t === 'ground' || t === 'cloud';
export const isLight = (t: ObjectType): t is LightType => (LIGHT_TYPES as string[]).includes(t);
export const isTerrainLike = (t: ObjectType): t is 'terrain' | 'lattice' => t === 'terrain' || t === 'lattice';
/** Flat, zero-thickness shapes. */
export const isFlat = (t: ObjectType) => t === 'disc' || t === 'square';
/** Types whose material can be edited in the Material Lab. */
export const hasMaterial = (t: ObjectType) => !isLight(t);

/** Groups used by the Selection palette ("select all terrains", ...). */
export const SELECTION_GROUPS: { id: string; label: string; types: ObjectType[] }[] = [
  { id: 'terrains', label: 'Terrains', types: ['terrain', 'lattice'] },
  { id: 'planes', label: 'Infinite Planes', types: ['water', 'cloud', 'ground'] },
  { id: 'primitives', label: 'Primitives', types: PRIMITIVE_TYPES },
  { id: 'stones', label: 'Stones', types: ['stone'] },
  { id: 'trees', label: 'Trees', types: ['tree'] },
  { id: 'lights', label: 'Lights', types: LIGHT_TYPES },
];
