/**
 * The Terrain Editor room: paint on the height canvas, watch the 3D preview, generate and
 * reshape with the Elevation / Filtering / Pictures tabs. Edits apply to a working copy with
 * its own undo; the check mark commits it to the object as one undo step, the X discards it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getObject, useStore } from '@/core/store';
import type { TerrainData } from '@/core/types';
import { Button, DragValue, IconButton, LabFrame, Select, Toggle } from '@/ui/kit';
import { createTerrainData, TERRAIN_RESOLUTIONS, withEditedHeights, type BrushSettings } from '@/terrain';
import { getGenerator } from '@/terrain/generators';
import { randomSeed, runOpAction, type EditorContext, type LastAction, type PreviewControl } from './actions';
import { AdjustPanel } from './AdjustPanel';
import { BrushPanel } from './BrushPanel';
import type { CanvasLook } from './canvasPaint';
import { ClipBracket } from './ClipBracket';
import { ElevationTab } from './ElevationTab';
import { FilteringTab } from './FilteringTab';
import { HeightBus } from './heightBus';
import { HeightCanvas } from './HeightCanvas';
import { PicturesTab } from './PicturesTab';
import { Preview3D } from './Preview3D';
import { getRamp, rampCss, rampLUT, RAMPS } from './ramps';
import { useSquareSize } from './useSquareSize';
import { useWorkspace } from './useWorkspace';
import './terrainEditor.css';

const TABS = [
  { id: 'elevation', label: 'Elevation' },
  { id: 'filtering', label: 'Filtering' },
  { id: 'pictures', label: 'Pictures' },
];

const CLIP_WIDTH = 56;

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

function recipeSummary(t: TerrainData): string {
  if (!t.recipe) return 'Hand-edited (no recipe)';
  const gen = getGenerator(t.recipe.generator)?.label ?? t.recipe.generator;
  const ops = t.recipe.ops.length;
  return `${gen}${ops ? ` + ${ops} step${ops > 1 ? 's' : ''}` : ''}`;
}

export function TerrainEditor() {
  const targetId = useStore((s) => s.ui.labTarget);
  const hint = useStore((s) => s.ui.hint);
  const [target] = useState(() => getObject(targetId));
  const [original] = useState<TerrainData>(() => target?.terrain ?? createTerrainData());
  const ws = useWorkspace(original);
  const terrain = ws.terrain;
  const n = terrain.resolution;

  const [tab, setTab] = useState('elevation');
  const [brush, setBrush] = useState<BrushSettings>({ mode: 'raise', size: 0.06, softness: 0.6, flow: 0.5, level: 0.5 });
  const [showBrush, setShowBrush] = useState(true);
  const [rampId, setRampId] = useState('gray');
  const [contours, setContours] = useState(false);
  const [relief, setRelief] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [last, setLast] = useState<LastAction | null>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [seedDraft, setSeedDraft] = useState<number | null>(null);
  const pickingRef = useRef(false);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const clipStart = useRef<TerrainData | null>(null);
  const { ref: fitRef, size } = useSquareSize<HTMLDivElement>(CLIP_WIDTH);

  // The heights on screen: the terrain, or a tab's live preview of an effect.
  const [bus] = useState(() => new HeightBus(original.heights, original.resolution));
  const previewRef = useRef<Float32Array | null>(null);
  const { current } = ws;
  const preview = useMemo<PreviewControl>(
    () => ({
      show(h) {
        previewRef.current = h;
        bus.set(h, current().resolution);
      },
      clear() {
        if (!previewRef.current) return;
        previewRef.current = null;
        const t = current();
        bus.set(t.heights, t.resolution);
      },
    }),
    [bus, current],
  );
  useEffect(() => {
    if (!previewRef.current) bus.set(terrain.heights, terrain.resolution);
  }, [terrain, bus]);

  const ctx = useMemo<EditorContext>(() => ({ ws, preview, last, setLast }), [ws, preview, last]);

  // Dev-only automation handle (scripts read the working terrain without committing it).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __terrainEditor?: { current(): TerrainData } };
    w.__terrainEditor = { current };
    return () => {
      delete w.__terrainEditor;
    };
  }, [current]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  // --- display ---------------------------------------------------------------
  const ramp = getRamp(rampId);
  const lut = useMemo(() => rampLUT(ramp), [ramp]);
  const lut3d = useMemo(() => (rampId === 'gray' ? rampLUT(getRamp('earth')) : lut), [rampId, lut]);
  const barCss = useMemo(() => rampCss(ramp), [ramp]);
  const clipLow = terrain.clipLow ?? 0;
  const clipHigh = terrain.clipHigh ?? 1;
  const look = useMemo<CanvasLook>(
    () => ({ lut, contours, relief, clipLow, clipHigh, contourColor: rampId === 'gray' ? [64, 200, 220] : [18, 18, 26] }),
    [lut, contours, relief, clipLow, clipHigh, rampId],
  );
  const scale = target?.transform.scale;
  const aspect = scale ? Math.min(2, Math.max(0.04, scale[1] / Math.max(1e-6, (scale[0] + scale[2]) / 2))) : 0.28;
  const mirror = target?.type === 'lattice';

  // --- painting --------------------------------------------------------------
  const onStrokeStart = useCallback(() => {
    if (ws.isBusy()) {
      useStore.getState().setHint('Busy: wait for the current effect to finish');
      return null;
    }
    return ws.current().heights.slice();
  }, [ws]);
  const onStrokeEnd = useCallback(
    (buf: Float32Array) => {
      ws.commit(withEditedHeights(ws.current(), buf));
      setLast(null);
    },
    [ws],
  );
  const onPick = useCallback((level: number) => {
    setBrush((b) => ({ ...b, level, mode: 'plateau' }));
    useStore.getState().setHint(`Picked height ${(level * 100).toFixed(1)}%: Plateau brush`);
  }, []);

  // --- grid, seed, clipping -------------------------------------------------------
  const changeResolution = (res: number) => {
    ws.enqueue(`Building ${res} × ${res}`, async (compute) => {
      const base = ws.current();
      if (base.resolution === res) return;
      if (base.recipe) {
        const recipe = { ...base.recipe, resolution: res };
        const h = await compute({ kind: 'recipe', recipe });
        if (h) ws.commit({ ...base, resolution: res, heights: h, recipe });
      } else {
        const h = await compute({ kind: 'resample', heights: base.heights, from: base.resolution, to: res });
        if (h) ws.commit({ ...base, resolution: res, heights: h });
      }
      setLast(null);
    });
  };

  const reseed = (seed: number) => {
    ws.enqueue(
      'Reseeding',
      async (compute) => {
        const base = ws.current();
        if (!base.recipe || base.recipe.seed === seed) return;
        const recipe = { ...base.recipe, seed };
        const h = await compute({ kind: 'recipe', recipe });
        if (!h) return;
        ws.commit({ ...base, heights: h, recipe });
        setLast(null);
        setSeedDraft(null);
      },
      'seed',
    );
  };

  const clip = {
    start: () => {
      clipStart.current = ws.current();
    },
    change: (lo: number, hi: number) => ws.replace({ ...ws.current(), clipLow: lo, clipHigh: hi }),
    end: () => {
      if (clipStart.current) ws.commit(ws.current(), clipStart.current);
      clipStart.current = null;
    },
  };

  // --- keyboard --------------------------------------------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const c = ctxRef.current;
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) c.ws.redo();
        else c.ws.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        c.ws.redo();
      } else if (mod && k === 'i') {
        e.preventDefault();
        runOpAction(c, 'invert');
      } else if (!mod && e.key === '[') {
        setBrush((b) => ({ ...b, size: Math.max(0.005, b.size / 1.2) }));
      } else if (!mod && e.key === ']') {
        setBrush((b) => ({ ...b, size: Math.min(0.4, b.size * 1.2) }));
      } else if (e.key === ' ') {
        e.preventDefault();
        pickingRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') pickingRef.current = false;
    };
    const blur = () => {
      pickingRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // --- confirm / cancel --------------------------------------------------------
  const close = useCallback(() => useStore.getState().closeLab(), []);
  const confirm = useCallback(() => {
    const t = ws.current();
    const s = useStore.getState();
    if (targetId && getObject(targetId)) {
      if (t !== original) s.updateObject(targetId, { terrain: t });
    } else if (!targetId) {
      s.createObject('terrain', { terrain: t });
    }
    s.closeLab();
  }, [ws, targetId, original]);

  const resOptions = useMemo(() => {
    const list: number[] = [...TERRAIN_RESOLUTIONS];
    if (!list.includes(n)) list.unshift(n);
    return list.map((r) => ({ value: String(r), label: `${r} × ${r}` }));
  }, [n]);

  const seed = terrain.recipe?.seed;
  const headerExtra = (
    <div className="te-header">
      <Select label="Grid" value={String(n)} options={resOptions} onChange={(v) => changeResolution(Number(v))} hint="Grid resolution: more detail at higher sizes (slower renders)" />
      {seed !== undefined ? (
        <span className="te-header__seed">
          <DragValue
            label="Seed"
            value={seedDraft ?? seed}
            min={1}
            max={999999}
            step={1}
            width={112}
            hint="Seed: drag or double-click to type; rebuilds the terrain with its recipe"
            onChange={(v) => setSeedDraft(Math.round(v))}
            onEnd={() => seedDraft !== null && reseed(seedDraft)}
          />
          <Button variant="ghost" hint="Same recipe, new random seed" onClick={() => reseed(randomSeed())}>
            🎲
          </Button>
        </span>
      ) : (
        <span className="te-header__handmade" title="Painted or picture-based terrains have no recipe">
          Hand-edited
        </span>
      )}
      <IconButton hint="Undo (Ctrl+Z)" onClick={ws.undo} disabled={!ws.canUndo} size={30}>
        ↶
      </IconButton>
      <IconButton hint="Redo (Shift+Ctrl+Z)" onClick={ws.redo} disabled={!ws.canRedo} size={30}>
        ↷
      </IconButton>
    </div>
  );

  const showAdjust = tab === 'elevation' && last && last.result === terrain;

  return (
    <LabFrame title="Terrain Editor" tabs={TABS} tab={tab} onTab={setTab} headerExtra={headerExtra} onConfirm={confirm} onCancel={close} className="te-lab">
      <div className="te-room">
        <BrushPanel brush={brush} onChange={setBrush} showBrush={showBrush} onShowBrush={setShowBrush} rampCss={barCss} />
        <section className="te-stage">
          <div className="te-canvasbar">
            <Select label="Colors" value={rampId} options={RAMPS.map((r) => ({ value: r.id, label: r.label }))} onChange={setRampId} hint="Color map for the canvas (a visual aid only)" />
            <Toggle label="Contours" value={contours} onChange={setContours} hint="Contour lines every 5% of height" />
            <Toggle label="Relief" value={relief} onChange={setRelief} hint="Shade the canvas like a relief map" />
            <span className="te-canvasbar__info">{n} × {n}</span>
          </div>
          <div className="te-stage__fit" ref={fitRef}>
            <div className="te-stage__square" style={{ height: size }}>
              <div className="te-stage__canvas" style={{ width: size, height: size }}>
                <HeightCanvas
                  bus={bus}
                  look={look}
                  brush={brush}
                  showBrush={showBrush}
                  pickingRef={pickingRef}
                  onStrokeStart={onStrokeStart}
                  onStrokeEnd={onStrokeEnd}
                  onPick={onPick}
                  readoutRef={readoutRef}
                  onDropFile={(f) => {
                    setDroppedFile(f);
                    setTab('pictures');
                  }}
                >
                  {ws.busy && (
                    <div className="te-busy" role="status">
                      <span className="te-busy__spinner" aria-hidden />
                      <span>{ws.busy.label}…</span>
                      {ws.busy.progress !== null && (
                        <span className="te-busy__bar">
                          <span style={{ width: `${Math.round(ws.busy.progress * 100)}%` }} />
                        </span>
                      )}
                    </div>
                  )}
                </HeightCanvas>
              </div>
              <ClipBracket low={clipLow} high={clipHigh} rampCss={barCss} onChange={clip.change} onStart={clip.start} onEnd={clip.end} />
            </div>
          </div>
        </section>
        <section className="te-side">
          <div className="te-side__preview">
            <Preview3D bus={bus} clipLow={clipLow} clipHigh={clipHigh} lut={lut3d} aspect={aspect} mirror={mirror} autoRotate={autoRotate} />
            <div className="te-side__previewbar">
              <Toggle label="Auto-rotate" value={autoRotate} onChange={setAutoRotate} hint="Spin the preview when idle" />
              <span className="te-side__recipe">{recipeSummary(terrain)}</span>
            </div>
          </div>
          <div className="te-side__tools">
            <div className="te-side__scroll">
              {tab === 'elevation' && <ElevationTab ctx={ctx} />}
              {tab === 'filtering' && <FilteringTab ctx={ctx} rampCss={barCss} />}
              {tab === 'pictures' && <PicturesTab ctx={ctx} incomingFile={droppedFile} onFileTaken={() => setDroppedFile(null)} />}
            </div>
            {showAdjust && last && <AdjustPanel key={last.serial} ctx={ctx} last={last} onClose={() => setLast(null)} />}
          </div>
        </section>
        <footer className="te-status">
          <span className="te-status__hint">{hint || 'Paint on the canvas, or pick a generator. Drag a tool button to the right to apply it gradually.'}</span>
          <span className="te-status__readout" ref={readoutRef} />
        </footer>
      </div>
    </LabFrame>
  );
}
