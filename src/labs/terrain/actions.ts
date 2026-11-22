/**
 * Editor actions shared by the tabs: run a generator or an op (recorded into the recipe),
 * apply them gradually (Bryce's drag-on-the-button), and the "last action" the Adjust panel
 * can re-run with new parameters.
 */
import type { TerrainData, TerrainRecipe } from '@/core/types';
import { getGenerator, getOp, opInvocation, resolveRandomGenerator, withOpResult } from '@/terrain';
import { lerpHeights } from '@/terrain/grid';
import type { Params } from '@/terrain/params';
import type { Workspace } from './useWorkspace';

export interface PreviewControl {
  /** Show these heights instead of the terrain (same resolution as the terrain). */
  show(h: Float32Array): void;
  clear(): void;
}

export interface LastAction {
  /** Unique per action (React key for the Adjust panel). */
  serial: number;
  kind: 'gen' | 'op';
  id: string;
  label: string;
  params: Params;
  /** Generator seed. */
  seed: number;
  /** Terrain before the action (the Adjust panel re-runs from here). */
  base: TerrainData;
  /** Terrain the action produced; the panel only shows while this is current. */
  result: TerrainData;
}

export interface EditorContext {
  ws: Workspace;
  preview: PreviewControl;
  last: LastAction | null;
  setLast(a: LastAction | null): void;
}

export const randomSeed = () => Math.floor(Math.random() * 999_999) + 1;

let serial = 0;

/** TerrainData for freshly generated heights, recipe recorded, clipping kept. */
export function generatedTerrain(base: TerrainData, generator: string, seed: number, params: Params, heights: Float32Array): TerrainData {
  const recipe: TerrainRecipe = { generator, seed, resolution: base.resolution, ops: [] };
  if (Object.keys(params).length) recipe.params = { ...params };
  return { resolution: base.resolution, heights, recipe, clipLow: base.clipLow ?? 0, clipHigh: base.clipHigh ?? 1 };
}

/** Ops on a hand-painted terrain get their own seed so repeated clicks vary. */
function seeded(base: TerrainData, params: Params): Params {
  return base.recipe || params.seed !== undefined ? params : { ...params, seed: randomSeed() };
}

function resolveGenerator(id: string, seed: number, params?: Params): { id: string; params: Params } {
  if (id !== 'random') return { id, params: params ?? {} };
  const r = resolveRandomGenerator(seed);
  return { id: r.generator, params: r.params };
}

export function runGeneratorAction(ctx: EditorContext, id: string, options: { seed?: number; params?: Params } = {}): void {
  const seed = options.seed ?? randomSeed();
  const g = resolveGenerator(id, seed, options.params);
  const label = getGenerator(g.id)?.label ?? g.id;
  ctx.ws.enqueue(`Generating ${label}`, async (compute) => {
    const base = ctx.ws.current();
    const h = await compute({ kind: 'generate', generator: g.id, seed, resolution: base.resolution, params: g.params });
    if (!h) return;
    const next = generatedTerrain(base, g.id, seed, g.params, h);
    ctx.ws.commit(next);
    ctx.setLast({ serial: ++serial, kind: 'gen', id: g.id, label, params: g.params, seed, base, result: next });
  });
}

export function runOpAction(ctx: EditorContext, id: string, params: Params = {}, label = getOp(id)?.label ?? id): void {
  ctx.ws.enqueue(label, async (compute) => {
    const base = ctx.ws.current();
    const p = seeded(base, params);
    const { seed } = opInvocation(base, id, p);
    const h = await compute({ kind: 'op', heights: base.heights, resolution: base.resolution, op: id, params: p, seed });
    if (!h) return;
    const next = withOpResult(base, id, p, h);
    ctx.ws.commit(next);
    ctx.setLast({ serial: ++serial, kind: 'op', id, label, params: p, seed, base, result: next });
  });
}

/**
 * Gradual application: compute the full effect once, then cross-fade the preview while the
 * pointer drags; on release record the op with that `amount`.
 */
export function makeGradual(ctx: EditorContext, target: { kind: 'gen' | 'op'; id: string; params?: Params }) {
  let base: TerrainData | null = null;
  let effect: Float32Array | null = null;
  let amount = 0;
  let ended = false;
  let raf = 0;
  let recipeOp: { op: string; params: Params } | null = null;

  const show = () => {
    raf = 0;
    if (base && effect) ctx.preview.show(lerpHeights(base.heights, effect, amount));
  };
  const finalize = () => {
    cancelAnimationFrame(raf);
    ctx.preview.clear();
    if (!base || !effect || !recipeOp || amount <= 0.001) return;
    if (ctx.ws.current() !== base) return;
    const p = { ...recipeOp.params, amount: Math.round(amount * 1000) / 1000 };
    ctx.ws.commit(withOpResult(base, recipeOp.op, p, lerpHeights(base.heights, effect, p.amount)));
    ctx.setLast(null);
  };

  return {
    start() {
      base = ctx.ws.current();
      effect = null;
      ended = false;
      amount = 0;
      const b = base;
      const label = target.kind === 'gen' ? getGenerator(target.id)?.label ?? 'Generator' : getOp(target.id)?.label ?? target.id;
      ctx.ws.enqueue(label, async (compute) => {
        if (target.kind === 'gen') {
          const seed = randomSeed();
          const g = resolveGenerator(target.id, seed, target.params);
          const code = getGenerator(g.id)?.code ?? 1;
          const params: Params = { g: code, s: seed };
          for (const [k, v] of Object.entries(g.params)) params[`p_${k}`] = v;
          recipeOp = { op: 'blendGen', params };
          effect = await compute({ kind: 'generate', generator: g.id, seed, resolution: b.resolution, params: g.params });
        } else {
          const p = seeded(b, target.params ?? {});
          const { seed } = opInvocation(b, target.id, p);
          recipeOp = { op: target.id, params: p };
          effect = await compute({ kind: 'op', heights: b.heights, resolution: b.resolution, op: target.id, params: p, seed });
        }
        if (ended) finalize();
        else show();
      });
    },
    change(a: number) {
      amount = a;
      if (effect && !raf) raf = requestAnimationFrame(show);
    },
    end(a: number) {
      amount = a;
      ended = true;
      if (effect) finalize();
    },
  };
}
