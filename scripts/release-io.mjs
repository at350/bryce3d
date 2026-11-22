/** Browser-level IO/persistence release checks. Start Vite, then run:
 * node scripts/release-io.mjs http://localhost:5301/
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5301/';
const evidenceDir = '/tmp/bryce-release-io';
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const outcomes = [];
const record = (name, details = {}) => outcomes.push({ name, passed: true, ...details });
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?fresh`);
  await page.waitForFunction(() => !!window.__bryce?.store);

  const fixtures = await page.evaluate(async () => {
    const { createDefaultScene } = await import('/src/scenes/defaultScene.ts');
    const { serializeScene } = await import('/src/io/serialize.ts');
    const { encodeShareLink } = await import('/src/io/share.ts');
    const autosave = createDefaultScene(); autosave.name = 'IO Stress Autosave';
    const shared = createDefaultScene(); shared.name = 'IO Stress Shared';
    return {
      autosave: serializeScene(autosave),
      sharedLink: encodeShareLink(shared, { base: `${location.origin}${location.pathname}` }),
    };
  });

  await page.evaluate((text) => localStorage.setItem('bryce3d-web:autosave', text), fixtures.autosave);
  await page.goto(base);
  await page.waitForFunction(() => window.__bryce.store.getState().scene.name === 'IO Stress Autosave');
  record('autosave restored on startup');

  await page.goto(`${base}?fresh`);
  await page.waitForFunction(() => window.__bryce.store.getState().scene.name !== 'IO Stress Autosave');
  record('fresh query skips autosave');

  await page.goto(fixtures.sharedLink);
  await page.waitForFunction(() => window.__bryce.store.getState().scene.name === 'IO Stress Shared');
  record('share hash takes precedence over autosave');

  await page.evaluate(() => window.__bryce.store.getState().setSceneName('IO Stress Debounced Save'));
  await page.waitForFunction(() => {
    const text = localStorage.getItem('bryce3d-web:autosave') ?? '';
    return text.includes('IO Stress Debounced Save');
  }, { timeout: 5000 });
  record('scene edits reach autosave storage');

  const fileScene = await page.evaluate(async () => {
    const { createDefaultScene } = await import('/src/scenes/defaultScene.ts');
    const { serializeScene } = await import('/src/io/serialize.ts');
    const scene = createDefaultScene(); scene.name = 'IO Stress Opened File';
    return serializeScene(scene);
  });
  await page.mouse.move(12, 1);
  await page.waitForFunction(() => document.querySelector('.menubar')?.classList.contains('is-revealed'));
  await page.getByRole('button', { name: 'File', exact: true }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: /Open/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'opened.bryce.json', mimeType: 'application/json', buffer: Buffer.from(fileScene) });
  await page.waitForFunction(() => window.__bryce.store.getState().scene.name === 'IO Stress Opened File');
  record('file picker opens a scene');

  const beforeCancel = await page.evaluate(() => window.__bryce.store.getState().scene.name);
  await page.mouse.move(12, 1);
  await page.waitForFunction(() => document.querySelector('.menubar')?.classList.contains('is-revealed'));
  await page.getByRole('button', { name: 'File', exact: true }).click();
  const cancelChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: /Open/ }).click();
  const cancelChooser = await cancelChooserPromise;
  await cancelChooser.setFiles([]);
  await page.waitForTimeout(100);
  const afterCancel = await page.evaluate(() => window.__bryce.store.getState().scene.name);
  assert.equal(afterCancel, beforeCancel, 'empty file selection should leave the current scene untouched');
  record('empty file chooser selection leaves scene unchanged');

  const nativeCancel = await page.evaluate(async () => {
    const { openSceneFile } = await import('/src/io/files.ts');
    const originalClick = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      setTimeout(() => this.dispatchEvent(new Event('cancel')), 0);
    };
    let result = 'pending';
    void openSceneFile().then((scene) => { result = scene === null ? 'null' : 'scene'; }, () => { result = 'error'; });
    await new Promise((resolve) => setTimeout(resolve, 30));
    HTMLInputElement.prototype.click = originalClick;
    return result;
  });
  outcomes.push({ name: 'native file-picker cancel resolves null', passed: nativeCancel === 'null', actual: nativeCancel, expected: 'null' });

  const dropText = await page.evaluate(async () => {
    const { createDefaultScene } = await import('/src/scenes/defaultScene.ts');
    const { serializeScene } = await import('/src/io/serialize.ts');
    const scene = createDefaultScene(); scene.name = 'IO Stress Dropped File';
    return serializeScene(scene);
  });
  await page.evaluate((text) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'dropped.bryce.json', { type: 'application/json' }));
    for (const type of ['dragenter', 'dragover', 'drop']) window.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, dropText);
  await page.waitForFunction(() => window.__bryce.store.getState().scene.name === 'IO Stress Dropped File');
  record('drag and drop opens a scene');

  await page.evaluate(() => {
    const state = window.__bryce.store.getState();
    state.openDialog('share');
  });
  await page.getByRole('textbox', { name: 'Share link' }).waitFor();
  const linkLength = await page.getByRole('textbox', { name: 'Share link' }).evaluate((el) => el.value.length);
  assert.ok(linkLength > 0, 'share dialog should render a nonempty URL');
  record('share dialog renders a complete payload', { linkLength });
  await page.screenshot({ path: `${evidenceDir}/share-dialog.png` });

  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  record('no uncaught browser errors');
  await writeFile(`${evidenceDir}/results.json`, `${JSON.stringify(outcomes, null, 2)}\n`);
  console.table(outcomes);
  if (outcomes.some((outcome) => !outcome.passed)) process.exitCode = 1;
  await context.close();
} finally {
  await browser.close();
}
