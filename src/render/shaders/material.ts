/** Bryce Material Lab channels -> a shading record (drivers, bump, altitude blend). */
export const MATERIAL_GLSL = /* glsl */ `
struct Surface {
  vec3 diffuse; float diffusion;
  vec3 ambient; float ambience;
  vec3 specular; float specularity;
  vec3 halo; float tight;
  vec3 transColor; float transparency;
  vec3 volume; float metal;
  float reflection; float ior; float blur;
  vec3 n;
};

Surface evalMaterial(int m, vec3 pw, vec3 po, vec3 n, mat3 M3, float objSize, float footprint) {
  Surface s;
  vec4 d0 = matFetch(m, MAT_DIFFUSE);
  vec4 d1 = matFetch(m, MAT_AMBIENT);
  vec4 d2 = matFetch(m, MAT_SPECULAR);
  vec4 d3 = matFetch(m, MAT_HALO);
  vec4 d4 = matFetch(m, MAT_TRANSPARENT);
  vec4 d5 = matFetch(m, MAT_VOLUME);
  vec4 misc = matFetch(m, MAT_MISC);
  vec4 misc2 = matFetch(m, MAT_MISC2);
  s.diffuse = d0.rgb; s.diffusion = d0.w;
  s.ambient = d1.rgb; s.ambience = d1.w;
  s.specular = d2.rgb; s.specularity = d2.w;
  s.halo = d3.rgb; s.tight = d3.w;
  s.transColor = d4.rgb; s.transparency = d4.w;
  s.volume = d5.rgb;
  s.metal = misc.x; s.reflection = misc.z; s.ior = misc.w; s.blur = misc2.x;
  s.n = n;

  int count = int(misc2.z);
  int used = int(misc2.w);
  float nv[3];
  vec3 nc[3];
  vec3 tp[3];
  nv[0] = 0.5; nv[1] = 0.5; nv[2] = 0.5;
  nc[0] = vec3(0.5); nc[1] = vec3(0.5); nc[2] = vec3(0.5);
  tp[0] = vec3(0.0); tp[1] = vec3(0.0); tp[2] = vec3(0.0);
  for (int c = 0; c < min(count, 3); c++) {
    if ((used & (1 << c)) == 0) continue;
    tp[c] = compPoint(m, c, pw, po);
    nv[c] = compValueAt(m, c, tp[c]);
    nc[c] = compColor(m, c, nv[c]);
  }
  vec4 dr0 = matFetch(m, MAT_DRV0);
  vec4 dr1 = matFetch(m, MAT_DRV1);
  vec4 dr2 = matFetch(m, MAT_DRV2);
  int k;
  k = int(dr0.x); if (k >= 0) s.diffuse = nc[k];
  k = int(dr0.y); if (k >= 0) s.ambient = nc[k];
  k = int(dr0.z); if (k >= 0) s.specular = nc[k];
  k = int(dr0.w); if (k >= 0) s.transColor = nc[k];
  k = int(dr1.x); if (k >= 0) s.diffusion *= nv[k];
  k = int(dr1.y); if (k >= 0) s.ambience *= nv[k];
  k = int(dr1.z); if (k >= 0) s.specularity *= nv[k];
  k = int(dr1.w); if (k >= 0) s.reflection *= nv[k];
  k = int(dr2.x); if (k >= 0) s.transparency *= nv[k];

  // Bump: finite differences of the driving component in texture space, pulled back to
  // world directions. The step follows the pixel footprint so distant bumps filter out.
  k = int(dr2.y);
  if (k >= 0 && misc.y != 0.0) {
    int b = compBase(k);
    vec4 t0 = matFetch(m, b);
    vec4 t2 = matFetch(m, b + 2);
    int mapping = int(t0.y);
    bool worldMapped = mapping == MAP_WORLD || mapping == MAP_WORLDTOP;
    float texPerWorld = t0.z / (worldMapped ? 1.0 : max(objSize, 1e-4));
    float h = max(0.002, footprint * texPerWorld * 0.75);
    float fade = clamp(1.6 - h * 5.0, 0.0, 1.0);
    float amount = misc.y * t2.w * fade * BUMP_K;
    if (abs(amount) > 1e-4) {
      vec3 p = tp[k];
      float n0 = nv[k];
      bool flat2 = mapping == MAP_WORLDTOP || mapping == MAP_OBJECTTOP;
      vec3 g = vec3(0.0);
      // One call site in a loop with a data-dependent bound keeps the shader small.
      int axes = flat2 ? 2 : 3;
      for (int a = 0; a < axes; a++) {
        int axis = flat2 && a == 1 ? 2 : a;
        vec3 e = axis == 0 ? vec3(h, 0.0, 0.0) : axis == 1 ? vec3(0.0, h, 0.0) : vec3(0.0, 0.0, h);
        float d = compValueAt(m, k, p + e) - n0;
        if (axis == 0) g.x = d; else if (axis == 1) g.y = d; else g.z = d;
      }
      g /= h;
      vec3 gw;
      if (mapping == MAP_WORLD || mapping == MAP_WORLDTOP) gw = g;
      else if (mapping == MAP_SPHERICAL) {
        vec3 u = normalize(po + vec3(1e-6));
        gw = transpose(M3) * (g - u * dot(g, u)) * objSize / max(length(po), 1e-3);
      } else gw = transpose(M3) * g * objSize;
      vec3 gt = gw - n * dot(gw, n);
      s.n = normalize(n - amount * gt);
    }
  }
  return s;
}

// Altitude / slope blend (snow caps): object-space height mapped to 0..1, geometric slope.
void applyAltitude(int m, inout Surface s, vec3 po, vec3 pw, vec3 ng) {
  vec4 a1 = matFetch(m, MAT_ALT1);
  if (a1.z < 0.5) return;
  vec4 a0 = matFetch(m, MAT_ALT0);
  float h01 = clamp(po.y * 0.5 + 0.5, 0.0, 1.0);
  float jitter = (noise3(pw * 0.23 + 5.3) - 0.5) * 0.16 + (noise3(pw * 1.7 + 1.1) - 0.5) * 0.07;
  float a = smoothstep(a0.w, a0.w + a1.x, h01 + jitter);
  float slope = 1.0 - clamp(ng.y, 0.0, 1.0);
  a *= 1.0 - smoothstep(a1.y, a1.y + 0.12, slope + jitter * 0.5);
  s.diffuse = mix(s.diffuse, a0.rgb, a);
  s.diffusion = mix(s.diffusion, max(s.diffusion, 0.85), a);
  s.specularity = mix(s.specularity, 0.15, a);
  s.reflection *= 1.0 - a;
}
`;
