/**
 * The little 3D models behind every icon. Original designs in the spirit of Bryce's
 * ray-traced palette icons: glossy primitives, rocky chunks, rippled water, glowing lights
 * and chunky tool glyphs. Each builder returns a model roughly inside [-1, 1]^3.
 */
import { AdditiveBlending, Color, ConeGeometry, DoubleSide, ExtrudeGeometry, MeshBasicMaterial, PlaneGeometry, Shape, type Object3D } from 'three';
import type { IconKind } from './iconKinds';
import {
  arrow,
  box,
  canvasTexture,
  chrome,
  cone,
  cyl,
  fbm,
  glossy,
  glow,
  group,
  heightTile,
  ico,
  matte,
  mesh,
  metal,
  paintVertical,
  ramp,
  rbox,
  ringArrow,
  rockGeometry,
  seeded,
  sphere,
  toolMaterial,
  torus,
  veil,
  vertexColored,
  type V3,
} from './iconParts';
import type { IconTheme } from './iconTheme';

export interface IconSpec {
  root: Object3D;
  /** Camera azimuth in degrees (0 = from the front, positive = from the right). */
  azimuth?: number;
  /** Camera elevation in degrees. */
  elevation?: number;
  /** Fraction of the frame the model fills (default 0.84). */
  fill?: number;
  /** Soft contact shadow under the model (default true). */
  shadow?: boolean;
  lighting?: 'studio' | 'moon';
}

const PI = Math.PI;

// --- shared pieces ------------------------------------------------------------

const TERRAIN_RAMP = ramp([
  [0, '#3f6f35'],
  [0.3, '#6f7a3c'],
  [0.5, '#80664a'],
  [0.72, '#9a9088'],
  [0.86, '#e8edf2'],
  [1, '#ffffff'],
]);

function terrainChunk(seed = 7, peak = 1): Object3D {
  const geo = heightTile(
    2,
    30,
    (u, v) => {
      const r = Math.hypot(u * 0.95, v * 1.05);
      const mound = Math.max(0, 1 - r * 0.8);
      return peak * (0.08 + mound * mound * 1.05 * (0.55 + 0.9 * fbm(u * 2.1 + 3, v * 2.1 + 1, seed, 5)));
    },
    (t) => TERRAIN_RAMP(t),
  );
  return group([mesh(geo, vertexColored(0.9)), mesh(box(2, 0.16, 2), matte('#57483a', 0.9), [0, -0.08, 0])]);
}

function waterTile(): Object3D {
  const g = new PlaneGeometry(2, 2, 56, 56);
  g.rotateX(-PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const r = Math.hypot(x - 0.25, z + 0.15);
    p.setY(i, 0.045 * Math.sin(r * 15) * Math.exp(-r * 1.1) + 0.012 * Math.sin(x * 9 + z * 4));
  }
  g.computeVertexNormals();
  return group([
    mesh(g, glossy('#1f74d6', { roughness: 0.06, clearcoatRoughness: 0.02 })),
    mesh(box(2, 0.12, 2), glossy('#123f7a', { roughness: 0.3 }), [0, -0.07, 0]),
  ]);
}

function groundTile(): Object3D {
  const sand = ramp([
    [0, '#8a6a45'],
    [0.5, '#b89466'],
    [1, '#d9c193'],
  ]);
  const geo = heightTile(2, 26, (u, v) => 0.1 * fbm(u * 3 + 9, v * 3 + 2, 4, 4) + 0.03 * Math.sin(u * 7 + v * 3), (t) => sand(t));
  return group([mesh(geo, vertexColored(0.95)), mesh(box(2, 0.16, 2), matte('#6c5236'), [0, -0.08, 0])]);
}

function cloudPuff(material = matte('#ffffff', 0.95), seed = 3): Object3D {
  const rnd = seeded(seed);
  const parts: Object3D[] = [];
  const blobs: [number, number, number, number][] = [
    [0, 0.18, 0, 0.42],
    [-0.42, 0.06, 0.05, 0.32],
    [0.42, 0.08, -0.02, 0.34],
    [-0.15, 0.36, -0.06, 0.3],
    [0.2, 0.34, 0.08, 0.28],
    [0.7, -0.02, 0.06, 0.22],
    [-0.72, -0.04, -0.04, 0.2],
  ];
  for (const [x, y, z, r] of blobs) parts.push(mesh(sphere(r * (0.92 + rnd() * 0.16), 32, 20), material, [x, y, z]));
  return group(parts);
}

function cloudTile(): Object3D {
  const sky = mesh(box(2, 0.1, 2), glossy('#8fb8ee', { roughness: 0.4, clearcoat: 0.3 }), [0, -0.05, 0]);
  const white = matte('#ffffff', 0.9);
  return group([sky, group([cloudPuff(white, 5)], [-0.3, 0.15, 0.2], [0, 0, 0], [0.75, 0.6, 0.75]), group([cloudPuff(white, 9)], [0.45, 0.12, -0.45], [0, 0.6, 0], [0.55, 0.5, 0.55])]);
}

function treeModel(): Object3D {
  const bark = matte('#6b4a2e', 0.9);
  const leaf = new Color('#3e8a3a');
  const leaves = glossy(leaf, { roughness: 0.55, clearcoat: 0.2, flatShading: true });
  const trunk = mesh(cyl(0.09, 0.16, 1.1, 14), bark, [0, -0.45, 0]);
  const crown = [
    mesh(ico(0.48, 1), leaves, [0, 0.38, 0]),
    mesh(ico(0.36, 1), leaves, [-0.36, 0.18, 0.12]),
    mesh(ico(0.34, 1), leaves, [0.36, 0.2, -0.08]),
    mesh(ico(0.3, 1), leaves, [0.05, 0.7, 0.05]),
    mesh(ico(0.28, 1), leaves, [0.12, 0.2, 0.36]),
  ];
  return group([trunk, ...crown]);
}

function latticeModel(color: string): Object3D {
  const steel = metal(color, 0.12);
  const geo = heightTile(1.8, 18, (u, v) => {
    const r = Math.max(Math.abs(u), Math.abs(v));
    return 0.06 + 0.75 * Math.max(0, 1 - r) * (0.4 + fbm(u * 2.5 + 7, v * 2.5 + 3, 11, 3));
  }, () => new Color('#ffffff'));
  geo.deleteAttribute('color');
  const top = mesh(geo, steel);
  const bottom = mesh(geo.clone(), steel, [0, 0, 0], [0, 0, 0], [1, -1, 1]);
  return group([top, bottom], [0, 0, 0], [0, PI / 4, 0]);
}

function viewPlatform(theme: IconTheme, seeThrough = false): Object3D {
  const plate = seeThrough ? glossy(theme.tool, { transparent: true, opacity: 0.45, depthWrite: false }) : toolMaterial(theme.tool, theme.toolMetal);
  const ball = glossy(theme.accent);
  const peak = group([terrainChunk(21, 1.25)], [0, 0.1, 0], [0, 0, 0], [0.42, 0.55, 0.42]);
  const corners: Object3D[] = [
    [-0.72, -0.72],
    [0.72, -0.72],
    [-0.72, 0.72],
  ].map(([x, z]) => mesh(sphere(0.14), ball, [x, 0.2, z]));
  corners.push(mesh(rbox(0.26, 0.26, 0.26, 0.04), ball, [0.72, 0.19, 0.72]));
  return group([mesh(rbox(2, 0.12, 2, 0.05), plate, [0, 0, 0]), peak, ...corners]);
}

function starShape(outer = 0.5, inner = 0.22, points = 5): Shape {
  const s = new Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * PI * 2 + PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

function extruded(shape: Shape, depth: number) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
  g.center();
  return g;
}

function triangleArrow(material: ReturnType<typeof glossy>, pointRight: boolean): Object3D {
  const s = new Shape();
  s.moveTo(-0.45, 0.55);
  s.lineTo(0.55, 0);
  s.lineTo(-0.45, -0.55);
  s.lineTo(-0.45, 0.55);
  return mesh(extruded(s, 0.28), material, [0, 0, 0], [0, pointRight ? 0 : PI, 0]);
}

function corners(material: ReturnType<typeof glossy>, half = 0.9, len = 0.42, t = 0.09): Object3D[] {
  const out: Object3D[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      out.push(mesh(rbox(len, t, t, 0.03), material, [sx * (half - len / 2), sy * half, 0]));
      out.push(mesh(rbox(t, len, t, 0.03), material, [sx * half, sy * (half - len / 2), 0]));
    }
  }
  return out;
}

function magnifier(theme: IconTheme, plus: boolean): Object3D {
  const rim = toolMaterial(theme.tool, theme.toolMetal);
  const lens = glossy('#bcd6ff', { transmission: 0, opacity: 0.55, transparent: true, roughness: 0.05 });
  const sign = glossy(theme.accent);
  const parts: Object3D[] = [
    mesh(torus(0.5, 0.09), rim, [-0.15, 0.15, 0]),
    mesh(cyl(0.48, 0.48, 0.04, 40), lens, [-0.15, 0.15, 0], [PI / 2, 0, 0]),
    mesh(cyl(0.1, 0.12, 0.7, 20), rim, [0.48, -0.48, 0], [0, 0, PI / 4]),
    mesh(rbox(0.5, 0.12, 0.1, 0.04), sign, [-0.15, 0.15, 0.06]),
  ];
  if (plus) parts.push(mesh(rbox(0.12, 0.5, 0.1, 0.04), sign, [-0.15, 0.15, 0.06]));
  return group(parts);
}

function skyDome(bottom: string, top: string, sun: boolean, theme: IconTheme): Object3D {
  const dome = paintVertical(sphere(0.95, 48, 24), bottom, top);
  const parts: Object3D[] = [
    mesh(dome, new MeshBasicMaterial({ vertexColors: true })),
    mesh(cyl(1.05, 1.08, 0.14, 48), toolMaterial(theme.tool, theme.toolMetal), [0, -0.98, 0]),
  ];
  if (sun) parts.push(mesh(sphere(0.16), glow('#fff6c8'), [0.42, 0.25, 0.8]));
  return group(parts);
}

function chromeBall(theme: IconTheme, r = 0.9): Object3D {
  return mesh(sphere(r, 64, 48), chrome(theme.chrome));
}

// --- the catalog --------------------------------------------------------------------

export function buildIcon(kind: IconKind, theme: IconTheme): IconSpec {
  const obj = glossy(theme.object);
  const tool = toolMaterial(theme.tool, theme.toolMetal);
  const accent = glossy(theme.accent);
  const lightMat = glow(theme.light);

  switch (kind) {
    // primitives ----------------------------------------------------------------
    case 'sphere':
      return { root: mesh(sphere(1, 64, 48), obj) };
    case 'flatSphere':
      return { root: mesh(sphere(1, 64, 48), obj, [0, 0, 0], [0, 0, 0], [1.25, 0.5, 1.25]), elevation: 30 };
    case 'cube':
      return { root: mesh(rbox(1.6, 1.6, 1.6, 0.06), obj, [0, 0, 0], [0, PI / 5, 0]), elevation: 28 };
    case 'tallCube':
      return { root: mesh(rbox(0.7, 2.2, 0.7, 0.05), obj, [0, 0, 0], [0, PI / 5, 0]) };
    case 'flatCube':
      return { root: mesh(rbox(2, 0.4, 2, 0.05), obj, [0, 0, 0], [0, PI / 5, 0]), elevation: 34 };
    case 'cylinder':
      return { root: mesh(cyl(0.8, 0.8, 1.7, 64), obj), elevation: 26 };
    case 'tallCylinder':
      return { root: mesh(cyl(0.42, 0.42, 2.3, 48), obj), elevation: 22 };
    case 'cone':
      return { root: mesh(cone(0.9, 1.8, 64), obj), elevation: 22 };
    case 'torus':
      return { root: mesh(torus(0.72, 0.3), obj, [0, 0, 0], [0.45, 0.35, 0]), elevation: 18, azimuth: 18 };
    case 'pyramid':
      return { root: mesh(new ConeGeometry(1.1, 1.6, 4), obj, [0, 0, 0], [0, PI / 4 + 0.3, 0]), elevation: 22 };
    case 'disc':
      return { root: mesh(cyl(1, 1, 0.08, 64), obj), elevation: 40 };
    case 'square':
      return { root: mesh(rbox(1.8, 0.08, 1.8, 0.03), obj, [0, 0, 0], [0, PI / 5, 0]), elevation: 40 };

    // natural objects -------------------------------------------------------------
    case 'water':
      return { root: waterTile(), elevation: 42, azimuth: 20 };
    case 'ground':
      return { root: groundTile(), elevation: 42, azimuth: 20 };
    case 'cloud':
      return { root: cloudTile(), elevation: 36, azimuth: 20 };
    case 'terrain':
      return { root: terrainChunk(7), elevation: 30, azimuth: 25 };
    case 'lattice':
      return { root: latticeModel(theme.object), elevation: 24 };
    case 'stone':
      return { root: mesh(rockGeometry(4), vertexColored(0.75), [0, 0, 0], [0.3, 0.5, 0], [1, 0.8, 0.9]), elevation: 24 };
    case 'tree':
      return { root: treeModel(), elevation: 14 };

    // lights ------------------------------------------------------------------------
    case 'radialLight': {
      const rays = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * PI * 2;
        return mesh(cone(0.07, 0.34, 12), glow(theme.light, 0.85), [Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0], [0, 0, a - PI / 2]);
      });
      const halo = mesh(sphere(0.78), new MeshBasicMaterial({ color: theme.light, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false }));
      return { root: group([mesh(sphere(0.55, 48, 32), lightMat), halo, ...rays]), shadow: false, elevation: 8 };
    }
    case 'spotLight':
    case 'squareSpotLight': {
      const square = kind === 'squareSpotLight';
      const seg = square ? 4 : 40;
      const housing = mesh(new ConeGeometry(0.42, 0.62, seg, 1, true), tool, [0, 0.72, 0], [0, square ? PI / 4 : 0, 0]);
      (housing.material as ReturnType<typeof glossy>).side = DoubleSide;
      const lens = mesh(cyl(0.42, 0.42, 0.03, seg), lightMat, [0, 0.42, 0], [0, square ? PI / 4 : 0, 0]);
      const beam = mesh(
        new ConeGeometry(0.95, 1.25, seg, 1, true),
        new MeshBasicMaterial({ color: theme.light, transparent: true, opacity: 0.28, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }),
        [0, -0.2, 0],
        [0, square ? PI / 4 : 0, 0],
      );
      const pool = mesh(square ? box(1.35, 0.02, 1.35) : cyl(0.95, 0.95, 0.02, 48), glow(theme.light, 0.55), [0, -0.83, 0], [0, square ? PI / 4 : 0, 0]);
      return { root: group([housing, lens, beam, pool]), shadow: false, elevation: 24 };
    }
    case 'parallelLight': {
      const frame = mesh(rbox(1.8, 0.16, 1.2, 0.05), tool, [0, 0.86, 0]);
      const face = mesh(rbox(1.6, 0.05, 1.0, 0.02), lightMat, [0, 0.77, 0]);
      const beams = [-0.55, 0, 0.55].flatMap((x) =>
        [-0.22, 0.22].map((z) => group([arrow(1.15, glow(theme.light, 0.95), 0.07, 0.17, 0.3)], [x, 0.72, z], [PI, 0, 0])),
      );
      return { root: group([frame, face, ...beams]), shadow: false, elevation: 22 };
    }
    // edit tools -----------------------------------------------------------------------
    case 'materials': {
      const tex = canvasTexture(128, (ctx, s) => {
        ctx.fillStyle = theme.object;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#f4f1ea';
        const n = 8;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2) ctx.fillRect((x * s) / n, (y * s) / n, s / n, s / n);
      });
      const ball = mesh(sphere(0.62, 64, 48), glossy('#ffffff', { map: tex, roughness: 0.25 }), [-0.34, 0.08, 0]);
      const chromeBallSmall = mesh(sphere(0.44, 48, 32), chrome(theme.chrome), [0.6, -0.12, 0.15]);
      return { root: group([ball, chromeBallSmall]), elevation: 16 };
    }
    case 'editObject': {
      const gem = mesh(ico(0.9, 0), metal(theme.accent, 0.12), [0, 0, 0], [0.4, 0.3, 0]);
      (gem.material as ReturnType<typeof metal>).flatShading = true;
      return { root: gem, elevation: 18 };
    }
    case 'editTerrain': {
      const brush = mesh(sphere(0.22), accent, [0.35, 0.95, 0.2]);
      return { root: group([terrainChunk(13), brush]), elevation: 28 };
    }
    case 'resize': {
      const cube = mesh(rbox(0.95, 0.95, 0.95, 0.06), tool);
      const a = [
        group([arrow(0.95, accent)], [0.48, 0, 0], [0, 0, -PI / 2]),
        group([arrow(0.95, accent)], [0, 0.48, 0]),
        group([arrow(0.95, accent)], [0, 0, 0.48], [PI / 2, 0, 0]),
      ];
      return { root: group([cube, ...a]), azimuth: 35, elevation: 24 };
    }
    case 'rotate': {
      const core = mesh(sphere(0.42), tool);
      const ring = group([ringArrow(0.85, 0.07, PI * 1.55, accent)], [0, 0, 0], [PI / 2.4, 0, 0.3]);
      const ring2 = group([ringArrow(0.7, 0.05, PI * 1.3, accent)], [0, 0, 0], [0, PI / 2, 0.2]);
      return { root: group([core, ring, ring2]), elevation: 18 };
    }
    case 'reposition': {
      const dirs: V3[] = [[0, 0, -PI / 2], [0, 0, PI / 2], [PI / 2, 0, 0], [-PI / 2, 0, 0]];
      const arrows = dirs.map((r) => group([arrow(0.95, tool, 0.08, 0.2, 0.32)], [0, -0.3, 0], r));
      return { root: group([...arrows, mesh(sphere(0.36), accent, [0, 0.12, 0])]), elevation: 34 };
    }
    case 'align': {
      const bar = mesh(rbox(2.1, 0.14, 0.5, 0.04), tool, [0, -0.55, 0]);
      const balls = [
        mesh(sphere(0.3), accent, [-0.68, -0.18, 0]),
        mesh(rbox(0.5, 0.9, 0.5, 0.05), accent, [0, -0.03, 0]),
        mesh(cone(0.3, 0.7, 32), accent, [0.68, -0.13, 0]),
      ];
      return { root: group([bar, ...balls]), elevation: 16 };
    }
    case 'randomize': {
      const rnd = seeded(42);
      const cubes: Object3D[] = [];
      for (let i = 0; i < 7; i++) {
        const p: V3 = [(rnd() - 0.5) * 1.8, (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.2];
        cubes.push(mesh(rbox(0.42, 0.42, 0.42, 0.05), i % 3 === 0 ? tool : accent, p, [rnd() * PI, rnd() * PI, rnd() * PI], [0.7 + rnd() * 0.6, 0.7 + rnd() * 0.6, 0.7 + rnd() * 0.6]));
      }
      return { root: group(cubes), elevation: 20 };
    }
    case 'duplicate':
      return { root: group([mesh(rbox(1.1, 1.1, 1.1, 0.07), tool, [-0.38, -0.2, -0.3]), mesh(rbox(1.1, 1.1, 1.1, 0.07), accent, [0.38, 0.22, 0.3])], [0, 0, 0], [0, 0.4, 0]), elevation: 24 };
    case 'delete': {
      const red = glossy('#d9301f');
      return { root: group([mesh(rbox(2, 0.4, 0.4, 0.12), red, [0, 0, 0], [0, 0, PI / 4]), mesh(rbox(2, 0.4, 0.4, 0.12), red, [0, 0, 0], [0, 0, -PI / 4])]), elevation: 14 };
    }
    case 'land': {
      const slab = mesh(rbox(1.9, 0.18, 1.3, 0.05), tool, [0, -0.85, 0]);
      const ballMesh = mesh(sphere(0.38), accent, [0, 0.62, 0]);
      const down = group([arrow(0.75, accent, 0.06, 0.16, 0.26)], [0, 0.18, 0], [PI, 0, 0]);
      return { root: group([slab, ballMesh, down]), elevation: 14 };
    }

    // render ---------------------------------------------------------------------------
    case 'render':
      return { root: chromeBall(theme), elevation: 10, fill: 0.92 };
    case 'renderResume':
      return { root: group([chromeBall(theme, 0.72), group([triangleArrow(accent, true)], [0.05, 0, 0.72], [0, 0, 0], [0.62, 0.62, 0.62])]), elevation: 6 };
    case 'renderClear':
      return { root: group([chromeBall(theme, 0.72), group([ringArrow(0.5, 0.07, PI * 1.5, accent)], [0, 0, 0.62])]), elevation: 6 };
    case 'stop': {
      const red = glossy('#d42a1c');
      return { root: mesh(cyl(0.9, 0.9, 0.3, 8), red, [0, 0, 0], [PI / 2, PI / 8, 0]), elevation: 4, shadow: false };
    }

    // sky ------------------------------------------------------------------------------
    case 'dice': {
      const die = rbox(1.3, 1.3, 1.3, 0.2);
      const pip = matte('#1b1d24', 0.4);
      const pips: Object3D[] = [];
      const h = 0.66;
      pips.push(mesh(sphere(0.13, 20, 14), pip, [0, h, 0], [0, 0, 0], [1, 0.35, 1]));
      for (const [y, x] of [[0.3, -0.3], [-0.3, 0.3]]) pips.push(mesh(sphere(0.12, 20, 14), pip, [x, y, h], [0, 0, 0], [1, 1, 0.35]));
      for (const [y, z] of [[0.32, 0.32], [0, 0], [-0.32, -0.32]]) pips.push(mesh(sphere(0.11, 20, 14), pip, [h, y, z], [0, 0, 0], [0.35, 1, 1]));
      return { root: group([mesh(die, glossy('#fbfbf8', { roughness: 0.3 })), ...pips], [0, 0, 0], [0, 0, 0]), azimuth: 40, elevation: 30 };
    }
    case 'sun': {
      const core = mesh(sphere(0.55, 48, 32), glow('#ffd44a'));
      const halo = mesh(sphere(0.72), new MeshBasicMaterial({ color: '#ffb02e', transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false }));
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * PI * 2;
        return mesh(cone(0.08, 0.32, 12), glow('#ffc23a'), [Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0], [0, 0, a - PI / 2]);
      });
      return { root: group([core, halo, ...rays]), shadow: false, elevation: 0 };
    }
    case 'moon':
      return { root: mesh(sphere(0.9, 64, 48), matte('#f1ecd8', 0.7)), lighting: 'moon', shadow: false, elevation: 0 };
    case 'stars': {
      const gold = glossy('#ffd84a', { metalness: 0.4, roughness: 0.2 });
      return {
        root: group([
          mesh(extruded(starShape(0.62, 0.26), 0.16), gold, [-0.25, 0.15, 0], [0, 0, 0.2]),
          mesh(extruded(starShape(0.34, 0.14), 0.12), gold, [0.62, 0.5, -0.2], [0, 0, -0.3]),
          mesh(extruded(starShape(0.26, 0.11), 0.1), gold, [0.55, -0.45, 0.1], [0, 0, 0.5]),
        ]),
        shadow: false,
        elevation: 6,
      };
    }
    case 'cloudCover':
      return { root: cloudPuff(matte('#ffffff', 0.9), 2), elevation: 10, shadow: false };
    case 'fog': {
      const layers = [0.15, 0.35, 0.55].map((y, i) => mesh(new PlaneGeometry(2.2, 2.2), veil('#ffffff', 0.4 - i * 0.08), [0, y, 0], [-PI / 2, 0, 0]));
      return { root: group([terrainChunk(5, 0.9), ...layers]), elevation: 28 };
    }
    case 'haze': {
      const v = mesh(new PlaneGeometry(2.2, 1.6), veil('#f6efe0', 0.55), [0, 0.35, 0.9]);
      return { root: group([terrainChunk(9, 0.9), v]), elevation: 16 };
    }
    case 'shadows': {
      const slab = mesh(rbox(2, 0.12, 1.6, 0.04), tool, [0, -0.6, 0]);
      const sh = mesh(cyl(0.5, 0.5, 0.01, 40), new MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.45, depthWrite: false }), [0.35, -0.53, -0.25], [0, 0, 0], [1.2, 1, 0.7]);
      return { root: group([slab, sh, mesh(sphere(0.45), accent, [-0.25, 0.05, 0.1])]), elevation: 26, shadow: false };
    }
    case 'skySoft':
      return { root: skyDome('#eef5ff', '#6f9fe8', true, theme), elevation: 8, shadow: false };
    case 'skyDarker':
      return { root: skyDome('#9fb8ee', '#14276e', true, theme), elevation: 8, shadow: false };
    case 'skyCustom':
      return { root: skyDome('#ffb86b', '#8a3fd1', true, theme), elevation: 8, shadow: false };
    case 'skyOff':
      return { root: skyDome('#55585f', '#3a3d44', false, theme), elevation: 8, shadow: false };

    // view & display -----------------------------------------------------------------------
    case 'camera': {
      const body = glossy('#2a2d34', { roughness: 0.35 });
      return {
        root: group([
          mesh(rbox(1.3, 0.75, 0.6, 0.08), body, [0, -0.15, 0]),
          mesh(cyl(0.32, 0.32, 0.18, 32), tool, [-0.3, 0.55, 0], [PI / 2, 0, 0]),
          mesh(cyl(0.32, 0.32, 0.18, 32), tool, [0.32, 0.55, 0], [PI / 2, 0, 0]),
          mesh(cyl(0.18, 0.26, 0.45, 32), accent, [0.86, -0.15, 0], [0, 0, PI / 2]),
        ]),
        azimuth: 35,
        elevation: 16,
      };
    }
    case 'director': {
      const stripes = canvasTexture(64, (ctx, s) => {
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#1c1d22';
        for (let i = -2; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 16, s);
          ctx.lineTo(i * 16 + 8, s);
          ctx.lineTo(i * 16 + 8 + s, 0);
          ctx.lineTo(i * 16 + s, 0);
          ctx.fill();
        }
      });
      const board = glossy('#22252c', { roughness: 0.4 });
      const top = glossy('#ffffff', { map: stripes, roughness: 0.4 });
      return {
        root: group([mesh(rbox(1.6, 1.05, 0.14, 0.04), board, [0, -0.25, 0]), mesh(rbox(1.6, 0.26, 0.14, 0.03), top, [0.05, 0.48, 0], [0, 0, 0.22])]),
        elevation: 12,
      };
    }
    case 'viewCamera':
      return { root: viewPlatform(theme), azimuth: 25, elevation: 28, fill: 0.95 };
    case 'viewDirector':
      return { root: viewPlatform(theme), azimuth: -40, elevation: 42, fill: 0.95 };
    case 'viewTop':
      return { root: viewPlatform(theme), azimuth: 0, elevation: 89, shadow: false };
    case 'viewBottom':
      return { root: viewPlatform(theme, true), azimuth: 0, elevation: -89, shadow: false };
    case 'viewFront':
      return { root: viewPlatform(theme), azimuth: 0, elevation: 12, fill: 0.95 };
    case 'viewBack':
      return { root: viewPlatform(theme), azimuth: 180, elevation: 12, fill: 0.95 };
    case 'viewLeft':
      return { root: viewPlatform(theme), azimuth: -90, elevation: 12, fill: 0.95 };
    case 'viewRight':
      return { root: viewPlatform(theme), azimuth: 90, elevation: 12, fill: 0.95 };
    case 'eye': {
      const white = glossy('#fbfbfb', { roughness: 0.15 });
      const iris = glossy(theme.accent, { roughness: 0.2 });
      const pupil = glossy('#08080a', { roughness: 0.1 });
      return {
        root: group([
          mesh(sphere(0.9, 64, 48), white),
          mesh(sphere(1, 48, 32), iris, [0, 0, 0.74], [0, 0, 0], [0.44, 0.44, 0.2]),
          mesh(sphere(1, 32, 24), pupil, [0, 0, 0.83], [0, 0, 0], [0.2, 0.2, 0.12]),
        ]),
        azimuth: 14,
        elevation: 8,
      };
    }
    case 'library': {
      const cols = [theme.object, theme.tool, theme.accent];
      return {
        root: group(cols.map((c, i) => mesh(rbox(1.5, 0.12, 1.1, 0.04), i === 1 ? tool : glossy(c), [i * 0.12 - 0.12, i * 0.28 - 0.28, -i * 0.1], [0, -0.25 + i * 0.25, 0]))),
        elevation: 32,
      };
    }
    case 'zoomIn':
      return { root: magnifier(theme, true), elevation: 6, shadow: false };
    case 'zoomOut':
      return { root: magnifier(theme, false), elevation: 6, shadow: false };
    case 'frame':
      return { root: group([...corners(tool), mesh(sphere(0.32), accent)]), elevation: 4, shadow: false };
    case 'selectAll':
      return {
        root: group([...corners(tool), mesh(sphere(0.22), accent, [-0.3, -0.25, 0]), mesh(rbox(0.36, 0.36, 0.36, 0.04), accent, [0.32, -0.22, 0]), mesh(cone(0.2, 0.42, 24), accent, [0, 0.3, 0])]),
        elevation: 4,
        shadow: false,
      };
    case 'selectNone':
      return { root: group(corners(tool)), elevation: 4, shadow: false };
    case 'wireframe': {
      const bar = glossy(theme.accent, { roughness: 0.25 });
      const edges: Object3D[] = [];
      const s = 0.8;
      for (const a of [-s, s]) {
        for (const b of [-s, s]) {
          edges.push(mesh(cyl(0.045, 0.045, s * 2, 10), bar, [a, 0, b]));
          edges.push(mesh(cyl(0.045, 0.045, s * 2, 10), bar, [0, a, b], [0, 0, PI / 2]));
          edges.push(mesh(cyl(0.045, 0.045, s * 2, 10), bar, [a, b, 0], [PI / 2, 0, 0]));
        }
      }
      for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) edges.push(mesh(sphere(0.08, 16, 12), bar, [x, y, z]));
      return { root: group(edges, [0, 0, 0], [0, PI / 5, 0]), elevation: 24 };
    }
    case 'solid':
      return { root: group([mesh(rbox(1.5, 1.5, 1.5, 0.08), accent, [0, 0, 0], [0, PI / 5, 0])]), elevation: 24 };
    case 'prev':
      return { root: triangleArrow(accent, false), elevation: 10, shadow: false };
    case 'next':
      return { root: triangleArrow(accent, true), elevation: 10, shadow: false };
    case 'family':
      return {
        root: group([mesh(sphere(0.42), glossy('#2e5bd6'), [-0.55, -0.2, 0]), mesh(sphere(0.42), glossy('#1d9a4c'), [0.55, -0.2, 0]), mesh(sphere(0.42), glossy('#e39a12'), [0, 0.45, -0.1])]),
        elevation: 12,
      };
    case 'objectList': {
      const rows = [0.55, 0, -0.55].map((y, i) => group([mesh(sphere(0.16), accent, [-0.75, 0, 0]), mesh(rbox(1.25, 0.2, 0.22, 0.05), tool, [0.12, 0, 0])], [0, y, i * 0.05]));
      return { root: group(rows), elevation: 8, shadow: false };
    }
    case 'depthCue': {
      const cubes = [0, 1, 2].map((i) => mesh(rbox(0.7, 0.7, 0.7, 0.05), glossy(theme.accent, { transparent: true, opacity: 1 - i * 0.3 }), [-0.6 + i * 0.6, 0, -i * 1.1]));
      return { root: group(cubes), azimuth: 20, elevation: 18 };
    }
    case 'resetView': {
      const target = [0.9, 0.62, 0.34].map((r, i) => mesh(cyl(r, r, 0.12 + i * 0.04, 48), i % 2 ? accent : tool, [0, i * 0.04, 0]));
      return { root: group(target, [0, 0, 0], [PI / 2.4, 0, 0]), elevation: 8 };
    }
    // light-ish fallback for any kind added later without a model
    default:
      return { root: mesh(sphere(0.8), obj) };
  }
}
