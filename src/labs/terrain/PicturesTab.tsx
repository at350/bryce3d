/**
 * Pictures tab: build terrain from an image file, typed text or a procedural picture, blended
 * with the current terrain. Patterns stay in the recipe; images and text are hand edits.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Select, Slider, Toggle, useHint } from '@/ui/kit';
import { applyOpToTerrain, BLEND_MODES, blendHeights, getPattern, PATTERNS, renderPattern, withEditedHeights } from '@/terrain';
import { blurHeights } from '@/terrain/grid';
import { resolveParams, type Params } from '@/terrain/params';
import type { EditorContext } from './actions';
import { loadImageFile, rasterizeImage, rasterizeText, type PictureImage } from './pictureSources';
import { heightsToDataURL, patternThumb } from './thumbnails';

type Source =
  | { kind: 'image'; img: PictureImage; name: string }
  | { kind: 'text'; text: string }
  | { kind: 'pattern'; id: string; params: Params };

interface Props {
  ctx: EditorContext;
  /** A file dropped on the canvas, handed over by the editor. */
  incomingFile: File | null;
  onFileTaken(): void;
}

function PatternTile({ id, label, hint, active, onPick }: { id: string; label: string; hint: string; active: boolean; onPick(): void }) {
  return (
    <button type="button" className={`te-pattern ${active ? 'is-active' : ''}`} onClick={onPick} aria-label={label} {...useHint(`${label}: ${hint}`)}>
      <img src={patternThumb(id)} alt="" draggable={false} />
      <span>{label}</span>
    </button>
  );
}

export function PicturesTab({ ctx, incomingFile, onFileTaken }: Props) {
  const [source, setSource] = useState<Source | null>(null);
  const [mode, setMode] = useState(0);
  const [amount, setAmount] = useState(1);
  const [invert, setInvert] = useState(false);
  const [soften, setSoften] = useState(0);
  const [text, setText] = useState('BRYCE');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const terrain = ctx.ws.terrain;
  const n = terrain.resolution;
  const { preview } = ctx;

  const raw = useMemo(() => {
    if (!source) return null;
    try {
      if (source.kind === 'image') return rasterizeImage(source.img, n);
      if (source.kind === 'text') return rasterizeText(source.text, n);
      const def = getPattern(source.id);
      return def ? renderPattern(def, n, resolveParams(def.params, source.params)) : null;
    } catch (e) {
      console.warn('[terrain] picture failed', e);
      return null;
    }
  }, [source, n]);

  const picture = useMemo(() => {
    if (!raw) return null;
    let p = soften > 0 ? blurHeights(raw, n, Math.max(1, (soften / 100) * n), 2) : raw;
    if (invert) p = p.map((v) => 1 - v);
    return p;
  }, [raw, soften, invert, n]);

  const thumb = useMemo(() => (picture ? heightsToDataURL(picture, n, true) : ''), [picture, n]);

  useEffect(() => {
    if (!picture || amount <= 0) {
      preview.clear();
      return;
    }
    preview.show(blendHeights(terrain.heights, picture, mode, amount));
  }, [picture, mode, amount, terrain, preview]);

  useEffect(() => () => preview.clear(), [preview]);

  const load = async (file: File) => {
    setError('');
    try {
      const img = await loadImageFile(file);
      setSource({ kind: 'image', img, name: file.name });
    } catch {
      setError('That file could not be read as a picture.');
    }
  };

  useEffect(() => {
    if (!incomingFile) return;
    onFileTaken();
    void load(incomingFile);
  }, [incomingFile, onFileTaken]);

  const apply = () => {
    if (!picture || amount <= 0) return;
    const base = ctx.ws.current();
    if (source?.kind === 'pattern') {
      const def = getPattern(source.id)!;
      const params: Params = { pattern: def.code, mode, ...resolveParams(def.params, source.params) };
      if (amount < 1) params.amount = Math.round(amount * 1000) / 1000;
      if (invert) params.invert = 1;
      if (soften > 0) params.soften = soften;
      ctx.ws.commit(applyOpToTerrain(base, 'picture', params));
    } else {
      ctx.ws.commit(withEditedHeights(base, blendHeights(base.heights, picture, mode, amount)));
    }
    ctx.setLast(null);
    setSource(null);
  };

  const pattern = source?.kind === 'pattern' ? getPattern(source.id) : undefined;

  return (
    <div className="te-pictures">
      <div className="te-pictures__top">
        <div className={`te-well ${picture ? 'has-picture' : ''}`} {...useHint('The picture: bright = high, dark = low')}>
          {thumb ? <img src={thumb} alt="Picture" /> : <span>Load a picture, type a word or pick a shape</span>}
        </div>
        <div className="te-pictures__load">
          <Button onClick={() => fileRef.current?.click()} hint="Load a picture file from your computer (or drop one on the canvas)">
            Load Picture…
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (f) void load(f);
            }}
          />
          <div className="te-row">
            <input
              className="te-text-input"
              value={text}
              maxLength={24}
              onChange={(e) => setText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && text.trim()) setSource({ kind: 'text', text });
                e.stopPropagation();
              }}
              aria-label="Text to raise"
              {...useHint('Type a word to raise it out of the terrain')}
            />
            <Button onClick={() => text.trim() && setSource({ kind: 'text', text })} hint="Raise the word as terrain">
              Text
            </Button>
          </div>
          {source?.kind === 'image' && <p className="te-note">{source.name}</p>}
          {error && <p className="te-note te-note--error">{error}</p>}
        </div>
      </div>
      <div className="te-patterns">
        {PATTERNS.map((p) => (
          <PatternTile
            key={p.id}
            id={p.id}
            label={p.label}
            hint={p.hint}
            active={source?.kind === 'pattern' && source.id === p.id}
            onPick={() => setSource({ kind: 'pattern', id: p.id, params: {} })}
          />
        ))}
      </div>
      <div className="te-pictures__controls">
        <Select
          label="Blend"
          value={String(mode)}
          options={BLEND_MODES.map((b) => ({ value: String(b.code), label: b.label }))}
          onChange={(v) => setMode(Number(v))}
          hint={BLEND_MODES.find((b) => b.code === mode)?.hint ?? 'How the picture combines with the terrain'}
        />
        <Slider label="Amount" value={amount} min={0} max={1} step={0.01} precision={2} width={240} onChange={setAmount} hint="How strongly the picture is blended in" />
        <Slider label="Soften" value={soften} min={0} max={5} step={0.1} precision={1} width={240} onChange={setSoften} hint="Blur the picture so its edges become slopes" />
        <Toggle label="Invert picture" value={invert} onChange={setInvert} hint="Dark becomes high, bright becomes low" />
        {pattern &&
          source?.kind === 'pattern' &&
          pattern.params.map((s) => (
            <Slider
              key={s.key}
              label={s.label}
              value={source.params[s.key] ?? s.default}
              min={s.min}
              max={s.max}
              step={s.step ?? (s.max - s.min) / 200}
              precision={s.precision ?? 0}
              width={240}
              hint={s.hint ?? s.label}
              onChange={(v) => setSource({ ...source, params: { ...source.params, [s.key]: s.step === 1 ? Math.round(v) : v } })}
            />
          ))}
        <div className="te-row">
          <Button onClick={() => setSource(null)} disabled={!source} hint="Remove the picture">
            Clear
          </Button>
          <Button variant="primary" onClick={apply} disabled={!picture || amount <= 0} hint="Blend the picture into the terrain">
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
