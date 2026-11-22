/** The Create palette catalog (also used by the Objects > Create menu). */
import type { ObjectType, Vec3 } from '@/core/types';
import type { IconKind } from './icons/iconKinds';

export type CreateGroup = 'planes' | 'procedural' | 'primitives' | 'flat' | 'lights';

export interface CreateItem {
  id: string;
  kind: IconKind;
  type: ObjectType;
  label: string;
  group: CreateGroup;
  /** Size override (half-extents) for stretched variants. */
  scale?: Vec3;
}

export const CREATE_GROUP_LABELS: Record<CreateGroup, string> = {
  planes: 'Infinite Planes',
  procedural: 'Procedurals',
  primitives: 'Primitives',
  flat: '2D Shapes',
  lights: 'Lights',
};

export const CREATE_ITEMS: CreateItem[] = [
  { id: 'water', kind: 'water', type: 'water', label: 'Water Plane', group: 'planes' },
  { id: 'cloud', kind: 'cloud', type: 'cloud', label: 'Cloud Plane', group: 'planes' },
  { id: 'ground', kind: 'ground', type: 'ground', label: 'Ground Plane', group: 'planes' },
  { id: 'terrain', kind: 'terrain', type: 'terrain', label: 'Terrain', group: 'procedural' },
  { id: 'lattice', kind: 'lattice', type: 'lattice', label: 'Symmetrical Lattice', group: 'procedural' },
  { id: 'stone', kind: 'stone', type: 'stone', label: 'Stone', group: 'procedural' },
  { id: 'tree', kind: 'tree', type: 'tree', label: 'Tree', group: 'procedural' },
  { id: 'sphere', kind: 'sphere', type: 'sphere', label: 'Sphere', group: 'primitives' },
  { id: 'flatSphere', kind: 'flatSphere', type: 'sphere', label: 'Flattened Sphere', group: 'primitives', scale: [3, 1.1, 3] },
  { id: 'cylinder', kind: 'cylinder', type: 'cylinder', label: 'Cylinder', group: 'primitives' },
  { id: 'tallCylinder', kind: 'tallCylinder', type: 'cylinder', label: 'Tall Cylinder', group: 'primitives', scale: [1.1, 4.5, 1.1] },
  { id: 'cube', kind: 'cube', type: 'cube', label: 'Cube', group: 'primitives' },
  { id: 'tallCube', kind: 'tallCube', type: 'cube', label: 'Monolith', group: 'primitives', scale: [1, 4.5, 0.35] },
  { id: 'flatCube', kind: 'flatCube', type: 'cube', label: 'Slab', group: 'primitives', scale: [3.5, 0.45, 3.5] },
  { id: 'torus', kind: 'torus', type: 'torus', label: 'Torus', group: 'primitives' },
  { id: 'cone', kind: 'cone', type: 'cone', label: 'Cone', group: 'primitives' },
  { id: 'pyramid', kind: 'pyramid', type: 'pyramid', label: 'Pyramid', group: 'primitives' },
  { id: 'disc', kind: 'disc', type: 'disc', label: 'Disc', group: 'flat' },
  { id: 'square', kind: 'square', type: 'square', label: 'Square', group: 'flat' },
  { id: 'radialLight', kind: 'radialLight', type: 'radialLight', label: 'Radial Light', group: 'lights' },
  { id: 'spotLight', kind: 'spotLight', type: 'spotLight', label: 'Spotlight', group: 'lights' },
  { id: 'squareSpotLight', kind: 'squareSpotLight', type: 'squareSpotLight', label: 'Square Spotlight', group: 'lights' },
  { id: 'parallelLight', kind: 'parallelLight', type: 'parallelLight', label: 'Parallel Light', group: 'lights' },
];

export function groupedCreateItems(): { group: CreateGroup; items: CreateItem[] }[] {
  const order: CreateGroup[] = ['planes', 'procedural', 'primitives', 'flat', 'lights'];
  return order.map((group) => ({ group, items: CREATE_ITEMS.filter((i) => i.group === group) }));
}
