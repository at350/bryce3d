/** Browser integration checks against a running dev, preview, or deployed build.
 * Usage: node scripts/smoke.mjs http://localhost:5301/ [/tmp/bryce-smoke]
 * Requires installed Chrome; screenshots and downloads stay outside the repository.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5301/';
const output = process.argv[3] ?? '/tmp/bryce-smoke';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
};
const page = await context.newPage();
watch(page);
const state = (fn) => page.evaluate(fn);
const closedLab = () => page.waitForFunction(() => !__bryce.store.getState().ui.lab);
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__bryce && document.querySelector('.bv-root'));
  assert.equal(await state(() => __bryce.renderer.supported), true);
  await page.getByRole('button', { name: 'Create Sphere', exact: true }).click();
  const sphere = await state(() => __bryce.store.getState().selection[0]);
  assert.ok(sphere);
  const count = await state(() => __bryce.store.getState().scene.objects.length);
  await page.keyboard.press('Control+d');
  assert.equal(await state(() => __bryce.store.getState().scene.objects.length), count + 1);
  await page.keyboard.press('Control+z');
  assert.equal(await state(() => __bryce.store.getState().scene.objects.length), count);
  await page.evaluate(id => __bryce.store.getState().select(id), sphere);

  // Lab edits remain local until accepted, and accepting is one undoable scene change.
  await state(() => __bryce.store.getState().openLab('material', __bryce.store.getState().selection[0]));
  await page.getByLabel('Material name', { exact: true }).fill('Cancelled smoke material');
  await page.getByRole('button', { name: 'Cancel (Esc)', exact: true }).click();
  await closedLab();
  assert.notEqual(await state(() => __bryce.store.getState().scene.objects.find(o => o.id === __bryce.store.getState().selection[0]).material.name), 'Cancelled smoke material');
  await state(() => __bryce.store.getState().openLab('material', __bryce.store.getState().selection[0]));
  await page.getByLabel('Material name', { exact: true }).fill('Smoke material');
  await page.waitForFunction(() => {
    const c = document.querySelector('.ml-preview__canvas');
    return c?.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data[3] > 0;
  });
  await page.screenshot({ path: join(output, 'materials.png') });
  await page.getByRole('button', { name: 'Accept (Enter)', exact: true }).click();
  await closedLab();
  assert.equal(await state(() => __bryce.store.getState().scene.objects.find(o => o.id === __bryce.store.getState().selection[0]).material.name), 'Smoke material');

  const oldSky = await state(() => __bryce.store.getState().scene.sky.mode);
  await state(() => __bryce.store.getState().openLab('sky'));
  await page.getByRole('tab', { name: 'Atmosphere', exact: true }).click();
  await page.locator('.skylab__modetile').last().click();
  await page.getByRole('button', { name: 'Cancel (Esc)', exact: true }).click();
  await closedLab();
  assert.equal(await state(() => __bryce.store.getState().scene.sky.mode), oldSky);
  await state(() => __bryce.store.getState().openLab('sky'));
  await page.getByRole('tab', { name: 'Atmosphere', exact: true }).click();
  await page.locator('.skylab__modetile').nth(2).click();
  await page.screenshot({ path: join(output, 'sky.png') });
  await page.getByRole('button', { name: 'Accept (Enter)', exact: true }).click();
  await closedLab();
  assert.equal(await state(() => __bryce.store.getState().scene.sky.mode), 'custom');

  const terrainBefore = await state(() => {
    const s = __bryce.store.getState();
    const terrain = s.scene.objects.find(o => o.type === 'terrain');
    s.select(terrain.id); s.openLab('terrain', terrain.id);
    return terrain.terrain.heights[100];
  });
  await page.getByRole('button', { name: 'Invert', exact: true }).click();
  await page.screenshot({ path: join(output, 'terrain.png') });
  await page.getByRole('button', { name: 'Accept (Enter)', exact: true }).click();
  await closedLab();
  const terrainAfter = await state(() => __bryce.store.getState().scene.objects.find(o => o.id === __bryce.store.getState().selection[0]).terrain.heights[100]);
  assert.ok(Math.abs(terrainBefore + terrainAfter - 1) < 1e-5);

  // Progressive GPU render, stop/resume, nonblank output and PNG encoding.
  await state(() => {
    const s = __bryce.store.getState();
    s.setRenderSettings({ width: 400, height: 300, quality: 'normal', samples: 2 });
    __bryce.renderer.start(__bryce.store.getState().scene);
    __bryce.renderer.stop();
  });
  assert.equal(await state(() => __bryce.renderer.getProgress().status), 'paused');
  await state(() => __bryce.renderer.resume());
  await page.waitForFunction(() => ['done', 'error'].includes(__bryce.renderer.getProgress().status), null, { timeout: 120000 });
  assert.equal(await state(() => __bryce.renderer.getProgress().status), 'done');
  const png = await state(async () => {
    const r = __bryce.renderer;
    const c = r.outputCanvas;
    const p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    for (let i = 0; i < p.length; i += 64) colors.add(`${p[i]},${p[i+1]},${p[i+2]}`);
    return { bytes: (await r.exportPNG()).size, colors: colors.size, error: r.error };
  });
  assert.equal(png.error, null);
  assert.ok(png.bytes > 1000 && png.colors > 100, JSON.stringify(png));
  await page.screenshot({ path: join(output, 'render.png') });

  // Download/open a real scene file through the UI and native file chooser.
  const downloadReady = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await downloadReady;
  const saved = join(output, download.suggestedFilename());
  await download.saveAs(saved);
  const chooserReady = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  await (await chooserReady).setFiles(saved);
  await page.waitForFunction(() => __bryce.store.getState().ui.status.startsWith('Opened'));
  assert.ok(Math.abs(await state(() => __bryce.store.getState().scene.objects.find(o => o.type === 'terrain').terrain.heights[100]) - terrainAfter) < 1e-5);

  await state(() => __bryce.store.getState().openDialog('share'));
  const link = await page.getByLabel('Share link', { exact: true }).inputValue();
  const shared = await context.newPage();
  watch(shared);
  await shared.goto(link);
  await shared.waitForFunction(() => window.__bryce);
  assert.equal(await shared.evaluate(() => __bryce.store.getState().scene.objects.length), count);
  assert.equal(await shared.evaluate(() => __bryce.store.getState().scene.sky.mode), 'custom');
  assert.ok(await shared.evaluate(() => __bryce.store.getState().scene.objects.some(o => o.material.name === 'Smoke material')));
  await shared.close();
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  for (const kind of ['objects', 'materials', 'skies', 'scenes']) {
    await page.evaluate(kind => __bryce.store.getState().openLibrary(kind), kind);
    await page.locator('.lib-grid').waitFor();
    await page.screenshot({ path: join(output, `library-${kind}.png`) });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !__bryce.store.getState().ui.library);
  }
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.screenshot({ path: join(output, 'compact.png') });
  assert.equal(await state(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', objects: count, png, shareCharacters: link.length, screenshots: output }));
} finally {
  await browser.close();
}
