#!/usr/bin/env node
/**
 * Headless screenshot helper for checking the app visually (GPU WebGL via Chrome + Metal).
 *
 *   node scripts/shot.mjs <url> <out.png> [options]
 *
 * Options:
 *   --width 1440 --height 900     viewport size
 *   --wait 1500                   ms to wait after load (and after each step)
 *   --until "<js expr>"           poll until the expression is truthy (max --timeout ms)
 *   --timeout 60000
 *   --eval "<js>"                 run JS in the page before the screenshot (repeatable, runs in order)
 *   --click "<css selector>"      click an element before the screenshot (repeatable, runs in order)
 *   --selector "<css selector>"   screenshot only this element
 *   --scale 1                     deviceScaleFactor
 *
 * Steps (--eval / --click) run in the order given. Console errors and page errors are printed,
 * so shader compile failures show up in the terminal.
 */
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('usage: node scripts/shot.mjs <url> <out.png> [--width W --height H --wait MS --until EXPR --eval JS --click SEL --selector SEL]');
  process.exit(2);
}
const [url, out] = args;
const opts = { width: 1440, height: 900, wait: 1500, timeout: 60000, scale: 1, selector: null, until: null };
const steps = [];
for (let i = 2; i < args.length; i++) {
  const k = args[i];
  const v = args[i + 1];
  switch (k) {
    case '--width': opts.width = Number(v); i++; break;
    case '--height': opts.height = Number(v); i++; break;
    case '--wait': opts.wait = Number(v); i++; break;
    case '--timeout': opts.timeout = Number(v); i++; break;
    case '--scale': opts.scale = Number(v); i++; break;
    case '--selector': opts.selector = v; i++; break;
    case '--until': opts.until = v; i++; break;
    case '--eval': steps.push({ kind: 'eval', v }); i++; break;
    case '--click': steps.push({ kind: 'click', v }); i++; break;
    default: console.error(`unknown option ${k}`); process.exit(2);
  }
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: opts.scale });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(url, { waitUntil: 'load', timeout: opts.timeout });
  await page.waitForTimeout(opts.wait);
  for (const s of steps) {
    if (s.kind === 'eval') {
      const r = await page.evaluate(s.v);
      if (r !== undefined) console.log(`[eval] ${typeof r === 'string' ? r : JSON.stringify(r)}`);
    } else {
      await page.click(s.v, { timeout: 10000 });
    }
    await page.waitForTimeout(opts.wait);
  }
  if (opts.until) {
    await page.waitForFunction(opts.until, null, { timeout: opts.timeout, polling: 250 });
    await page.waitForTimeout(300);
  }
  if (opts.selector) await page.locator(opts.selector).screenshot({ path: out });
  else await page.screenshot({ path: out });
  console.log(`saved ${out}`);
} finally {
  await browser.close();
}
