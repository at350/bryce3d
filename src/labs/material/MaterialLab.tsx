/**
 * The Materials Lab room. Edits a working copy of the target object's material:
 * ✓ applies it to every selected object (or the lab target), ✗ discards it.
 *
 * Layout (Bryce 4/5): preview and altitude blend on the left, the channel grid in the
 * middle, the A / B / C texture component editors on the right, presets along the bottom.
 */
import { useCallback, useEffect, useState } from 'react';
import { cloneMaterial, defaultMaterial } from '@/core/materialUtils';
import { hasMaterial, isInfinitePlane, isTerrainLike } from '@/core/objects';
import { getObject, useStore } from '@/core/store';
import type { Material, ObjectType } from '@/core/types';
import { setMode } from '@/materials/edit';
import type { PreviewShape } from '@/materials/previewScene';
import { randomMaterial } from '@/materials/random';
import { LabFrame } from '@/ui/kit';
import { AltitudePanel } from './AltitudePanel';
import { ChannelGrid } from './ChannelGrid';
import { ComponentStack } from './ComponentStack';
import { LabHeader } from './LabHeader';
import { LabToolbar } from './LabToolbar';
import { PresetDrawer } from './PresetDrawer';
import { PreviewPanel } from './PreviewPanel';
import { useMaterialHistory } from './useMaterialHistory';
import './materialLab.css';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

function initialShape(type: ObjectType | undefined): PreviewShape {
  if (!type) return 'sphere';
  if (type === 'cube') return 'cube';
  if (isInfinitePlane(type) && type !== 'cloud') return 'plane';
  if (isTerrainLike(type)) return 'plane';
  return 'sphere';
}

/** Objects the ✓ applies to: the selection (materials only), else the lab target. */
function applyTargets(): string[] {
  const s = useStore.getState();
  const targetId = s.ui.labTarget;
  const ids = s.selection.length ? s.selection : targetId ? [targetId] : [];
  return ids.filter((id) => {
    const o = s.scene.objects.find((obj) => obj.id === id);
    return !!o && hasMaterial(o.type);
  });
}

export function MaterialLab() {
  const targetId = useStore((s) => s.ui.labTarget);
  const [target] = useState(() => getObject(targetId));
  const history = useMaterialHistory(() => cloneMaterial(target?.material ?? defaultMaterial()));
  const { material, update, undo, redo } = history;
  const [shape, setShape] = useState<PreviewShape>(() => initialShape(target?.type));
  const [selected, setSelected] = useState(0);
  const [presetId, setPresetId] = useState<string | null>(null);

  const close = useCallback(() => useStore.getState().closeLab(), []);
  const confirm = useCallback(() => {
    const s = useStore.getState();
    const ids = applyTargets();
    if (ids.length) {
      s.setMaterial(ids, cloneMaterial(material));
      s.showStatus(ids.length === 1 ? `Applied ${material.name}` : `Applied ${material.name} to ${ids.length} objects`);
    }
    s.closeLab();
  }, [material]);

  const load = useCallback(
    (m: Material, kind: string) => {
      update(() => cloneMaterial(m), kind);
      setSelected(0);
    },
    [update],
  );

  // Lab-local undo / redo (global shortcuts are suspended while a lab is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || isTyping(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const count = applyTargets().length;
  const editor = history;

  return (
    <LabFrame
      title="Materials Lab"
      onConfirm={confirm}
      onCancel={close}
      className="ml-lab"
      headerExtra={
        <LabHeader
          material={material}
          targetName={target?.name ?? null}
          applyCount={count}
          onMode={(mode) => update((cur) => setMode(cur, mode), 'mode')}
          onName={(name) => update((cur) => ({ ...cur, name }), 'name')}
          history={history}
        />
      }
    >
      <div className="ml-root">
        <section className="ml-col ml-col--left" aria-label="Preview">
          <div className="ml-panel">
            <PreviewPanel material={material} shape={shape} onShape={setShape} />
            <LabToolbar
              material={material}
              onRandom={() => {
                load(randomMaterial(), 'random');
                setPresetId(null);
              }}
              onPaste={(m) => {
                load(m, 'paste');
                setPresetId(null);
              }}
              onRevert={() => {
                load(target?.material ?? defaultMaterial(), 'revert');
                setPresetId(null);
              }}
            />
          </div>
          <div className="ml-panel">
            <AltitudePanel editor={editor} />
          </div>
        </section>
        <section className="ml-col ml-col--grid ml-panel ml-panel--dark" aria-label="Material channels">
          <ChannelGrid editor={editor} selected={selected} onSelect={setSelected} />
        </section>
        <section className="ml-col ml-col--comps ml-panel ml-panel--dark" aria-label="Texture components">
          <ComponentStack editor={editor} selected={selected} onSelect={setSelected} />
        </section>
        <section className="ml-col--drawer ml-panel" aria-label="Material presets">
          <PresetDrawer
            activeId={presetId}
            onPick={(p) => {
              load(p.material, 'preset');
              setPresetId(p.id);
            }}
          />
        </section>
      </div>
    </LabFrame>
  );
}
