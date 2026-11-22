/**
 * Light sources and the shading response to one light. Shadow rays are traced by the path
 * loop itself (trace.ts) so the large scene-intersection code is inlined only once.
 */
export const LIGHTS_GLSL = /* glsl */ `
// Diffuse (weighted by wSurf) + specular response to light Lc arriving from L.
vec3 lightResponse(Surface s, vec3 Lc, vec3 L, vec3 V, float wSurf) {
  float ndl = dot(s.n, L);
  if (ndl <= 0.0) return vec3(0.0);
  vec3 c = s.diffuse * s.diffusion * wSurf * Lc * ndl;
  if (s.specularity > 0.0) {
    vec3 R = reflect(-L, s.n);
    float rv = max(dot(R, V), 0.0);
    float e = mix(6.0, 1600.0, s.tight * s.tight);
    vec3 core = mix(s.specular, s.specular * s.diffuse * 1.6, s.metal);
    c += Lc * s.specularity * (core * pow(rv, e) + s.halo * 0.3 * pow(rv, e * 0.12));
  }
  return c;
}

// Light source l at point p: -2 = sun, -1 = moon, 0.. = scene lights. False = no light.
bool lightSource(int l, vec3 p, out vec3 L, out vec3 Lc, out float dist, out bool casts) {
  L = vec3(0.0, 1.0, 0.0);
  Lc = vec3(0.0);
  dist = INF;
  casts = true;
  if (l == -2) {
    if (SKY_SUN_DIR.w <= 0.0) return false;
    L = SKY_SUN_DIR.xyz;
    if (Q_SOFT) L = sampleCone(L, SKY_SUN_LIGHT.w, rand2());
    Lc = SKY_SUN_LIGHT.rgb;
    return true;
  }
  if (l == -1) {
    if (SKY_MOON_DIR.w <= 0.0 || maxc(SKY_MOON_LIGHT.rgb) <= 0.0) return false;
    L = SKY_MOON_DIR.xyz;
    if (Q_SOFT) L = sampleCone(L, 0.9995, rand2());
    Lc = SKY_MOON_LIGHT.rgb;
    return true;
  }
  vec4 lp = lightFetch(l, LIGHT_POS);
  vec4 ld = lightFetch(l, LIGHT_DIR);
  vec4 lc = lightFetch(l, LIGHT_COLOR);
  vec4 la = lightFetch(l, LIGHT_AXIS);
  vec4 lm = lightFetch(l, LIGHT_MISC);
  int type = int(lp.x);
  float atten = 1.0;
  casts = lm.y > 0.5;
  if (type == LT_PARALLELLIGHT) {
    L = -ld.xyz;
    vec3 rel = p - lp.yzw;
    float along = dot(rel, ld.xyz);
    vec3 perp = rel - ld.xyz * along;
    float beam = lm.w;
    atten = along > 0.0 ? 1.0 - smoothstep(beam * (1.0 - max(lm.x, 0.04)), beam, length(perp)) : 0.0;
    dist = max(along, 0.0);
  } else {
    vec3 lpos = lp.yzw;
    if (Q_SOFT && lm.z > 0.0) lpos += randInSphere() * lm.z;
    vec3 dv = lpos - p;
    dist = max(length(dv), 1e-4);
    L = dv / dist;
    int fo = int(lc.w);
    if (fo == 1) atten = min(LIGHT_R0 / dist, 4.0);
    else if (fo == 2) atten = min(LIGHT_R0 * LIGHT_R0 / (dist * dist), 16.0);
    if (type == LT_SPOTLIGHT) {
      float cosOuter = ld.w;
      float cosInner = cos(acos(clamp(cosOuter, -1.0, 1.0)) * (1.0 - clamp(lm.x, 0.02, 0.98)));
      atten *= smoothstep(cosOuter, max(cosInner, cosOuter + 1e-4), dot(-L, ld.xyz));
    } else if (type == LT_SQUARESPOTLIGHT) {
      vec3 v = -L;
      float fwd = dot(v, ld.xyz);
      if (fwd <= 0.0) atten = 0.0;
      else {
        vec3 az = cross(ld.xyz, la.xyz);
        float mx = max(abs(dot(v, la.xyz)), abs(dot(v, az))) / fwd;
        atten *= 1.0 - smoothstep(la.w * (1.0 - clamp(lm.x, 0.02, 0.98)), la.w, mx);
      }
    }
  }
  Lc = lc.rgb * atten * LIGHT_K;
  return atten > 1e-4;
}

vec3 ambientFill(vec3 n) {
  return SKY_AMBIENT.rgb * (0.78 + 0.22 * n.y);
}
`;
