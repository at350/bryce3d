/**
 * The path loop: an explicit, bounded ray stack (no recursion) that splits each hit
 * deterministically into reflection and transmission children, so even the 1-sample
 * mosaic passes show full mirror and glass effects.
 */
export const TRACE_GLSL = /* glsl */ `
struct PathRay {
  vec3 o;
  vec3 d;
  vec3 w;
  int depth;
  int medium;
  float travel;
};

vec3 mediumAbsorption(int obj, float dist) {
  vec4 hdr = objFetch(obj, OBJ_HEADER);
  int m = int(hdr.y);
  if (m < 0) return vec3(1.0);
  vec3 vc = matFetch(m, MAT_VOLUME).rgb;
  return pow(max(vc, vec3(0.002)), vec3(dist / max(hdr.w, 1e-3) * 0.5));
}

void treeTrunk(int obj, inout Surface s, vec3 po) {
  vec3 c = objFetch(obj, OBJ_P2).rgb;
  float bark = fbm(vec3(po.x * 9.0, po.y * 2.5, po.z * 9.0) + objFetch(obj, OBJ_P0).xyz, 4, 0.55);
  s.diffuse = c * (0.65 + 0.6 * bark);
  s.diffusion = 0.85;
  s.ambience = 0.0;
  s.specularity = 0.05;
  s.reflection = 0.0;
  s.transparency = 0.0;
  s.metal = 0.0;
}

vec3 tracePath(vec3 ro, vec3 rd) {
  PathRay stack[STACK_SIZE];
  stack[0] = PathRay(ro, rd, vec3(1.0), 0, -1, 0.0);
  int sp = 1;
  vec3 total = vec3(0.0);
  int maxRays = min(Q_MAX_RAYS, 16);
  int maxDepth = Q_MAX_DEPTH;
  int lightCount = min(uLightCount, MAX_LIGHTS);
  float shadowK = SKY_AMBIENT.w;
  // The last shaded hit, whose lights are evaluated by the following iterations
  // (one shadow ray each) before the next path ray is popped.
  Surface cs;
  vec3 cP = vec3(0.0);
  vec3 cNg = vec3(0.0, 1.0, 0.0);
  vec3 cV = vec3(0.0, 0.0, 1.0);
  vec3 cW = vec3(0.0);
  float cSurf = 0.0;
  int light = 0;
  int lightEnd = 0;
  int paths = 0;
  int iterations = min(maxRays * (lightCount + 3), 300);
  for (int iter = 0; iter < iterations; iter++) {
    bool shadowIter = light < lightEnd;
    vec3 qo;
    vec3 qd;
    float qmax = INF;
    vec3 Lc = vec3(0.0);
    PathRay r;
    if (shadowIter) {
      vec3 L;
      float dist;
      bool casts;
      int l = light;
      light++;
      if (!lightSource(l, cP, L, Lc, dist, casts) || dot(cs.n, L) <= 0.0 || dot(cNg, L) <= 0.0) continue;
      if (!casts || shadowK <= 0.0) {
        total += cW * lightResponse(cs, Lc, L, cV, cSurf);
        continue;
      }
      qo = cP;
      qd = L;
      qmax = l < 0 ? INF : dist * 0.999;
    } else {
      if (sp <= 0 || paths >= maxRays) break;
      sp--;
      r = stack[sp];
      paths++;
      qo = r.o;
      qd = r.d;
    }

    // The single scene query and volume march of the whole shader.
    vec3 att;
    Hit h = sceneQuery(qo, qd, qmax, shadowIter, att);
    bool miss = h.obj < 0;
    float tEnd = shadowIter ? qmax : (miss ? INF : h.t);
    vec3 vt = vec3(1.0);
    vec3 vl = vec3(0.0);
    if (Q_HAS_VOLUMES && maxc(att) > 0.0) marchVolumes(qo, qd, min(tEnd, 1e6), shadowIter, shadowIter ? 8 : Q_VOL_STEPS, vt, vl);

    if (shadowIter) {
      vec3 vis = mix(vec3(1.0), att * vt, shadowK);
      total += cW * lightResponse(cs, Lc * vis, qd, cV, cSurf);
      continue;
    }

    if (r.medium >= 0 && !miss) r.w *= mediumAbsorption(r.medium, h.t);
    vec3 segT;
    vec3 segL;
    segmentAtmosphere(r.o, r.d, tEnd, r.depth, vt, vl, segT, segL);
    total += r.w * segL;
    if (miss) {
      total += r.w * segT * skyColor(r.o, r.d, r.depth);
      continue;
    }
    vec3 w = r.w * segT;
    if (maxc(w) < 0.002) continue;

    vec4 hdr = objFetch(h.obj, OBJ_HEADER);
    int type = int(hdr.x);
    int m = int(hdr.y);
    int flags = int(hdr.z);
    float size = hdr.w;
    vec3 p = r.o + r.d * h.t;
    if (type == T_LIGHTBALL) {
      total += w * objFetch(h.obj, OBJ_P0).rgb;
      continue;
    }
    vec3 ng = h.n;
    bool front = dot(r.d, ng) < 0.0;
    vec3 nf = front ? ng : -ng;
    vec3 po = toObjectPoint(h.obj, p);
    mat3 M3 = objectRotScale(h.obj);
    float footprint = (r.travel + h.t) * PIXEL_ANGLE;
    Surface s = evalMaterial(m, p, po, nf, M3, size, footprint);
    if (type == T_TREE && h.part == 1) {
      treeTrunk(h.obj, s, po);
      s.n = nf;
    }
    applyAltitude(m, s, po, p, nf);

    float eps = max(size * 3e-4, 2e-4) + maxc(abs(p)) * 3e-6;
    vec3 pOut = p + nf * eps;
    vec3 V = -r.d;

    float cosI = clamp(dot(V, s.n), 0.0, 1.0);
    float F = pow(1.0 - cosI, 5.0);
    float refl = s.reflection;
    if (refl > 0.0) refl += (1.0 - refl) * F * 0.65;
    float T = s.transparency;
    if (T > 0.0 && s.ior > 1.0005) {
      float f0 = sq((s.ior - 1.0) / (s.ior + 1.0));
      refl += (1.0 - refl) * (f0 + (1.0 - f0) * F) * T;
    }
    refl = clamp(refl, 0.0, 1.0);
    float wTrans = T * (1.0 - refl);
    float wSurf = (1.0 - T) * (1.0 - refl);

    total += w * (s.diffuse * s.diffusion * ambientFill(s.n) * wSurf + s.ambient * s.ambience);
    // Queue this hit's lights for the next iterations.
    cs = s;
    cP = pOut;
    cNg = nf;
    cV = V;
    cW = w;
    cSurf = wSurf;
    light = -2;
    lightEnd = lightCount;

    if (r.depth >= maxDepth) continue;
    // Transmission child.
    vec3 tW = w * wTrans * s.transColor;
    vec3 tDir = r.d;
    int tMedium = r.medium;
    if (maxc(tW) > 0.004) {
      bool thin = (flags & FLAG_FLAT) != 0;
      if (!thin && s.ior > 1.0005) {
        vec3 nr = dot(r.d, s.n) < 0.0 ? s.n : nf;
        float eta = front ? 1.0 / s.ior : s.ior;
        tDir = refract(r.d, nr, eta);
        if (dot(tDir, tDir) < 1e-6) {
          refl = clamp(refl + wTrans, 0.0, 1.0);
          tW = vec3(0.0);
        }
      }
      if (!thin) tMedium = front ? h.obj : -1;
      if (Q_BLUR && s.blur > 0.0 && maxc(tW) > 0.0) tDir = sampleCone(tDir, cos(s.blur * 0.35), rand2());
    } else {
      tW = vec3(0.0);
    }
    // Reflection child (metallicity tints it by the diffuse color).
    vec3 rW = w * refl * mix(vec3(1.0), s.diffuse * 1.25, s.metal);
    vec3 rDir = reflect(r.d, s.n);
    if (dot(rDir, nf) < 0.0) rDir = normalize(rDir - nf * dot(rDir, nf) * 1.02);
    if (Q_BLUR && s.blur > 0.0) {
      rDir = sampleCone(rDir, cos(s.blur * 0.35), rand2());
      if (dot(rDir, nf) < 0.0) rDir = reflect(rDir, nf);
    }
    float travel = r.travel + h.t;
    bool reflFirst = maxc(rW) >= maxc(tW);
    // Push the weaker child first so the stronger one is traced next.
    for (int c = 0; c < 2; c++) {
      bool isRefl = (c == 0) != reflFirst;
      vec3 cw = isRefl ? rW : tW;
      if (maxc(cw) <= 0.004 || sp >= STACK_SIZE) continue;
      PathRay child;
      child.o = isRefl ? pOut : p - nf * eps;
      child.d = isRefl ? rDir : normalize(tDir);
      child.w = cw;
      child.depth = r.depth + 1;
      child.medium = isRefl ? r.medium : tMedium;
      child.travel = travel;
      stack[sp] = child;
      sp++;
    }
  }
  return total;
}

layout(location = 0) out vec4 outColor;

// This pass's weight in the target's running average (1 = overwrite). It leaves as the source
// alpha, which the blend unit applies (see RayTracer.traceBand).
uniform float uWeight;
// Edge-only anti-aliasing: sample passes after the first trace only the pixels the edge mask
// marks; the others write weight 0, keeping the value they hold. Not a discard: a shader that
// may discard ran every pass ~15% slower on Metal, masked or not.
uniform sampler2D uMask;
uniform bool uMasked;

// Low-discrepancy (R2) subpixel offsets, rotated per pixel.
vec2 r2Jitter(float index) {
  return fract(vec2(0.7548776662, 0.5698402910) * index + 0.5);
}

void main() {
  ivec2 fc = ivec2(gl_FragCoord.xy);
  if (uMasked && texelFetch(uMask, fc, 0).r < 0.5) {
    outColor = vec4(0.0);
    return;
  }
  float block = uFrame[0].z;
  float sampleIndex = uFrame[0].w;
  gSeed = pcg(uint(fc.x) * 1973u + pcg(uint(fc.y) * 9277u + uint(uFrame[1].w)) + uint(sampleIndex) * 26699u);
  vec2 px;
  if (block > 1.0) {
    px = vec2(uFrame[1].x + (float(fc.x) + 0.5) * block, uFrame[1].y - (float(fc.y) + 0.5) * block);
  } else {
    vec2 j = vec2(0.5);
    if (uFrame[1].z > 0.5) j = fract(r2Jitter(sampleIndex) + vec2(hash13(vec3(vec2(fc), 7.0)), hash13(vec3(vec2(fc), 19.0))));
    px = vec2(fc) + j;
  }
  vec2 ndc = px / uFrame[0].xy * 2.0 - 1.0;
  vec3 dir = normalize(CAM_FWD + ndc.x * CAM_TAN * CAM_ASPECT * CAM_RIGHT + ndc.y * CAM_TAN * CAM_UP);
  vec3 col = tracePath(CAM_POS, dir);
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  float l = maxc(col);
  if (l > 24.0) col *= 24.0 / l;
  outColor = vec4(max(col, vec3(0.0)), uWeight);
}
`;
