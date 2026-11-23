/** Look regression for the soft pixel filter, edge-only anti-aliasing and torn, sun-lit clouds.
 * Own isolated Chrome context, pinned random numbers so renders are repeatable.
 * node scripts/look-regression.mjs [url] [baseline-url] [output]
 *   url           the working tree (default http://127.0.0.1:5320/)
 *   baseline-url  an unmodified copy of HEAD, for the legacy equivalence stage (default http://127.0.0.1:5330/)
 * Exits 1 if any stage fails.
 */
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5320/';
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5330/';
const out = process.argv[4] ?? '/tmp/bryce-look-regression';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const rows = [], errors = [];
const record = async (name, fn) => {
  const started = Date.now();
  try { rows.push({ name, result: await fn() }); }
  catch (e) { rows.push({ name, error: String(e) }); }
  rows.at(-1).ms = Date.now() - started;
  console.log(JSON.stringify(rows.at(-1)));
  await writeFile(join(out, 'results.json'), JSON.stringify({ rows, errors }, null, 2));
};

/** Open the renderer harness on `base` and install the helpers every stage uses (window.look). */
async function open(base) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push({ base, type: 'pageerror', text: e.message }));
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push({ base, type: m.type(), text: m.text() }); });
  await page.goto(new URL('/dev/renderer-test.html', base).href);
  await page.waitForFunction(() => window.__harness);
  await page.evaluate(() => {
    const r = __harness.renderer;
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    // Pinned Math.random: the job seed and the display dither repeat, so equal code gives equal pixels.
    const pin = () => { let s = 0x9e3779b9; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const scenes = {
      monolithSea: async () => (await import('/src/scenes/gallery/seas.ts')).monolithSea(),
      pyramids: async () => (await import('/src/scenes/gallery/lands.ts')).desertPyramids(),
    };
    /** Render `name` with render / sky patches (null deletes a field) and return its pixels (and the edge mask, if any). */
    const shoot = async (name, { render = {}, sky = {}, stratus = {}, cumulus = {}, size = 160 } = {}) => {
      const base = await scenes[name]();
      const patch = (o, p) => { const n = { ...o, ...p }; for (const k of Object.keys(p)) if (p[k] === null) delete n[k]; return n; };
      const scene = {
        ...base,
        sky: { ...patch(base.sky, sky), stratus: patch(base.sky.stratus, stratus), cumulus: patch(base.sky.cumulus, cumulus) },
        render: patch({ ...base.render, quality: 'normal', width: size, height: size * 3 / 4, samples: 8, mosaic: false }, render),
      };
      pin();
      r.start(scene);
      const t0 = performance.now();
      while (!['done', 'error'].includes(r.getProgress().status)) { if (performance.now() - t0 > 120000) throw Error('render timeout'); await frame(); }
      if (r.getProgress().status === 'error') throw Error('render error: ' + r.error);
      const c = r.outputCanvas, ctx = c.getContext('2d');
      const pixels = Array.from(ctx.getImageData(0, 0, c.width, c.height).data);
      let mask = null;
      const gl = r.tracer.gl;
      if (r.edges && render.antialias !== 'full') {
        gl.bindFramebuffer(gl.FRAMEBUFFER, r.edges.fbo);
        const m = new Uint8Array(r.edges.w * r.edges.h * 4);
        gl.readPixels(0, 0, r.edges.w, r.edges.h, gl.RGBA, gl.UNSIGNED_BYTE, m);
        mask = Array.from({ length: r.edges.w * r.edges.h }, (_, i) => m[i * 4] > 127 ? 1 : 0);
      }
      return { w: c.width, h: c.height, pixels, mask, ms: performance.now() - t0 };
    };
    window.look = { r, frame, shoot, scenes };
  });
  return page;
}

/** In-page pixel helpers (source text, prepended to the evaluated stages). */
const stats = `
  const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) if (i % 4 < 3) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
  const psnr = (a, b) => { let se = 0, n = 0; for (let i = 0; i < a.length; i++) if (i % 4 < 3) { se += (a[i] - b[i]) ** 2; n++; } return se ? 10 * Math.log10(255 * 255 / (se / n)) : Infinity; };
  const sharp = (img) => { const { w, h, pixels: p } = img; let s = 0, n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) for (let k = 0; k < 3; k++) { s += Math.abs(p[(y * w + x) * 4 + k] - p[(y * w + x + 1) * 4 + k]); n++; } return s / n; };
  const lum = (img, x0, y0, x1, y1) => { const { w, pixels: p } = img; let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; s += (p[i] + p[i + 1] + p[i + 2]) / 3; n++; } return s / n; };
`;

try {
  const head = await open(baseUrl);
  const page = await open(url);
  const psnrNode = (a, b) => { let se = 0, n = 0, m = 0; for (let i = 0; i < a.length; i++) if (i % 4 < 3) { const d = a[i] - b[i]; se += d * d; n++; m = Math.max(m, Math.abs(d)); } return { psnr: se ? 10 * Math.log10(255 * 255 / (se / n)) : Infinity, maxDiff: m }; };
  const shot = (p, name, opts) => p.evaluate(async ([n, o]) => { const s = await look.shoot(n, o); return { w: s.w, h: s.h, pixels: s.pixels }; }, [name, opts]);

  for (const name of ['monolithSea', 'pyramids']) {
    await record(`legacy-equivalence-${name}`, async () => {
      // The HEAD copy has neither field, so its renders are the legacy look.
      const a = await shot(head, name, {}), b = await shot(page, name, { render: { antialias: 'full', softness: 0 } });
      return { size: [a.w, a.h], ...psnrNode(a.pixels, b.pixels) };
    });
  }

  await record('legacy-equivalence-clouds-off-fields-absent', async () => {
    // Explicit turbulence 0 / glow 0 must equal a layer that has neither field (an old file).
    const opts = { render: { antialias: 'full', softness: 0 } };
    const a = await shot(page, 'monolithSea', { ...opts, stratus: { turbulence: null, glow: null }, cumulus: { turbulence: null, glow: null } });
    const b = await shot(page, 'monolithSea', { ...opts, stratus: { turbulence: 0, glow: 0 }, cumulus: { turbulence: 0, glow: 0 } });
    return psnrNode(a.pixels, b.pixels);
  });

  for (const name of ['pyramids', 'monolithSea']) {
    await record(`edge-mask-${name}`, () => page.evaluate(`(async () => {
      const name = ${JSON.stringify(name)}, o = { size: 160 };
      const one = await look.shoot(name, { ...o, render: { softness: 0, samples: 1 } });
      const edges = await look.shoot(name, { ...o, render: { softness: 0, antialias: 'edges' } });
      const full = await look.shoot(name, { ...o, render: { softness: 0, antialias: 'full' } });
      if (!edges.mask) throw Error('no edge mask after an edges render');
      const { w, h } = edges;
      let marked = 0, unmarked = 0, unmarkedSame = 0, markedFull = 0, markedOne = 0;
      // Display dither may differ by a level or two between runs (it draws on a per-frame random stream).
      const same = (a, b, i) => Math.abs(a[i] - b[i]) <= 2 && Math.abs(a[i + 1] - b[i + 1]) <= 2 && Math.abs(a[i + 2] - b[i + 2]) <= 2;
      // The mask texture is bottom-up (GL), the canvas top-down.
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, m = edges.mask[(h - 1 - y) * w + x];
        if (m) { marked++; if (same(edges.pixels, full.pixels, i)) markedFull++; if (same(edges.pixels, one.pixels, i)) markedOne++; }
        else { unmarked++; if (same(edges.pixels, one.pixels, i)) unmarkedSame++; }
      }
      return { marked, unmarked, markedFraction: marked / (w * h), unmarkedSameAs1Sample: unmarkedSame / unmarked, markedSameAsFull: markedFull / marked, markedSameAs1Sample: markedOne / marked };
    })()`));
  }

  await record('softness-monotonic', () => page.evaluate(`(async () => { ${stats}
    const sharpness = {}, shots = {};
    for (const name of ['pyramids', 'monolithSea']) {
      const row = [];
      for (const softness of [0, 30, 60, 100]) { const s = await look.shoot(name, { render: { softness, antialias: 'full' } }); row.push({ softness, sharp: sharp(s), pixels: s.pixels }); }
      sharpness[name] = row.map(r => r.sharp);
      const again = await look.shoot(name, { render: { softness: 0, antialias: 'full' } });
      shots[name] = { zeroRepeatable: maxDiff(row[0].pixels, again.pixels) <= 2, psnrFromZero: row.slice(1).map(r => psnr(row[0].pixels, r.pixels)) };
    }
    return { sharpness, shots };
  })()`));

  await record('clouds-off-vs-on', () => page.evaluate(`(async () => { ${stats}
    // Sun low and ahead of the camera behind a thick stratus layer; unfiltered full AA so only the sky differs.
    const sky = { sunAltitude: 12, sunAzimuth: 0, linkSunToView: false };
    const base = { render: { antialias: 'full', softness: 0 }, sky };
    const shoot = (extra) => look.shoot('monolithSea', { ...base, stratus: { enabled: true, cover: 70, ...extra }, cumulus: { enabled: false } });
    const plain = await shoot({ turbulence: 0, glow: 0 }), missing = await shoot({ turbulence: null, glow: null });
    const torn = await shoot({ turbulence: 70, glow: 0 }), lit = await shoot({ turbulence: 0, glow: 100 }), half = await shoot({ turbulence: 0, glow: 50 });
    const top = (s) => lum(s, 0, 0, s.w, Math.floor(s.h * 0.4));
    return {
      zeroEqualsMissing: maxDiff(plain.pixels, missing.pixels) <= 2,
      turbulencePsnr: psnr(plain.pixels, torn.pixels),
      glowPsnr: psnr(plain.pixels, lit.pixels),
      skyLuminance: { plain: top(plain), glow50: top(half), glow100: top(lit), torn: top(torn) },
    };
  })()`));

  const checks = {
    'legacy-equivalence-monolithSea': r => (r.psnr ?? Infinity) >= 48,
    'legacy-equivalence-pyramids': r => (r.psnr ?? Infinity) >= 48,
    'legacy-equivalence-clouds-off-fields-absent': r => r.maxDiff <= 2,
    'edge-mask-pyramids': r => r.markedFraction > 0.002 && r.markedFraction < 0.6 && r.unmarkedSameAs1Sample > 0.999 && r.markedSameAsFull > 0.99,
    // The rippled sea must stay mostly unmarked (about 11%; comparing raw pixels marked 30%).
    'edge-mask-monolithSea': r => r.markedFraction > 0.002 && r.markedFraction < 0.2 && r.unmarkedSameAs1Sample > 0.999 && r.markedSameAsFull > 0.99,
    'softness-monotonic': r => Object.values(r.sharpness).every(s => s[0] > s[1] && s[1] > s[2] && s[2] > s[3]) && Object.values(r.shots).every(s => s.zeroRepeatable && s.psnrFromZero[0] > s.psnrFromZero[1] && s.psnrFromZero[1] > s.psnrFromZero[2]),
    'clouds-off-vs-on': r => r.zeroEqualsMissing && r.turbulencePsnr < 45 && r.glowPsnr < 45 && r.skyLuminance.glow100 > r.skyLuminance.glow50 && r.skyLuminance.glow50 > r.skyLuminance.plain,
  };
  const failures = rows.filter(row => row.error || !checks[row.name]?.(row.result)).map(row => row.name);
  if (errors.length) failures.push('page-errors');
  await writeFile(join(out, 'results.json'), JSON.stringify({ rows, errors, failures }, null, 2));
  console.log(JSON.stringify({ finished: true, stages: rows.length, failures, errors, evidence: out }));
  if (failures.length) process.exitCode = 1;
} finally { await context.close(); await browser.close(); }
