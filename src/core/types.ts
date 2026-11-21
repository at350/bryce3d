/**
 * Scene data model: the contract shared by every module (store, renderer,
 * viewport, labs, presets, serialization). Change it only in coordination:
 * all modules read these shapes.
 *
 * Conventions
 * - World space is right-handed, +Y up (three.js convention). The ground is y = 0.
 * - Units are arbitrary "world units". A default primitive is 4 units across, a
 *   default terrain is 40 x 10 x 40, the default camera sits ~45 units from the origin.
 * - Colors are sRGB triples in 0..1 (what the UI shows). The renderer converts to linear.
 * - Angles in the data model are degrees.
 * - Every object lives in a canonical object space: the cube [-1, 1]^3. Its transform
 *   maps that cube into the world: position = world position of the cube center,
 *   rotation = Euler XYZ in degrees (three.js order 'XYZ'), scale = half-extents
 *   of the cube along the object's local axes. Use core/math.ts to build matrices so
 *   the renderer and the viewport agree exactly.
 * - Scene values are immutable. Never mutate an object or array in place: build a
 *   new one (the store's undo history keeps references to old scenes). This includes
 *   TerrainData.heights: edits produce a new Float32Array.
 */

export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

/**
 * Canonical object-space shapes (all inside [-1, 1]^3):
 * - sphere:   unit sphere (radius 1). Non-uniform scale makes ellipsoids.
 * - cube:     the full cube [-1, 1]^3.
 * - cylinder: radius 1 around the Y axis, y in [-1, 1], capped.
 * - cone:     apex at (0, 1, 0), base disc radius 1 at y = -1, capped.
 * - torus:    ring around the Y axis in the XZ plane. Major radius R = 1 - r,
 *             minor (tube) radius r = TorusParams.minorRadius (0.05..0.5), so it
 *             touches the cube walls in X/Z. Object-space Y extent is [-r, r]; it does
 *             not fill the cube vertically.
 * - pyramid:  square base [-1, 1]^2 at y = -1, apex at (0, 1, 0).
 * - disc:     flat two-sided disc of radius 1 in the XZ plane at y = 0 (zero thickness).
 * - square:   flat two-sided square [-1, 1]^2 in the XZ plane at y = 0 (zero thickness).
 */
export type PrimitiveType = 'sphere' | 'cube' | 'cylinder' | 'cone' | 'torus' | 'pyramid' | 'disc' | 'square';

/**
 * Infinite horizontal planes. Only transform.position[1] (the height) matters for
 * placement; rotation and x/z position are ignored. For 'cloud', transform.scale[1]
 * is the half-thickness of the cloud slab (it is volumetric).
 */
export type InfinitePlaneType = 'water' | 'ground' | 'cloud';

/**
 * Lights. Position = transform.position. Spot and square-spot lights point down
 * their local -Y axis (after rotation); parallel lights shine along local -Y as well.
 */
export type LightType = 'radialLight' | 'spotLight' | 'squareSpotLight' | 'parallelLight';

/**
 * - terrain: heightfield over object-space x, z in [-1, 1]; height h in 0..1 maps to
 *   object-space y = 2h - 1 (so h = 0 is the bottom face of the cube).
 * - lattice: Bryce's symmetrical lattice: the same heightfield mirrored about y = 0.
 *   Height h maps to the solid between y = -h and y = +h (h = 0 means no surface).
 * - stone: a lumpy rock: noise-displaced sphere filling roughly [-1, 1]^3 (StoneParams).
 * - tree:  a stylized tree filling [-1, 1]^3: trunk from y = -1 up the middle,
 *          foliage crown in the upper part (TreeParams).
 */
export type ObjectType =
  | PrimitiveType
  | InfinitePlaneType
  | 'terrain'
  | 'lattice'
  | 'stone'
  | 'tree'
  | LightType;

export interface Transform {
  position: Vec3;
  /** Euler angles in degrees, three.js order 'XYZ'. */
  rotation: Vec3;
  /** Half-extents along local axes (world units). Must stay > 0. */
  scale: Vec3;
}

export interface TorusParams {
  /** Tube radius in object space, 0.05..0.5. */
  minorRadius: number;
}

export interface StoneParams {
  seed: number;
  /** 0..1: how lumpy/irregular the overall shape is. */
  lumpiness: number;
  /** 0..1: fine surface roughness (small-scale displacement). */
  roughness: number;
}

export interface TreeParams {
  seed: number;
  /** Trunk height as a fraction of the object height, 0.2..0.8. */
  trunkHeight: number;
  /** Trunk radius as a fraction of the object half-width, 0.03..0.3. */
  trunkWidth: number;
  /** Crown shape. */
  crown: 'round' | 'cone' | 'palm' | 'willow';
  /** 0..1: how irregular/clumpy the crown is. */
  crownNoise: number;
  /** The object's main material shades the crown; this colors the trunk. */
  trunkColor: RGB;
}

export interface LightParams {
  color: RGB;
  /** 0..200 (100 = a typical lamp). */
  intensity: number;
  /** How intensity decays with distance. */
  falloff: 'none' | 'linear' | 'squared';
  /** Spot lights: full cone angle in degrees, 5..170. */
  coneAngle: number;
  /** 0..1: soft edge for spots / soft shadow radius. */
  softness: number;
  /** Render a visible glowing ball/disc at the light position. */
  visible: boolean;
  castShadows: boolean;
}

export interface TerrainRecipeOp {
  /** Operation id understood by src/terrain (e.g. 'erode', 'smooth', 'invert'). */
  op: string;
  params?: Record<string, number>;
}

/**
 * A procedural description that reproduces a terrain's heights exactly from a seed.
 * Used to keep share links small. Absent once a terrain has been hand-painted or built
 * from an imported picture.
 */
export interface TerrainRecipe {
  generator: string;
  seed: number;
  resolution: number;
  params?: Record<string, number>;
  ops: TerrainRecipeOp[];
}

export interface TerrainData {
  /** Grid size N. heights.length === N * N. One of 16, 32, 64, 128, 256, 512, 1024. */
  resolution: number;
  /** Row-major heights, index = z * N + x, x and z going from -1 to +1 in object space. Values 0..1. */
  heights: Float32Array;
  recipe?: TerrainRecipe;
  /**
   * Clipping bracket: heights below clipLow are cut away (no surface), heights above
   * clipHigh are flattened to clipHigh. Both 0..1, default 0 and 1. clipLow > 0 makes
   * Bryce-style floating islands/arches possible.
   */
  clipLow?: number;
  clipHigh?: number;
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  transform: Transform;
  /** Every object owns its material (Bryce model). Lights ignore it. */
  material: Material;
  hidden?: boolean;
  locked?: boolean;
  /** Draw as a bounding box in the editor (render is unaffected). */
  showAsBox?: boolean;
  /** Index into FAMILY_COLORS (core/defaults.ts); sets the wireframe color. */
  family?: number;
  torus?: TorusParams;
  stone?: StoneParams;
  tree?: TreeParams;
  light?: LightParams;
  /** Present for 'terrain' and 'lattice'. */
  terrain?: TerrainData;
}

// ---------------------------------------------------------------------------
// Materials (Bryce Material Lab model)
// ---------------------------------------------------------------------------

/**
 * Procedural texture kinds. Each evaluates a scalar field n(p) in 0..1 from a 3D point:
 * - fbm:        fractal Brownian motion (smooth rolling noise)
 * - ridged:     ridged multifractal (sharp ridges, rock/mountain veins)
 * - turbulence: sum of |noise| octaves (billowy, cloudy, smoky)
 * - voronoi:    cellular / Worley noise (cells, cracked mud, scales)
 * - marble:     sine bands warped by turbulence (marble, veins)
 * - strata:     horizontal bands along Y warped by noise (sandstone, canyon layers)
 * - spots:      thresholded noise blobs (spots, leopard, lichen)
 * - granite:    high-frequency speckle (granite, sand, stucco)
 * - waves:      concentric/linear ripples with noise (water, sand ripples)
 * - checker:    3D checkerboard (the classic ray-tracer floor)
 * - grid:       grid lines (tiles, sci-fi panels)
 */
export type TextureType =
  | 'fbm'
  | 'ridged'
  | 'turbulence'
  | 'voronoi'
  | 'marble'
  | 'strata'
  | 'spots'
  | 'granite'
  | 'waves'
  | 'checker'
  | 'grid';

/**
 * How the 3D point fed to the texture is computed:
 * - world:     world-space position (texture stays put when the object moves; terrains)
 * - object:    object-space position (texture moves/scales with the object)
 * - worldTop:  world x/z only, projected from above (no vertical variation)
 * - objectTop: object-space x/z only
 * - spherical: object-space direction (longitude/latitude), good for planets
 */
export type TextureMapping = 'world' | 'object' | 'worldTop' | 'objectTop' | 'spherical';

/** A texture component: one of the A / B / C columns of the Material Lab. */
export interface TextureComponent {
  type: TextureType;
  mapping: TextureMapping;
  /** Feature size: the noise is sampled at p / scale. World units for world mappings, object units otherwise. */
  scale: number;
  /** 1..10 fractal octaves. */
  octaves: number;
  /** 0..1: amplitude falloff per octave (higher = rougher). */
  roughness: number;
  /** 0..1: domain-warp amount (swirls, turbulence). */
  warp: number;
  /** 0..1: output contrast; 0.5 is neutral. */
  contrast: number;
  /** -1..1: shifts the output up/down before the color lookup. */
  bias: number;
  seed: number;
  /**
   * Color gradient indexed by the noise value: 2..4 stops sorted by `at` (0..1).
   * The component's color output is this gradient sampled at n(p).
   */
  gradient: { at: number; color: RGB }[];
  /** -1..1: strength/direction of this component's bump output. */
  bump: number;
}

export type MaterialColorChannel =
  | 'diffuseColor'
  | 'ambientColor'
  | 'specularColor'
  | 'transparentColor';

export type MaterialValueChannel =
  | 'diffusion'
  | 'ambience'
  | 'specularity'
  | 'reflection'
  | 'transparency'
  | 'bumpHeight';

export type MaterialChannel = MaterialColorChannel | MaterialValueChannel;

/**
 * Which texture component drives a channel: -1 = the channel's own fixed value,
 * 0 / 1 / 2 = component A / B / C. A driven color channel takes the component's
 * gradient color; a driven value channel becomes (component value n(p)) x (slider value).
 * bumpHeight driven by a component means that component's bump output is applied.
 */
export type ChannelDriver = -1 | 0 | 1 | 2;

export interface Material {
  name: string;
  // Color channels
  diffuseColor: RGB;
  ambientColor: RGB;
  specularColor: RGB;
  /** Color of the soft glow around specular highlights. */
  specularHaloColor: RGB;
  /** Tint applied to light passing through transparent surfaces. */
  transparentColor: RGB;
  /** Absorption tint inside transparent volumes / volume-mode color. */
  volumeColor: RGB;
  // Value channels (Bryce scales)
  /** 0..100: strength of diffuse (Lambert) shading. */
  diffusion: number;
  /** 0..100: self-illumination by ambientColor (100 = fully self-lit / glowing). */
  ambience: number;
  /** 0..100: highlight strength. */
  specularity: number;
  /** 0..100: highlight tightness. 0 = broad soft halo, 100 = pin-point. */
  specularHalo: number;
  /** 0..100: tints reflections/highlights by diffuse color (metals). */
  metallicity: number;
  /** -100..100: bump-map strength (negative inverts). */
  bumpHeight: number;
  /** 0..100: see-through amount. */
  transparency: number;
  /** 0..100: mirror reflection amount. */
  reflection: number;
  /** 100..300: index of refraction x 100 (100 = none, 133 = water, 152 = glass, 242 = diamond). */
  refraction: number;
  /** 0..100: blurs reflections/refractions (Bryce "blurry reflections"). */
  blur: number;
  /** Up to 3 texture components (A, B, C). Empty = flat colors. */
  components: TextureComponent[];
  /** Channels not listed are fixed (-1). */
  drivers: Partial<Record<MaterialChannel, ChannelDriver>>;
  /**
   * Optional altitude/slope blend applied on top (snow caps, grass in valleys).
   * Height is the object-space y mapped to 0..1; slope is 0 (flat) .. 1 (vertical).
   */
  altitude?: {
    color: RGB;
    /** 0..1: height where the blend starts. */
    start: number;
    /** 0..1: width of the transition. */
    softness: number;
    /** 0..1: surfaces steeper than this do not receive the blend. */
    maxSlope: number;
  };
  /** 'volume' renders the object as a participating medium (fog banks, clouds, glows). */
  mode: 'surface' | 'volume';
  /** volume mode: 0..100 density. */
  volumeDensity?: number;
}

// ---------------------------------------------------------------------------
// Sky & atmosphere
// ---------------------------------------------------------------------------

/**
 * - soft:   Bryce's default soft sky: gradient + sun, colors derived from the sun position.
 * - darker: deeper, more saturated version of soft.
 * - custom: uses horizonColor / zenithColor / skyDomeColor as given.
 * - off:    plain background color (zenithColor), no atmosphere scattering.
 */
export type SkyMode = 'soft' | 'darker' | 'custom' | 'off';

export interface CloudLayer {
  enabled: boolean;
  /** 0..100: fraction of the sky covered. */
  cover: number;
  /** World-space altitude of the layer (e.g. 100..3000). */
  height: number;
  /** 1..400: feature size control (higher = smaller, more frequent clouds). */
  frequency: number;
  /** 0..400: contrast/puffiness (higher = sharper, denser edges). */
  amplitude: number;
  color: RGB;
  /** 0..1: how much the layer shades its own underside. */
  shading: number;
  /** Horizontal offset in world units (lets presets/animation slide the clouds). */
  offset: [number, number];
}

export interface Sky {
  mode: SkyMode;
  horizonColor: RGB;
  zenithColor: RGB;
  /** Overall tint of the sky dome (Bryce "sky dome color"). */
  skyDomeColor: RGB;
  sunColor: RGB;
  /** 0..100: sun disc size. */
  sunSize: number;
  /** 0..100: glow/halo around the sun. */
  sunGlow: number;
  /** Degrees, 0..360. 0 = sun toward -Z (straight ahead of the default camera), 90 = toward +X. */
  sunAzimuth: number;
  /** Degrees, -90..90. Below 0 the sun sets; the scene is lit by the moon/ambient. */
  sunAltitude: number;
  /** Keep the sun at a fixed position relative to the camera (Bryce "link sun to view"). */
  linkSunToView: boolean;
  moonColor: RGB;
  /** 0..1: 0 = new, 0.5 = full, 1 = new. */
  moonPhase: number;
  /** 0..100: moon disc size. */
  moonSize: number;
  /** 0..100: star density/brightness at night (also visible in daytime if > 0 and sky is dark). */
  stars: number;
  /** 0..100. */
  haze: number;
  hazeColor: RGB;
  /** 0..100. */
  fogDensity: number;
  /** World units: fog fills the space below this height. */
  fogHeight: number;
  fogColor: RGB;
  /** 0..100: how dark shadows are (100 = black shadows, 0 = none). */
  shadowIntensity: number;
  /** 0..100: general ambient light from the sky. */
  ambient: number;
  /** Ambient light tint. */
  ambientColor: RGB;
  stratus: CloudLayer;
  cumulus: CloudLayer;
  rainbow: boolean;
}

// ---------------------------------------------------------------------------
// Camera & render settings
// ---------------------------------------------------------------------------

export interface CameraState {
  position: Vec3;
  /** Point the camera looks at. */
  target: Vec3;
  /** Bank angle in degrees around the view direction. */
  roll: number;
  /** Vertical field of view in degrees (Bryce default ~ 60). */
  fov: number;
}

export type RenderQuality = 'draft' | 'normal' | 'premium';

export interface RenderSettings {
  /** Document size in pixels (Bryce default 640 x 480 here). */
  width: number;
  height: number;
  /** draft: 1 spp, hard shadows, 2 bounces. normal: AA + soft shadows. premium: many spp, blur, 8 bounces. */
  quality: RenderQuality;
  /** Show the progressive Bryce mosaic (coarse blocks refining to pixels). */
  mosaic: boolean;
  /** Ray depth for reflection/refraction chains, 1..12. */
  maxBounces: number;
  /** Anti-aliasing samples per pixel after the mosaic passes (normal: 8, premium: 64). */
  samples: number;
  /** Output gamma/exposure tweak, 0.5..2 (1 = neutral). */
  exposure: number;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export interface Scene {
  version: 1;
  name: string;
  objects: SceneObject[];
  sky: Sky;
  camera: CameraState;
  render: RenderSettings;
}

// ---------------------------------------------------------------------------
// Editor / UI state (not part of the saved scene)
// ---------------------------------------------------------------------------

export type PaletteTab = 'create' | 'edit' | 'sky';

/**
 * camera: the render camera (what Render produces). director: a free editing camera
 * that does not change the render. The rest are orthographic views.
 */
export type ViewMode = 'camera' | 'director' | 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

export type DisplayMode = 'wireframe' | 'solid';

/** Full-screen "rooms". */
export type LabKind = 'material' | 'terrain' | 'sky';

/** Library browsers (preset galleries with a category list and a tile grid). */
export type LibraryKind = 'objects' | 'materials' | 'skies' | 'scenes';

/** Modal dialogs. */
export type DialogKind = 'attributes' | 'renderSettings' | 'about' | 'share' | 'shortcuts';

export type Skin = 'bryce5' | 'bryce2' | 'bryce7';

export type RenderStatus = 'idle' | 'rendering' | 'paused' | 'done' | 'error';

export interface RenderProgress {
  status: RenderStatus;
  /** 0-based index of the current pass and total pass count (mosaic passes + AA passes). */
  pass: number;
  passCount: number;
  /** 0..1 overall. */
  fraction: number;
  /** Accumulated samples per pixel so far. */
  samples: number;
  elapsedMs: number;
  message?: string;
}
