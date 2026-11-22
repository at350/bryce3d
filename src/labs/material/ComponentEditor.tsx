/** Editor for one texture component (A, B or C): pattern, mapping, noise shaping, gradient. */
import { randomSeed } from '@/core/math';
import type { MaterialChannel, TextureComponent, TextureMapping, TextureType } from '@/core/types';
import {
  COMPONENT_LETTERS,
  TEXTURE_MAPPINGS,
  TEXTURE_MAPPING_HINTS,
  TEXTURE_MAPPING_LABELS,
  TEXTURE_TYPES,
  TEXTURE_TYPE_HINTS,
  TEXTURE_TYPE_LABELS,
} from '@/materials/channels';
import { addStop, channelsDrivenBy, removeComponent, removeStop, reverseGradient, setStopColor, setStopPosition, updateComponent } from '@/materials/edit';
import { DragValue, Icon3D, IconButton, Select, useHint } from '@/ui/kit';
import { GradientEditor } from './GradientEditor';
import type { LabEditor } from './labTypes';
import { ScaleDrag } from './ScaleDrag';
import { TextureSwatch } from './TextureSwatch';

const CHANNEL_NAMES: Record<MaterialChannel, string> = {
  diffuseColor: 'Diffuse',
  ambientColor: 'Ambient',
  specularColor: 'Specular',
  transparentColor: 'Transparent',
  diffusion: 'Diffusion',
  ambience: 'Ambience',
  specularity: 'Specularity',
  reflection: 'Reflection',
  transparency: 'Transparency',
  bumpHeight: 'Bump',
};

const TYPE_OPTIONS = TEXTURE_TYPES.map((t) => ({ value: t, label: TEXTURE_TYPE_LABELS[t] }));
const MAPPING_OPTIONS = TEXTURE_MAPPINGS.map((m) => ({ value: m, label: TEXTURE_MAPPING_LABELS[m] }));

export interface ComponentEditorProps {
  editor: LabEditor;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

export function ComponentEditor({ editor, index, selected, onSelect }: ComponentEditorProps) {
  const m = editor.material;
  const c = m.components[index];
  const letter = COMPONENT_LETTERS[index];
  const drives = channelsDrivenBy(m, index).map((ch) => (m.mode === 'volume' && ch === 'transparency' ? 'Density' : CHANNEL_NAMES[ch]));
  const set = (patch: Partial<TextureComponent>, kind: string) => editor.update((cur) => updateComponent(cur, index, patch), `comp${index}:${kind}`);
  const num = (key: 'octaves' | 'roughness' | 'warp' | 'contrast' | 'bias' | 'bump' | 'seed') => (v: number) => set({ [key]: v }, key);
  const common = { onStart: editor.begin, onEnd: editor.end, width: 96 };
  const headHint = useHint(`Component ${letter}${drives.length ? `: drives ${drives.join(', ')}` : ': not driving any channel yet (use the grid balls)'}`);
  if (!c) return null;
  return (
    <section className={`ml-comp ${selected ? 'is-selected' : ''}`} onPointerDownCapture={onSelect} aria-label={`Texture component ${letter}`}>
      <header className="ml-comp__head">
        <span className="ml-comp__letter" {...headHint}>
          {letter}
        </span>
        <Select value={c.type} options={TYPE_OPTIONS} onChange={(v) => set({ type: v as TextureType }, 'type')} hint={TEXTURE_TYPE_HINTS[c.type]} width={118} />
        <Select value={c.mapping} options={MAPPING_OPTIONS} onChange={(v) => set({ mapping: v as TextureMapping }, 'mapping')} hint={TEXTURE_MAPPING_HINTS[c.mapping]} width={112} />
        <span className="ml-comp__spacer" />
        <IconButton hint={`New random seed for component ${letter}`} size={24} className="ml-glyph" onClick={() => set({ seed: randomSeed() % 100000 }, 'seed')}>
          <Icon3D kind="dice" size={18} />
        </IconButton>
        <IconButton hint={`Remove component ${letter} (its channels return to fixed values)`} size={24} className="ml-glyph" onClick={() => editor.update((cur) => removeComponent(cur, index), 'remove')}>
          ✕
        </IconButton>
      </header>
      <div className="ml-comp__body">
        <TextureSwatch component={c} letter={letter} />
        <div className="ml-comp__params">
          <ScaleDrag value={c.scale} onChange={(v) => set({ scale: v }, 'scale')} onStart={editor.begin} onEnd={editor.end} hint={`Component ${letter} feature size`} />
          <DragValue label="Octaves" value={c.octaves} min={1} max={10} step={1} onChange={num('octaves')} hint="Octaves: layers of finer detail" {...common} />
          <DragValue label="Rough" value={c.roughness} min={0} max={1} precision={2} onChange={num('roughness')} hint="Roughness: strength of the finer octaves" {...common} />
          <DragValue label="Warp" value={c.warp} min={0} max={1} precision={2} onChange={num('warp')} hint="Warp: swirls the pattern" {...common} />
          <DragValue label="Contrast" value={c.contrast} min={0} max={1} precision={2} onChange={num('contrast')} hint="Contrast: 0.5 is neutral" {...common} />
          <DragValue label="Bias" value={c.bias} min={-1} max={1} precision={2} onChange={num('bias')} hint="Bias: shifts the values lighter or darker" {...common} />
          <DragValue label="Bump" value={c.bump} min={-1} max={1} precision={2} onChange={num('bump')} hint="Bump: strength and direction of this component's bumps" {...common} />
          <DragValue label="Seed" value={c.seed} min={0} max={99999} step={1} onChange={num('seed')} hint="Seed: picks a different but similar pattern" {...common} />
        </div>
      </div>
      <GradientEditor
        gradient={c.gradient}
        letter={letter}
        onPosition={(si, at) => editor.update((cur) => setStopPosition(cur, index, si, at), `comp${index}:stop${si}`)}
        onColor={(si, color) => editor.update((cur) => setStopColor(cur, index, si, color), `comp${index}:color${si}`)}
        onAdd={() => editor.update((cur) => addStop(cur, index), 'addStop')}
        onRemove={(si) => editor.update((cur) => removeStop(cur, index, si), 'removeStop')}
        onReverse={() => editor.update((cur) => reverseGradient(cur, index), 'reverse')}
        onStart={editor.begin}
        onEnd={editor.end}
      />
      <footer className="ml-comp__drives">{drives.length ? `Drives ${drives.join(' · ')}` : 'Not driving any channel: click a ball in the grid'}</footer>
    </section>
  );
}
