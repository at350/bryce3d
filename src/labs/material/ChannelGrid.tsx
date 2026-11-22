/**
 * The Bryce material grid: one row per channel with its fixed value (color oval or LED
 * bar) and the A / B / C component indicators that hand the channel to a texture.
 */
import type { Material, TextureComponent } from '@/core/types';
import { COMPONENT_LETTERS } from '@/materials/channels';
import { driverOf, toggleDriver } from '@/materials/edit';
import { ColorSwatch, useHint } from '@/ui/kit';
import { ChannelBar } from './ChannelBar';
import { DRIVEN_DEFAULTS, rowGroups, rowValue, type ColorRow, type GridRow, type ValueRow } from './channelRows';
import { DriverBalls } from './DriverBalls';
import { gradientCss, type LabEditor } from './labTypes';
import { newComponentFor } from './newComponent';

export function ChannelGrid({ editor, selected, onSelect }: { editor: LabEditor; selected: number; onSelect: (i: number) => void }) {
  const m = editor.material;
  return (
    <div className="ml-grid" role="grid" aria-label="Material channels">
      <div className="ml-grid__head">
        <span className="ml-grid__mode">{m.mode === 'volume' ? 'Volume' : 'Surface'}</span>
        <div className="ml-grid__letters">
          {COMPONENT_LETTERS.map((letter, i) => (
            <ColumnHead key={letter} letter={letter} component={m.components[i]} selected={selected === i} onSelect={() => onSelect(i)} />
          ))}
        </div>
      </div>
      {rowGroups(m.mode).map((group) => (
        <div key={group.title} className="ml-grid__group">
          <div className="ml-grid__title">{group.title}</div>
          {group.rows.map((row) => (
            <Row key={row.key} row={row} editor={editor} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ColumnHead({ letter, component, selected, onSelect }: { letter: string; component?: TextureComponent; selected: boolean; onSelect: () => void }) {
  const hint = component ? `Component ${letter}: edit it on the right` : `Component ${letter} is empty: click a ${letter} ball to create it`;
  return (
    <button type="button" className={`ml-colhead ${selected && component ? 'is-selected' : ''}`} onClick={onSelect} disabled={!component} aria-label={hint} {...useHint(hint)}>
      <span className="ml-colhead__chip" style={component ? { background: gradientCss(component) } : undefined} />
      <span className="ml-colhead__letter">{letter}</span>
    </button>
  );
}

function Row({ row, editor, onSelect }: { row: GridRow; editor: LabEditor; onSelect: (i: number) => void }) {
  const m = editor.material;
  const active = row.driver ? driverOf(m, row.driver) : -1;
  const pick = (i: 0 | 1 | 2) => {
    const channel = row.driver;
    if (!channel) return;
    editor.update((cur) => {
      let next = toggleDriver(cur, channel, i, (idx) => newComponentFor(cur, channel, idx));
      if (driverOf(next, channel) === i && row.kind === 'value') next = ensureVisible(next, row);
      return next;
    });
    onSelect(i);
  };
  return (
    <div className={`ml-row ${active >= 0 ? 'is-driven' : ''}`} role="row">
      <span className="ml-row__label">{row.label}</span>
      <div className="ml-row__control">
        {row.kind === 'color' ? <ColorControl row={row} editor={editor} active={active} onSelect={onSelect} /> : <ValueControl row={row} editor={editor} active={active} />}
      </div>
      <DriverBalls channelLabel={row.label} active={active} enabled={row.driver !== null} componentCount={m.components.length} onPick={pick} />
    </div>
  );
}

/** A texture times zero shows nothing: give a freshly driven channel a usable strength. */
function ensureVisible(m: Material, row: ValueRow): Material {
  let next = m;
  const fallback = DRIVEN_DEFAULTS[row.key];
  if (fallback !== undefined && rowValue(next, row.key) === 0) next = { ...next, [row.key]: fallback };
  // Volume density is shaped through the driven transparency channel.
  if (row.key === 'volumeDensity' && next.transparency === 0) next = { ...next, transparency: 100 };
  return next;
}

function ColorControl({ row, editor, active, onSelect }: { row: ColorRow; editor: LabEditor; active: number; onSelect: (i: number) => void }) {
  const m = editor.material;
  const comp = active >= 0 ? m.components[active] : undefined;
  const hint = comp ? `${row.label} comes from component ${COMPONENT_LETTERS[active]}'s gradient` : row.hint;
  const hintHandlers = useHint(hint);
  if (comp) {
    return (
      <button type="button" className="ml-texchip" style={{ background: gradientCss(comp) }} onClick={() => onSelect(active)} aria-label={hint} {...hintHandlers}>
        <span>{COMPONENT_LETTERS[active]}</span>
      </button>
    );
  }
  return (
    <ColorSwatch
      value={m[row.key]}
      onChange={(c) => editor.update((cur) => ({ ...cur, [row.key]: c }), `color:${row.key}`)}
      onStart={editor.begin}
      onEnd={editor.end}
      hint={row.hint}
      size={20}
    />
  );
}

function ValueControl({ row, editor, active }: { row: ValueRow; editor: LabEditor; active: number }) {
  const m = editor.material;
  return (
    <ChannelBar
      label={row.label}
      value={rowValue(m, row.key)}
      min={row.min}
      max={row.max}
      precision={row.precision}
      hint={row.hint}
      driven={active >= 0}
      onChange={(v) => editor.update((cur) => ({ ...cur, [row.key]: v }), `value:${row.key}`)}
      onStart={editor.begin}
      onEnd={editor.end}
    />
  );
}
