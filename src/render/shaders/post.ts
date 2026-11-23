/**
 * Small helper programs: mosaic splat (blocks -> full resolution), the edge mask of edge-only
 * anti-aliasing, the rows of the soft pixel filter, and the display/tonemap pass (which runs the
 * filter's columns).
 */
import { MAX_FILTER_RADIUS } from '../quality';
import { PRECISION } from './common';

export const SPLAT_FRAGMENT = /* glsl */ `${PRECISION}
uniform sampler2D uScratch;
// origin x, top row (exclusive), block size
uniform vec4 uSplat;
layout(location = 0) out vec4 outColor;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int b = int(uSplat.z);
  int i = (p.x - int(uSplat.x)) / b;
  int j = (int(uSplat.y) - 1 - p.y) / b;
  outColor = texelFetch(uScratch, ivec2(i, j), 0);
}
`;

const TONE_GLSL = /* glsl */ `
// Linear below the knee, soft exponential shoulder above it, so the saturated 90s colors
// survive and only highlights (sun, glints) roll off; very hot values bleach to white.
vec3 tonemap(vec3 c) {
  const float knee = 0.62;
  vec3 over = max(c - knee, 0.0);
  vec3 comp = knee + (1.0 - knee) * (1.0 - exp(-over / (1.0 - knee)));
  vec3 res = mix(c, comp, step(vec3(knee), c));
  float hot = smoothstep(1.5, 8.0, max(c.r, max(c.g, c.b)));
  return mix(res, vec3(1.0), hot * 0.65);
}

vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

// The displayed color (before dithering) of a linear accumulated value.
vec3 shown(vec3 c, float exposure) {
  return toSrgb(clamp(tonemap(max(c, vec3(0.0)) * exposure), 0.0, 1.0));
}
`;

const KERNEL_GLSL = /* glsl */ `
#define FILTER_RADIUS ${MAX_FILTER_RADIUS}
// Gaussian weights for offsets 0..FILTER_RADIUS (normalized over both sides, see filterKernel()).
uniform float uKernel[FILTER_RADIUS + 1];
`;

// Marks (1) the pixels whose displayed color differs from one of their 8 neighbours by more than
// the threshold, compared on a 3x3 median of the displayed image so single-sample noise (rippled
// water, glossy reflections) does not mark itself while silhouettes, which a median keeps, do.
// A difference above the strong threshold in the unfiltered image also marks, so thin
// high-contrast features the median removes are still smoothed. Neighbours are clamped into the
// job's region: outside it lies an older image.
export const EDGE_FRAGMENT = /* glsl */ `${PRECISION}
uniform sampler2D uAccum;
// exposure, threshold (median image), strong threshold (unfiltered image), 0
uniform vec4 uEdge;
// first and last pixel of the region (inclusive)
uniform ivec4 uRegion;
layout(location = 0) out vec4 outColor;
${TONE_GLSL}
vec3 shownAt(ivec2 q) {
  return shown(texelFetch(uAccum, clamp(q, uRegion.xy, uRegion.zw), 0).rgb, uEdge.x);
}

float maxDiff(vec3 a, vec3 b) {
  vec3 e = abs(a - b);
  return max(e.r, max(e.g, e.b));
}

#define SORT2(a, b) { vec3 t = a; a = min(t, b); b = max(t, b); }
// Per-channel median of 9 (Devillard's 19-exchange network).
vec3 median9(vec3 p0, vec3 p1, vec3 p2, vec3 p3, vec3 p4, vec3 p5, vec3 p6, vec3 p7, vec3 p8) {
  SORT2(p1, p2) SORT2(p4, p5) SORT2(p7, p8) SORT2(p0, p1) SORT2(p3, p4) SORT2(p6, p7)
  SORT2(p1, p2) SORT2(p4, p5) SORT2(p7, p8) SORT2(p0, p3) SORT2(p5, p8) SORT2(p4, p7)
  SORT2(p3, p6) SORT2(p1, p4) SORT2(p2, p5) SORT2(p4, p7) SORT2(p4, p2) SORT2(p6, p4)
  SORT2(p4, p2)
  return p4;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  // The 5x5 block around p, row by row: the 3x3 medians of p and its 8 neighbours need all of it.
  vec3 v[25];
  for (int y = 0; y < 5; y++) {
    for (int x = 0; x < 5; x++) v[y * 5 + x] = shownAt(p + ivec2(x - 2, y - 2));
  }
  vec3 m[9];
  for (int y = 0; y < 3; y++) {
    for (int x = 0; x < 3; x++) {
      int o = y * 5 + x;
      m[y * 3 + x] = median9(v[o], v[o + 1], v[o + 2], v[o + 5], v[o + 6], v[o + 7], v[o + 10], v[o + 11], v[o + 12]);
    }
  }
  float d = 0.0;
  float raw = 0.0;
  for (int y = 0; y < 3; y++) {
    for (int x = 0; x < 3; x++) {
      d = max(d, maxDiff(m[y * 3 + x], m[4]));
      raw = max(raw, maxDiff(v[(y + 1) * 5 + x + 1], v[12]));
    }
  }
  outColor = vec4(d > uEdge.y || raw > uEdge.z ? 1.0 : 0.0, 0.0, 0.0, 1.0);
}
`;

// Rows of the soft pixel filter, in linear light. Colors are weighted by coverage (alpha 0 = not
// rendered yet) so the unrendered part of a progressive render does not darken its neighbours;
// the output keeps the weighted sums (rgb, coverage) for the columns in the display pass.
export const FILTER_FRAGMENT = /* glsl */ `${PRECISION}
uniform sampler2D uSource;
// taps used on each side
uniform int uRadius;
${KERNEL_GLSL}
layout(location = 0) out vec4 outColor;

vec4 covered(int x, int y) {
  vec4 a = texelFetch(uSource, ivec2(x, y), 0);
  return vec4(a.rgb * a.a, a.a);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int last = textureSize(uSource, 0).x - 1;
  vec4 s = covered(p.x, p.y) * uKernel[0];
  for (int i = 1; i <= FILTER_RADIUS; i++) {
    if (i > uRadius) break;
    s += (covered(max(p.x - i, 0), p.y) + covered(min(p.x + i, last), p.y)) * uKernel[i];
  }
  outColor = s;
}
`;

export const DISPLAY_FRAGMENT = /* glsl */ `${PRECISION}
uniform sampler2D uAccum;
// FILTER_FRAGMENT's rows of uAccum, read when the filter radius is > 0
uniform sampler2D uSoft;
// exposure, dither seed, source y offset, filter radius (0 = unfiltered)
uniform vec4 uDisplay;
${KERNEL_GLSL}
layout(location = 0) out vec4 outColor;
${TONE_GLSL}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 q = p + ivec2(0, int(uDisplay.z));
  vec4 a = texelFetch(uAccum, q, 0);
  if (a.a < 0.5) {
    outColor = vec4(0.0);
    return;
  }
  vec3 lin = a.rgb;
  int radius = int(uDisplay.w);
  if (radius > 0) {
    // Columns of the soft pixel filter, then back from coverage-weighted sums to colors.
    int last = textureSize(uSoft, 0).y - 1;
    vec4 s = texelFetch(uSoft, q, 0) * uKernel[0];
    for (int i = 1; i <= FILTER_RADIUS; i++) {
      if (i > radius) break;
      s += (texelFetch(uSoft, ivec2(q.x, max(q.y - i, 0)), 0) + texelFetch(uSoft, ivec2(q.x, min(q.y + i, last)), 0)) * uKernel[i];
    }
    lin = s.rgb / max(s.a, 1e-6);
  }
  vec3 c = shown(lin, uDisplay.x);
  float n = fract(sin(dot(vec2(p) + uDisplay.y, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  outColor = vec4(clamp(c + n / 255.0, 0.0, 1.0), 1.0);
}
`;
