import type { ObjectType } from '@/core/types';

/**
 * Every icon the app can draw. Object types draw the object; the rest are tool glyphs.
 * Owners of src/ui may add kinds; other modules may use any listed kind.
 */
export type IconKind =
  | ObjectType
  | 'tallCylinder'
  | 'flatSphere'
  | 'tallCube'
  | 'flatCube'
  | 'materials'
  | 'editTerrain'
  | 'editObject'
  | 'resize'
  | 'rotate'
  | 'reposition'
  | 'align'
  | 'randomize'
  | 'duplicate'
  | 'delete'
  | 'land'
  | 'render'
  | 'renderResume'
  | 'renderClear'
  | 'dice'
  | 'sun'
  | 'moon'
  | 'stars'
  | 'cloudCover'
  | 'fog'
  | 'haze'
  | 'shadows'
  | 'skySoft'
  | 'skyDarker'
  | 'skyCustom'
  | 'skyOff'
  | 'camera'
  | 'director'
  | 'eye'
  | 'library'
  | 'zoomIn'
  | 'zoomOut'
  | 'frame'
  | 'wireframe'
  | 'solid'
  | 'selectAll'
  | 'prev'
  | 'next'
  // added by the ui module
  | 'stop'
  | 'selectNone'
  | 'family'
  | 'objectList'
  | 'depthCue'
  | 'resetView'
  | 'viewCamera'
  | 'viewDirector'
  | 'viewTop'
  | 'viewBottom'
  | 'viewLeft'
  | 'viewRight'
  | 'viewFront'
  | 'viewBack';

/** All kinds, for tests and the icon gallery. */
export const ALL_ICON_KINDS: IconKind[] = [
  'sphere', 'cube', 'cylinder', 'cone', 'torus', 'pyramid', 'disc', 'square',
  'water', 'ground', 'cloud', 'terrain', 'lattice', 'stone', 'tree',
  'radialLight', 'spotLight', 'squareSpotLight', 'parallelLight',
  'tallCylinder', 'flatSphere', 'tallCube', 'flatCube',
  'materials', 'editTerrain', 'editObject', 'resize', 'rotate', 'reposition', 'align', 'randomize',
  'duplicate', 'delete', 'land', 'render', 'renderResume', 'renderClear', 'dice',
  'sun', 'moon', 'stars', 'cloudCover', 'fog', 'haze', 'shadows', 'skySoft', 'skyDarker', 'skyCustom', 'skyOff',
  'camera', 'director', 'eye', 'library', 'zoomIn', 'zoomOut', 'frame', 'wireframe', 'solid', 'selectAll', 'prev', 'next',
  'stop', 'selectNone', 'family', 'objectList', 'depthCue', 'resetView',
  'viewCamera', 'viewDirector', 'viewTop', 'viewBottom', 'viewLeft', 'viewRight', 'viewFront', 'viewBack',
];
