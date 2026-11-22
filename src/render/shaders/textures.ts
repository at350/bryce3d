/** Procedural 3D texture patterns and Material Lab texture components (A/B/C). */
export const TEXTURES_GLSL = /* glsl */ `
float wavesPattern(vec3 p, int oct, float rough) {
  vec2 q = p.xz + p.y * vec2(0.71, -0.43);
  float sum = 0.0;
  float amp = 1.0;
  float norm = 0.0;
  float ang = 0.4;
  int n = clamp(oct, 1, 10);
  for (int i = 0; i < n; i++) {
    vec2 dir = vec2(cos(ang), sin(ang));
    float ph = dot(q, dir) * 2.6 + (noise3(vec3(q * 0.33, float(i) * 3.7)) - 0.5) * 7.0;
    float w = 0.5 + 0.5 * sin(ph);
    sum += amp * w * w * (3.0 - 2.0 * w);
    norm += amp;
    amp *= max(rough, 0.2);
    q = mat2(0.8, -0.6, 0.6, 0.8) * q * 1.83 + vec2(3.7, 1.9);
    ang += 2.1;
  }
  return sum / max(norm, 1e-4);
}

float strataPattern(vec3 p, int oct, float rough) {
  float y = p.y * 2.0 + (fbmRaw(p * 0.45, 3, 0.5) - 0.5) * 2.6;
  float v = 0.0;
  float amp = 1.0;
  float norm = 0.0;
  int bands = clamp(oct / 2, 1, 4);
  for (int i = 0; i < bands; i++) {
    float band = floor(y);
    float f = y - band;
    float a = hash13(vec3(band, 3.7 + float(i), 1.3));
    float b = hash13(vec3(band + 1.0, 3.7 + float(i), 1.3));
    v += amp * mix(a, b, smoothstep(0.8, 1.0, f));
    norm += amp;
    amp *= max(rough, 0.25);
    y = y * 2.7 + 0.37;
  }
  float fine = 0.5 + 0.5 * sin(p.y * 22.0 + noise3(p * 3.0) * 3.0);
  return clamp(v / max(norm, 1e-4) * 0.85 + fine * 0.15, 0.0, 1.0);
}

float granitePattern(vec3 p, int oct, float rough) {
  float n = fbm(p * 2.5, oct, max(rough, 0.6));
  float g = noise3(p * 19.0 + 3.1);
  return clamp(n * 0.75 + smoothstep(0.62, 0.74, g) * 0.35 - smoothstep(0.32, 0.2, g) * 0.2, 0.0, 1.0);
}

float pattern(int type, vec3 p, int oct, float rough) {
  if (type == TEX_FBM) return fbm(p, oct, rough);
  if (type == TEX_RIDGED) return ridgedNoise(p, oct, rough);
  if (type == TEX_TURBULENCE) return turbulenceNoise(p, oct, rough);
  if (type == TEX_VORONOI) {
    float f = voronoi(p).x;
    if (oct > 2) f = mix(f, voronoi(p * 2.31 + 7.1).x, 0.35 * rough);
    return clamp(f * 1.15, 0.0, 1.0);
  }
  if (type == TEX_MARBLE) {
    float t = turbulenceNoise(p * 0.6, oct, rough);
    return 0.5 + 0.5 * sin((p.x * 0.9 + p.y * 0.35 + p.z * 0.2) * 3.2 + t * 7.0);
  }
  if (type == TEX_STRATA) return strataPattern(p, oct, rough);
  if (type == TEX_SPOTS) return smoothstep(0.5, 0.58, fbmRaw(p, oct, rough));
  if (type == TEX_GRANITE) return granitePattern(p, oct, rough);
  if (type == TEX_WAVES) return wavesPattern(p, oct, rough);
  if (type == TEX_CHECKER) {
    vec3 c = floor(p + vec3(0.0013, 0.0137, 0.0071));
    return mod(c.x + c.y + c.z, 2.0);
  }
  if (type == TEX_GRID) {
    vec3 f = abs(fract(p + 0.25) - 0.5);
    float d = min(f.x, min(f.y, f.z));
    return 1.0 - smoothstep(0.03, 0.06, d);
  }
  return 0.5;
}

vec3 texMap(int mapping, vec3 pw, vec3 po) {
  if (mapping == MAP_OBJECT) return po;
  if (mapping == MAP_WORLDTOP) return vec3(pw.x, 0.0, pw.z);
  if (mapping == MAP_OBJECTTOP) return vec3(po.x, 0.0, po.z);
  if (mapping == MAP_SPHERICAL) {
    float l = length(po);
    return l > 1e-5 ? po / l : vec3(0.0, 1.0, 0.0);
  }
  return pw;
}

int compBase(int c) { return MAT_COMP0 + c * COMP_TEXELS; }

// Point in the component's texture space (mapped, scaled, seed-offset).
vec3 compPoint(int m, int c, vec3 pw, vec3 po) {
  int b = compBase(c);
  vec4 t0 = matFetch(m, b);
  vec4 t2 = matFetch(m, b + 2);
  return texMap(int(t0.y), pw, po) * t0.z + t2.xyz;
}

// Scalar output n(p) in 0..1 after warp, contrast and bias.
float compValueAt(int m, int c, vec3 p) {
  int b = compBase(c);
  vec4 t0 = matFetch(m, b);
  vec4 t1 = matFetch(m, b + 1);
  if (t1.y > 0.0) {
    vec3 w = noise3v(p * 0.5 + 11.3).xyz - 0.5;
    w += (noise3v(p * 1.13 + 4.1).xyz - 0.5) * 0.35;
    p += w * (t1.y * 3.0);
  }
  float n = pattern(int(t0.x), p, int(t0.w), t1.x);
  return clamp((n - 0.5) * t1.z + 0.5 + t1.w * 0.5, 0.0, 1.0);
}

vec3 compColor(int m, int c, float n) {
  int b = compBase(c) + 3;
  vec4 s0 = matFetch(m, b);
  vec4 s1 = matFetch(m, b + 1);
  vec4 s2 = matFetch(m, b + 2);
  vec4 s3 = matFetch(m, b + 3);
  if (n <= s0.x) return s0.yzw;
  if (n <= s1.x) return mix(s0.yzw, s1.yzw, clamp((n - s0.x) / max(s1.x - s0.x, 1e-5), 0.0, 1.0));
  if (n <= s2.x) return mix(s1.yzw, s2.yzw, clamp((n - s1.x) / max(s2.x - s1.x, 1e-5), 0.0, 1.0));
  if (n <= s3.x) return mix(s2.yzw, s3.yzw, clamp((n - s2.x) / max(s3.x - s2.x, 1e-5), 0.0, 1.0));
  return s3.yzw;
}
`;
