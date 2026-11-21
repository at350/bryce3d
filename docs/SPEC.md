# Bryce 3D Web: build spec

An unofficial, browser-based homage to **Bryce 3D** (MetaCreations / DAZ 3D, 1994–2010), the playful
landscape ray tracer behind a decade of "alien floating world" album covers. People should be able to open
a URL and, within a minute, build a fractal island in a reflective sea under a surreal sky, drop in a chrome
sphere, hit Render and watch the image resolve in Bryce's chunky mosaic passes.

It is a static web app (Vite + React 19 + TypeScript + three.js + Zustand + a custom WebGL2 ray tracer),
hosted on GitHub Pages / Vercel. No backend. Unofficial: "Bryce" is a trademark of DAZ 3D; we copy no
original code, artwork, icons or presets. We recreate the look and the interaction ideas.

---

## 1. What it must feel like

Bryce's identity, in priority order:

1. **The render.** Ray-traced fractal terrains, infinite reflective water, mirror and glass spheres,
   procedural rock/lava/marble textures, saturated skies with sun glow, cloud layers, haze and fog.
   The progressive **mosaic render**: big blocks refine to pixels, then an anti-aliasing pass.
2. **The playful, custom UI.** No OS widgets. A full-window "desktop" with floating, beveled palettes,
   tiny ray-traced-looking 3D icons, blue/silver balls for controls (Bryce 5 look), drag-on-the-control
   interaction instead of sliders, triangles that open menus, a text line that names whatever is under the
   pointer, full-screen "rooms" (labs) with a check mark and an X to confirm or cancel.
3. **Instant feedback.** Nano Preview (a small live render) updates as you edit. Sky & Fog changes
   show immediately. Presets everywhere (objects, materials, skies, scenes) with thumbnails.
4. **Play.** Dice/randomize buttons for terrains, skies and materials; sample scenes; share links.

### Layout (Bryce 5, see ref/screens and the reel frames)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [nano]  Create  Edit  Sky&Fog ▾      (hint/text line)          menus (hover) │  top: palette tabs + icon row
│ [prev]  ◯ ◯ ▦ ⛰ ◆ ● ▮ ■ ◎ ▲ ◢ ● ▪  ☀ ☀ ☀ ☀  ▾                                │
├───────┬──────────────────────────────────────────────────────────────┬──────┤
│ memory│                                                              │ adv. │
│ dots  │                    Working window                            │ disp │
│ view  │        (document frame 4:3; wireframes on light paper,       │ pal. │
│ ctrl  │         selected object red; render image shown here)        │      │
│ cross │                                                              │      │
│ cross │                                                              │      │
│ track │                                                              │      │
│ ball  │                                                              │      │
│ render│                                                              │      │
│ ctrls │                                                              │      │
│ text  │                                                              │      │
├───────┴──────────────────────────────────────────────────────────────┴──────┤
│ selection palette  /  animation strip (toggle)                     status    │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Top**: palette title buttons `Create`, `Edit`, `Sky & Fog` (Ctrl+1/2/3), each with a small triangle that
  opens its preset library (objects / materials / skies). The active palette's icon row sits below.
- **Left Control palette**: Nano Preview (with a triangle menu: Scene / Sky only, Auto-update), camera memory
  dots, View Control (cycles Camera / Director / Top / Bottom / Left / Right / Front / Back), camera cross
  controls (XZ, XY, ZY planes) and the camera Trackball, Render controls (big render ball + resume +
  clear-and-render + options triangle), and the **Text Display Area** that names the control under the
  pointer and shows object/polygon counts.
- **Right Advanced Display palette**: wireframe/solid toggle, show-render-under-wireframes toggle,
  depth cue, zoom in/out, frame selection, Nano toggle.
- **Bottom**: Selection palette (select by type, previous/next object, families) and a status line.
- **Labs ("rooms")** replace the whole window: Materials Lab, Terrain Editor, Sky Lab. Confirm ✓ / cancel ✗
  bottom right.
- Default document: 4:3. Bryce's default was 540 x 405; we render 800 x 600 by default.

---

## 2. Architecture

```
src/
  main.tsx, App.tsx            app shell (ui owner)
  core/                        CONTRACT: types, store, math, defaults, renderApi, cameraOps (frozen, see §5)
  render/                      WebGL2 ray tracer implementing RendererAPI (renderer owner)
  viewport/                    three.js working window (viewport owner)
  ui/                          palettes, kit controls, icons, dialogs, menus, shortcuts (ui owner)
    palettes/SkyFogPalette.tsx (sky owner)
    library/                   preset library browser (scenes owner)
    dialogs/ShareDialog.tsx    (scenes owner)
  labs/material/               Materials Lab (materials owner)
  labs/terrain/                Terrain Editor (terrain owner)
  labs/sky/                    Sky Lab (sky owner)
  terrain/                     heightfield generators + ops (terrain owner)
  materials/                   material presets, defaults, randomizer (materials owner)
  sky/                         sky presets, defaults, randomizer (sky owner)
  scenes/                      startup scene, sample scenes, object library (scenes owner)
  io/                          save/open/share/export/autosave/boot (scenes owner)
tests/                         vitest unit tests (each owner adds tests/<module>.test.ts)
scripts/shot.mjs               headless GPU screenshot tool
```

Data flow: the Zustand store (`src/core/store.ts`) holds the immutable `Scene`, the selection, UI state and
undo history. React components select from it; non-React systems (renderer, viewport) subscribe with
`useStore.subscribe(selector, listener)`. Anything that changes the scene calls a store action. The
renderer is reached through `getRenderer()` (`src/render/index.ts`), typed by `src/core/renderApi.ts`.

A debug handle is exposed as `window.__bryce = { store, renderer }` (set in `main.tsx`) so scripts can drive
the app: e.g. `node scripts/shot.mjs http://localhost:5301/ /tmp/x.png --eval "__bryce.renderer.start(__bryce.store.getState().scene)" --until "__bryce.store.getState().render.status==='done'"`.

### Coordinate conventions (from `core/types.ts`, binding for everyone)

- Right-handed, +Y up, ground at y = 0. World units: default primitive 4 across, default terrain 40 x 10 x 40.
- Every object's object space is the cube [-1, 1]^3. `transform.position` = cube center, `rotation` = Euler
  XYZ degrees (three.js 'XYZ'), `scale` = half-extents. Build matrices only with `core/math.ts`
  (`objectMatrix`, `inverseObjectMatrix`) so wireframes and ray-traced pixels line up exactly.
- Canonical shapes are defined in the `PrimitiveType` doc comment (torus major radius `1 - r`, cone apex up,
  pyramid apex up, disc/square flat in XZ at y = 0, terrain height h → y = 2h − 1, lattice ±h).
- Infinite planes ignore everything but `position[1]` (cloud planes also use `scale[1]` as half-thickness).
- Sun direction: `sunDirection(azimuth, altitude)`; azimuth 0 = toward −Z (in front of the default camera,
  i.e. back-lit), 90 = toward +X.
- Colors in the data model are sRGB 0..1; the renderer linearizes.
- **Camera model** (renderer and viewport must match exactly): basis `{right, up, forward} = cameraBasis(cam)`
  from `core/math.ts`; vertical field of view `cam.fov`; aspect `render.width / render.height`; the ray for
  normalized device coordinates x, y in [-1, 1] (x right, y up) is
  `normalize(forward + x·tan(fov/2)·aspect·right + y·tan(fov/2)·up)`. The viewport's camera view shows this
  exact frame (the document frame) and may show extra, dimmed surroundings outside it.

---

## 3. Module specs

### 3.1 Renderer (`src/render/**`)

Implement `RendererAPI` (`core/renderApi.ts`) as a singleton returned by `getRenderer()`.

- **WebGL2** on a private offscreen canvas; RGBA32F accumulation targets (`EXT_color_buffer_float`,
  fall back to RGBA16F). If WebGL2 is missing, `supported = false` and `error` explains; the app shows a
  friendly message and keeps working (wireframes still useful).
- **Scene packing**: objects into a float texture (inverse matrices, normal matrices, type, params,
  material index), materials into a float texture (all channels + up to 3 texture components + gradients
  + drivers + altitude blend), terrains into a `TEXTURE_2D_ARRAY` (R32F/R16F, resampled to ≤ 512²; cache by
  `heights` array identity). Re-pack only what changed (object identity is stable across immutable updates).
- **Ray tracing (fragment shader)**: analytic intersection in object space for sphere, cube, cylinder,
  cone, pyramid, disc, square; torus via quartic or SDF march; terrain/lattice by heightfield ray-marching
  inside the object's box (adaptive step + bisection refinement, honoring clipLow/clipHigh); stone and
  tree as noise-displaced SDFs inside their box; infinite water/ground planes; cloud planes as a volumetric
  slab. Correct normals under non-uniform scale (inverse-transpose).
- **Shading** (Bryce Material Lab semantics, see `Material` in types.ts and guide §"Surface Material
  Channels" line 6061): diffuse × diffusion, ambient × ambience (self-illumination), specular highlights
  with halo/tightness, metallicity tinting, reflection (with Fresnel boost), transparency + refraction with
  `refraction/100` as IOR and volume tint, blur for glossy reflection/refraction, bump from texture
  components, altitude/slope blend (snow caps). Procedural textures per `TextureType` in 3D (value/gradient
  noise, fbm, ridged, turbulence, voronoi, marble, strata, spots, granite, waves, checker, grid) with
  mappings (world, object, worldTop, objectTop, spherical), domain warp, contrast/bias, gradient lookup.
  Volume-mode materials render as participating media.
- **Lights**: the sun (directional, soft shadows by jittered direction in normal/premium), radial (point),
  spot and square spot (cone/pyramid falloff with softness), parallel. Shadow rays test all occluders
  (volumes and transparent surfaces attenuate). `sky.shadowIntensity` scales shadow darkness; `sky.ambient`
  adds sky-colored ambient.
- **Sky & atmosphere** (Sky type, guide §"Creating Skies" line 11264+): soft/darker/custom/off modes;
  horizon→zenith gradient tinted by skyDomeColor; sun disc + glow; moon with phase; stars at night; two
  procedural cloud layers (stratus = flat wispy, cumulus = puffy, shaded by sun) at their altitudes,
  fading toward the horizon; haze (distance-based horizon whitening with hazeColor), height fog
  (fogDensity, fogHeight, fogColor); optional rainbow. Sunset coloring when the sun is low. The look should
  be the saturated, painterly Bryce look, not physically exact.
- **Progressive render**: Bryce mosaic: passes of block sizes 16 → 8 → 4 → 2 → 1 pixels (shown
  nearest-neighbor, chunky), then anti-aliasing passes accumulating jittered samples up to
  `render.samples` (draft: no AA). Time-slice every pass into scanline bands sized to ~10–14 ms of GPU work
  per frame so the UI stays responsive and the GPU watchdog never fires. Report progress through
  `subscribe` and mirror it into the store with `setRenderProgress`. `outputCanvas` is a 2D canvas at the
  document size showing the tone-mapped/gamma-corrected result (`render.exposure`).
- **Previews**: `preview()` renders small images (Nano Preview ~ 160 x 120 at 1–4 spp; lab previews; preset
  thumbnails) between main-render bands; requests with the same `key` supersede older ones.
- **Quality**: draft = 1 spp, hard shadows, 2 bounces; normal = mosaic + `samples` spp, soft shadows,
  `maxBounces`; premium = 4x samples, blurry reflections, more cloud/volume steps.
- Keep shader compile time reasonable (ANGLE/D3D on Windows): bounded loops, no recursion, use
  `KHR_parallel_shader_compile` when available, compile once.

### 3.2 Viewport (`src/viewport/**`)

`<Viewport />` fills its parent and is the Working window.

- three.js scene synced from the store (diff by object identity). **Wireframe mode** (default): Bryce-style
  line drawings (sphere lat/long rings, box edges, terrain grid at ~32 x 32 following the heights, stones as
  lumpy wire, trees as trunk + crown outline, light glyphs, infinite planes as a large grid fading to the
  horizon), colored by family (`FAMILY_COLORS`), selected objects red (`SELECTED_COLOR`) with a bounding box
  and handles. Light paper background with a subtle horizon line. Optional depth cue (far lines fainter).
  **Solid mode**: shaded preview meshes with material base colors, sky-colored background.
- **Document frame**: the working area shows the document's 4:3 frame (camera view); outside is dimmed.
- **Views** (`ui.view`): camera (the render camera, `scene.camera`), director (`ui.directorCamera`), and
  orthographic top/bottom/left/right/front/back with their own pan/zoom.
- **Interaction**: click selects (shift = add, ctrl/cmd = toggle), click empty deselects; drag a selected
  object to move it (XZ plane; Alt/Option = vertical; Shift = constrain axis); drag bounding-box handles to
  resize; R-key or ring handles to rotate (Bryce used the Edit palette tools; offer both). Wrap drags in
  `beginGesture()/endGesture()`. Mouse wheel = dolly, right/middle drag = orbit/pan the active camera
  (via `core/cameraOps.ts`), double-click object = open its editor (terrain → Terrain Editor, else
  Materials Lab). Hover sets the hint text (object name).
- **Render display**: when `render.visible`, show `getRenderer().outputCanvas` scaled into the document
  frame (`image-rendering: pixelated` while mosaic passes run). When the user edits after a render and
  `ui.showRenderUnderWireframe` is on, keep the image faded under the wireframes (Bryce behavior);
  otherwise hide it. A small progress bar/percentage overlays the frame while rendering.
- Implement `src/viewport/commands.ts` (frame selection, zoom) for the UI to call.

### 3.3 UI shell (`src/App.tsx`, `src/main.tsx`, `src/styles/**`, `src/ui/**` except as noted)

- The layout of §1 with three **skins**: `bryce5` (default: silver/white metal, blue glossy balls,
  dark-charcoal desktop), `bryce2` (warm gray metal, orange + teal icons, the Kai's Power Tools era),
  `bryce7` (gray-green "sage"). CSS custom properties per skin; icons re-rendered per skin.
- **Kit** (`src/ui/kit/**`): the shared controls other modules use (props are fixed by the stubs; you may
  add optional props, never remove or rename): `IconButton`, `Icon3D`, `DragValue`, `Slider`,
  `ColorSwatch`, `Trackball`, `CrossControl`, `DragPad`, `Tabs`, `TriangleMenu`, `LabFrame`, `Dialog`,
  `MemoryDots`, `Toggle`, `Select`, `Button`, `useHint`. Make them look and feel like Bryce.
- **Icons** (`src/ui/icons/**`): tiny glossy 3D icons rendered at runtime with three.js (offscreen, cached
  data URLs) — spheres, cubes, terrain chunks, water/cloud/ground planes, lights, tool glyphs (resize,
  rotate, reposition, align, randomize), etc. Original art, Bryce spirit.
- **Create palette**: water, cloud, ground planes; terrain; symmetrical lattice; stone; tree; sphere,
  cylinder, cube, torus, cone, pyramid, disc, square (+ a few stretched variants, e.g. tall cylinder, flat
  ellipsoid); radial light, spotlight, square spot, parallel light. Clicking creates the object in front of
  the camera on the ground (store `createObject`), selected.
- **Edit palette**: Materials (opens Materials Lab for the selection), Edit object (terrain → Terrain
  Editor; torus/stone/tree parameters → attributes), and Bryce's drag-to-transform tools: Resize (drag on
  the icon: horizontal = uniform scale; per-axis handles), Rotate (drag around X/Y/Z), Reposition (drag
  along X/Y/Z), Align (menu: centers/edges/drop to ground), Randomize (scatter/rotate/size jitter of the
  selection with an intensity drag). Also Duplicate, Delete, Group-less "Land object" (drop to ground).
- **Control palette**: Nano Preview (uses `renderer.preview` with key `'nano'`, debounced ~120 ms after any
  scene change; sky-only mode), camera memory dots, View Control (click cycles views, triangle menu lists
  them), cross controls and trackball moving the active camera via `core/cameraOps.ts`, render controls
  (Render = `renderer.start(scene)`, Resume, Clear & Render, Stop; triangle menu: quality draft/normal/
  premium, mosaic on/off, render settings dialog), Text Display Area bound to `ui.hint` / `ui.status`, the
  object/polygon summary when idle.
- **Advanced Display palette**, **Selection palette** (select by type groups, prev/next object, select all,
  family popup), **menus** (File: New, Open…, Save, Share link…, Export render PNG, Sample scenes…;
  Edit: Undo, Redo, Duplicate, Delete, Select all; Objects: create items, attributes; Help: shortcuts,
  about). **Dialogs**: Attributes (name, position/rotation/size numeric fields, hidden/locked/show-as-box,
  family, type-specific params: torus thickness, stone seed/lumpiness/roughness, tree params, light params),
  Render settings (size presets 4:3 / 16:9 / square, custom size, quality, samples, bounces, mosaic,
  exposure), About (credits + the unofficial disclaimer), Shortcuts.
- **Keyboard**: Ctrl/Cmd+Z / Shift+Ctrl+Z undo/redo, Ctrl/Cmd+D duplicate, Delete/Backspace delete,
  Ctrl/Cmd+R render, Ctrl/Cmd+1/2/3 palettes, Ctrl/Cmd+A select all, Esc deselect/close, Ctrl/Cmd+M
  materials lab, Ctrl/Cmd+E edit selected, Ctrl/Cmd+S save, Ctrl/Cmd+O open, arrow keys nudge selection.
  Ignore shortcuts while typing in inputs (`ui.keyboardCaptured` or focused input).
- A short **splash** on load (homage title card, fades out), responsive down to 1024 x 700 (palettes
  scale), a friendly notice on narrow/mobile screens.

### 3.4 Terrain (`src/terrain/**`, `src/labs/terrain/**`)

- Keep the exported API of `src/terrain/index.ts` (generateHeights, applyOp, resampleHeights,
  heightsFromRecipe, createTerrainData, normalizeHeights, TERRAIN_GENERATORS, TERRAIN_OPS) and extend it:
  generators: fractal (fBm), ridged/rugged mountains, rolling hills, canyons, mesas/subplateaus, volcano,
  islands/archipelago, dunes, craters, spikes, mounds, terraces, mosaic, eroded alpine, plus `random`.
  Ops: smooth, sharpen, erode (hydraulic + thermal), invert, raise/lower, spikes, mounds, subplateaus
  (terrace), mosaic, square/round/gaussian edges, noise/roughen, clip, scale/contrast, blur. Deterministic
  with seeds; ops record into the recipe; painted edits drop the recipe.
- **Terrain Editor room** (guide §"Editing Terrains" line 4222+): big grayscale (or color-ramped) height
  canvas you can paint on (brush size, softness, intensity; modes raise, lower, smooth, roughen, plateau),
  a live rotating 3D preview (three.js mesh with altitude colors), tabs Elevation (one-click generators and
  ops as Bryce-style buttons, with dice), Filtering (a curve editor remapping heights), Pictures (load an
  image as a heightmap, blend), grid resolution selector (64–1024), clipping bracket (clipLow/clipHigh),
  undo within the lab, ✓ commits `updateObject(id, { terrain })`, ✗ discards.

### 3.5 Materials (`src/materials/**`, `src/labs/material/**`)

- `presets.ts`: `MATERIAL_CATEGORIES` and `MATERIAL_PRESETS` (60+ original presets across Bryce-like
  categories: Simple & Fast, Rocks & Stones, Planes & Terrains, Waters & Liquids, Metals, Glasses,
  Wild & Fun, Clouds & Fogs, Complex f/x, Leaves & Woods). Must include the classics: Chrome mirror, gold,
  clear glass, colored glass, ocean/lagoon/lake water, lava, marble, sandstone strata, canyon layers,
  snowy mountain rock, moon rock, grass, desert sand, checkerboard, planet surfaces, neon glow, fog volume.
- `random.ts`: `randomMaterial(seed?)` that produces fun but sane results.
- `defaults.ts`: default material per object type (exists; tune it).
- **Materials Lab room** (guide §"Applying Materials" line 5802+, §"Materials Lab" line 7501+): live preview
  (a sphere on a ground under a simple sky via `renderer.preview`, plus a flat swatch), the **channel grid**:
  rows = color channels (diffuse, ambient, specular, specular halo, transparent, volume) and value
  channels (diffusion, ambience, specularity, specular halo, metallicity, bump height, transparency,
  reflection, refraction, blur), columns = fixed value + texture components A/B/C as radio "component
  indicators" (sets `drivers`). Component editors A/B/C: type, mapping, scale, octaves, roughness, warp,
  contrast, bias, seed (dice), gradient stops (color swatches), bump. Altitude blend section. Surface /
  Volume mode switch. Presets strip with categories. ✓ applies to all selected objects (`setMaterial`).

### 3.6 Sky (`src/sky/**`, `src/labs/sky/**`, `src/ui/palettes/SkyFogPalette.tsx`)

- `presets.ts`: `SKY_CATEGORIES`, `SKY_PRESETS` (40+ original skies: soft daylight, deep blue noon, golden
  hour, blood-red sunset, purple dusk, teal dream, pink alien, green alien, stormy, foggy morning, misty
  lake, desert haze, arctic, moonlit night, starfield, eclipse, two-tone 90s CD cover, vaporwave, …).
- `random.ts`: `randomSky(seed?)`.
- **Sky & Fog palette** (guide §"The Sky & Fog Palette" line 11264): sky mode thumbnails (soft, darker,
  custom, off), drag-pad thumbnails for Shadows, Fog (x = density, y = height), Haze, Cloud height,
  Cloud cover, Cloud frequency/amplitude; color swatches (sky dome, fog, haze, cloud, sun); the sun/moon
  trackball (drag to set azimuth/altitude; a ball showing the sun direction); link-sun-to-view; sky memory
  dots; randomize-sky dice; triangle → Skies library. Every change updates immediately (Nano Preview).
- **Sky Lab room** (guide line 11335–12622): tabs Sun & Moon (sun color/size/glow, azimuth/altitude
  numeric + trackball, moon color/size/phase, stars), Cloud Cover (stratus and cumulus: on/off, cover,
  height, frequency, amplitude, color, shading, offset), Atmosphere (mode, horizon/zenith/dome colors,
  haze, fog, ambient, shadows, rainbow). Live preview via `renderer.preview` (`skyOnly` and full scene).

### 3.7 Scenes & IO (`src/scenes/**`, `src/io/**`, `src/ui/library/**`, `src/ui/dialogs/ShareDialog.tsx`)

- `defaultScene.ts` (startup + File > New), `samples.ts` (`SAMPLE_SCENES`: 10+ gorgeous scenes, e.g.
  Monolith Sea (the reel's teal sea + dark monolith), Alien Floating Worlds, Chrome Sphere Lagoon,
  Lava Planet, Canyon River, Moonlit Peaks, Desert Pyramids, Glass Orbs & Checkerboard, Tropical Cove,
  Eyeball Meadow, Frozen Fjord, Vaporwave Grid), `objectLibrary.ts` (`OBJECT_CATEGORIES`, `OBJECT_PRESETS`:
  arches, columns, ring of spheres, monolith, pedestal + orb, chess pieces from primitives, ruined temple,
  rock clusters, tree groves, lamp posts…).
- **Library browser** (`ui/library/LibraryBrowser.tsx`): a Bryce-style preset window (category list on the
  left, tile grid with rendered thumbnails via `renderer.preview` quality 'icon', cached; name +
  description of the hovered tile; Apply / double-click; Cancel). Kinds: objects, materials (applies to
  selection), skies, scenes.
- `io/serialize.ts` (versioned JSON, Float32 heights → base64, validation + defaults filling on load),
  `io/share.ts` (scene → `#s=` URL hash with lz-string; terrains as recipes when available, else downsampled
  8-bit heights; keeps links short), `io/files.ts` (download `.bryce.json`, open file picker, download PNG
  of the render), `io/autosave.ts` (debounced localStorage autosave), `io/boot.ts` (initial scene: share
  hash > autosave > default; called once from main).
- `ui/dialogs/ShareDialog.tsx`: copyable link, size warning, "open in new tab".

---

## 4. Quality bar

- `npm run typecheck`, `npm test`, `npm run build` pass. No console errors on load.
- 60 fps editor interaction with ~50 objects; render never freezes the UI for > 50 ms.
- First impression: the startup scene, rendered with one click, looks like a Bryce poster.
- Original artwork/presets only. Unofficial disclaimer in About and README.
- Code style: TypeScript strict, small focused files, comments only where they explain intent.

## 5. Working rules for parallel module owners

- Edit only files you own (§2). `src/core/**` is the shared contract: do not change existing shapes or
  behaviors. If you truly need something new there, make a minimal **additive** change (new optional field,
  new action/helper), re-read the file right before editing, keep everything compiling, and list it in your
  final report.
- Other modules are being built at the same time. Code against the documented interfaces and stubs; do not
  "fix" another owner's files. If something you depend on is still a stub, work around it locally.
- Type-check only your files: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "^src/(<your dirs>)"`.
- Visual checks: run your own dev server on your assigned port (`npx vite --port <port> --strictPort`) and
  screenshot with `node scripts/shot.mjs`. Stop your server when done.
- Reference material (local, not for the repo): see `REFERENCE.md` in the scratchpad path given in your brief.
