/** Shared GLSL: version/precision header, scene uniforms, data fetches, RNG and hashing. */
import { layoutDefines } from '../layout';
import { skyDefines } from '../skyParams';

export const FULLSCREEN_VERTEX = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const PRECISION = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp sampler2DArray;
`;

export function commonGLSL(): string {
  return /* glsl */ `
${layoutDefines()}
${skyDefines()}
#define PI 3.14159265
#define TAU 6.28318531
#define INF 1e20
#define STACK_SIZE 6
#define MAX_VOL 4
#define BUMP_K 0.35
#define LIGHT_K 2.0
#define LIGHT_R0 10.0

uniform sampler2D uObjects;
uniform sampler2D uMaterials;
uniform sampler2D uLights;
uniform sampler2DArray uTerrain;
uniform sampler3D uNoise;
uniform int uObjectCount;
uniform int uLightCount;
uniform vec4 uSky[SKY_SLOT_COUNT];
// [0] position, tan(fov/2)  [1] right, aspect  [2] up, radians per pixel  [3] forward
uniform vec4 uCam[4];
// [0] image width, height, mosaic block, sample index  [1] origin x, top row, jitter, seed
uniform vec4 uFrame[2];
// [0] max rays, max depth, soft shadows, blur  [1] volume steps, terrain steps, sdf steps, has volumes
uniform vec4 uQuality[2];

#define CAM_POS uCam[0].xyz
#define CAM_TAN uCam[0].w
#define CAM_RIGHT uCam[1].xyz
#define CAM_ASPECT uCam[1].w
#define CAM_UP uCam[2].xyz
#define PIXEL_ANGLE uCam[2].w
#define CAM_FWD uCam[3].xyz
#define Q_MAX_RAYS int(uQuality[0].x)
#define Q_MAX_DEPTH int(uQuality[0].y)
#define Q_SOFT (uQuality[0].z > 0.5)
#define Q_BLUR (uQuality[0].w > 0.5)
#define Q_VOL_STEPS int(uQuality[1].x)
#define Q_TERRAIN_STEPS int(uQuality[1].y)
#define Q_SDF_STEPS int(uQuality[1].z)
#define Q_HAS_VOLUMES (uQuality[1].w > 0.5)

vec4 objFetch(int i, int t) { return texelFetch(uObjects, ivec2(t, i), 0); }
vec4 matFetch(int m, int t) { return texelFetch(uMaterials, ivec2(t, m), 0); }
vec4 lightFetch(int l, int t) { return texelFetch(uLights, ivec2(t, l), 0); }

uint gSeed;
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rand() {
  gSeed = pcg(gSeed);
  return float(gSeed >> 8u) * (1.0 / 16777216.0);
}
vec2 rand2() { return vec2(rand(), rand()); }

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash33(vec3 p) {
  return vec3(pcg3d(uvec3(ivec3(floor(p)) + 65536))) * (1.0 / 4294967296.0);
}
float hash13(vec3 p) { return hash33(p).x; }

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float maxc(vec3 v) { return max(v.x, max(v.y, v.z)); }
float sq(float x) { return x * x; }

vec3 safeInv(vec3 d) {
  vec3 s = vec3(d.x >= 0.0 ? 1.0 : -1.0, d.y >= 0.0 ? 1.0 : -1.0, d.z >= 0.0 ? 1.0 : -1.0);
  return s / max(abs(d), vec3(1e-12));
}

// Slab test: (tNear, tFar) of a ray against an axis-aligned box.
vec2 boxHit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) {
  vec3 inv = safeInv(rd);
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tn = min(t0, t1);
  vec3 tf = max(t0, t1);
  return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}

// Uniform direction inside a cone around dir.
vec3 sampleCone(vec3 dir, float cosMax, vec2 u) {
  float cosT = mix(1.0, cosMax, u.x);
  float sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
  float phi = TAU * u.y;
  vec3 t = normalize(abs(dir.y) < 0.99 ? cross(dir, vec3(0.0, 1.0, 0.0)) : cross(dir, vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(dir, t);
  return normalize(t * (cos(phi) * sinT) + b * (sin(phi) * sinT) + dir * cosT);
}

vec3 randInSphere() {
  vec2 u = rand2();
  float z = u.x * 2.0 - 1.0;
  float r = sqrt(max(0.0, 1.0 - z * z));
  float phi = TAU * u.y;
  return vec3(r * cos(phi), z, r * sin(phi)) * pow(rand(), 0.3333);
}

// World <-> object helpers for object row i.
vec3 toObjectPoint(int i, vec3 p) {
  vec4 r0 = objFetch(i, OBJ_INV0);
  vec4 r1 = objFetch(i, OBJ_INV1);
  vec4 r2 = objFetch(i, OBJ_INV2);
  return vec3(dot(r0.xyz, p) + r0.w, dot(r1.xyz, p) + r1.w, dot(r2.xyz, p) + r2.w);
}
mat3 objectRotScale(int i) {
  vec4 r0 = objFetch(i, OBJ_INV0);
  vec4 r1 = objFetch(i, OBJ_INV1);
  vec4 r2 = objFetch(i, OBJ_INV2);
  return mat3(r0.x, r1.x, r2.x, r0.y, r1.y, r2.y, r0.z, r1.z, r2.z);
}
`;
}
