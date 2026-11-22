/**
 * The Sky Lab room: fine-tune the sky on a working copy (✓ applies it to the scene as one
 * undo step, ✗ discards it). Tabs Sun & Moon, Cloud Cover and Atmosphere on the left; a
 * large live preview and the preset drawer on the right. Ctrl/Cmd+Z undoes inside the lab.
 */
import { useEffect, useState } from 'react';
import { randomSeed } from '@/core/math';
import { useStore } from '@/core/store';
import { RANDOM_SKY_KINDS, randomSky, type RandomSkyKind } from '@/sky/random';
import { cloneSky } from '@/sky/sanitize';
import { Button, Icon3D, IconButton, LabFrame, MemoryDots, TriangleMenu, isEditableTarget } from '@/ui/kit';
import { AtmosphereTab } from './AtmosphereTab';
import { CloudCoverTab } from './CloudCoverTab';
import { SkyLabPreview, type PreviewTarget } from './SkyLabPreview';
import { SkyPresetDrawer } from './SkyPresetDrawer';
import { SunMoonTab } from './SunMoonTab';
import { useWorkingSky, type WorkingSky } from './useWorkingSky';
import './SkyLab.css';

type TabId = 'sun' | 'clouds' | 'atmosphere';

const TABS: { id: TabId; label: string }[] = [
  { id: 'sun', label: 'Sun & Moon' },
  { id: 'clouds', label: 'Cloud Cover' },
  { id: 'atmosphere', label: 'Atmosphere' },
];

function HeaderTools({ work, original }: { work: WorkingSky; original: () => void }) {
  const memories = useStore((s) => s.ui.skyMemories);
  const roll = (kind?: RandomSkyKind) => {
    const seed = randomSeed();
    work.replace(randomSky(seed, kind));
    useStore.getState().setHint(`Random sky #${seed}`);
  };
  return (
    <div className="skylab__tools">
      <Button variant="ghost" hint="Undo (Ctrl/Cmd+Z)" disabled={!work.canUndo} onClick={work.undo}>
        Undo
      </Button>
      <Button variant="ghost" hint="Redo (Shift+Ctrl/Cmd+Z)" disabled={!work.canRedo} onClick={work.redo}>
        Redo
      </Button>
      <Button variant="ghost" hint="Revert to the scene's sky" onClick={original}>
        Revert
      </Button>
      <span className="skylab__toolsep" />
      <IconButton hint="Randomize the sky" size={30} onClick={() => roll()}>
        <Icon3D kind="dice" size={24} />
      </IconButton>
      <TriangleMenu hint="Randomize a particular kind of sky" items={RANDOM_SKY_KINDS.map((k) => ({ label: k.label, onSelect: () => roll(k.id) }))} />
      <span className="skylab__toolsep" />
      <MemoryDots
        count={memories.length}
        direction="horizontal"
        hint="Sky memory"
        filled={memories.map(Boolean)}
        onSave={(i) => {
          const list = [...useStore.getState().ui.skyMemories];
          list[i] = work.current();
          useStore.getState().setUI({ skyMemories: list });
        }}
        onRecall={(i) => {
          const mem = useStore.getState().ui.skyMemories[i];
          if (mem) work.replace(cloneSky(mem));
        }}
        onClear={(i) => {
          const list = [...useStore.getState().ui.skyMemories];
          list[i] = null;
          useStore.getState().setUI({ skyMemories: list });
        }}
      />
    </div>
  );
}

function HintLine() {
  const hint = useStore((s) => s.ui.hint);
  return <div className="skylab__hint">{hint || 'Drag the preview to look around · ✓ keeps your sky, ✗ (Esc) leaves it as it was'}</div>;
}

export function SkyLab() {
  const [initial] = useState(() => useStore.getState().scene.sky);
  const work = useWorkingSky(initial);
  const [tab, setTab] = useState<TabId>('sun');
  const [target, setTarget] = useState<PreviewTarget>('sky');
  const { undo, redo } = work;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || isEditableTarget(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const cancel = () => useStore.getState().closeLab();
  const confirm = () => {
    const s = useStore.getState();
    const sky = work.current();
    if (sky !== initial) {
      s.setSky(sky);
      s.showStatus('Sky updated');
    }
    s.closeLab();
  };
  const tabProps = { sky: work.sky, update: work.update, current: work.current };

  return (
    <LabFrame
      title="Sky Lab"
      className="skylab"
      tabs={TABS}
      tab={tab}
      onTab={(id) => setTab(id as TabId)}
      onConfirm={confirm}
      onCancel={cancel}
      headerExtra={<HeaderTools work={work} original={() => work.replace(initial)} />}
    >
      <div className="skylab__body">
        <div className="skylab__left" role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
          {tab === 'sun' && <SunMoonTab {...tabProps} />}
          {tab === 'clouds' && <CloudCoverTab {...tabProps} />}
          {tab === 'atmosphere' && <AtmosphereTab {...tabProps} />}
        </div>
        <div className="skylab__right">
          <SkyLabPreview sky={work.sky} target={target} onTarget={setTarget} />
          <SkyPresetDrawer sky={work.sky} onPick={(p) => work.replace(cloneSky(p.sky))} />
        </div>
        <HintLine />
      </div>
    </LabFrame>
  );
}
