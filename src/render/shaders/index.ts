/** Assembles the GLSL ES 3.00 programs. */
import { commonGLSL, FULLSCREEN_VERTEX, PRECISION } from './common';
import { INTERSECT_GLSL } from './intersect';
import { LIGHTS_GLSL } from './lights';
import { MATERIAL_GLSL } from './material';
import { NOISE_GLSL } from './noise';
import { DISPLAY_FRAGMENT, SPLAT_FRAGMENT } from './post';
import { SKY_GLSL } from './sky';
import { TEXTURES_GLSL } from './textures';
import { TRACE_GLSL } from './trace';
import { VOLUME_GLSL } from './volume';

export { NOISE_SIZE } from './noise';

export interface ProgramSource {
  name: string;
  vertex: string;
  fragment: string;
}

/** salt != 0 makes the source unique (defeats driver shader caches when measuring cold compiles). */
export function traceFragment(salt = 0): string {
  const saltInt = Math.floor(salt * 1e6) >>> 0;
  const trace = salt ? TRACE_GLSL.replace('outColor = vec4(max(col, vec3(0.0)), 1.0);', `outColor = vec4(max(col, vec3(0.0)), 1.0 + float(gSeed == ${saltInt}u) * 1e-30);`) : TRACE_GLSL;
  return [PRECISION, commonGLSL(), NOISE_GLSL, TEXTURES_GLSL, MATERIAL_GLSL, INTERSECT_GLSL, VOLUME_GLSL, LIGHTS_GLSL, SKY_GLSL, trace].join('\n');
}

export function programSources(salt = 0): ProgramSource[] {
  return [
    { name: 'trace', vertex: FULLSCREEN_VERTEX, fragment: traceFragment(salt) },
    { name: 'splat', vertex: FULLSCREEN_VERTEX, fragment: SPLAT_FRAGMENT },
    { name: 'display', vertex: FULLSCREEN_VERTEX, fragment: DISPLAY_FRAGMENT },
  ];
}
