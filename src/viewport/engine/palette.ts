/** Colors of the Working window (sRGB 0..1 unless noted). */
import { FAMILY_COLORS, SELECTED_COLOR } from '@/core/defaults';
import { isInfinitePlane, isLight } from '@/core/objects';
import type { InfinitePlaneType, RGB, SceneObject } from '@/core/types';

/** The light textured paper behind the wireframes (average tone, also the depth-cue fog color). */
export const PAPER: RGB = [0.862, 0.858, 0.836];
export const PAPER_CSS = '#dcdbd5';

/** Bryce's thin blue horizon line. */
export const HORIZON_CSS = 'rgba(52, 96, 220, 0.85)';

export const PLANE_TINTS: Record<InfinitePlaneType, RGB> = {
  water: [0.22, 0.42, 0.66],
  ground: [0.42, 0.38, 0.32],
  cloud: [0.5, 0.6, 0.76],
};

export const PLANE_OPACITY: Record<InfinitePlaneType, number> = { water: 0.62, ground: 0.55, cloud: 0.42 };

/** Planes under another plane (a sea floor below the water) are drawn fainter. */
export const SUBMERGED_PLANE_FACTOR = 0.45;

/** Lights in the default family get a warm tint so they read as lights. */
export const LIGHT_TINT: RGB = [0.78, 0.52, 0.06];
export const CAMERA_TINT: RGB = [0.18, 0.34, 0.8];

/** The soft pink of a selected object's wireframe shadow on the ground. */
export const SHADOW_COLOR: RGB = [0.93, 0.42, 0.46];

export function familyColor(o: SceneObject): RGB {
  const fam = o.family ?? 0;
  if (fam === 0 && isLight(o.type)) return LIGHT_TINT;
  if (fam === 0 && isInfinitePlane(o.type)) return PLANE_TINTS[o.type as InfinitePlaneType];
  return FAMILY_COLORS[((fam % FAMILY_COLORS.length) + FAMILY_COLORS.length) % FAMILY_COLORS.length] ?? FAMILY_COLORS[0];
}

/** Wire color for an object in its current state. */
export function wireColor(o: SceneObject, selected: boolean, hovered: boolean): RGB {
  if (selected) return SELECTED_COLOR;
  const c = familyColor(o);
  return hovered ? [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55] : c;
}

export const cssRgb = (c: RGB, a = 1) =>
  `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`;
