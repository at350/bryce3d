/**
 * "Adjust last action": after a generator or op button, its parameters appear here; changing
 * them re-runs the action from the terrain it started from (no extra undo steps).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DragValue, Slider } from '@/ui/kit';
import { getGenerator, getOp, opInvocation, withOpResult } from '@/terrain';
import { resolveParams, type ParamSpec, type Params } from '@/terrain/params';
import { generatedTerrain, randomSeed, withCurrentClipping, type EditorContext, type LastAction } from './actions';

interface Props {
  ctx: EditorContext;
  last: LastAction;
  onClose(): void;
}

const AMOUNT: ParamSpec = { key: 'amount', label: 'Amount', min: 0, max: 1, default: 1, precision: 2, hint: 'How much of the effect is applied' };

export function AdjustPanel({ ctx, last, onClose }: Props) {
  const def = last.kind === 'gen' ? getGenerator(last.id) : getOp(last.id);
  const specs = useMemo<ParamSpec[]>(() => {
    if (!def) return [];
    return last.kind === 'op' ? [...def.params, AMOUNT] : def.params;
  }, [def, last.kind]);
  const [params, setParams] = useState<Params>(() => ({ ...resolveParams(specs, last.params), ...(last.kind === 'op' ? { amount: last.params.amount ?? 1 } : {}) }));
  const [seed, setSeed] = useState(last.seed);
  const resultRef = useRef(last.result);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const heavy = !!def?.heavy;

  const rerun = (p: Params, s: number) => {
    const { ws } = ctx;
    ws.enqueue(
      `Updating ${last.label}`,
      async (compute) => {
        const base = last.base;
        let next;
        if (last.kind === 'gen') {
          const h = await compute({ kind: 'generate', generator: last.id, seed: s, resolution: base.resolution, params: p });
          if (!h) return;
          next = generatedTerrain(base, last.id, s, p, h);
        } else {
          const full = { ...last.params, ...p };
          if (full.amount === 1) delete full.amount;
          const { seed: opSeed } = opInvocation(base, last.id, full);
          const h = await compute({ kind: 'op', heights: base.heights, resolution: base.resolution, op: last.id, params: full, seed: opSeed });
          if (!h) return;
          next = withOpResult(base, last.id, full, h);
        }
        const current = ws.current();
        if (current.heights !== resultRef.current.heights || current.resolution !== resultRef.current.resolution) return;
        next = withCurrentClipping(next, current);
        resultRef.current = next;
        ws.replace(next);
        ctx.setLast({ ...last, params: p, seed: s, result: next });
      },
      'adjust',
    );
  };

  const schedule = (p: Params, s: number, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => rerun(p, s), delay);
  };

  const change = (key: string, value: number) => {
    const p = { ...params, [key]: value };
    setParams(p);
    schedule(p, seed, heavy ? 700 : 70);
  };

  if (!def) return null;
  return (
    <div className="te-adjust">
      <div className="te-adjust__title">
        <span>Adjust {last.label}</span>
        <button type="button" className="te-adjust__close" onClick={onClose} aria-label="Close" title="Hide (the change stays)">
          ✕
        </button>
        {last.kind === 'gen' && (
          <span className="te-adjust__seed">
            <DragValue
              label="Seed"
              value={seed}
              min={1}
              max={999999}
              step={1}
              width={110}
              hint="Seed: each number gives a different variation"
              onChange={(v) => setSeed(Math.round(v))}
              onEnd={() => schedule(params, seed, 0)}
            />
            <Button
              variant="ghost"
              hint="New random seed"
              onClick={() => {
                const s = randomSeed();
                setSeed(s);
                schedule(params, s, 0);
              }}
            >
              🎲
            </Button>
          </span>
        )}
      </div>
      <div className="te-adjust__params">
        {specs.map((s) => (
          <Slider
            key={s.key}
            label={s.label}
            value={params[s.key] ?? s.default}
            min={s.min}
            max={s.max}
            step={s.step ?? (s.max - s.min) / 200}
            precision={s.precision ?? 0}
            hint={s.hint ?? s.label}
            width={300}
            onChange={(v) => change(s.key, s.step === 1 ? Math.round(v) : v)}
            onEnd={() => heavy && schedule({ ...params }, seed, 0)}
          />
        ))}
        {heavy && <p className="te-adjust__note">Heavy effect: updates when you let go.</p>}
      </div>
    </div>
  );
}
