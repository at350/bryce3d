/** GPU terrain intersection regression. Start Vite, then run:
 * node scripts/terrain-regression.mjs http://localhost:5301/
 * Checks full-coverage rays and exact intersections on small analytic heightfields.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2] ?? 'http://localhost:5301/');
  const { coverage, analytic } = await page.evaluate(async () => {
    const { INTERSECT_GLSL } = await import('/src/render/shaders/intersect.ts');
    const { commonGLSL, FULLSCREEN_VERTEX, PRECISION } = await import('/src/render/shaders/common.ts');
    const { generateHeights } = await import('/src/terrain/index.ts');
    const { prepareTerrain } = await import('/src/render/terrainData.ts');
    const terrainSource = INTERSECT_GLSL.slice(INTERSECT_GLSL.indexOf('float terrainH('), INTERSECT_GLSL.indexOf('struct Hit {'));
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('Float WebGL2 targets unavailable');
    const terrainFormat = gl.R32F;
    const shader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, FULLSCREEN_VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `${PRECISION}\n${commonGLSL()}\n${terrainSource}
      uniform sampler2D uOrigins;
      uniform sampler2D uDirections;
      uniform vec4 uTerrainParams;
      uniform vec4 uClipParams;
      uniform bool uLattice;
      out vec4 result;
      void main() {
        ivec2 p = ivec2(gl_FragCoord.xy);
        vec3 ro = texelFetch(uOrigins, p, 0).xyz;
        vec3 rd = texelFetch(uDirections, p, 0).xyz;
        vec3 n;
        float t = hitTerrain(ro, rd, 0.00001, INF, uTerrainParams, uClipParams, uLattice, n);
        result = vec4(t < INF ? t : -1.0, n);
      }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    const width = 64, height = 64;
    canvas.width = width; canvas.height = height;
    const texture = (unit, data) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return tex;
    };
    const origins = new Float32Array(width * height * 4);
    const directions = new Float32Array(origins.length);
    const originTexture = texture(1, origins);
    const directionTexture = texture(2, directions);
    gl.uniform1i(gl.getUniformLocation(program, 'uOrigins'), 1);
    gl.uniform1i(gl.getUniformLocation(program, 'uDirections'), 2);
    gl.uniform1i(gl.getUniformLocation(program, 'uTerrain'), 0);
    const target = texture(3, null);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    gl.viewport(0, 0, width, height);
    gl.bindVertexArray(gl.createVertexArray());
    gl.activeTexture(gl.TEXTURE0);
    const terrain = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, terrain);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const setTerrain = (n, data, { low = 0, high = 1, lattice = false } = {}) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, terrain);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, terrainFormat, n, n, 1, 0, gl.RED, gl.FLOAT, data);
      gl.uniform4f(gl.getUniformLocation(program, 'uTerrainParams'), 0, (n - 1) / n, 0.5 / n, 0);
      let maxHeight = 0;
      for (const h of data) maxHeight = Math.max(maxHeight, h);
      gl.uniform4f(gl.getUniformLocation(program, 'uClipParams'), low, high, Math.min(maxHeight, high), n);
      gl.uniform1i(gl.getUniformLocation(program, 'uLattice'), lattice ? 1 : 0);
    };
    const render = (cases) => {
      origins.fill(0); directions.fill(0);
      for (let i = 0; i < cases.length; i++) {
        origins.set([...cases[i].ro, 0], 4 * i);
        directions.set([...cases[i].rd, 0], 4 * i);
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, originTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, origins);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, directionTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, directions);
      gl.activeTexture(gl.TEXTURE0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const pixels = new Float32Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);
      return cases.map((test, i) => ({ name: test.name, t: pixels[i * 4], n: [...pixels.slice(i * 4 + 1, i * 4 + 4)] }));
    };
    const coverage = [];
    for (const n of [64, 256, 512]) {
      for (const kind of ['mosaic', 'cliff']) {
        const heights = kind === 'mosaic' ? generateHeights('mosaic', 1994, n) : Float32Array.from({ length: n * n }, (_, i) => i % n < n / 2 ? 0.02 : 0.98);
        const prepared = prepareTerrain({ resolution: n, heights });
        setTerrain(n, prepared.data);
        gl.uniform4f(gl.getUniformLocation(program, 'uClipParams'), 0, 1, prepared.maxHeight, n);
        const rayCases = Array.from({ length: width * height }, (_, i) => {
          const x = i % width, z = Math.floor(i / width);
          const d = [((x + 0.5) / width * 2 - 1) * 0.9, -1.8, ((z + 0.5) / height * 2 - 1) * 0.9 - 3];
          const len = Math.hypot(...d);
          return { ro: [0, 0.8, 3], rd: d.map(v => v / len) };
        });
        const pixels = render(rayCases);
        const misses = pixels.filter(p => p.t < 0 || !Number.isFinite(p.t)).length;
        coverage.push({ kind, n, rays: rayCases.length, misses });
      }
    }

    const flat = new Float32Array(16 * 16).fill(0.5);
    const planar = Float32Array.from({ length: 16 * 16 }, (_, i) => 0.5 + 0.1 * ((i % 16) * 2 / 15 - 1));
    const bilinear = Float32Array.from({ length: 16 * 16 }, (_, i) => {
      const x = (i % 16) * 2 / 15 - 1;
      const z = Math.floor(i / 16) * 2 / 15 - 1;
      return 0.5 + 0.2 * x * z;
    });
    const ramp = Float32Array.from({ length: 16 * 16 }, (_, i) => 0.35 + 0.25 * ((i % 16) * 2 / 15 - 1));
    const analytic = [];
    const check = (cases, expected) => {
      const pixels = render(cases);
      for (let i = 0; i < cases.length; i++) analytic.push({ ...pixels[i], expected: expected[i] });
    };
    setTerrain(16, flat);
    check([
      { name: 'flat vertical top', ro: [0, 1, 0], rd: [0, -1, 0] },
      { name: 'flat vertical underside', ro: [0, -2, 0], rd: [0, 1, 0] },
      { name: 'x-parallel side entry', ro: [-2, -0.5, 0], rd: [1, 0, 0] },
      { name: 'interior origin exits top', ro: [0, -0.5, 0], rd: [0, 1, 0] },
      { name: 'outside true miss', ro: [0, 0.5, 3], rd: [0, 0, -1] },
    ], [
      { t: 1, n: [0, 1, 0] }, { t: 1, n: [0, -1, 0] },
      { t: 1, n: [-1, 0, 0] }, { t: 0.5, n: [0, 1, 0] },
      { t: -1 },
    ]);
    setTerrain(16, new Float32Array(16 * 16).fill(0.8), { low: 0, high: 0.6 });
    check([{ name: 'clipped top cap', ro: [0, 1, 0], rd: [0, -1, 0] }], [{ t: 0.8, n: [0, 1, 0] }]);
    setTerrain(16, new Float32Array(16 * 16).fill(0.8), { low: 0.3, high: 1 });
    check([{ name: 'clipped base', ro: [0, -2, 0], rd: [0, 1, 0] }], [{ t: 1.6, n: [0, -1, 0] }]);
    setTerrain(16, planar);
    check([{ name: 'bilinear planar slope', ro: [-0.5, 1, 0], rd: [0.2, -1, 0] }], [
      { t: 1.1 / 1.04, n: [-0.2 / Math.hypot(0.2, 1), 1 / Math.hypot(0.2, 1), 0] },
    ]);
    setTerrain(16, bilinear);
    const quadraticHit = (0.46 + Math.sqrt(0.378)) / 0.8;
    const quadraticX = -0.7 + quadraticHit;
    const quadraticSlope = -0.4 * quadraticX;
    const quadraticNormalLength = Math.hypot(quadraticSlope, 1, quadraticSlope);
    const interiorHit = 0.9 - Math.sqrt(0.125);
    const interiorContact = -Math.sqrt(0.125);
    const interiorSlope = -0.4 * interiorContact;
    const interiorNormalLength = Math.hypot(interiorSlope, 1, interiorSlope);
    check([
      { name: 'bilinear quadratic first root', ro: [-0.7, 0.3, -0.7], rd: [1, -0.1, 1] },
      { name: 'bilinear interior first of two roots', ro: [-0.9, 0.05, -0.9], rd: [1, 0, 1] },
    ], [
      { t: quadraticHit, n: [quadraticSlope / quadraticNormalLength, 1 / quadraticNormalLength, quadraticSlope / quadraticNormalLength] },
      { t: interiorHit, n: [interiorSlope / interiorNormalLength, 1 / interiorNormalLength, interiorSlope / interiorNormalLength] },
    ]);
    setTerrain(16, flat, { high: 1, lattice: true });
    check([
      { name: 'mirror upper face', ro: [0, 1, 0], rd: [0, -1, 0] },
      { name: 'mirror lower face', ro: [0, -2, 0], rd: [0, 1, 0] },
    ], [{ t: 0.5, n: [0, 1, 0] }, { t: 1.5, n: [0, -1, 0] }]);
    setTerrain(16, ramp, { low: 0.3, high: 1, lattice: true });
    check([{ name: 'mirror low-clip wall', ro: [-1, 0, 0], rd: [1, 0, 0] }], [{ t: 0.8, n: [-1, 0, 0] }]);
    setTerrain(2, new Float32Array(4).fill(0.5), { low: 0.5, high: 1, lattice: true });
    check([
      { name: 'constant-threshold mirror exits side', ro: [0, 0, 0], rd: [1, 0, 0] },
      { name: 'constant-threshold mirror exits top', ro: [0, 0, 0], rd: [0, 1, 0] },
      { name: 'constant-threshold mirror corner', ro: [0, 0, 0], rd: [0.5, 0.25, 0] },
    ], [
      { t: 1, n: [1, 0, 0] },
      { t: 0.5, n: [0, 1, 0] },
      { t: 2 },
    ]);
    setTerrain(2, new Float32Array([0, 1, 0, 1]), { low: 0, high: 0.702, lattice: true });
    check([{ name: 'clipped bilinear near-cap false hit', ro: [1.403, 0.802, 0], rd: [-1, -0.1, 0] }], [{ t: -1 }]);
    let seed = 271828;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 77892; i++) random();
    const driftHeights = Float32Array.from({ length: 512 * 512 }, random);
    setTerrain(512, driftHeights);
    check([{
      name: '512 deterministic DDA boundary drift miss',
      ro: [1.3991496562957764, 1.8277716636657715, -1.9239622354507446],
      rd: [-0.834251344203949, -0.3558081388473511, 0.4212188124656677],
    }], [{ t: -1 }]);
    return { coverage, analytic };
  });
  console.table(coverage);
  console.table(analytic.map(({ name, t, expected }) => ({ name, actual: t, expected: expected.t })));
  assert.ok(coverage.every(r => r.misses === 0), 'Terrain rays aimed inside the solid returned misses');
  for (const row of analytic) {
    const { expected } = row;
    if (expected.t < 0) assert.ok(row.t < 0, `${row.name}: expected miss, got t=${row.t}`);
    else {
      assert.ok(Math.abs(row.t - expected.t) < 2e-4, `${row.name}: expected t=${expected.t}, got ${row.t}`);
      if (expected.n) {
        for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(row.n[axis] - expected.n[axis]) < 2e-3, `${row.name}: expected n=${expected.n}, got ${row.n}`);
      }
    }
  }
} finally {
  await browser.close();
}
