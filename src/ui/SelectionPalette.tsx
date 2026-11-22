/**
 * Bottom Selection palette: select by type (icons; triangles list the members), previous /
 * next object, all / none, family colors, the object list, and the status line.
 */
import { useRef, useState } from 'react';
import { FAMILY_COLORS, FAMILY_NAMES } from '@/core/defaults';
import { rgbToHex } from '@/core/math';
import { SELECTION_GROUPS } from '@/core/objects';
import { useStore } from '@/core/store';
import { Icon3D, IconButton, Popover, TriangleMenu, useHint, type IconKind, type MenuItem } from '@/ui/kit';
import { cycleSelection, selectNone } from './actions';
import { ObjectList } from './selection/ObjectList';

const GROUP_ICONS: Record<string, IconKind> = {
  terrains: 'terrain',
  planes: 'water',
  primitives: 'sphere',
  stones: 'stone',
  trees: 'tree',
  lights: 'radialLight',
};

function GroupButton({ group }: { group: (typeof SELECTION_GROUPS)[number] }) {
  const objects = useStore((s) => s.scene.objects);
  const selection = useStore((s) => s.selection);
  const members = objects.filter((o) => group.types.includes(o.type) && !o.hidden);
  const items: MenuItem[] = members.map((o) => ({
    label: o.name,
    checked: selection.includes(o.id),
    onSelect: () => useStore.getState().select(o.id),
  }));
  return (
    <div className="selection-group">
      <IconButton
        hint={members.length ? `Select all ${group.label} (${members.length})` : `No ${group.label.toLowerCase()} in the scene`}
        size={32}
        disabled={!members.length}
        onClick={() => useStore.getState().selectByType(group.types)}
      >
        <Icon3D kind={GROUP_ICONS[group.id] ?? 'sphere'} size={26} />
      </IconButton>
      <TriangleMenu direction="up" hint={`Pick one of the ${group.label}`} disabled={!members.length} items={items} />
    </div>
  );
}

function FamilyMenu() {
  const selection = useStore((s) => s.selection);
  const objects = useStore((s) => s.scene.objects);
  const selected = objects.filter((o) => selection.includes(o.id));
  const items: MenuItem[] = [
    ...FAMILY_NAMES.map((name, i) => ({
      label: name,
      swatch: rgbToHex(FAMILY_COLORS[i]),
      checked: selected.length > 0 && selected.every((o) => (o.family ?? 0) === i),
      disabled: !selected.length,
      onSelect: () => useStore.getState().updateObjects(selection, (o) => ({ ...o, family: i })),
    })),
    { divider: true, label: '' },
    {
      label: 'Select a Family',
      submenu: FAMILY_NAMES.map((name, i) => ({
        label: name,
        swatch: rgbToHex(FAMILY_COLORS[i]),
        disabled: !objects.some((o) => (o.family ?? 0) === i && !o.hidden),
        onSelect: () => useStore.getState().select(objects.filter((o) => (o.family ?? 0) === i && !o.hidden).map((o) => o.id)),
      })),
    },
  ];
  return (
    <TriangleMenu
      direction="up"
      hint="Families: color the selection's wireframes, or select a whole family"
      items={items}
      trigger={<Icon3D kind="family" size={26} />}
    />
  );
}

function ObjectListButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref} style={{ display: 'inline-flex' }}>
      <IconButton hint="Object list: select, hide and lock objects" size={32} active={open} onClick={() => setOpen((o) => !o)}>
        <Icon3D kind="objectList" size={26} />
      </IconButton>
      {open && (
        <Popover anchor={ref.current} placement="up" onClose={() => setOpen(false)}>
          <ObjectList />
        </Popover>
      )}
    </span>
  );
}

function SceneName() {
  const name = useStore((s) => s.scene.name);
  const [editing, setEditing] = useState(false);
  const hint = useHint('Scene name: double-click to rename');
  if (editing) {
    const done = (value: string | null) => {
      setEditing(false);
      if (value !== null && value.trim() && value.trim() !== name) useStore.getState().setSceneName(value.trim().slice(0, 80));
    };
    return (
      <input
        className="selection-status__input"
        autoFocus
        defaultValue={name}
        aria-label="Scene name"
        data-bk-own-escape=""
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => done(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') done(e.currentTarget.value);
          if (e.key === 'Escape') done(null);
        }}
      />
    );
  }
  return (
    <button type="button" className="selection-status__name" onDoubleClick={() => setEditing(true)} onKeyDown={(e) => e.key === 'Enter' && setEditing(true)} {...hint}>
      {name || 'Untitled'}
    </button>
  );
}

function StatusLine() {
  const selCount = useStore((s) => s.selection.length);
  const status = useStore((s) => s.render.status);
  const stale = useStore((s) => s.render.stale);
  const fraction = useStore((s) => s.render.fraction);
  const w = useStore((s) => s.scene.render.width);
  const h = useStore((s) => s.scene.render.height);
  const quality = useStore((s) => s.scene.render.quality);
  let pill: { text: string; stale?: boolean } | null = null;
  if (status === 'rendering') pill = { text: `Rendering ${Math.round(fraction * 100)}%` };
  else if (status === 'paused') pill = { text: 'Paused', stale: true };
  else if (status === 'done') pill = stale ? { text: 'Render out of date', stale: true } : { text: 'Rendered' };
  return (
    <div className="selection-status">
      {pill && <span className={`status-pill ${pill.stale ? 'status-pill--stale' : ''}`}>{pill.text}</span>}
      <span className="selection-status__text">
        {selCount ? `${selCount} selected · ` : ''}
        {w} × {h} · {quality}
      </span>
      <SceneName />
    </div>
  );
}

export function SelectionPalette() {
  const any = useStore((s) => s.scene.objects.length > 0);
  const hasSel = useStore((s) => s.selection.length > 0);
  return (
    <footer className="selection-palette" aria-label="Selection palette">
      <div className="selection-palette__zoom">
        <div className="selection-groups" role="group" aria-label="Select by type">
          {SELECTION_GROUPS.map((g) => (
            <GroupButton key={g.id} group={g} />
          ))}
        </div>
        <span className="selection-sep" aria-hidden="true" />
        <div className="selection-nav">
          <IconButton hint="Previous object ([)" size={30} disabled={!any} onClick={() => cycleSelection(-1)}>
            <Icon3D kind="prev" size={22} />
          </IconButton>
          <IconButton hint="Next object (])" size={30} disabled={!any} onClick={() => cycleSelection(1)}>
            <Icon3D kind="next" size={22} />
          </IconButton>
          <IconButton hint="Select all (Ctrl+A)" size={32} disabled={!any} onClick={() => useStore.getState().selectAll()}>
            <Icon3D kind="selectAll" size={26} />
          </IconButton>
          <IconButton hint="Select none (Esc)" size={32} disabled={!hasSel} onClick={selectNone}>
            <Icon3D kind="selectNone" size={26} />
          </IconButton>
          <FamilyMenu />
          <ObjectListButton />
        </div>
        <StatusLine />
      </div>
    </footer>
  );
}
