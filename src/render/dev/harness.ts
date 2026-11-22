/**
 * Renderer dev harness (dev/renderer-test.html): renders test scenes straight onto a
 * visible canvas and records timings. Scriptable through window.__harness.
 */
import { getRenderer } from '@/render';
import type { RenderQuality, RenderProgress, Scene } from '@/core/types';
import { RayTracer } from '../gl/RayTracer';
import { SceneGPU } from '../gl/SceneGPU';
import { testScenes } from './testScenes';

interface RunResult {
  scene: string;
  quality: RenderQuality;
  firstPassMs: number | null;
  mosaicMs: number | null;
  doneMs: number | null;
  status: string;
}

const renderer = getRenderer();
const scenes = testScenes();
const root = document.getElementById('app')!;
const info = document.createElement('pre');
const controls = document.createElement('div');
const frame = document.createElement('div');
frame.style.cssText = 'display:inline-block;border:1px solid #555;background:repeating-conic-gradient(#3a3a3a 0 25%,#444 0 50%) 0 0/20px 20px;line-height:0';
renderer.outputCanvas.style.cssText = 'image-rendering:pixelated;display:block';
frame.appendChild(renderer.outputCanvas);
const nano = document.createElement('canvas');
nano.width = 160;
nano.height = 120;
nano.style.cssText = 'border:1px solid #555;margin-left:12px;vertical-align:top;width:320px;height:240px;image-rendering:pixelated';
root.append(controls, frame, nano, info);

const sceneSelect = document.createElement('select');
Object.keys(scenes).forEach((k) => sceneSelect.add(new Option(k, k)));
const qualitySelect = document.createElement('select');
['draft', 'normal', 'premium'].forEach((q) => qualitySelect.add(new Option(q, q, q === 'normal', q === 'normal')));
const renderBtn = document.createElement('button');
renderBtn.textContent = 'Render';
const stopBtn = document.createElement('button');
stopBtn.textContent = 'Stop';
const resumeBtn = document.createElement('button');
resumeBtn.textContent = 'Resume';
const nanoBtn = document.createElement('button');
nanoBtn.textContent = 'Nano preview';
controls.append(sceneSelect, qualitySelect, renderBtn, stopBtn, resumeBtn, nanoBtn);

let current: RunResult | null = null;
let startTime = 0;
let lastProgress: RenderProgress = renderer.getProgress();
let previewMs: number | null = null;
let resolveRun: ((r: RunResult) => void) | null = null;

function build(name: string, quality: RenderQuality, overrides: Partial<Scene['render']> = {}): Scene {
  const s = scenes[name]();
  return { ...s, render: { ...s.render, quality, ...overrides } };
}

renderer.subscribe((p) => {
  lastProgress = p;
  if (!current) return;
  const t = performance.now() - startTime;
  if (current.firstPassMs === null && p.pass >= 1) current.firstPassMs = t;
  if (current.mosaicMs === null && p.samples >= 1) current.mosaicMs = t;
  if (p.status === 'done' || p.status === 'error') {
    current.doneMs = t;
    current.status = p.status;
    const r = current;
    resolveRun?.(r);
    resolveRun = null;
  }
});

// Frame pacing while rendering: the UI must never stall (max rAF gap, 95th percentile).
const gaps: number[] = [];
let lastFrame = performance.now();
function pace(now: number) {
  if (lastProgress.status === 'rendering') gaps.push(now - lastFrame);
  lastFrame = now;
  requestAnimationFrame(pace);
}
requestAnimationFrame(pace);
function pacing() {
  const s = [...gaps].sort((a, b) => a - b);
  return { frames: s.length, max: s[s.length - 1] ?? 0, p95: s[Math.floor(s.length * 0.95)] ?? 0, median: s[Math.floor(s.length / 2)] ?? 0 };
}

function run(name: string, quality: RenderQuality = 'normal', overrides: Partial<Scene['render']> = {}): Promise<RunResult> {
  gaps.length = 0;
  current = { scene: name, quality, firstPassMs: null, mosaicMs: null, doneMs: null, status: 'rendering' };
  startTime = performance.now();
  renderer.start(build(name, quality, overrides));
  return new Promise((resolve) => {
    resolveRun = resolve;
  });
}

async function nanoPreview(name: string): Promise<number> {
  const t0 = performance.now();
  await renderer.preview(scenes[name](), nano, { width: 160, height: 120, quality: 'nano', key: 'nano' });
  previewMs = performance.now() - t0;
  return previewMs;
}

renderBtn.onclick = () => void run(sceneSelect.value, qualitySelect.value as RenderQuality);
stopBtn.onclick = () => renderer.stop();
resumeBtn.onclick = () => renderer.resume();
nanoBtn.onclick = () => void nanoPreview(sceneSelect.value);

function extensions(): string {
  const tracer = (renderer as unknown as { tracer?: { gl: WebGL2RenderingContext; timer: { precise: boolean }; accumFormat: number } }).tracer;
  if (!tracer) return 'no tracer';
  const gl = tracer.gl;
  return [
    `timer query: ${tracer.timer.precise}`,
    `accum: ${tracer.accumFormat === gl.RGBA32F ? 'RGBA32F' : 'RGBA16F'}`,
    `parallel compile: ${!!gl.getExtension('KHR_parallel_shader_compile')}`,
    `renderer: ${gl.getParameter(gl.RENDERER)}`,
  ].join(' | ');
}

setInterval(() => {
  info.textContent = [
    `supported: ${renderer.supported}  error: ${renderer.error ?? '-'}`,
    extensions(),
    `progress: ${JSON.stringify(lastProgress)}`,
    `run: ${JSON.stringify(current)}`,
    `nano preview ms: ${previewMs === null ? '-' : previewMs.toFixed(1)}`,
  ].join('\n');
}, 200);

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));
const waitFor = async (cond: () => boolean, timeout = 60000) => {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > timeout) throw new Error('timeout');
    await nextFrame();
  }
};

/** Stop a render once the given number of mosaic passes completed (shows the chunky blocks). */
async function mosaicFrame(name: string, passes: number): Promise<string> {
  const s = build(name, 'premium', { width: 1600, height: 1200 });
  renderer.start(s);
  await waitFor(() => renderer.getProgress().pass >= passes);
  renderer.stop();
  return renderer.outputCanvas.toDataURL('image/png');
}

/** Plop render: re-render the middle of the frame with a different sky; the rest must be kept. */
async function plop(name: string): Promise<string> {
  await run(name, 'draft');
  const s = build(name, 'draft');
  renderer.start({ ...s, sky: { ...s.sky, mode: 'custom', zenithColor: [0.6, 0.1, 0.1], horizonColor: [1, 0.8, 0.2] } }, { region: { x: 0.25, y: 0.25, w: 0.5, h: 0.4 } });
  await waitFor(() => renderer.getProgress().status === 'done');
  return renderer.outputCanvas.toDataURL('image/png');
}

/** Lose and restore the WebGL context mid-render; the render must restart and finish. */
async function contextLoss(name: string): Promise<unknown> {
  const tracer = (renderer as unknown as { tracer: { loseContext(): void; restoreContext(): void } }).tracer;
  renderer.start(build(name, 'normal'));
  await nextFrame();
  await nextFrame();
  tracer.loseContext();
  await new Promise((r) => setTimeout(r, 300));
  tracer.restoreContext();
  await waitFor(() => renderer.getProgress().status === 'done');
  return { status: renderer.getProgress().status, error: renderer.error, image: renderer.outputCanvas.toDataURL('image/png').length };
}

/** Nano previews: timings for a few consecutive requests, and key superseding. */
async function previews(name: string): Promise<unknown> {
  const times: number[] = [];
  for (let i = 0; i < 3; i++) times.push(await nanoPreview(name));
  const order: string[] = [];
  const a = renderer.preview(scenes[name](), nano, { width: 160, height: 120, quality: 'preview', key: 'k' }).then(() => order.push('a'));
  const b = renderer.preview(scenes[name](), nano, { width: 160, height: 120, quality: 'preview', key: 'k' }).then(() => order.push('b'));
  const t0 = performance.now();
  await Promise.all([a, b]);
  return { nanoMs: times, supersedeOrder: order, previewMs: performance.now() - t0 };
}

/** Cold shader compile + pipeline warm-up on a fresh, salted tracer (defeats driver caches). */
function coldCompile(): Promise<unknown> {
  const created = RayTracer.create({ salt: 1 + Math.random() });
  if (!('tracer' in created)) return Promise.resolve(created);
  const rt = created.tracer;
  const scene = new SceneGPU(rt.gl, rt.terrains);
  const t0 = performance.now();
  let maxCall = 0;
  let maxGap = 0;
  let last = t0;
  let polls = 0;
  return new Promise((resolve) => {
    const step = (now: number) => {
      maxGap = Math.max(maxGap, now - last);
      last = now;
      const c0 = performance.now();
      const state = rt.pollReady(() => scene);
      maxCall = Math.max(maxCall, performance.now() - c0);
      polls++;
      if (state === 'pending') requestAnimationFrame(step);
      else resolve({ state, totalMs: performance.now() - t0, maxPollMs: maxCall, maxFrameGapMs: maxGap, polls, error: rt.error });
    };
    requestAnimationFrame(step);
  });
}

(window as unknown as { __harness: unknown }).__harness = { coldCompile, mosaicFrame, plop, contextLoss, previews, renderer, scenes, run, nanoPreview, extensions, pacing, get progress() { return lastProgress; }, get result() { return current; } };
