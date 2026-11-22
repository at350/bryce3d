/** Participating media: volume-mode objects, cloud planes, height fog and distance haze. */
export const VOLUME_GLSL = /* glsl */ `
// Soft "inside" factor of a shape at object-space point po (1 deep inside, 0 outside).
float shapeDensity(int i, int type, vec3 po) {
  if (type == T_SPHERE) return smoothstep(1.0, 0.72, length(po));
  if (type == T_CUBE) return smoothstep(1.0, 0.86, maxc(abs(po)));
  if (type == T_CYLINDER) return smoothstep(1.0, 0.86, max(length(po.xz), abs(po.y)));
  if (type == T_CONE) {
    float r = (1.0 - po.y) * 0.5;
    return po.y < -1.0 || po.y > 1.0 ? 0.0 : smoothstep(r, r * 0.75 - 0.02, length(po.xz)) * smoothstep(-1.0, -0.9, po.y);
  }
  if (type == T_PYRAMID) {
    float r = (1.0 - po.y) * 0.5;
    return po.y < -1.0 ? 0.0 : smoothstep(r, r * 0.8 - 0.02, max(abs(po.x), abs(po.z))) * smoothstep(-1.0, -0.9, po.y);
  }
  vec4 p0 = objFetch(i, OBJ_P0);
  vec4 p1 = objFetch(i, OBJ_P1);
  if (type == T_TERRAIN || type == T_LATTICE) {
    if (max(abs(po.x), abs(po.z)) > 1.0) return 0.0;
    return smoothstep(0.0, -0.08, terrainF(po, p0, p1, type == T_LATTICE));
  }
  if (type == T_TORUS || type == T_STONE || type == T_TREE) {
    if (maxc(abs(po)) > 1.0) return 0.0;
    int part;
    return smoothstep(0.0, -0.12, sdfShape(type, po, p0, p1, part));
  }
  return 0.0;
}

// Density (per world unit) of volume object i at world point p, with albedo and emission.
float volumeDensityAt(int i, vec3 p, out vec3 albedo, out vec3 emit) {
  vec4 hdr = objFetch(i, OBJ_HEADER);
  int type = int(hdr.x);
  int m = int(hdr.y);
  float size = max(hdr.w, 1e-3);
  albedo = vec3(1.0);
  emit = vec3(0.0);
  vec3 po;
  float shape;
  if (type == T_CLOUD) {
    vec4 p0 = objFetch(i, OBJ_P0);
    float v = (p.y - p0.x) / p0.y;
    shape = clamp(1.0 - v * v, 0.0, 1.0);
    po = vec3(p.x / p0.y, v, p.z / p0.y);
  } else {
    po = toObjectPoint(i, p);
    shape = shapeDensity(i, type, po);
  }
  if (shape <= 0.0) return 0.0;
  vec4 vd = matFetch(m, MAT_VOLUME);
  vec4 dif = matFetch(m, MAT_DIFFUSE);
  vec4 amb = matFetch(m, MAT_AMBIENT);
  vec4 tr = matFetch(m, MAT_TRANSPARENT);
  vec4 dr0 = matFetch(m, MAT_DRV0);
  vec4 dr2 = matFetch(m, MAT_DRV2);
  float dens = vd.w * vd.w * 6.0 / size;
  // One texture evaluation drives both the density pattern and (if driven) the color.
  int k = int(dr2.x);
  int kc = int(dr0.x);
  int ke = k >= 0 ? k : kc;
  vec3 color = dif.rgb;
  if (ke >= 0) {
    float n = compValueAt(m, ke, compPoint(m, ke, p, po));
    if (k >= 0) dens *= smoothstep(0.42, 0.8, n) * max(tr.w, 0.05) * 1.8;
    if (kc >= 0) color = compColor(m, kc, n);
  }
  albedo = color * vd.rgb;
  emit = amb.rgb * amb.w * 1.5;
  return dens * shape;
}

int gatherVolumes(vec3 ro, vec3 rd, float tEnd, out int idx[MAX_VOL], out vec2 iv[MAX_VOL]) {
  int n = 0;
  for (int k = 0; k < MAX_VOL; k++) { idx[k] = -1; iv[k] = vec2(0.0); }
  for (int i = 0; i < min(uObjectCount, MAX_OBJECT_ROWS); i++) {
    if (n >= MAX_VOL) break;
    vec4 hdr = objFetch(i, OBJ_HEADER);
    if ((int(hdr.z) & FLAG_VOLUME) == 0) continue;
    vec2 span;
    if (int(hdr.x) == T_CLOUD) {
      vec4 p0 = objFetch(i, OBJ_P0);
      if (abs(rd.y) < 1e-6) {
        if (abs(ro.y - p0.x) > p0.y) continue;
        span = vec2(0.0, INF);
      } else {
        float ta = (p0.x - p0.y - ro.y) / rd.y;
        float tb = (p0.x + p0.y - ro.y) / rd.y;
        span = vec2(min(ta, tb), max(ta, tb));
      }
      // Grazing rays through an infinite slab: march a bounded stretch, haze hides the rest.
      span.y = min(span.y, max(span.x, 0.0) + p0.y * 60.0);
    } else {
      vec4 r0 = objFetch(i, OBJ_INV0);
      vec4 r1 = objFetch(i, OBJ_INV1);
      vec4 r2 = objFetch(i, OBJ_INV2);
      vec3 o = vec3(dot(r0.xyz, ro) + r0.w, dot(r1.xyz, ro) + r1.w, dot(r2.xyz, ro) + r2.w);
      vec3 d = vec3(dot(r0.xyz, rd), dot(r1.xyz, rd), dot(r2.xyz, rd));
      span = boxHit(o, d, vec3(-1.0), vec3(1.0));
    }
    span.x = max(span.x, 0.0);
    span.y = min(span.y, tEnd);
    if (span.x >= span.y) continue;
    idx[n] = i;
    iv[n] = span;
    n++;
  }
  return n;
}

float volumeDensitySum(int idx[MAX_VOL], vec2 iv[MAX_VOL], int n, float t, vec3 p, out vec3 albedo, out vec3 emit) {
  float sigma = 0.0;
  albedo = vec3(0.0);
  emit = vec3(0.0);
  for (int k = 0; k < MAX_VOL; k++) {
    if (k >= n) break;
    if (t < iv[k].x || t > iv[k].y) continue;
    vec3 a;
    vec3 e;
    float d = volumeDensityAt(idx[k], p, a, e);
    sigma += d;
    albedo += a * d;
    emit += e * d;
  }
  if (sigma > 1e-6) {
    albedo /= sigma;
    emit /= sigma;
  }
  return sigma;
}

// Ray-march the volumes along [0, tEnd]. light += in-scattered radiance, trans *= transmittance.
void marchVolumes(vec3 ro, vec3 rd, float tEnd, bool shadowOnly, int steps, inout vec3 trans, inout vec3 light) {
  int idx[MAX_VOL];
  vec2 iv[MAX_VOL];
  int n = gatherVolumes(ro, rd, tEnd, idx, iv);
  if (n == 0) return;
  float ta = INF;
  float tb = 0.0;
  for (int k = 0; k < MAX_VOL; k++) {
    if (k >= n) break;
    ta = min(ta, iv[k].x);
    tb = max(tb, iv[k].y);
  }
  float dt = (tb - ta) / float(max(steps, 1));
  float t = ta + dt * rand();
  vec3 sunL = SKY_SUN_DIR.xyz;
  float reach = 0.0;
  for (int k = 0; k < n; k++) reach = max(reach, objFetch(idx[k], OBJ_HEADER).w);
  reach *= 0.45;
  for (int s = 0; s < min(steps, 128); s++) {
    vec3 p = ro + rd * t;
    vec3 albedo = vec3(0.0);
    vec3 emit = vec3(0.0);
    float sigma = 0.0;
    float probe = 0.0;
    // Sample q = 0 is the density here; q = 1 probes toward the sun to approximate
    // self-shadowing (lit tops, dark bellies). One call site keeps the shader small.
    int probes = shadowOnly ? 1 : 2;
    for (int q = 0; q < probes; q++) {
      vec3 a;
      vec3 e;
      float d = volumeDensitySum(idx, iv, n, t, q == 0 ? p : p + sunL * reach, a, e);
      if (q == 0) { sigma = d; albedo = a; emit = e; } else probe = d;
      if (sigma <= 1e-6) break;
    }
    if (sigma > 1e-6) {
      float tr = exp(-sigma * dt);
      if (!shadowOnly) {
        float selfShadow = exp(-probe * reach * 1.4);
        float phase = 0.6 + 0.5 * pow(max(dot(rd, sunL), 0.0), 6.0);
        vec3 lit = SKY_SUN_LIGHT.rgb * selfShadow * phase * 0.85 + SKY_MOON_LIGHT.rgb * selfShadow * 0.6 + SKY_AMBIENT.rgb * 1.6 + SKY_ZENITH.rgb * 0.25;
        light += trans * (1.0 - tr) * (albedo * lit + emit);
      }
      trans *= tr;
      if (maxc(trans) < 0.01) break;
    }
    t += dt;
  }
}

// Optical depth of the height fog along [0, tEnd]: density 1 below the fog height,
// decaying exponentially above it.
float fogDepth(vec3 ro, vec3 rd, float tEnd) {
  float k = SKY_FOG.w;
  if (k <= 0.0) return 0.0;
  float H = SKY_ATMO.x;
  float w = SKY_ATMO.y;
  float T = min(tEnd, 1e7);
  if (abs(rd.y) < 1e-5) {
    float g = ro.y <= H ? 1.0 : exp(-(ro.y - H) / w);
    return k * g * T;
  }
  float tH = (H - ro.y) / rd.y;
  float below = 0.0;
  float aboveA = 0.0;
  float aboveB = 0.0;
  if (rd.y > 0.0) {
    if (ro.y < H) below = clamp(tH, 0.0, T);
    aboveA = max(tH, 0.0);
    aboveB = T;
  } else {
    if (ro.y > H) { aboveA = 0.0; aboveB = clamp(tH, 0.0, T); }
    below = max(T - max(tH, 0.0), 0.0);
  }
  float above = 0.0;
  if (aboveB > aboveA) {
    float ua = (ro.y + rd.y * aboveA - H) / w;
    float ub = (ro.y + rd.y * aboveB - H) / w;
    above = (w / rd.y) * (exp(-ua) - exp(-ub));
  }
  return k * (below + max(above, 0.0));
}

// Soft halos around visible lights along the segment.
vec3 lightGlows(vec3 ro, vec3 rd, float tEnd) {
  vec3 g = vec3(0.0);
  for (int l = 0; l < min(uLightCount, MAX_LIGHTS); l++) {
    vec4 ex = lightFetch(l, LIGHT_EXTRA);
    if (ex.x < 0.5) continue;
    vec3 lp = lightFetch(l, LIGHT_POS).yzw;
    vec3 c = lightFetch(l, LIGHT_COLOR).rgb;
    vec3 oc = lp - ro;
    float tc = dot(oc, rd);
    if (tc < 0.0 || tc > tEnd) continue;
    float d2 = max(dot(oc, oc) - tc * tc, 0.0);
    float r2 = ex.y * ex.y;
    g += c * 0.35 * r2 / (d2 + r2 * 0.25) * exp(-d2 / (r2 * 30.0));
  }
  return g;
}

// Haze, fog and light glows between the ray origin and tEnd, composited over the volume
// result (vt, vl) already marched along the same segment.
void segmentAtmosphere(vec3 ro, vec3 rd, float tEnd, int depth, vec3 vt, vec3 vl, out vec3 T, out vec3 L) {
  bool sky = tEnd >= INF * 0.5;
  float hz = sky ? 1.0 : exp(-tEnd * SKY_HAZE.w);
  float ff = exp(-fogDepth(ro, rd, tEnd));
  T = vt * hz * ff;
  L = (vl * hz + SKY_HAZE.rgb * (1.0 - hz)) * ff + SKY_FOG.rgb * (1.0 - ff);
  if (depth <= 1) L += lightGlows(ro, rd, tEnd) * ff;
}
`;
