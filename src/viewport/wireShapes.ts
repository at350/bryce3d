/**
 * Bryce-style wireframe shapes in canonical object space ([-1, 1]^3, see PrimitiveType in
 * core/types.ts). Every builder returns a flat Float32Array of line-segment endpoints
 * (x0 y0 z0 x1 y1 z1 ...). The object matrix (core/math objectMatrix) places them.
 */
import { clamp } from '@/core/math';
import type { StoneParams, TreeParams, Vec3 } from '@/core/types';
import { fbm3, valueNoise3 } from './noise';

const TAU = Math.PI * 2;

/** Accumulates line segments. */
export class SegmentBuilder {
  private data: number[] = [];

  seg(a: Vec3, b: Vec3): this {
    this.data.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    return this;
  }

  polyline(points: Vec3[], closed = false): this {
    for (let i = 0; i + 1 < points.length; i++) this.seg(points[i], points[i + 1]);
    if (closed && points.length > 2) this.seg(points[points.length - 1], points[0]);
    return this;
  }

  get count(): number {
    return this.data.length / 6;
  }

  build(): Float32Array {
    return new Float32Array(this.data);
  }
}

/** Points on a horizontal circle (XZ plane) at height y. */
function ringXZ(y: number, r: number, n: number, radius?: (x: number, z: number) => number): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = Math.cos(a);
    const z = Math.sin(a);
    const rr = radius ? radius(x, z) : r;
    pts.push([x * rr, y, z * rr]);
  }
  return pts;
}

/** Edges of an axis-aligned box. */
export function boxWire(min: Vec3 = [-1, -1, -1], max: Vec3 = [1, 1, 1]): Float32Array {
  const b = new SegmentBuilder();
  const c = (i: number): Vec3 => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
  for (let i = 0; i < 8; i++) {
    for (const bit of [1, 2, 4]) {
      if (!(i & bit)) b.seg(c(i), c(i | bit));
    }
  }
  return b.build();
}

/** Latitude rings and meridians on the unit sphere, optionally displaced by a radius function. */
function latLongWire(rings: number, meridians: number, segs: number, radius?: (d: Vec3) => number): Float32Array {
  const b = new SegmentBuilder();
  const at = (lat: number, lon: number): Vec3 => {
    const d: Vec3 = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
    const r = radius ? radius(d) : 1;
    return [d[0] * r, d[1] * r, d[2] * r];
  };
  for (let i = 1; i <= rings; i++) {
    const lat = -Math.PI / 2 + (i / (rings + 1)) * Math.PI;
    const pts: Vec3[] = [];
    for (let j = 0; j < segs; j++) pts.push(at(lat, (j / segs) * TAU));
    b.polyline(pts, true);
  }
  const half = Math.max(4, Math.round(segs / 2));
  for (let m = 0; m < meridians; m++) {
    const lon = (m / meridians) * TAU;
    const pts: Vec3[] = [];
    for (let j = 0; j <= half; j++) pts.push(at(-Math.PI / 2 + (j / half) * Math.PI, lon));
    b.polyline(pts);
  }
  return b.build();
}

export function sphereWire(): Float32Array {
  return latLongWire(7, 12, 48);
}

export function cubeWire(): Float32Array {
  return boxWire();
}

export function cylinderWire(): Float32Array {
  const b = new SegmentBuilder();
  for (const y of [-1, -1 / 3, 1 / 3, 1]) b.polyline(ringXZ(y, 1, 48), true);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    b.seg([Math.cos(a), -1, Math.sin(a)], [Math.cos(a), 1, Math.sin(a)]);
  }
  return b.build();
}

export function coneWire(): Float32Array {
  const b = new SegmentBuilder();
  for (const y of [-1, -1 / 3, 1 / 3]) b.polyline(ringXZ(y, (1 - y) / 2, 48), true);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    b.seg([Math.cos(a), -1, Math.sin(a)], [0, 1, 0]);
  }
  return b.build();
}

export function torusWire(minorRadius: number): Float32Array {
  const r = clamp(minorRadius, 0.02, 0.5);
  const R = 1 - r;
  const b = new SegmentBuilder();
  const tube = 24;
  const around = 24;
  for (let i = 0; i < around; i++) {
    const a = (i / around) * TAU;
    const pts: Vec3[] = [];
    for (let j = 0; j < tube; j++) {
      const t = (j / tube) * TAU;
      const rr = R + r * Math.cos(t);
      pts.push([Math.cos(a) * rr, r * Math.sin(t), Math.sin(a) * rr]);
    }
    b.polyline(pts, true);
  }
  for (const t of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    b.polyline(ringXZ(r * Math.sin(t), R + r * Math.cos(t), 64), true);
  }
  return b.build();
}

export function pyramidWire(): Float32Array {
  const b = new SegmentBuilder();
  const square = (y: number, h: number): Vec3[] => [
    [-h, y, -h],
    [h, y, -h],
    [h, y, h],
    [-h, y, h],
  ];
  for (const y of [-1, -1 / 3, 1 / 3]) b.polyline(square(y, (1 - y) / 2), true);
  for (const c of square(-1, 1)) b.seg(c, [0, 1, 0]);
  return b.build();
}

export function discWire(): Float32Array {
  const b = new SegmentBuilder();
  b.polyline(ringXZ(0, 1, 64), true);
  b.polyline(ringXZ(0, 0.5, 40), true);
  for (let i = 0; i < 4; i++) {
    const a = (i / 8) * TAU;
    b.seg([Math.cos(a), 0, Math.sin(a)], [-Math.cos(a), 0, -Math.sin(a)]);
  }
  return b.build();
}

export function squareWire(): Float32Array {
  const b = new SegmentBuilder();
  for (const t of [-1, -0.5, 0, 0.5, 1]) {
    b.seg([t, 0, -1], [t, 0, 1]);
    b.seg([-1, 0, t], [1, 0, t]);
  }
  return b.build();
}

/** Radius of the editor's stand-in stone along a unit direction (0.35..1). */
export function stoneRadius(s: StoneParams, d: Vec3): number {
  const seed = (s.seed | 0) >>> 0;
  const lump = fbm3(seed, d[0] * 1.15 + 3.1, d[1] * 1.15 + 7.7, d[2] * 1.15 + 1.3, 3) - 0.5;
  const rough = fbm3(seed + 977, d[0] * 4.3, d[1] * 4.3, d[2] * 4.3, 2) - 0.5;
  const r = 0.86 + lump * (0.3 + 0.9 * clamp(s.lumpiness, 0, 1)) * 0.7 + rough * clamp(s.roughness, 0, 1) * 0.18;
  return clamp(r, 0.35, 1);
}

export function stoneWire(s: StoneParams): Float32Array {
  return latLongWire(5, 10, 32, (d) => stoneRadius(s, d));
}

/** Shape facts of the editor's stand-in tree, shared by the wire, solid and pick builders. */
export function treeLayout(t: TreeParams) {
  const trunkTop = -1 + 2 * clamp(t.trunkHeight, 0.1, 0.9);
  const trunkRadius = clamp(t.trunkWidth, 0.02, 0.35);
  const crownBottom = clamp(trunkTop - 0.35, -0.9, 0.6);
  return { trunkTop, trunkRadius, crownBottom };
}

/** Crown radius scale at a direction: lumpy by crownNoise. */
function crownLump(t: TreeParams, d: Vec3): number {
  const n = valueNoise3((t.seed | 0) >>> 0, d[0] * 2.2 + 5, d[1] * 2.2 + 1, d[2] * 2.2 + 9) - 0.5;
  return 1 + n * clamp(t.crownNoise, 0, 1) * 0.45;
}

export function treeWire(t: TreeParams): Float32Array {
  const b = new SegmentBuilder();
  const { trunkTop, trunkRadius: rt, crownBottom } = treeLayout(t);
  // Trunk: a tapered tube.
  b.polyline(ringXZ(-1, rt * 1.3, 12), true);
  b.polyline(ringXZ(trunkTop, rt * 0.7, 12), true);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    b.seg([Math.cos(a) * rt * 1.3, -1, Math.sin(a) * rt * 1.3], [Math.cos(a) * rt * 0.7, trunkTop, Math.sin(a) * rt * 0.7]);
  }
  const rand = (i: number) => valueNoise3((t.seed | 0) >>> 0, i * 1.7, 0.5, 2.3);

  if (t.crown === 'cone') {
    // Three stacked conifer tiers.
    const tiers = 3;
    const span = 1 - crownBottom;
    for (let k = 0; k < tiers; k++) {
      const yb = crownBottom + (k / tiers) * span * 0.8;
      const yt = Math.min(1, yb + span * 0.55);
      const r = 0.95 * (1 - k * 0.25);
      const ring = ringXZ(yb, r, 24, (x, z) => r * crownLump(t, [x, 0, z]));
      b.polyline(ring, true);
      for (let i = 0; i < ring.length; i += 3) b.seg(ring[i], [0, yt, 0]);
    }
    b.seg([0, trunkTop, 0], [0, 1, 0]);
    return b.build();
  }

  if (t.crown === 'palm') {
    const fronds = 7;
    const peak = Math.min(1, trunkTop + 0.3);
    for (let f = 0; f < fronds; f++) {
      const a = (f / fronds) * TAU + rand(f) * 0.6;
      const reach = 0.75 + rand(f + 10) * 0.2;
      const pts: Vec3[] = [];
      for (let i = 0; i <= 10; i++) {
        const s = i / 10;
        const r = s * reach;
        const y = trunkTop + (peak - trunkTop) * Math.sin(s * Math.PI * 0.6) - 0.7 * s * s;
        pts.push([Math.cos(a) * r, Math.max(-0.95, y), Math.sin(a) * r]);
      }
      b.polyline(pts);
      for (let i = 2; i < pts.length - 1; i += 2) {
        const p = pts[i];
        const side: Vec3 = [-Math.sin(a) * 0.12, -0.08, Math.cos(a) * 0.12];
        b.seg(p, [p[0] + side[0], p[1] + side[1], p[2] + side[2]]);
        b.seg(p, [p[0] - side[0], p[1] + side[1], p[2] - side[2]]);
      }
    }
    return b.build();
  }

  // round and willow share an ellipsoidal canopy.
  const cy = (crownBottom + 1) / 2;
  const ry = (1 - crownBottom) / 2;
  const willow = t.crown === 'willow';
  const meridians = 6;
  for (let m = 0; m < meridians; m++) {
    const lon = (m / meridians) * Math.PI;
    const pts: Vec3[] = [];
    const n = 32;
    for (let i = 0; i <= n; i++) {
      // Willow: a dome (upper half); round: full great circles.
      const lat = willow ? (i / n) * Math.PI : (i / n) * TAU;
      const d: Vec3 = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
      const k = crownLump(t, d);
      pts.push([d[0] * 0.95 * k, cy + d[1] * ry * k, d[2] * 0.95 * k]);
    }
    b.polyline(pts);
  }
  for (const lat of willow ? [0.15, 0.6] : [-0.6, 0, 0.6]) {
    const y = Math.sin(lat);
    const r = Math.cos(lat);
    b.polyline(
      ringXZ(0, 1, 32).map(([x, , z]): Vec3 => {
        const d: Vec3 = [x * r, y, z * r];
        const k = crownLump(t, d);
        return [d[0] * 0.95 * k, cy + y * ry * k, d[2] * 0.95 * k];
      }),
      true,
    );
  }
  if (willow) {
    // Drooping strands from the canopy rim.
    const strands = 18;
    for (let i = 0; i < strands; i++) {
      const a = (i / strands) * TAU + rand(i) * 0.3;
      const r0 = 0.9 * crownLump(t, [Math.cos(a), 0, Math.sin(a)]);
      const len = 0.6 + rand(i + 40) * 0.6;
      const y0 = cy;
      b.seg([Math.cos(a) * r0, y0, Math.sin(a) * r0], [Math.cos(a) * (r0 + 0.05), Math.max(-0.98, y0 - len), Math.sin(a) * (r0 + 0.05)]);
    }
  } else {
    // A few branches reaching into the canopy.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rand(i + 20);
      b.seg([0, trunkTop, 0], [Math.cos(a) * 0.55, cy + (rand(i + 30) - 0.3) * ry, Math.sin(a) * 0.55]);
    }
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Light and camera glyphs
// ---------------------------------------------------------------------------

function circle(b: SegmentBuilder, center: Vec3, u: Vec3, v: Vec3, r: number, n: number) {
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const c = Math.cos(a) * r;
    const s = Math.sin(a) * r;
    pts.push([center[0] + u[0] * c + v[0] * s, center[1] + u[1] * c + v[1] * s, center[2] + u[2] * c + v[2] * s]);
  }
  b.polyline(pts, true);
}

/** Radial light: a small sun burst. */
export function radialLightGlyph(): Float32Array {
  const b = new SegmentBuilder();
  circle(b, [0, 0, 0], [1, 0, 0], [0, 1, 0], 0.42, 24);
  circle(b, [0, 0, 0], [0, 0, 1], [0, 1, 0], 0.42, 24);
  circle(b, [0, 0, 0], [1, 0, 0], [0, 0, 1], 0.42, 24);
  const dirs: Vec3[] = [];
  for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as Vec3[]) dirs.push(d);
  for (let i = 0; i < 8; i++) dirs.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1].map((x) => x / Math.sqrt(3)) as Vec3);
  for (const d of dirs) b.seg([d[0] * 0.6, d[1] * 0.6, d[2] * 0.6], [d[0], d[1], d[2]]);
  return b.build();
}

/** Spotlight (round or square): a bulb and its light cone opening down local -Y. */
export function spotLightGlyph(coneAngle: number, square: boolean): Float32Array {
  const b = new SegmentBuilder();
  circle(b, [0, 0, 0], [1, 0, 0], [0, 0, 1], 0.3, 16);
  circle(b, [0, 0, 0], [1, 0, 0], [0, 1, 0], 0.3, 16);
  const L = 1.6;
  const R = Math.min(2.2, L * Math.tan((clamp(coneAngle, 5, 170) * Math.PI) / 360));
  if (square) {
    const rim: Vec3[] = [
      [-R, -L, -R],
      [R, -L, -R],
      [R, -L, R],
      [-R, -L, R],
    ];
    b.polyline(rim, true);
    for (const p of rim) b.seg([0, 0, 0], p);
  } else {
    circle(b, [0, -L, 0], [1, 0, 0], [0, 0, 1], R, 32);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      b.seg([0, 0, 0], [Math.cos(a) * R, -L, Math.sin(a) * R]);
    }
  }
  b.seg([0, -0.3, 0], [0, -L, 0]);
  return b.build();
}

/** Parallel light: an emitter plate with parallel arrows along local -Y. */
export function parallelLightGlyph(): Float32Array {
  const b = new SegmentBuilder();
  const h = 0.7;
  b.polyline(
    [
      [-h, 0, -h],
      [h, 0, -h],
      [h, 0, h],
      [-h, 0, h],
    ],
    true,
  );
  for (const [x, z] of [
    [0, 0],
    [-0.4, -0.4],
    [0.4, -0.4],
    [0.4, 0.4],
    [-0.4, 0.4],
  ]) {
    b.seg([x, 0, z], [x, -1.3, z]);
    b.seg([x, -1.3, z], [x + 0.12, -1.1, z]);
    b.seg([x, -1.3, z], [x - 0.12, -1.1, z]);
  }
  return b.build();
}

/** A little film camera in camera space (x right, y up, looking down -z). About 1 unit long. */
export function cameraGlyph(): Float32Array {
  const body = boxWire([-0.3, -0.22, 0.12], [0.3, 0.22, 0.8]);
  const out = new SegmentBuilder();
  for (let i = 0; i < body.length; i += 6) {
    out.seg([body[i], body[i + 1], body[i + 2]], [body[i + 3], body[i + 4], body[i + 5]]);
  }
  // Lens hood flaring toward the view direction.
  const back: Vec3[] = [
    [-0.12, -0.1, 0.12],
    [0.12, -0.1, 0.12],
    [0.12, 0.1, 0.12],
    [-0.12, 0.1, 0.12],
  ];
  const front: Vec3[] = back.map(([x, y]) => [x * 1.9, y * 1.9, -0.22] as Vec3);
  out.polyline(back, true).polyline(front, true);
  for (let i = 0; i < 4; i++) out.seg(back[i], front[i]);
  // Two film reels on top.
  circle(out, [0, 0.42, 0.28], [0, 0, 1], [0, 1, 0], 0.17, 16);
  circle(out, [0, 0.42, 0.64], [0, 0, 1], [0, 1, 0], 0.17, 16);
  return out.build();
}
