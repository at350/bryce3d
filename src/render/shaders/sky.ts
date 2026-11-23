/** The painterly Bryce sky: gradient, sun disc + glow, sunset band, moon, stars, clouds, rainbow, haze. */
export const SKY_GLSL = /* glsl */ `
// 2D value noise (3 channels) hashed at full float precision. The noise texture's hardware
// filter quantizes its weights, which shows as lattice seams under warps as large as cloudTear's.
vec3 hashNoise2(vec2 p, float z) {
  vec2 i = floor(p);
  vec2 f = p - i;
  f = f * f * (3.0 - 2.0 * f);
  vec3 a = hash33(vec3(i, z));
  vec3 b = hash33(vec3(i.x + 1.0, i.y, z));
  vec3 c = hash33(vec3(i.x, i.y + 1.0, z));
  vec3 d = hash33(vec3(i + 1.0, z));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Turbulence: a multi-scale domain warp that bends the pattern (large scale), shears it into
// broken lengths (middle scale) and frays its edges (small scale). Weights already hold the
// turbulence amount, so a zero weight leaves that scale alone. z: integer seed.
vec2 cloudTear(vec2 q, float z, vec2 big, vec2 mid, float small) {
  vec3 a = hashNoise2(q * 0.12, z) - 0.5;
  vec3 b = hashNoise2(q * 0.8 + a.zx, z + 1.0) - 0.5;
  vec4 c = noise3v(vec3(q * 3.1 + b.zy, z + 0.6)) - 0.5;
  return a.xy * big + b.xy * mid + c.xy * small;
}

// Large-scale density swing for a torn layer: some stretches run dense, others empty.
float cloudSwing(vec2 p, float z, float t) {
  return (smoothstep(0.25, 0.75, noise3(vec3(p, z))) - 0.6) * 0.8 * t;
}

// fbmRaw plus one more octave weighted by extra (extra = 0 is fbmRaw's pattern).
float cloudFbm(vec3 p, int oct, float rough, float extra) {
  float sum = 0.0;
  float amp = 1.0;
  float norm = 0.0;
  for (int i = 0; i <= oct; i++) {
    float a = i == oct ? amp * extra : amp;
    sum += a * noise3(p);
    norm += a;
    amp *= rough;
    p = OCT_ROT * p * 2.03 + vec3(1.7, 9.2, 3.1);
  }
  return sum / max(norm, 1e-4);
}

// One cloud layer. prm: cover 0..1 (0 = off), height, frequency, amplitude; col: rgb, w shading;
// sty: turbulence 0..1, glow 0..1. Both style terms are skipped at 0, so plain layers cost the same.
vec4 cloudLayer(vec3 ro, vec3 rd, vec4 prm, vec4 col, vec2 off, vec2 sty, bool cumulus, out float tHit) {
  tHit = INF;
  if (prm.x <= 0.0 || abs(rd.y) < 1e-4) return vec4(0.0);
  float t = (prm.y - ro.y) / rd.y;
  if (t <= 0.0) return vec4(0.0);
  tHit = t;
  vec3 P = ro + rd * t;
  float fade = smoothstep(0.0, 0.09, abs(rd.y)) * exp(-t / (prm.y * 28.0));
  if (fade < 0.002) return vec4(0.0);
  vec2 q = (P.xz + off) * (prm.z / 100.0 * 1.7 / max(prm.y, 10.0));
  float sharp = clamp(prm.w / 400.0, 0.0, 1.0);
  float thr = mix(0.93, 0.18, prm.x);
  float soft = mix(0.4, 0.06, sharp);
  // Ease-out, so a little turbulence already breaks the bands.
  float tb = sty.x * (2.0 - sty.x);
  float swing = 0.0;
  float n;
  if (cumulus) {
    if (tb > 0.0) {
      swing = cloudSwing(q * 0.12, 4.4, tb);
      q += cloudTear(q, 7.0, vec2(1.1 * tb), vec2(0.6 * tb), 0.22 * tb);
      n = stretch01(cloudFbm(vec3(q, 0.37), 6, 0.52, tb * 3.0), 2.3) + swing;
    } else {
      n = stretch01(fbmRaw(vec3(q, 0.37), 6, 0.52), 2.3);
    }
  } else {
    vec2 qs = vec2(q.x * 0.42, q.y * 1.35);
    vec3 w = noise3v(vec3(qs * 0.6, 7.7)).xyz - 0.5;
    qs += w.xy * 1.4;
    if (tb > 0.0) {
      // Streaks run along x: bend them across (big y), break them along (mid x), fray both ways.
      swing = cloudSwing(qs * vec2(0.1, 0.3), 6.6, tb);
      qs += cloudTear(qs, 3.0, vec2(1.5, 7.0) * tb, vec2(1.7, 0.8) * tb, 0.45 * tb);
      n = stretch01(cloudFbm(vec3(qs, 2.9), 5, 0.62, tb * 3.0), 2.1) + swing;
    } else {
      n = stretch01(fbmRaw(vec3(qs, 2.9), 5, 0.62), 2.1);
    }
  }
  float d = smoothstep(thr - soft * 0.35, thr + soft, n);
  if (d <= 0.0) return vec4(0.0);
  // Thin parts and edges pass the most sun glow (silver linings).
  float thin = 1.0 - 0.85 * d;
  vec3 c;
  if (cumulus) {
    vec2 sd = SKY_SUN_DIR.xz;
    sd = length(sd) > 1e-4 ? normalize(sd) : vec2(0.0);
    float n2 = stretch01(fbmRaw(vec3(q + sd * 0.08, 0.37), 4, 0.52), 2.3) + swing;
    float lit = clamp(0.7 + (n - n2) * 3.0, 0.2, 1.3);
    float thick = smoothstep(thr, min(thr + 0.45, 1.0), n);
    float shade = mix(1.0, 1.0 - col.w * 0.85, thick);
    c = col.rgb * (SKY_CLOUD_LIGHT.rgb * lit * shade + SKY_AMBIENT.rgb * 1.4 + SKY_ZENITH.rgb * 0.3);
  } else {
    c = col.rgb * (SKY_CLOUD_LIGHT.rgb * (1.05 - col.w * 0.35 * d) + SKY_ZENITH.rgb * 0.45 + SKY_DOME.rgb * 0.12);
    d *= 0.82;
  }
  if (sty.y > 0.0) {
    // Sun glow lighting: forward scattering around the sun in the sky's glow color, as smooth
    // lobes that fade with the angle to the sun (no rim, so no hard-edged halo), added to the
    // cloud's own light so dark cores keep their color while thin parts and edges glow.
    float cs = max(dot(rd, SKY_SUN_DIR.xyz), 0.0);
    float k = sty.y * (0.3 * pow(cs, 8.0) + 1.4 * pow(cs, 20.0) + 2.4 * pow(cs, 200.0));
    c += SKY_GLOW.rgb * (k * thin * 3.5);
  }
  float a = d * fade;
  return vec4(c * a, a);
}

vec4 skyClouds(vec3 ro, vec3 rd) {
  float ts;
  float tc;
  vec4 st = cloudLayer(ro, rd, SKY_STRATUS, SKY_STRATUS_COLOR, SKY_CLOUD_OFFSETS.xy, SKY_CLOUD_STYLE.xy, false, ts);
  vec4 cu = cloudLayer(ro, rd, SKY_CUMULUS, SKY_CUMULUS_COLOR, SKY_CLOUD_OFFSETS.zw, SKY_CLOUD_STYLE.zw, true, tc);
  vec4 nearL = tc <= ts ? cu : st;
  vec4 farL = tc <= ts ? st : cu;
  return vec4(nearL.rgb + farL.rgb * (1.0 - nearL.a), nearL.a + farL.a * (1.0 - nearL.a));
}

vec3 starField(vec3 rd) {
  vec3 p = rd * 230.0;
  vec3 cell = floor(p);
  vec3 f = p - cell;
  vec3 h = hash33(cell);
  if (h.x < 0.88) return vec3(0.0);
  vec3 pos = 0.25 + 0.5 * hash33(cell + 17.0);
  float d = length(f - pos);
  float b = pow(h.y, 4.0) * 3.0 + 0.15;
  vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.88, 0.72), h.z);
  return tint * b * smoothstep(0.32, 0.0, d);
}

vec3 moonDisc(vec3 rd, vec3 base) {
  vec3 md = SKY_MOON_DIR.xyz;
  float cm = dot(rd, md);
  float vis = SKY_MOON_DIR.w;
  base += SKY_MOON_COLOR.rgb * vis * (0.05 * pow(max(cm, 0.0), 400.0) + 0.012 * pow(max(cm, 0.0), 40.0));
  float cosR = SKY_MOON_LIGHT.w;
  if (cm < cosR - 1e-4) return base;
  float sinR = sqrt(max(1.0 - cosR * cosR, 1e-10));
  vec3 right = normalize(abs(md.y) < 0.99 ? cross(md, vec3(0.0, 1.0, 0.0)) : cross(md, vec3(0.0, 0.0, 1.0)));
  vec3 up = cross(right, md);
  vec2 uv = vec2(dot(rd, right), dot(rd, up)) / sinR;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) return base;
  vec3 n = vec3(uv, sqrt(1.0 - r2));
  float ph = SKY_MOON_COLOR.w * TAU;
  vec3 l = vec3(sin(ph), 0.0, -cos(ph));
  float lit = smoothstep(-0.05, 0.12, dot(n, l));
  float maria = 0.72 + 0.28 * fbm(vec3(uv * 2.2, 4.2), 4, 0.5);
  vec3 mc = SKY_MOON_COLOR.rgb * (lit * maria + 0.012);
  float edge = smoothstep(1.0, 0.94, r2) * vis;
  return mix(base, mc + base * 0.25, edge);
}

vec3 rainbowColor(vec3 rd) {
  vec3 anti = -SKY_SUN_DIR.xyz;
  float ang = degrees(acos(clamp(dot(rd, anti), -1.0, 1.0)));
  float x = (ang - 40.2) / 2.4;
  if (x < -0.4 || x > 1.4 || rd.y < -0.01) return vec3(0.0);
  float hue = (1.0 - clamp(x, 0.0, 1.0)) * 0.78;
  vec3 c = clamp(abs(fract(hue + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  float fade = smoothstep(-0.4, 0.05, x) * smoothstep(1.4, 0.95, x) * smoothstep(-0.01, 0.12, rd.y);
  return c * fade;
}

vec3 skyColor(vec3 ro, vec3 rd, int depth) {
  int mode = int(SKY_ZENITH.w);
  float y = rd.y;
  vec3 base;
  if (mode == 3) {
    base = SKY_ZENITH.rgb;
  } else {
    base = mix(SKY_HORIZON.rgb, SKY_ZENITH.rgb, pow(max(y, 0.0), SKY_HORIZON.w));
    if (y < 0.0) base = mix(SKY_HORIZON.rgb, SKY_BELOW.rgb, smoothstep(0.0, 0.25, -y));
    vec3 sd = SKY_SUN_DIR.xyz;
    if (SKY_SUNSET.w > 0.0) {
      float la = length(rd.xz);
      float lb = length(sd.xz);
      float az = (la > 1e-4 && lb > 1e-4) ? dot(rd.xz, sd.xz) / (la * lb) : 0.0;
      float band = exp(-abs(y) * 4.5) * pow(0.5 + 0.5 * az, 2.2);
      base = mix(base, SKY_SUNSET.rgb, clamp(band * SKY_SUNSET.w, 0.0, 1.0));
      base += vec3(0.5, 0.22, 0.55) * SKY_SUNSET.rgb * exp(-abs(y) * 3.0) * pow(0.5 - 0.5 * az, 2.0) * SKY_SUNSET.w * 0.3;
    }
    if (SKY_ATMO.w > 0.0 && y > 0.0) {
      float dark = 1.0 - smoothstep(0.015, 0.2, luma(base));
      base += starField(rd) * SKY_ATMO.w * dark * smoothstep(0.0, 0.08, y);
    }
    if (SKY_MOON_DIR.w > 0.0) base = moonDisc(rd, base);
    float g = max(dot(rd, sd), 0.0);
    base += SKY_GLOW.rgb * (1.6 * pow(g, 1200.0) + 0.42 * pow(g, 80.0) + 0.16 * pow(g, 8.0));
    float cs = dot(rd, sd);
    float disc = smoothstep(SKY_SUN_DISC.w - 3e-5, SKY_SUN_DISC.w + 3e-5, cs);
    base += SKY_SUN_DISC.rgb * disc;
    vec4 cl = skyClouds(ro, rd);
    base = base * (1.0 - cl.a) + cl.rgb;
    if (SKY_DOME.w > 0.0) base += rainbowColor(rd) * SKY_DOME.w;
  }
  float hb = SKY_ATMO.z;
  if (hb > 0.0) {
    float band = exp(-abs(y) * (6.0 / (0.2 + hb))) * (0.35 + hb * 0.65);
    base = mix(base, SKY_HAZE.rgb, clamp(band, 0.0, 0.94));
  }
  return base;
}
`;
