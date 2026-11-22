/**
 * File / Edit / Objects / Links / Help. Like Bryce, the menu bar hides above the screen and
 * slides down when the pointer touches the top edge (or a menu title gets keyboard focus).
 * Once a menu is open, hovering another title switches to it.
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import type { Skin } from '@/core/types';
import { MenuList, Popover, type MenuItem } from '@/ui/kit';
import {
  createFromItem,
  deleteSelection,
  duplicateSelection,
  editSelected,
  exportRender,
  landSelection,
  newScene,
  openAttributes,
  openMaterialsLab,
  openScene,
  saveScene,
  selectNone,
  setSkin,
  startRender,
} from './actions';
import { CREATE_GROUP_LABELS, groupedCreateItems } from './createItems';

const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

export const SKINS: { id: Skin; label: string }[] = [
  { id: 'bryce5', label: 'Bryce 5 (silver & blue)' },
  { id: 'bryce2', label: 'Bryce 2 (orange & teal)' },
  { id: 'bryce7', label: 'Bryce 7 (sage)' },
];

const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

function useMenus(): { id: string; label: string; items: MenuItem[] }[] {
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const hasSel = useStore((s) => s.selection.length > 0);
  const skin = useStore((s) => s.ui.skin);
  const under = useStore((s) => s.ui.showRenderUnderWireframe);
  const s = useStore.getState();
  return [
    {
      id: 'file',
      label: 'File',
      items: [
        { label: 'New Scene', shortcut: `${mod}N`, onSelect: newScene },
        { label: 'Open…', shortcut: `${mod}O`, onSelect: openScene },
        { label: 'Save', shortcut: `${mod}S`, onSelect: saveScene },
        { label: 'Share Link…', onSelect: () => s.openDialog('share') },
        { divider: true, label: '' },
        { label: 'Render', shortcut: `${mod}R`, onSelect: startRender },
        { label: 'Export Render as PNG', onSelect: exportRender },
        { label: 'Render Settings…', onSelect: () => s.openDialog('renderSettings') },
        { divider: true, label: '' },
        { label: 'Sample Scenes…', onSelect: () => s.openLibrary('scenes') },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: `${mod}Z`, disabled: !canUndo, onSelect: () => useStore.getState().undo() },
        { label: 'Redo', shortcut: `⇧${mod}Z`, disabled: !canRedo, onSelect: () => useStore.getState().redo() },
        { divider: true, label: '' },
        { label: 'Duplicate', shortcut: `${mod}D`, disabled: !hasSel, onSelect: duplicateSelection },
        { label: 'Delete', shortcut: 'Del', disabled: !hasSel, onSelect: deleteSelection },
        { divider: true, label: '' },
        { label: 'Select All', shortcut: `${mod}A`, onSelect: () => useStore.getState().selectAll() },
        { label: 'Select None', shortcut: 'Esc', disabled: !hasSel, onSelect: selectNone },
        { divider: true, label: '' },
        { label: 'Render Under Wireframes', checked: under, onSelect: () => s.setUI({ showRenderUnderWireframe: !under }) },
        { label: 'Skin', submenu: SKINS.map((k) => ({ label: k.label, checked: skin === k.id, onSelect: () => setSkin(k.id) })) },
      ],
    },
    {
      id: 'objects',
      label: 'Objects',
      items: [
        {
          label: 'Create',
          submenu: groupedCreateItems().flatMap(({ group, items }, gi) => [
            ...(gi ? [{ divider: true, label: '' }] : []),
            ...items.map((it) => ({ label: it.label, hint: `${CREATE_GROUP_LABELS[group]}: ${it.label}`, onSelect: () => createFromItem(it) })),
          ]),
        },
        { divider: true, label: '' },
        { label: 'Object Attributes…', shortcut: `${mod}⌥E`, disabled: !hasSel, onSelect: openAttributes },
        { label: 'Edit Object…', shortcut: `${mod}E`, disabled: !hasSel, onSelect: editSelected },
        { label: 'Materials Lab…', shortcut: `${mod}M`, disabled: !hasSel, onSelect: openMaterialsLab },
        { label: 'Sky Lab…', shortcut: `${mod}K`, onSelect: () => s.openLab('sky') },
        { label: 'Land on Ground', disabled: !hasSel, onSelect: landSelection },
        { divider: true, label: '' },
        { label: 'Objects Library…', onSelect: () => s.openLibrary('objects') },
        { label: 'Materials Library…', onSelect: () => s.openLibrary('materials') },
        { label: 'Skies Library…', onSelect: () => s.openLibrary('skies') },
      ],
    },
    {
      id: 'links',
      label: 'Links',
      items: [
        { label: 'Bryce on Wikipedia', onSelect: () => openLink('https://en.wikipedia.org/wiki/Bryce_(software)') },
        { label: 'This Project on GitHub', onSelect: () => openLink('https://github.com/at350/bryce3d') },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', shortcut: '?', onSelect: () => s.openDialog('shortcuts') },
        { label: 'About Bryce 3D Web', onSelect: () => s.openDialog('about') },
      ],
    },
  ];
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return <span>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>;
}

function Logo() {
  return (
    <svg className="menubar__logo" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <radialGradient id="mb-ball" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#7d9cff" />
          <stop offset="1" stopColor="#0b1a6e" />
        </radialGradient>
      </defs>
      <path d="M2 27 L11 12 L15 18 L20 9 L30 27 Z" fill="#59616f" />
      <circle cx="22" cy="10" r="6" fill="url(#mb-ball)" />
    </svg>
  );
}

/** Reveal the bar for a moment at startup so people discover it. */
export function MenuBar({ introMs = 0 }: { introMs?: number }) {
  const menus = useMenus();
  const [open, setOpen] = useState<{ id: string; focus: boolean } | null>(null);
  const [hover, setHover] = useState(false);
  const [intro, setIntro] = useState(false);
  const titles = useRef<Record<string, HTMLButtonElement | null>>({});
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!introMs) return;
    setIntro(true);
    const t = setTimeout(() => setIntro(false), introMs);
    return () => clearTimeout(t);
  }, [introMs]);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const revealed = hover || intro || !!open;
  const close = () => {
    const inside = !!document.activeElement?.closest('.bk-popover');
    const id = open?.id;
    setOpen(null);
    if (inside && id) titles.current[id]?.focus({ preventScroll: true });
  };
  const current = menus.find((m) => m.id === open?.id);

  const onTitleKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = menus[(i + (e.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length];
      titles.current[next.id]?.focus();
      if (open) setOpen({ id: next.id, focus: false });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen({ id: menus[i].id, focus: true });
    }
  };

  return (
    <>
      <div className="menubar-zone" onPointerEnter={() => setHover(true)} aria-hidden="true" />
      <div className="menubar__hint" style={{ opacity: revealed ? 0 : 1 }} aria-hidden="true" />
      <nav
        className={`menubar ${revealed ? 'is-revealed' : ''}`}
        aria-label="Menu bar"
        onPointerEnter={() => {
          clearTimeout(leaveTimer.current);
          setHover(true);
        }}
        onPointerLeave={() => {
          leaveTimer.current = setTimeout(() => setHover(false), 350);
        }}
      >
        <div className="menubar__inner">
          <Logo />
          {menus.map((m, i) => (
            <button
              key={m.id}
              ref={(el) => {
                titles.current[m.id] = el;
              }}
              type="button"
              className={`menubar__title ${open?.id === m.id ? 'is-open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={open?.id === m.id}
              onClick={(e) => setOpen((o) => (o?.id === m.id ? null : { id: m.id, focus: e.detail === 0 }))}
              onPointerEnter={() => {
                if (open && open.id !== m.id) setOpen({ id: m.id, focus: false });
              }}
              onKeyDown={(e) => onTitleKey(e, i)}
            >
              {m.label}
            </button>
          ))}
          <div className="menubar__right">
            <Clock />
            <span className="menubar__app">Bryce 3D Web</span>
          </div>
        </div>
      </nav>
      {open && current && (
        <Popover key={current.id} anchor={titles.current[current.id] ?? null} placement="down" offset={1} onClose={close}>
          <MenuList items={current.items} onDone={close} autoFocus={open.focus} ariaLabel={current.label} />
        </Popover>
      )}
    </>
  );
}
