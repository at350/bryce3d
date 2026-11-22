/** Small helper programs: mosaic splat (blocks -> full resolution) and the display/tonemap pass. */
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

export const DISPLAY_FRAGMENT = /* glsl */ `${PRECISION}
uniform sampler2D uAccum;
// exposure, dither seed, source y offset, 0
uniform vec4 uDisplay;
layout(location = 0) out vec4 outColor;

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

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 a = texelFetch(uAccum, p + ivec2(0, int(uDisplay.z)), 0);
  if (a.a < 0.5) {
    outColor = vec4(0.0);
    return;
  }
  vec3 c = clamp(tonemap(max(a.rgb, vec3(0.0)) * uDisplay.x), 0.0, 1.0);
  c = toSrgb(c);
  float n = fract(sin(dot(vec2(p) + uDisplay.y, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  outColor = vec4(clamp(c + n / 255.0, 0.0, 1.0), 1.0);
}
`;
