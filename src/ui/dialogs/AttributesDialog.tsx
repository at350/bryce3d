/**
 * Object Attributes: name, flags and family (General), position / rotation / size
 * (Transform), and the type's own parameters (torus, stone, tree, light, terrain, plane).
 * Edits apply live; ✗ (or Esc) puts the object back the way it was when the dialog opened.
 */
import { useRef, useState } from 'react';
import { FAMILY_COLORS, FAMILY_NAMES } from '@/core/defaults';
import { randomSeed, rgbToHex } from '@/core/math';
import { OBJECT_LABELS, isInfinitePlane, isLight, isTerrainLike } from '@/core/objects';
import { selectPrimarySelection, useStore } from '@/core/store';
import type { LightParams, SceneObject, StoneParams, TreeParams, Vec3 } from '@/core/types';
import { Button, ColorSwatch, Dialog, DragValue, Icon3D, IconButton, Select, Slider, Tabs, Toggle } from '@/ui/kit';
import { landObjects } from '../edit/transformOps';

const gesture = { onStart: () => useStore.getState().beginGesture(), onEnd: () => useStore.getState().endGesture() };
const AXES = ['X', 'Y', 'Z'];

type Tab = 'general' | 'transform' | 'shape';

function shapeTabLabel(o: SceneObject): string | null {
  if (o.type === 'torus') return 'Torus';
  if (o.type === 'stone') return 'Stone';
  if (o.type === 'tree') return 'Tree';
  if (isLight(o.type)) return 'Light';
  if (isTerrainLike(o.type)) return 'Terrain';
  return null;
}

function VecRow({ label, value, onChange, min, max, speed, precision, unit = '' }: { label: string; value: Vec3; onChange: (v: Vec3) => void; min: number; max: number; speed: number; precision: number; unit?: string }) {
  return (
    <div className="vec-row">
      <span className="vec-row__label">{label}</span>
      {[0, 1, 2].map((i) => (
        <DragValue
          key={i}
          label={AXES[i]}
          hint={`${label} ${AXES[i]}`}
          value={value[i]}
          min={min}
          max={max}
          speed={speed}
          precision={precision}
          unit={unit}
          width={104}
          {...gesture}
          onChange={(v) => {
            const next = [...value] as Vec3;
            next[i] = v;
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function GeneralTab({ o, update }: { o: SceneObject; update: (p: Partial<SceneObject>) => void }) {
  return (
    <div className="dlg-section">
      <label className="dlg-field">
        <span>Object name</span>
        <input className="dlg-text" value={o.name} maxLength={80} spellCheck={false} onChange={(e) => update({ name: e.currentTarget.value })} />
      </label>
      <div className="dlg-row dlg-row--wrap">
        <Toggle label="Hidden" value={!!o.hidden} onChange={(v) => update({ hidden: v })} hint="Hidden objects are not drawn or rendered" />
        <Toggle label="Locked" value={!!o.locked} onChange={(v) => update({ locked: v })} hint="Locked objects can't be moved in the Working window" />
        <Toggle label="Show as box" value={!!o.showAsBox} onChange={(v) => update({ showAsBox: v })} hint="Draw as a bounding box in the Working window (renders normally)" />
      </div>
      <div className="dlg-field">
        <span>Family (wireframe color)</span>
        <div className="family-row" role="radiogroup" aria-label="Family">
          {FAMILY_NAMES.map((name, i) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={(o.family ?? 0) === i}
              aria-label={name}
              title={name}
              className={`family-chip ${(o.family ?? 0) === i ? 'is-on' : ''}`}
              style={{ background: rgbToHex(FAMILY_COLORS[i]) }}
              onClick={() => update({ family: i })}
            />
          ))}
        </div>
      </div>
      <p className="dlg-note">
        {OBJECT_LABELS[o.type]}
        {isInfinitePlane(o.type) ? ' · infinite plane: only its height matters' : ''}
      </p>
    </div>
  );
}

function TransformTab({ o }: { o: SceneObject }) {
  const s = useStore.getState();
  const t = o.transform;
  const setT = (patch: Partial<SceneObject['transform']>) => s.setTransform(o.id, patch);
  if (isInfinitePlane(o.type)) {
    return (
      <div className="dlg-section">
        <div className="dlg-row">
          <DragValue label="Height" value={t.position[1]} min={-10000} max={10000} speed={0.05} precision={2} width={150} {...gesture} onChange={(v) => setT({ position: [t.position[0], v, t.position[2]] })} />
          {o.type === 'cloud' && (
            <DragValue label="Thickness" value={t.scale[1] * 2} min={0.2} max={1000} speed={0.05} precision={2} width={160} {...gesture} onChange={(v) => setT({ scale: [t.scale[0], v / 2, t.scale[2]] })} />
          )}
        </div>
        <p className="dlg-note">Infinite planes stretch to the horizon; position X/Z and rotation are ignored.</p>
      </div>
    );
  }
  return (
    <div className="dlg-section">
      <VecRow label="Position" value={t.position} min={-100000} max={100000} speed={0.05} precision={2} onChange={(v) => setT({ position: v })} />
      <VecRow label="Rotate" value={t.rotation} min={-720} max={720} speed={0.5} precision={1} unit="°" onChange={(v) => setT({ rotation: v })} />
      <VecRow
        label="Size"
        value={[t.scale[0] * 2, t.scale[1] * 2, t.scale[2] * 2]}
        min={0.02}
        max={20000}
        speed={0.04}
        precision={2}
        onChange={(v) => setT({ scale: [v[0] / 2, v[1] / 2, v[2] / 2] })}
      />
      <div className="dlg-row">
        <Button hint="Drop the object onto the ground" onClick={() => s.updateObject(o.id, landObjects([o])[0])}>
          Land
        </Button>
        <Button hint="Clear the rotation" onClick={() => setT({ rotation: [0, 0, 0] })}>
          Unrotate
        </Button>
        <Button
          hint="Make the size uniform (the average of X, Y and Z)"
          onClick={() => {
            const m = (t.scale[0] + t.scale[1] + t.scale[2]) / 3;
            setT({ scale: [m, m, m] });
          }}
        >
          Uniform size
        </Button>
      </div>
    </div>
  );
}

function Dice({ onRoll, label }: { onRoll: () => void; label: string }) {
  return (
    <IconButton hint={label} size={30} onClick={onRoll}>
      <Icon3D kind="dice" size={26} />
    </IconButton>
  );
}

function ShapeTab({ o, update }: { o: SceneObject; update: (p: Partial<SceneObject>) => void }) {
  if (o.type === 'torus') {
    const r = o.torus?.minorRadius ?? 0.3;
    return (
      <div className="dlg-section">
        <Slider label="Thickness" value={r} min={0.05} max={0.5} step={0.01} precision={2} width={420} {...gesture} onChange={(v) => update({ torus: { minorRadius: v } })} hint="Tube radius (the ring always touches the box)" />
      </div>
    );
  }
  if (o.type === 'stone') {
    const st: StoneParams = o.stone ?? { seed: 1, lumpiness: 0.5, roughness: 0.5 };
    const set = (p: Partial<StoneParams>) => update({ stone: { ...st, ...p } });
    return (
      <div className="dlg-section">
        <div className="dlg-row">
          <DragValue label="Seed" value={st.seed} min={0} max={999999} step={1} speed={20} width={150} {...gesture} onChange={(v) => set({ seed: v })} />
          <Dice label="New random stone" onRoll={() => set({ seed: randomSeed() % 1000000 })} />
        </div>
        <Slider label="Lumpiness" value={st.lumpiness} min={0} max={1} precision={2} width={420} {...gesture} onChange={(v) => set({ lumpiness: v })} />
        <Slider label="Roughness" value={st.roughness} min={0} max={1} precision={2} width={420} {...gesture} onChange={(v) => set({ roughness: v })} />
      </div>
    );
  }
  if (o.type === 'tree') {
    const tr: TreeParams = o.tree ?? { seed: 1, trunkHeight: 0.45, trunkWidth: 0.1, crown: 'round', crownNoise: 0.5, trunkColor: [0.32, 0.22, 0.14] };
    const set = (p: Partial<TreeParams>) => update({ tree: { ...tr, ...p } });
    return (
      <div className="dlg-section">
        <div className="dlg-row">
          <Select
            label="Crown"
            value={tr.crown}
            width={170}
            options={[
              { value: 'round', label: 'Round' },
              { value: 'cone', label: 'Cone (conifer)' },
              { value: 'palm', label: 'Palm' },
              { value: 'willow', label: 'Willow' },
            ]}
            onChange={(v) => set({ crown: v as TreeParams['crown'] })}
          />
          <DragValue label="Seed" value={tr.seed} min={0} max={999999} step={1} speed={20} width={130} {...gesture} onChange={(v) => set({ seed: v })} />
          <Dice label="New random tree" onRoll={() => set({ seed: randomSeed() % 1000000 })} />
        </div>
        <Slider label="Crown clumps" value={tr.crownNoise} min={0} max={1} precision={2} width={420} {...gesture} onChange={(v) => set({ crownNoise: v })} />
        <Slider label="Trunk height" value={tr.trunkHeight} min={0.2} max={0.8} precision={2} width={420} {...gesture} onChange={(v) => set({ trunkHeight: v })} />
        <Slider label="Trunk width" value={tr.trunkWidth} min={0.03} max={0.3} precision={2} width={420} {...gesture} onChange={(v) => set({ trunkWidth: v })} />
        <ColorSwatch label="Trunk color" value={tr.trunkColor} {...gesture} onChange={(c) => set({ trunkColor: c })} />
        <p className="dlg-note">The crown uses the object's material (Materials Lab).</p>
      </div>
    );
  }
  if (isLight(o.type) && o.light) {
    const l: LightParams = o.light;
    const set = (p: Partial<LightParams>) => update({ light: { ...l, ...p } });
    const spot = o.type === 'spotLight' || o.type === 'squareSpotLight';
    return (
      <div className="dlg-section">
        <div className="dlg-row">
          <ColorSwatch label="Light color" value={l.color} size={26} {...gesture} onChange={(c) => set({ color: c })} />
          <Select
            label="Falloff"
            value={l.falloff}
            width={170}
            options={[
              { value: 'none', label: 'None' },
              { value: 'linear', label: 'Linear' },
              { value: 'squared', label: 'Squared (natural)' },
            ]}
            onChange={(v) => set({ falloff: v as LightParams['falloff'] })}
          />
        </div>
        <Slider label="Intensity" value={l.intensity} min={0} max={200} step={1} width={420} {...gesture} onChange={(v) => set({ intensity: v })} />
        {spot && <Slider label="Cone angle" value={l.coneAngle} min={5} max={170} step={1} unit="°" width={420} {...gesture} onChange={(v) => set({ coneAngle: v })} />}
        <Slider label={spot ? 'Edge softness' : 'Softness'} value={l.softness} min={0} max={1} precision={2} width={420} {...gesture} onChange={(v) => set({ softness: v })} />
        <div className="dlg-row">
          <Toggle label="Visible glow" value={l.visible} onChange={(v) => set({ visible: v })} hint="Render a glowing ball or disc where the light is" />
          <Toggle label="Cast shadows" value={l.castShadows} onChange={(v) => set({ castShadows: v })} />
        </div>
      </div>
    );
  }
  if (isTerrainLike(o.type)) {
    const n = o.terrain?.resolution ?? 0;
    return (
      <div className="dlg-section">
        <p>
          Height map: {n} × {n}
          {o.terrain?.recipe ? ` · ${o.terrain.recipe.generator} (seed ${o.terrain.recipe.seed})` : ' · hand-edited'}
        </p>
        <Button
          variant="primary"
          onClick={() => {
            useStore.getState().closeDialog();
            useStore.getState().openLab('terrain', o.id);
          }}
        >
          Open the Terrain Editor…
        </Button>
      </div>
    );
  }
  return null;
}

export function AttributesDialog() {
  const obj = useStore(selectPrimarySelection);
  const count = useStore((s) => s.selection.length);
  const initial = useRef<SceneObject | undefined>(obj);
  const [tab, setTab] = useState<Tab>('general');
  const close = () => useStore.getState().closeDialog();
  const cancel = () => {
    const start = initial.current;
    const now = start && useStore.getState().scene.objects.find((o) => o.id === start.id);
    if (start && now && now !== start) {
      const { id, ...rest } = start;
      useStore.getState().updateObject(id, rest);
    }
    close();
  };

  if (!obj) {
    return (
      <Dialog title="Object Attributes" onClose={close}>
        <p className="dlg-empty">Select an object in the Working window first, then open its attributes (Ctrl+Alt+E).</p>
      </Dialog>
    );
  }

  const update = (patch: Partial<SceneObject>) => useStore.getState().updateObject(obj.id, patch);
  const shapeLabel = shapeTabLabel(obj);
  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'transform', label: 'Transform' },
    ...(shapeLabel ? [{ id: 'shape', label: shapeLabel }] : []),
  ];
  const active: Tab = tab === 'shape' && !shapeLabel ? 'general' : tab;
  return (
    <Dialog title="Object Attributes" width={520} onClose={close} onCancel={cancel} onConfirm={close}>
      <div className="attr-head">
        <span className="attr-head__name">{obj.name}</span>
        {count > 1 && <span className="attr-head__more">+{count - 1} more selected (editing the last one)</span>}
      </div>
      <Tabs tabs={tabs} value={active} onChange={(id) => setTab(id as Tab)} className="dlg-tabs" />
      <div className="dlg-tabpanel" role="tabpanel">
        {active === 'general' && <GeneralTab o={obj} update={update} />}
        {active === 'transform' && <TransformTab o={obj} />}
        {active === 'shape' && <ShapeTab o={obj} update={update} />}
      </div>
    </Dialog>
  );
}
