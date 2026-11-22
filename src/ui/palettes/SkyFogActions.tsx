/** Sky Lab button, randomize dice, sky memory dots and the Sky & Fog options menu. */
import { useCallback } from 'react';
import { randomSeed } from '@/core/math';
import { useStore } from '@/core/store';
import type { Sky } from '@/core/types';
import { PaintCanvas, type PaintFn } from '@/sky/components/PaintCanvas';
import { defaultSky } from '@/sky/defaults';
import { paintSkyLabGlyph } from '@/sky/paint/textures';
import { RANDOM_SKY_KINDS, randomSky, type RandomSkyKind } from '@/sky/random';
import { SKY_MODES, SKY_MODE_LABELS } from '@/sky/ranges';
import { Icon3D, IconButton, MemoryDots, TriangleMenu, type MenuItem } from '@/ui/kit';
import { currentSky, patchSky, type SkyFogMetrics } from './SkyFogLayout';
import { swapDayNight, toggleSunLink } from './SkyFogSun';

export function rollRandomSky(kind?: RandomSkyKind): void {
  const seed = randomSeed();
  const s = useStore.getState();
  s.setSky(randomSky(seed, kind));
  const mood = kind ? `${(RANDOM_SKY_KINDS.find((k) => k.id === kind)?.label ?? kind).toLowerCase()} ` : '';
  s.showStatus(`Random ${mood}sky #${seed}`);
}

function toggleLayer(key: 'stratus' | 'cumulus') {
  const layer = currentSky()[key];
  patchSky({ [key]: { ...layer, enabled: !layer.enabled } });
}

function optionsMenu(sky: Sky): MenuItem[] {
  const s = useStore.getState();
  return [
    { label: 'Skies Library…', onSelect: () => s.openLibrary('skies') },
    { label: 'Sky Lab…', onSelect: () => s.openLab('sky') },
    { label: '', divider: true },
    {
      label: 'Sky Mode',
      submenu: SKY_MODES.map((mode) => ({ label: SKY_MODE_LABELS[mode], checked: sky.mode === mode, onSelect: () => patchSky({ mode }) })),
    },
    { label: 'Stratus Clouds', checked: sky.stratus.enabled, onSelect: () => toggleLayer('stratus') },
    { label: 'Cumulus Clouds', checked: sky.cumulus.enabled, onSelect: () => toggleLayer('cumulus') },
    { label: 'Rainbow', checked: sky.rainbow, onSelect: () => patchSky({ rainbow: !currentSky().rainbow }) },
    { label: 'Link Sun to View', checked: sky.linkSunToView, onSelect: toggleSunLink },
    { label: sky.sunAltitude < 0 ? 'Switch to Day' : 'Switch to Night', onSelect: swapDayNight },
    { label: '', divider: true },
    {
      label: 'Randomize',
      submenu: [{ label: 'Any Sky', onSelect: () => rollRandomSky() }, ...RANDOM_SKY_KINDS.map((k) => ({ label: k.label, onSelect: () => rollRandomSky(k.id) }))],
    },
    { label: 'Reset to Default Sky', onSelect: () => s.setSky(defaultSky()) },
  ];
}

export function SkyFogActions({ sky, m }: { sky: Sky; m: SkyFogMetrics }) {
  const memories = useStore((s) => s.ui.skyMemories);
  const big = m.tier === 'compact' ? 30 : 34;
  const glyph = useCallback<PaintFn>((ctx, w) => paintSkyLabGlyph(ctx, w), []);
  const s = useStore.getState();
  return (
    <div className="skyfog__cell skyfog__cell--actions">
      <div className="skyfog__actionrow">
        <IconButton hint="Sky Lab: fine-tune sun, moon, clouds and atmosphere" size={big} onClick={() => s.openLab('sky')}>
          <PaintCanvas width={big - 6} height={big - 6} paint={glyph} />
        </IconButton>
        <IconButton hint="Randomize sky (roll the dice again for another)" size={big} onClick={() => rollRandomSky()}>
          <Icon3D kind="dice" size={big - 6} />
        </IconButton>
        <TriangleMenu hint="Sky & Fog options and the Skies Library" items={optionsMenu(sky)} className="skyfog__options" />
      </div>
      <MemoryDots
        count={memories.length}
        direction="horizontal"
        hint="Sky memory"
        filled={memories.map(Boolean)}
        onSave={(i) => {
          const list = [...useStore.getState().ui.skyMemories];
          list[i] = currentSky();
          s.setUI({ skyMemories: list });
          s.showStatus(`Sky stored in memory ${i + 1}`);
        }}
        onRecall={(i) => {
          const mem = useStore.getState().ui.skyMemories[i];
          if (!mem) return;
          s.setSky(mem);
          s.showStatus(`Sky memory ${i + 1} recalled`);
        }}
        onClear={(i) => {
          const list = [...useStore.getState().ui.skyMemories];
          list[i] = null;
          s.setUI({ skyMemories: list });
        }}
      />
    </div>
  );
}
