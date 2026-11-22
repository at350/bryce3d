/** Elevation tab: one-click generators (with dice) and the Basic Tools / Special Effects. */
import { useMemo } from 'react';
import { FLAT_GENERATOR, getOp, TERRAIN_GENERATORS } from '@/terrain';
import type { Params } from '@/terrain/params';
import { makeGradual, runGeneratorAction, runOpAction, type EditorContext } from './actions';
import { generatorThumb } from './thumbnails';
import { ToolButton } from './ToolButton';

const SHAPE_OPS = ['invert', 'smooth', 'blur', 'sharpen', 'contrast', 'scale', 'equalize', 'clip', 'posterize'];
const EDGE_OPS = ['squareEdges', 'roundEdges', 'gaussianEdges', 'raiseEdges'];
const EFFECT_OPS = ['erode', 'noise', 'slopeNoise', 'heightNoise', 'spikes', 'mounds', 'subplateaus', 'mosaic', 'sawtooth'];

interface Props {
  ctx: EditorContext;
}

function OpButton({ ctx, id, label, hint, params }: { ctx: EditorContext; id: string; label?: string; hint?: string; params?: Params }) {
  const def = getOp(id);
  const gradual = useMemo(() => makeGradual(ctx, { kind: 'op', id, params }), [ctx, id, params]);
  if (!def) return null;
  return (
    <ToolButton
      label={label ?? def.label}
      hint={hint ?? def.hint}
      onApply={() => runOpAction(ctx, id, params, label ?? def.label)}
      gradual={gradual}
      className={def.heavy ? 'is-heavy' : ''}
    />
  );
}

function GeneratorButton({ ctx, id, label, hint, icon }: { ctx: EditorContext; id: string; label: string; hint: string; icon: React.ReactNode }) {
  const gradual = useMemo(() => makeGradual(ctx, { kind: 'gen', id }), [ctx, id]);
  return <ToolButton variant="tile" label={label} hint={hint} icon={icon} onApply={() => runGeneratorAction(ctx, id)} gradual={gradual} />;
}

const RAISE: Params = { offset: 0.06 };
const LOWER: Params = { offset: -0.06 };

export function ElevationTab({ ctx }: Props) {
  return (
    <div className="te-elevation">
      <section className="te-group">
        <h3 className="te-group__title">Create <small>click for a new variation, drag right to blend it in</small></h3>
        <div className="te-tiles">
          <GeneratorButton ctx={ctx} id="flat" label={FLAT_GENERATOR.label} hint={FLAT_GENERATOR.hint} icon={<span className="te-thumb te-thumb--flat" />} />
          {TERRAIN_GENERATORS.map((g) => (
            <GeneratorButton
              key={g.id}
              ctx={ctx}
              id={g.id}
              label={g.id === 'random' ? 'Random' : g.label}
              hint={g.hint ?? g.label}
              icon={g.id === 'random' ? <span className="te-thumb te-thumb--dice">🎲</span> : <img className="te-thumb" src={generatorThumb(g.id)} alt="" draggable={false} />}
            />
          ))}
        </div>
      </section>
      <section className="te-group">
        <h3 className="te-group__title">Shape</h3>
        <div className="te-pills">
          <OpButton ctx={ctx} id="raiseLower" label="Raise" hint="Lift the whole terrain a little" params={RAISE} />
          <OpButton ctx={ctx} id="raiseLower" label="Lower" hint="Sink the whole terrain a little" params={LOWER} />
          {SHAPE_OPS.map((id) => <OpButton key={id} ctx={ctx} id={id} />)}
        </div>
      </section>
      <section className="te-group">
        <h3 className="te-group__title">Edges</h3>
        <div className="te-pills">{EDGE_OPS.map((id) => <OpButton key={id} ctx={ctx} id={id} />)}</div>
      </section>
      <section className="te-group">
        <h3 className="te-group__title">Effects</h3>
        <div className="te-pills">{EFFECT_OPS.map((id) => <OpButton key={id} ctx={ctx} id={id} />)}</div>
      </section>
    </div>
  );
}
