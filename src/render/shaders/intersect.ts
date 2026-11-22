/**
 * Ray-object intersection in object space (the cube [-1, 1]^3). Ray directions are NOT
 * normalized after the world->object transform, so t is the same world-space distance
 * on both sides. Every function returns INF on a miss and the object-space normal in n.
 */
export const INTERSECT_GLSL = /* glsl */ `
float hitSphere(vec3 ro, vec3 rd, float tmin, float tmax, out vec3 n) {
  float a = dot(rd, rd);
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 1.0;
  float disc = b * b - a * c;
  n = vec3(0.0, 1.0, 0.0);
  if (disc < 0.0) return INF;
  float s = sqrt(disc);
  float t = (-b - s) / a;
  if (t < tmin) t = (-b + s) / a;
  if (t < tmin || t > tmax) return INF;
  n = ro + rd * t;
  return t;
}

float hitBox(vec3 ro, vec3 rd, float tmin, float tmax, out vec3 n) {
  n = vec3(0.0, 1.0, 0.0);
  vec2 iv = boxHit(ro, rd, vec3(-1.0), vec3(1.0));
  if (iv.x > iv.y) return INF;
  float t = iv.x >= tmin ? iv.x : iv.y;
  if (t < tmin || t > tmax) return INF;
  vec3 p = ro + rd * t;
  vec3 a = abs(p);
  if (a.x >= a.y && a.x >= a.z) n = vec3(sign(p.x), 0.0, 0.0);
  else if (a.y >= a.z) n = vec3(0.0, sign(p.y), 0.0);
  else n = vec3(0.0, 0.0, sign(p.z));
  return t;
}

float hitCylinder(vec3 ro, vec3 rd, float tmin, float tmax, out vec3 n) {
  float best = INF;
  n = vec3(0.0, 1.0, 0.0);
  float a = dot(rd.xz, rd.xz);
  if (a > 1e-14) {
    float b = dot(ro.xz, rd.xz);
    float c = dot(ro.xz, ro.xz) - 1.0;
    float disc = b * b - a * c;
    if (disc >= 0.0) {
      float s = sqrt(disc);
      for (int k = 0; k < 2; k++) {
        float t = (-b + (k == 0 ? -s : s)) / a;
        float y = ro.y + rd.y * t;
        if (t >= tmin && t < best && abs(y) <= 1.0) {
          best = t;
          vec2 q = ro.xz + rd.xz * t;
          n = vec3(q.x, 0.0, q.y);
        }
      }
    }
  }
  if (abs(rd.y) > 1e-14) {
    for (int k = 0; k < 2; k++) {
      float yc = k == 0 ? -1.0 : 1.0;
      float t = (yc - ro.y) / rd.y;
      vec2 q = ro.xz + rd.xz * t;
      if (t >= tmin && t < best && dot(q, q) <= 1.0) {
        best = t;
        n = vec3(0.0, yc, 0.0);
      }
    }
  }
  return best <= tmax ? best : INF;
}

// Apex at (0, 1, 0), base radius 1 at y = -1: x^2 + z^2 = ((1 - y) / 2)^2.
float hitCone(vec3 ro, vec3 rd, float tmin, float tmax, out vec3 n) {
  float best = INF;
  n = vec3(0.0, 1.0, 0.0);
  const float k = 0.25;
  float y0 = 1.0 - ro.y;
  float a = dot(rd.xz, rd.xz) - k * rd.y * rd.y;
  float b = dot(ro.xz, rd.xz) + k * y0 * rd.y;
  float c = dot(ro.xz, ro.xz) - k * y0 * y0;
  float ts[2];
  ts[0] = INF;
  ts[1] = INF;
  if (abs(a) > 1e-10) {
    float disc = b * b - a * c;
    if (disc >= 0.0) {
      float s = sqrt(disc);
      ts[0] = (-b - s) / a;
      ts[1] = (-b + s) / a;
    }
  } else if (abs(b) > 1e-10) {
    ts[0] = -c / (2.0 * b);
  }
  for (int i = 0; i < 2; i++) {
    float t = ts[i];
    if (t >= tmin && t < best) {
      vec3 p = ro + rd * t;
      if (p.y >= -1.0 && p.y <= 1.0) {
        best = t;
        n = vec3(p.x, k * (1.0 - p.y), p.z);
      }
    }
  }
  if (abs(rd.y) > 1e-14) {
    float t = (-1.0 - ro.y) / rd.y;
    vec2 q = ro.xz + rd.xz * t;
    if (t >= tmin && t < best && dot(q, q) <= 1.0) {
      best = t;
      n = vec3(0.0, -1.0, 0.0);
    }
  }
  return best <= tmax ? best : INF;
}

// Square base [-1, 1]^2 at y = -1, apex (0, 1, 0): intersection of five half-spaces.
float hitPyramid(vec3 ro, vec3 rd, float tmin, float tmax, out vec3 n) {
  n = vec3(0.0, 1.0, 0.0);
  float tn = -INF;
  float tf = INF;
  vec3 nn = vec3(0.0);
  vec3 nf = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec3 pn = i == 0 ? vec3(2.0, 1.0, 0.0) : i == 1 ? vec3(-2.0, 1.0, 0.0) : i == 2 ? vec3(0.0, 1.0, 2.0) : i == 3 ? vec3(0.0, 1.0, -2.0) : vec3(0.0, -1.0, 0.0);
    float dist = dot(pn, ro) - 1.0;
    float den = dot(pn, rd);
    if (abs(den) < 1e-14) {
      if (dist > 0.0) return INF;
      continue;
    }
    float t = -dist / den;
    if (den < 0.0) {
      if (t > tn) { tn = t; nn = pn; }
    } else if (t < tf) {
      tf = t;
      nf = pn;
    }
  }
  if (tn > tf) return INF;
  float t = tn >= tmin ? tn : tf;
  if (t < tmin || t > tmax) return INF;
  n = tn >= tmin ? nn : nf;
  return t;
}

float hitFlat(vec3 ro, vec3 rd, float tmin, float tmax, bool round, out vec3 n) {
  n = vec3(0.0, 1.0, 0.0);
  if (abs(rd.y) < 1e-14) return INF;
  float t = -ro.y / rd.y;
  if (t < tmin || t > tmax) return INF;
  vec2 q = ro.xz + rd.xz * t;
  if (round ? dot(q, q) > 1.0 : max(abs(q.x), abs(q.y)) > 1.0) return INF;
  return t;
}

// ---------------------------------------------------------------------------
// Signed distance shapes (sphere-traced inside their box)
// ---------------------------------------------------------------------------

float sdTorus(vec3 p, float R, float r) {
  vec2 q = vec2(length(p.xz) - R, p.y);
  return length(q) - r;
}

float sdStone(vec3 p, vec4 p0, vec4 p1) {
  vec3 q = p + p0.xyz;
  float lump = (fbmRaw(q * 1.15, 3, 0.5) - 0.5) * 2.0;
  float rough = (fbmRaw(q * 5.3 + 2.0, 3, 0.55) - 0.5) * 2.0;
  float r = length(p * vec3(1.0, 1.06, 1.0));
  float d = r - 0.8 - lump * p0.w * 0.24 - rough * p1.x * 0.055;
  d = max(d, -(p.y + 0.93));
  return d;
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-6);
}

// Tree in its box: trunk from y = -1 to the crown, crown shape by type. part 1 = trunk.
float sdTree(vec3 p, vec4 p0, vec4 p1, out int part) {
  float trunkTop = -1.0 + 2.0 * p0.w;
  float tw = p1.x;
  int crown = int(p1.y + 0.5);
  float cn = p1.z;
  vec3 seed = p0.xyz;
  float yk = clamp((p.y + 1.0) / max(trunkTop + 1.0, 1e-3), 0.0, 1.0);
  float bend = crown == 2 ? sin(yk * 1.4) * 0.08 : 0.0;
  float rT = mix(tw, tw * 0.55, yk);
  float trunkEnd = crown == 2 ? trunkTop + 0.05 : trunkTop + 0.25;
  float dTrunk = max(length(p.xz - vec2(bend, 0.0)) - rT, max(-1.0 - p.y, p.y - trunkEnd));
  float dCrown = INF;
  float wob = (fbmRaw(p * 3.1 + seed, 3, 0.5) - 0.5) * cn;
  if (crown == 0) {
    float cy = (trunkTop + 1.0) * 0.5;
    vec3 rr = vec3(0.92, max((1.0 - trunkTop) * 0.5 + 0.06, 0.2), 0.92);
    float clumps = (noise3(p * 4.1 + seed) - 0.5) * 0.3 * cn;
    dCrown = sdEllipsoid(p - vec3(0.0, cy, 0.0), rr) + wob * 0.3 + clumps;
  } else if (crown == 1) {
    float yb = trunkTop - 0.12;
    float h = max(1.0 - yb, 0.2);
    float u = clamp((p.y - yb) / h, 0.0, 1.0);
    float tiers = 0.82 + 0.18 * fract(u * 4.0 + 0.5);
    float r = 0.92 * (1.0 - u) * tiers;
    dCrown = max((length(p.xz) - r) * 0.85, max(yb - p.y, p.y - 1.0)) + wob * 0.18;
  } else if (crown == 2) {
    vec3 c = vec3(bend, trunkTop, 0.0);
    vec3 q = p - c;
    float ang = atan(q.z, q.x);
    float sector = TAU / 8.0;
    float idx = floor(ang / sector + 0.5);
    float a2 = ang - idx * sector + (hash13(vec3(idx, seed.x, 1.0)) - 0.5) * 0.3;
    float r = length(q.xz);
    vec3 f = vec3(r * cos(a2), q.y, r * sin(a2));
    float x = clamp(f.x, 0.0, 0.98);
    float droop = 0.22 * x - (0.75 + 0.2 * hash13(vec3(idx, 2.0, seed.y))) * x * x;
    float w = 0.12 * (1.0 - x / 0.98) + 0.012;
    float frond = length(vec2(f.y - droop, f.z * 0.55)) - w;
    frond = max(frond, -f.x);
    float nuts = length(q + vec3(0.0, 0.06, 0.0)) - 0.09;
    dCrown = min(frond * 0.8, nuts);
  } else {
    float cy = trunkTop + (1.0 - trunkTop) * 0.45;
    vec3 rr = vec3(0.88, max((1.0 - trunkTop) * 0.5, 0.18), 0.88);
    float dome = sdEllipsoid(p - vec3(0.0, cy, 0.0), rr) + wob * 0.2;
    float rr2 = length(p.xz);
    float ang = atan(p.z, p.x);
    float strands = 0.5 + 0.5 * sin(ang * 46.0 + noise3(p * 4.0 + seed) * 5.0);
    float hang = cy - (cy + 1.0) * 0.72;
    float droopR = 0.8 + (cy - p.y) * 0.08;
    float curtain = max(abs(rr2 - droopR) - 0.035 - 0.05 * strands, max(hang - p.y, p.y - cy));
    dCrown = min(dome, curtain * 0.8);
  }
  part = dTrunk < dCrown ? 1 : 0;
  return min(dTrunk, dCrown);
}

float sdfShape(int type, vec3 p, vec4 p0, vec4 p1, out int part) {
  part = 0;
  if (type == T_TORUS) return sdTorus(p, p0.y, p0.x);
  if (type == T_STONE) return sdStone(p, p0, p1);
  return sdTree(p, p0, p1, part);
}

// Tetrahedral gradient; a loop with one call site keeps the inlined SDF code small.
vec3 sdfNormal(int type, vec3 p, vec4 p0, vec4 p1, int taps) {
  vec3 g = vec3(0.0);
  int dummy;
  for (int i = 0; i < taps; i++) {
    vec3 e = 0.5773 * (2.0 * vec3(float((i + 3) >> 1 & 1), float(i >> 1 & 1), float(i & 1)) - 1.0);
    g += e * sdfShape(type, p + e * 0.0015, p0, p1, dummy);
  }
  return normalize(g + vec3(0.0, 1e-9, 0.0));
}

float hitSDF(int type, vec3 ro, vec3 rd, float tmin, float tmax, vec4 p0, vec4 p1, int steps, out vec3 n, out int part) {
  n = vec3(0.0, 1.0, 0.0);
  part = 0;
  float yr = type == T_TORUS ? p0.x : 1.0;
  vec2 iv = boxHit(ro, rd, vec3(-1.0, -yr, -1.0), vec3(1.0, yr, 1.0));
  float t = max(iv.x, tmin);
  float tEnd = min(iv.y, tmax);
  if (t > tEnd) return INF;
  float speed = max(length(rd), 1e-9);
  float relax = type == T_TORUS ? 1.0 : 0.6;
  for (int i = 0; i < min(steps, 160); i++) {
    vec3 p = ro + rd * t;
    float d = sdfShape(type, p, p0, p1, part);
    if (abs(d) < 6e-4) {
      if (type == T_TORUS) {
        vec2 q = normalize(p.xz + vec2(1e-7, 0.0)) * p0.y;
        n = p - vec3(q.x, 0.0, q.y);
      } else {
        n = sdfNormal(type, p, p0, p1, steps > 0 ? 4 : 0);
      }
      return t;
    }
    t += max(abs(d) * relax, 2e-4) / speed;
    if (t > tEnd) return INF;
  }
  return INF;
}

// ---------------------------------------------------------------------------
// Terrain / lattice heightfields
// tp: layer, uvScale, uvBias, lipschitz   cp: clipLow, clipHigh, maxHeight, grid size
// ---------------------------------------------------------------------------

float terrainH(vec2 xz, vec4 tp) {
  vec2 uv = (clamp(xz, -1.0, 1.0) * 0.5 + 0.5) * tp.y + tp.z;
  return textureLod(uTerrain, vec3(uv, tp.x), 0.0).r;
}

// Positive outside the solid, negative inside.
float terrainF(vec3 p, vec4 tp, vec4 cp, bool lattice) {
  float h = terrainH(p.xz, tp);
  if (h < cp.x || (lattice && h <= 1e-4)) return 0.02;
  float hc = min(h, cp.y);
  if (lattice) return abs(p.y) - hc;
  return max(p.y - (2.0 * hc - 1.0), (2.0 * cp.x - 1.0) - p.y);
}

vec3 terrainNormal(vec3 p, vec4 tp, vec4 cp, bool lattice) {
  float e = 2.0 / max(cp.w - 1.0, 1.0);
  float hx = terrainH(p.xz + vec2(e, 0.0), tp) - terrainH(p.xz - vec2(e, 0.0), tp);
  float hz = terrainH(p.xz + vec2(0.0, e), tp) - terrainH(p.xz - vec2(0.0, e), tp);
  float k = lattice ? 0.5 : 1.0;
  vec3 n = normalize(vec3(-hx / e * k, 1.0, -hz / e * k));
  if (terrainH(p.xz, tp) > cp.y) n = vec3(0.0, 1.0, 0.0);
  if (lattice && p.y < 0.0) n.y = -n.y;
  if (!lattice && p.y < 2.0 * cp.x - 1.0 + 1e-3 && cp.x > 0.0) n = vec3(0.0, -1.0, 0.0);
  return n;
}

float hitTerrain(vec3 ro, vec3 rd, float tmin, float tmax, vec4 tp, vec4 cp, bool lattice, int steps, out vec3 n) {
  n = vec3(0.0, 1.0, 0.0);
  float top = lattice ? cp.z : 2.0 * cp.z - 1.0;
  float bot = lattice ? -cp.z : 2.0 * cp.x - 1.0;
  vec3 bmin = vec3(-1.0, bot - 1e-3, -1.0);
  vec3 bmax = vec3(1.0, top + 1e-3, 1.0);
  vec2 iv = boxHit(ro, rd, bmin, bmax);
  float t0 = max(iv.x, tmin);
  float t1 = min(iv.y, tmax);
  if (t0 > t1) return INF;
  float L = max(tp.w, 0.05) * (lattice ? 0.5 : 1.0);
  float denom = abs(rd.y) + L * length(rd.xz);
  float texel = 2.0 / max(cp.w - 1.0, 1.0);
  float minStep = 0.3 * texel / max(length(rd), 1e-9);
  float t = t0;
  float f = terrainF(ro + rd * t, tp, cp, lattice);
  if (f <= 0.0) {
    if (iv.x >= tmin) {
      // Entered through a side or the base of the box: the wall of the solid.
      vec3 p = ro + rd * t;
      vec3 a = abs(p);
      if (a.x > 1.0 - 1e-3 && a.x >= a.z) n = vec3(sign(p.x), 0.0, 0.0);
      else if (a.z > 1.0 - 1e-3) n = vec3(0.0, 0.0, sign(p.z));
      else n = vec3(0.0, sign(p.y), 0.0);
      return t;
    }
    // Origin inside the solid (precision): step out before searching for a surface.
    for (int i = 0; i < 24; i++) {
      t += minStep * 2.0;
      if (t > t1) return INF;
      f = terrainF(ro + rd * t, tp, cp, lattice);
      if (f > 0.0) break;
    }
    if (f <= 0.0) return INF;
  }
  for (int i = 0; i < min(steps, 512); i++) {
    float tn = min(t + max(f / denom, minStep), t1);
    float fn = terrainF(ro + rd * tn, tp, cp, lattice);
    if (fn <= 0.0) {
      float a = t;
      float b = tn;
      for (int k = 0; k < 7; k++) {
        float mid = 0.5 * (a + b);
        if (terrainF(ro + rd * mid, tp, cp, lattice) <= 0.0) b = mid; else a = mid;
      }
      n = terrainNormal(ro + rd * b, tp, cp, lattice);
      return b;
    }
    if (tn >= t1) return INF;
    t = tn;
    f = fn;
  }
  return INF;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

struct Hit {
  float t;
  int obj;
  vec3 n;
  int part;
};

// Surface intersection with object row i (volumes are skipped). n is the world normal.
bool hitObject(int i, vec3 ro, vec3 rd, float tmax, bool shadow, out float t, out vec3 n, out int part) {
  t = INF;
  n = vec3(0.0, 1.0, 0.0);
  part = 0;
  vec4 hdr = objFetch(i, OBJ_HEADER);
  int type = int(hdr.x);
  int flags = int(hdr.z);
  if ((flags & FLAG_VOLUME) != 0) return false;
  if (shadow && (flags & FLAG_NO_SHADOW) != 0) return false;
  if (type == T_WATER || type == T_GROUND) {
    float y = objFetch(i, OBJ_P0).x;
    if (abs(rd.y) < 1e-12) return false;
    float tt = (y - ro.y) / rd.y;
    if (tt <= 0.0 || tt > tmax) return false;
    t = tt;
    return true;
  }
  vec4 bs = objFetch(i, OBJ_BOUNDS);
  vec3 oc = ro - bs.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - bs.w * bs.w;
  float disc = b * b - c;
  if (disc < 0.0) return false;
  float s = sqrt(disc);
  if (-b + s < 0.0 || -b - s > tmax) return false;

  vec4 r0 = objFetch(i, OBJ_INV0);
  vec4 r1 = objFetch(i, OBJ_INV1);
  vec4 r2 = objFetch(i, OBJ_INV2);
  vec3 o = vec3(dot(r0.xyz, ro) + r0.w, dot(r1.xyz, ro) + r1.w, dot(r2.xyz, ro) + r2.w);
  vec3 d = vec3(dot(r0.xyz, rd), dot(r1.xyz, rd), dot(r2.xyz, rd));
  vec3 no = vec3(0.0, 1.0, 0.0);
  float tt = INF;
  if (type == T_SPHERE || type == T_LIGHTBALL) tt = hitSphere(o, d, 0.0, tmax, no);
  else if (type == T_CUBE) tt = hitBox(o, d, 0.0, tmax, no);
  else if (type == T_CYLINDER) tt = hitCylinder(o, d, 0.0, tmax, no);
  else if (type == T_CONE) tt = hitCone(o, d, 0.0, tmax, no);
  else if (type == T_PYRAMID) tt = hitPyramid(o, d, 0.0, tmax, no);
  else if (type == T_DISC) tt = hitFlat(o, d, 0.0, tmax, true, no);
  else if (type == T_SQUARE) tt = hitFlat(o, d, 0.0, tmax, false, no);
  else if (type == T_TERRAIN || type == T_LATTICE) {
    int steps = shadow ? (Q_TERRAIN_STEPS * 2) / 3 : Q_TERRAIN_STEPS;
    tt = hitTerrain(o, d, 0.0, tmax, objFetch(i, OBJ_P0), objFetch(i, OBJ_P1), type == T_LATTICE, steps, no);
  } else if (type == T_TORUS || type == T_STONE || type == T_TREE) {
    tt = hitSDF(type, o, d, 0.0, tmax, objFetch(i, OBJ_P0), objFetch(i, OBJ_P1), Q_SDF_STEPS, no, part);
  }
  if (tt >= tmax) return false;
  t = tt;
  n = normalize(no.x * r0.xyz + no.y * r1.xyz + no.z * r2.xyz);
  return true;
}

// Closest surface hit (shadow = false), or the transmittance toward a light through
// transparent surfaces up to tmax (shadow = true; h.att, opaque hit = 0).
Hit sceneQuery(vec3 ro, vec3 rd, float tmax, bool shadow, out vec3 att) {
  Hit h;
  h.t = tmax;
  h.obj = -1;
  h.n = vec3(0.0, 1.0, 0.0);
  h.part = 0;
  att = vec3(1.0);
  for (int i = 0; i < min(uObjectCount, MAX_OBJECT_ROWS); i++) {
    float t;
    vec3 n;
    int part;
    if (!hitObject(i, ro, rd, h.t, shadow, t, n, part)) continue;
    if (shadow) {
      vec4 hdr = objFetch(i, OBJ_HEADER);
      if ((int(hdr.z) & FLAG_TRANSPARENT) == 0) {
        att = vec3(0.0);
        break;
      }
      vec4 tr = matFetch(int(hdr.y), MAT_TRANSPARENT);
      att *= mix(vec3(1.0), tr.rgb, 0.6) * tr.w;
      if (maxc(att) < 0.004) {
        att = vec3(0.0);
        break;
      }
    } else {
      h.t = t;
      h.obj = i;
      h.n = n;
      h.part = part;
    }
  }
  return h;
}
`;
