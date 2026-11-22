/** Adversarial renderer QA against local Vite. Own isolated Chrome context.
 * node scripts/release-renderer.mjs [url] [output]
 */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://localhost:5301/';
const out = process.argv[3] ?? '/tmp/bryce-release-renderer';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await context.newPage();
const rows = [], errors = [];
page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push({ type: m.type(), text: m.text() }); });
const record = async (name, fn) => {
  const started = Date.now();
  try { const result = await fn(); rows.push({ name, ms: Date.now() - started, result }); }
  catch (e) { rows.push({ name, ms: Date.now() - started, error: String(e) }); }
  console.log(JSON.stringify(rows.at(-1)));
  await writeFile(join(out, 'results.json'), JSON.stringify({ rows, errors }, null, 2));
};
const saveCanvas = async name => {
  const data = await page.evaluate(() => __harness.renderer.outputCanvas.toDataURL('image/png'));
  await writeFile(join(out, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
};
try {
  await page.goto(new URL('/dev/renderer-test.html', url).href);
  await page.waitForFunction(() => window.__harness);
  await page.evaluate(async () => {
    const { createObject, makeMaterial } = await import('/src/core/defaults.ts');
    const r = __harness.renderer, base = __harness.scenes.empty();
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const wait = async (fn, ms = 45000) => { const start = performance.now(); while (!fn()) { if (performance.now() - start > ms) throw Error('QA timeout: ' + JSON.stringify(r.getProgress())); await frame(); } };
    const scene = (objects = [], patch = {}) => ({ ...base, camera: { position: [0, 5, 15], target: [0, 0, 0], roll: 0, fov: 50 }, ...patch, objects, render: { ...base.render, quality: 'draft', width: 96, height: 64, samples: 1, mosaic: false, ...patch.render } });
    const sphere = (i = 8) => createObject('sphere', { id: 'qa-sphere-' + i, transform: { position: [(i % 16 - 7.5) * 2, 0, -Math.floor(i / 16) * 2], rotation: [0, 0, 0], scale: [.8, .8, .8] } });
    const terrain = (i, n = 2, h = .4) => ({ ...sphere(i), type: 'terrain', id: 'qa-terrain-' + i, terrain: { resolution: n, heights: new Float32Array(n * n).fill(h), clipLow: 0, clipHigh: 1 }, transform: { position: [(i % 4 - 1.5) * 3, 0, -Math.floor((i % 16) / 4) * 3], rotation: [0, 0, 0], scale: [1.3, 1, 1.3] } });
    const run = async (s, options = {}) => { r.start(s, options); await wait(() => ['done', 'error'].includes(r.getProgress().status)); return { ...r.getProgress(), objects: r.mainScene?.objectCount, dropped: r.mainScene?.dropped, error: r.error }; };
    window.qa = { r, base, frame, wait, scene, sphere, terrain, run, makeMaterial };
  });

  await record('boot', () => page.evaluate(async () => { const q = qa; const p = await q.run(q.scene()); return { ...p, supported: q.r.supported, renderer: q.r.tracer.gl.getParameter(q.r.tracer.gl.RENDERER) }; }));

  await record('start-stop-resume-clear', () => page.evaluate(async () => {
    const q = qa, r = q.r;
    r.start(q.scene([q.sphere()], { render: { quality: 'normal', samples: 8, width: 256, height: 160 } }));
    await q.frame(); await q.frame(); r.stop();
    const stopped = r.getProgress(); for (let i = 0; i < 4; i++) await q.frame(); const paused = r.getProgress();
    r.resume(); await q.wait(() => r.getProgress().status === 'done'); const firstDone = r.getProgress();
    r.resume(); await q.wait(() => r.getProgress().status === 'done'); const moreDone = r.getProgress();
    const pngBytes = (await r.exportPNG())?.size;
    r.clear(); const px = r.outputCanvas.getContext('2d').getImageData(0, 0, r.outputCanvas.width, r.outputCanvas.height).data;
    return { stopped, paused, firstDone, moreDone, pngBytes, cleared: r.getProgress(), clearedPixels: px.some(v => v !== 0), exportAfterClear: await r.exportPNG() };
  }));

  await record('region-preserves-accumulation', () => page.evaluate(async () => {
    const q = qa, r = q.r, gl = r.tracer.gl, s = q.scene([q.sphere()], { render: { width: 128, height: 96 } });
    await q.run(s);
    const read = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, r.accum.fbo); const p = new Float32Array(128 * 96 * 4); gl.readPixels(0, 0, 128, 96, gl.RGBA, gl.FLOAT, p); return p; };
    const before = read(), region = { x: .25, y: .25, w: .5, h: .5 };
    await q.run({ ...s, sky: { ...s.sky, mode: 'custom', zenithColor: [1, 0, 0], horizonColor: [1, 0, 0] } }, { region });
    const after = read(); let changedOutside = 0, changedInside = 0;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 128; x++) { const i = (y * 128 + x) * 4; if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) { if (x < 32 || x >= 96 || y < 24 || y >= 72) changedOutside++; else changedInside++; } }
    return { changedOutside, changedInside, progress: r.getProgress(), glError: gl.getError() };
  }));

  await record('region-preserves-image-exposure', () => page.evaluate(async () => {
    const q = qa, r = q.r, s = q.scene([], { render: { width: 128, height: 96, exposure: 1 } });
    await q.run(s); const ctx = r.outputCanvas.getContext('2d'), before = ctx.getImageData(0, 0, 128, 96).data;
    await q.run({ ...s, render: { ...s.render, exposure: 4 } }, { region: { x: .25, y: .25, w: .5, h: .5 } });
    const after = ctx.getImageData(0, 0, 128, 96).data; let changedOutside = 0, maxOutsideDifference = 0;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 128; x++) if (x < 32 || x >= 96 || y < 24 || y >= 72) {
      const i = (y * 128 + x) * 4, diff = Math.max(...[0, 1, 2].map(k => Math.abs(before[i + k] - after[i + k]))); maxOutsideDifference = Math.max(maxOutsideDifference, diff); if (diff > 2) changedOutside++;
    }
    return { changedOutside, maxOutsideDifference };
  }));

  await record('terrain-pin-scene-replacement', () => page.evaluate(async () => {
    const q = qa, r = q.r, a = q.scene(Array.from({ length: 16 }, (_, i) => q.terrain(i))), b = q.scene(Array.from({ length: 16 }, (_, i) => q.terrain(i + 16)));
    const first = await q.run(a), second = await q.run(b);
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
    await r.preview(q.scene([q.terrain(99)]), canvas, { width: 64, height: 48, quality: 'nano', key: 'qa-pin-preview' });
    return { first, second, previewObjects: r.previewScene.objectCount, previewDropped: r.previewScene.dropped, cacheEntries: r.tracer.terrains.entries.size, pinned: r.tracer.terrains.pinned.size };
  }));
  await saveCanvas('terrain-pin-scene-replacement');

  await record('clear-releases-terrain-previews', () => page.evaluate(async () => {
    const q = qa, r = q.r;
    await q.run(q.scene(Array.from({ length: 16 }, (_, i) => q.terrain(110 + i))));
    // Repeat with a fresh scene identity to get past a previously cached failed pack.
    await q.run({ ...r.job.scene });
    r.clear();
    const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 32;
    await r.preview(q.scene([q.terrain(133)]), canvas, { width: 48, height: 32, quality: 'nano', key: 'qa-clear-preview' });
    return { previewObjects: r.previewScene.objectCount, dropped: r.previewScene.dropped, pinned: r.tracer.terrains.pinned.size };
  }));

  await record('terrain-cache-grow-evict', () => page.evaluate(async () => {
    const q = qa, r = q.r; r.tracer.terrains.pin([]); const results = [];
    for (let i = 0; i < 24; i++) {
      const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 16;
      await r.preview(q.scene([q.terrain(i + 200, i === 23 ? 512 : i % 2 ? 64 : 2, .1 + i / 30)]), canvas, { width: 24, height: 16, quality: 'nano', key: 'qa-evict-' + i });
      results.push({ i, objects: r.previewScene.objectCount, dropped: r.previewScene.dropped, version: r.tracer.terrains.version, entries: r.tracer.terrains.entries.size });
    }
    return { results, glError: r.tracer.gl.getError() };
  }));

  await record('object-limits', () => page.evaluate(async () => {
    const q = qa, results = [];
    for (const n of [50, 256, 280]) results.push({ n, ...(await q.run(q.scene(Array.from({ length: n }, (_, i) => q.sphere(i)), { render: { width: 96, height: 64 } }))) });
    return results;
  }));

  await record('evicted-preview-slot-version', () => page.evaluate(async () => {
    const q = qa, r = q.r; await q.run(q.scene());
    const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 32;
    const scenes = Array.from({ length: 16 }, (_, i) => q.scene([q.terrain(700 + i, 2, .15)]));
    for (const s of scenes) await r.preview(s, canvas, { width: 48, height: 32, quality: 'nano' });
    const a = scenes[0], key = a.objects[0].terrain.heights;
    await r.preview(a, canvas, { width: 48, height: 32, quality: 'nano' });
    const oldVersion = r.tracer.terrains.version, layer = r.tracer.terrains.entries.get(key).layer;
    await q.run(q.scene(Array.from({ length: 16 }, (_, i) => q.terrain(800 + i, 2, .85))));
    const aResidentBeforePreview = r.tracer.terrains.entries.has(key), newVersion = r.tracer.terrains.version;
    await r.preview(a, canvas, { width: 48, height: 32, quality: 'nano' });
    const layerEntry = [...r.tracer.terrains.entries.values()].find(e => e.layer === layer), current = r.tracer.terrains.entries.get(key);
    return { oldVersion, newVersion, aResidentBeforePreview, aResidentAfterPreview: !!current, previewObjects: r.previewScene.objectCount, previewDropped: r.previewScene.dropped, oldLayer: layer, oldLayerHeight: layerEntry?.prepared.data[0], expectedHeight: .15, actualHeight: current?.prepared.data[0] };
  }));

  await record('hidden-terrain-pins', () => page.evaluate(async () => {
    const q = qa, r = q.r; await q.run(q.scene());
    const objects = Array.from({ length: 17 }, (_, i) => ({ ...q.terrain(900 + i), hidden: i === 16 }));
    const first = await q.run(q.scene(objects));
    const next = await q.run(q.scene(objects.map((o, i) => ({ ...o, hidden: i !== 16 }))));
    return { first, next, pins: r.tracer.terrains.pinned.size, visible: 1 };
  }));

  await record('active-sixteen-terrain-preview', () => page.evaluate(async () => {
    const q = qa, r = q.r; await q.run(q.scene());
    const s = q.scene(Array.from({ length: 16 }, (_, i) => q.terrain(1000 + i)));
    await q.run(s);
    r.start({ ...s, render: { ...s.render, width: 800, height: 600, quality: 'normal', samples: 64 } });
    const c = document.createElement('canvas'); c.width = 32; c.height = 24;
    let settled = false;
    const preview = r.preview(q.scene([q.terrain(1100)]), c, { width: 32, height: 24, quality: 'nano', key: 'qa-deferred' }).then(() => { settled = true; });
    for (let i = 0; i < 3; i++) await q.frame();
    const during = { settled, progress: r.getProgress(), unavailable: r.previewScene.terrainUnavailable, workDone: r.job.workDone, pins: r.tracer.terrains.pinned.size };
    r.stop(); await q.wait(() => settled); await preview;
    return { during, settled, previewObjects: r.previewScene.objectCount, previewDropped: r.previewScene.dropped, progress: r.getProgress(), pins: r.tracer.terrains.pinned.size };
  }));

  await record('mid-preview-resource-deferral', () => page.evaluate(async () => {
    const q = qa, r = q.r; await q.run(q.scene());
    const main = q.scene(Array.from({ length: 16 }, (_, i) => q.terrain(1200 + i)));
    await q.run(main);
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
    let settled = false;
    const preview = r.preview(q.scene([q.terrain(1300)]), canvas, { width: 1024, height: 1024, quality: 'preview', key: 'qa-mid-deferred' }).then(() => { settled = true; });
    await q.wait(() => settled || r.previewJob?.req.key === 'qa-mid-deferred');
    const wasActive = !settled && !!r.previewJob;
    r.start({ ...main, render: { ...main.render, width: 800, height: 600, quality: 'normal', samples: 64 } });
    for (let i = 0; i < 4; i++) await q.frame();
    const during = { settled, unavailable: r.previewScene.terrainUnavailable, queued: r.queue.size, workDone: r.job.workDone, pins: r.tracer.terrains.pinned.size };
    r.stop(); await q.wait(() => settled); await preview;
    return { wasActive, during, settled, previewObjects: r.previewScene.objectCount, previewDropped: r.previewScene.dropped, pins: r.tracer.terrains.pinned.size };
  }));

  await record('concurrent-preview-main-context-loss', () => page.evaluate(async () => {
    const q = qa, r = q.r, main = q.scene([q.terrain(500, 64)], { render: { quality: 'normal', samples: 8, width: 256, height: 160 } });
    r.start(main); const completed = [], promises = [];
    for (let i = 0; i < 12; i++) { const c = document.createElement('canvas'); c.width = 64; c.height = 48; promises.push(r.preview(q.scene([q.terrain(501 + i, i === 10 ? 512 : 2)]), c, { width: 64, height: 48, quality: i % 2 ? 'nano' : 'preview', key: i < 6 ? 'qa-supersede' : 'qa-distinct-' + i }).then(() => completed.push(i))); }
    await q.frame(); await q.frame(); r.tracer.loseContext();
    await q.wait(() => r.tracer.lost, 5000); const lostProgress = r.getProgress();
    await new Promise(resolve => setTimeout(resolve, 200)); r.tracer.restoreContext();
    await q.wait(() => !r.tracer.lost, 15000); await q.wait(() => r.getProgress().status === 'done', 45000); await Promise.all(promises);
    return { lostProgress, progress: r.getProgress(), completed, supported: r.supported, error: r.error, mainObjects: r.mainScene.objectCount, previewObjects: r.previewScene.objectCount, glError: r.tracer.gl.getError() };
  }));

  await record('paused-context-loss', () => page.evaluate(async () => {
    const q = qa, r = q.r; r.start(q.scene([q.sphere()], { render: { width: 192, height: 128, quality: 'normal', samples: 12 } })); r.stop();
    const before = r.getProgress();
    r.tracer.loseContext(); await q.wait(() => r.tracer.lost, 5000); await new Promise(resolve => setTimeout(resolve, 200)); r.tracer.restoreContext(); await q.wait(() => !r.tracer.lost, 15000);
    const paused = r.getProgress(); r.resume(); await q.wait(() => r.getProgress().status === 'done', 45000); return { before, paused, final: r.getProgress(), supported: r.supported };
  }));

  await record('no-float-linear-extension-R32F', async () => {
    const p = await context.newPage();
    await p.addInitScript(() => {
      const getExtension = WebGL2RenderingContext.prototype.getExtension;
      WebGL2RenderingContext.prototype.getExtension = function(name) { if (name === 'OES_texture_float_linear') return null; return getExtension.call(this, name); };
      window.qaAllocations = [];
      const storage = WebGL2RenderingContext.prototype.texStorage3D;
      WebGL2RenderingContext.prototype.texStorage3D = function(target, levels, format, ...args) { window.qaAllocations.push(format); return storage.call(this, target, levels, format, ...args); };
    });
    await p.goto(new URL('/dev/renderer-test.html', url).href); await p.waitForFunction(() => window.__harness);
    const result = await p.evaluate(async () => {
      const r = __harness.renderer, gl = r.tracer.gl, cache = r.tracer.terrains;
      const heights = new Float32Array(4).fill(.6), slot = cache.resolve({ resolution: 2, heights });
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, cache.texture);
      const min = gl.getTexParameter(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER), mag = gl.getTexParameter(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER);
      const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, cache.texture, 0, slot.layer);
      const pixels = new Float32Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixels); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fbo);
      const { INTERSECT_GLSL } = await import('/src/render/shaders/intersect.ts');
      const { PRECISION, FULLSCREEN_VERTEX, commonGLSL } = await import('/src/render/shaders/common.ts');
      const terrainSource = INTERSECT_GLSL.slice(INTERSECT_GLSL.indexOf('float terrainH('), INTERSECT_GLSL.indexOf('struct Hit {'));
      const compile = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s; };
      const pg = gl.createProgram(); gl.attachShader(pg, compile(gl.VERTEX_SHADER, FULLSCREEN_VERTEX));
      gl.attachShader(pg, compile(gl.FRAGMENT_SHADER, `${PRECISION}\n${commonGLSL()}\n${terrainSource}\nuniform vec4 uTP; uniform vec4 uCP; out vec4 result; void main(){vec3 n; float t=hitTerrain(vec3(0,1,0),vec3(0,-1,0),0.,INF,uTP,uCP,false,n);result=vec4(t,terrainH(vec2(0),uTP),0,1);}`));
      gl.linkProgram(pg); if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(pg)); gl.useProgram(pg);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, cache.texture); gl.uniform1i(gl.getUniformLocation(pg, 'uTerrain'), 0);
      gl.uniform4f(gl.getUniformLocation(pg, 'uTP'), slot.layer, slot.uvScale, slot.uvBias, 0); gl.uniform4f(gl.getUniformLocation(pg, 'uCP'), 0, 1, slot.maxHeight, 2);
      const target = r.tracer.createTarget(1, 1, gl.RGBA32F); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, 1, 1); gl.bindVertexArray(gl.createVertexArray()); gl.drawArrays(gl.TRIANGLES, 0, 3);
      const hit = new Float32Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, hit);
      return { extension: gl.getExtension('OES_texture_float_linear'), allocationFormats: window.qaAllocations, R32F: gl.R32F, nearest: min === gl.NEAREST && mag === gl.NEAREST, stored: pixels[0], expected: heights[0], gpuT: hit[0], gpuHeight: hit[1], glError: gl.getError() };
    });
    await p.close(); return result;
  });

  await record('unsupported-webgl-fallback', async () => {
    const p = await context.newPage();
    await p.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : get.call(this, type, ...args); }; });
    await p.goto(new URL('/dev/renderer-test.html', url).href); await p.waitForFunction(() => window.__harness);
    const result = await p.evaluate(async () => { const r = __harness.renderer, s = __harness.scenes.empty(); s.render = { ...s.render, width: 48, height: 32 }; r.start(s); const exported = (await r.exportPNG())?.size; const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 16; await r.preview(s, canvas, { width: 24, height: 16, quality: 'nano' }); const p = canvas.getContext('2d').getImageData(0, 0, 24, 16).data; const before = r.getProgress(); r.clear(); return { supported: r.supported, error: r.error, before, exported, previewHasPixels: p.some(v => v > 0), cleared: r.getProgress(), exportAfterClear: await r.exportPNG() }; });
    await p.close(); return result;
  });

  await record('app-heavy-render-library-concurrency', async () => {
    const p = await context.newPage(); const appErrors = [];
    p.on('pageerror', e => appErrors.push(e.message));
    await p.goto(url); await p.waitForFunction(() => window.__bryce && document.querySelector('.bv-root'));
    await p.evaluate(async () => {
      const { testScenes } = await import('/src/render/dev/testScenes.ts');
      const s = testScenes().showcase(); s.render = { ...s.render, width: 800, height: 600, quality: 'normal', samples: 4 };
      __bryce.store.getState().loadScene(s);
      window.qaGaps = []; let last = performance.now(); window.qaMeasuring = true;
      const frame = now => { if (window.qaMeasuring) { window.qaGaps.push(now - last); last = now; requestAnimationFrame(frame); } }; requestAnimationFrame(frame);
      __bryce.renderer.start(__bryce.store.getState().scene);
      __bryce.store.getState().openLibrary('materials');
    });
    await p.locator('.lib-grid').waitFor();
    const renderAtLibraryOpen = await p.evaluate(() => __bryce.renderer.getProgress());
    await p.keyboard.press('Escape');
    await p.evaluate(() => __bryce.store.getState().openLibrary('scenes'));
    await p.locator('.lib-grid').waitFor();
    await p.screenshot({ path: join(out, 'app-render-library.png') });
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => ['done', 'error'].includes(__bryce.renderer.getProgress().status), null, { timeout: 60000 });
    const result = await p.evaluate(() => { window.qaMeasuring = false; const gaps = window.qaGaps.sort((a, b) => a - b); return { progress: __bryce.renderer.getProgress(), supported: __bryce.renderer.supported, error: __bryce.renderer.error, gaps: { count: gaps.length, max: gaps.at(-1), p95: gaps[Math.floor(gaps.length * .95)] }, queue: __bryce.renderer.queue.size, mainObjects: __bryce.renderer.mainScene.objectCount }; });
    await p.close(); return { renderAtLibraryOpen, ...result, appErrors };
  });

  await saveCanvas('final-render');
  await page.screenshot({ path: join(out, 'harness.png') });
  const checks = {
    boot: r => r.supported && r.status === 'done' && !r.error,
    'start-stop-resume-clear': r => r.stopped.status === 'paused' && r.paused.fraction === r.stopped.fraction && r.moreDone.samples > r.firstDone.samples && !r.clearedPixels && r.exportAfterClear === null,
    'region-preserves-accumulation': r => r.changedOutside === 0 && r.changedInside > 0 && r.glError === 0,
    'region-preserves-image-exposure': r => r.changedOutside === 0,
    'terrain-pin-scene-replacement': r => r.first.objects === 16 && r.second.objects === 16 && r.second.dropped === 0 && r.previewObjects === 1,
    'clear-releases-terrain-previews': r => r.previewObjects === 1 && r.dropped === 0 && r.pinned === 0,
    'terrain-cache-grow-evict': r => r.glError === 0 && r.results.every(v => v.objects === 1 && v.dropped === 0),
    'object-limits': r => r.every(v => v.objects === Math.min(256, v.n) && v.dropped === Math.max(0, v.n - 256)),
    'evicted-preview-slot-version': r => r.aResidentAfterPreview && r.actualHeight === Math.fround(.15) && r.previewDropped === 0,
    'hidden-terrain-pins': r => r.next.objects === 1 && r.next.dropped === 0,
    'active-sixteen-terrain-preview': r => !r.during.settled && r.during.workDone > 0 && r.settled && r.previewObjects === 1 && r.previewDropped === 0 && r.pins === 0,
    'mid-preview-resource-deferral': r => r.wasActive && !r.during.settled && r.during.workDone > 0 && r.settled && r.previewObjects === 1 && r.previewDropped === 0 && r.pins === 0,
    'concurrent-preview-main-context-loss': r => r.completed.length === 12 && r.supported && !r.error && r.progress.status === 'done' && r.glError === 0,
    'paused-context-loss': r => r.before.status === 'paused' && r.paused.status === 'paused' && r.final.status === 'done',
    'no-float-linear-extension-R32F': r => r.extension === null && r.nearest && r.stored === Math.fround(.6) && r.gpuHeight === r.stored && Math.abs(r.gpuT - .8) < 1e-6 && r.glError === 0,
    'unsupported-webgl-fallback': r => !r.supported && r.before.status === 'error' && r.exported > 0 && r.previewHasPixels && r.exportAfterClear === null,
    'app-heavy-render-library-concurrency': r => r.progress.status === 'done' && r.supported && !r.error && !r.appErrors.length,
  };
  const failures = rows.filter(row => row.error || !checks[row.name]?.(row.result)).map(row => row.name);
  await writeFile(join(out, 'results.json'), JSON.stringify({ rows, errors, failures }, null, 2));
  console.log(JSON.stringify({ finished: true, rows: rows.length, failures, errors, evidence: out }));
  if (failures.length) process.exitCode = 1;
} finally { await context.close(); await browser.close(); }
