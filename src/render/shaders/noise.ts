/**
 * Noise GLSL. Value noise comes from a tiling 32^3 RGBA16F texture; sampling at
 * floor(p) + smoothstep(fract(p)) gives C1-continuous noise from one hardware trilinear
 * fetch (smooth enough for bump mapping, far cheaper than hashing 8 lattice corners).
 */
export const NOISE_SIZE = 32;

export const NOISE_GLSL = /* glsl */ `
float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return textureLod(uNoise, (i + f + 0.5) * (1.0 / ${NOISE_SIZE}.0), 0.0).r;
}
vec4 noise3v(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  return textureLod(uNoise, (i + f + 0.5) * (1.0 / ${NOISE_SIZE}.0), 0.0);
}

const mat3 OCT_ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

// Raw fractal sum, mean ~0.5 (narrow distribution).
float fbmRaw(vec3 p, int oct, float rough) {
  float sum = 0.0;
  float amp = 1.0;
  float norm = 0.0;
  int n = clamp(oct, 1, 10);
  for (int i = 0; i < n; i++) {
    sum += amp * noise3(p);
    norm += amp;
    amp *= rough;
    p = OCT_ROT * p * 2.03 + vec3(1.7, 9.2, 3.1);
  }
  return sum / max(norm, 1e-4);
}
float stretch01(float n, float k) { return clamp(0.5 + (n - 0.5) * k, 0.0, 1.0); }
float fbm(vec3 p, int oct, float rough) { return stretch01(fbmRaw(p, oct, rough), 2.2); }

float ridgedNoise(vec3 p, int oct, float rough) {
  float sum = 0.0;
  float amp = 1.0;
  float norm = 0.0;
  float w = 1.0;
  int n = clamp(oct, 1, 10);
  for (int i = 0; i < n; i++) {
    float n = 1.0 - abs(noise3(p) * 2.0 - 1.0);
    n *= n;
    sum += amp * n * w;
    norm += amp;
    w = clamp(n * 1.7, 0.3, 1.0);
    amp *= rough;
    p = OCT_ROT * p * 2.07 + vec3(4.1, 1.3, 7.7);
  }
  return clamp(sum / max(norm, 1e-4) * 1.35, 0.0, 1.0);
}

float turbulenceNoise(vec3 p, int oct, float rough) {
  float sum = 0.0;
  float amp = 1.0;
  float norm = 0.0;
  int n = clamp(oct, 1, 10);
  for (int i = 0; i < n; i++) {
    sum += amp * abs(noise3(p) * 2.0 - 1.0);
    norm += amp;
    amp *= rough;
    p = OCT_ROT * p * 2.01 + vec3(2.9, 5.3, 0.6);
  }
  return clamp(sum / max(norm, 1e-4) * 1.9, 0.0, 1.0);
}

// Worley cellular noise: (F1, F2) distances.
vec2 voronoi(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  float d1 = 8.0;
  float d2 = 8.0;
  // A flat loop over the 27 neighbor cells, bounded by data so it is not unrolled.
  int cells = 27 + int(min(f.x, 0.0));
  for (int c = 0; c < cells; c++) {
    vec3 g = vec3(float(c % 3 - 1), float((c / 3) % 3 - 1), float(c / 9 - 1));
    vec3 r = g + hash33(i + g) - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
`;
