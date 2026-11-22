/**
 * A Bryce Edit-palette tool: drag on the big icon (all axes) or on its little X/Y/Z balls
 * (one axis). The tool computes new objects from the snapshot taken at drag start, so a
 * drag is reversible while scrubbing and lands in history as one undo step.
 */
import { useRef, useState } from 'react';
import { useStore } from '@/core/store';
import type { SceneObject } from '@/core/types';
import { Icon3D, TriangleMenu, useHint, type IconKind, type MenuItem } from '@/ui/kit';
import { editableSelection } from '../actions';

export type ToolMode = 'all' | 'x' | 'y' | 'z';

export interface DragDelta {
  /** Total drag since the start in CSS px (x right, y up). */
  dx: number;
  dy: number;
  shift: boolean;
  alt: boolean;
}

export interface DragToolProps {
  kind: IconKind;
  label: string;
  /** Hint shown on the icon. */
  hint: string;
  disabled?: boolean;
  handles?: ('x' | 'y' | 'z')[];
  /** Compute the dragged objects from their snapshot; returns the readout text. */
  apply: (base: SceneObject[], mode: ToolMode, d: DragDelta) => { objects: SceneObject[]; readout: string };
  /** Pixels a key press is worth (arrow keys on a focused tool). */
  keyStep?: number;
  menu?: MenuItem[];
  menuHint?: string;
  /** Called once per drag start (e.g. to pick a new random seed). */
  onBegin?: () => void;
}

const AXIS_LABEL: Record<ToolMode, string> = { all: 'XYZ', x: 'X', y: 'Y', z: 'Z' };

export function DragTool({ kind, label, hint, disabled, handles = [], apply, keyStep = 6, menu, menuHint, onBegin }: DragToolProps) {
  const [drag, setDrag] = useState<{ mode: ToolMode; readout: string } | null>(null);
  const base = useRef<SceneObject[]>([]);

  const commit = (mode: ToolMode, d: DragDelta) => {
    const s = useStore.getState();
    const { objects, readout } = apply(base.current, mode, d);
    const map = new Map(objects.map((o) => [o.id, o]));
    s.updateObjects([...map.keys()], (o) => map.get(o.id) ?? o);
    setDrag({ mode, readout });
    s.setHint(`${label} ${AXIS_LABEL[mode]}: ${readout}`);
  };

  const begin = (): boolean => {
    base.current = editableSelection();
    if (!base.current.length) {
      useStore.getState().showStatus(useStore.getState().selection.length ? 'The selection is locked.' : 'Select an object first.');
      return false;
    }
    onBegin?.();
    useStore.getState().beginGesture();
    return true;
  };

  const startDrag = (mode: ToolMode) => (e: React.PointerEvent) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.focus({ preventScroll: true });
    if (!begin()) return;
    const id = e.pointerId;
    try {
      el.setPointerCapture(id);
    } catch {
      // ignore
    }
    const sx = e.clientX;
    const sy = e.clientY;
    setDrag({ mode, readout: '' });
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      commit(mode, { dx: ev.clientX - sx, dy: sy - ev.clientY, shift: ev.shiftKey, alt: ev.altKey });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      useStore.getState().endGesture();
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onKey = (mode: ToolMode) => (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (!begin()) return;
    const px = dir * keyStep * (e.shiftKey ? 5 : 1);
    commit(mode, { dx: px, dy: px, shift: false, alt: e.altKey });
    useStore.getState().endGesture();
    setTimeout(() => setDrag(null), 600);
  };

  const iconHint = useHint(disabled ? `${label} (select an object first)` : hint);
  return (
    <div className={`edit-tool ${disabled ? 'is-disabled' : ''} ${drag ? 'is-dragging' : ''}`}>
      <div
        className="edit-tool__icon"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${label}: drag left or right, or use the arrow keys`}
        aria-disabled={disabled || undefined}
        aria-valuetext={drag?.readout || undefined}
        onPointerDown={startDrag('all')}
        onKeyDown={onKey('all')}
        {...iconHint}
      >
        <Icon3D kind={kind} size={50} />
      </div>
      {handles.map((h) => (
        <Handle key={h} axis={h} label={label} active={drag?.mode === h} onPointerDown={startDrag(h)} onKeyDown={onKey(h)} />
      ))}
      {menu && <TriangleMenu className="edit-tool__tri" hint={menuHint ?? `${label} options`} items={menu} />}
      {drag?.readout && <span className="edit-tool__readout">{drag.readout}</span>}
    </div>
  );
}

function Handle({
  axis,
  label,
  active,
  onPointerDown,
  onKeyDown,
}: {
  axis: 'x' | 'y' | 'z';
  label: string;
  active: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const text = `${label} ${axis.toUpperCase()}: drag left or right`;
  return (
    <button
      type="button"
      className={`edit-tool__handle edit-tool__handle--${axis} ${active ? 'is-active' : ''}`}
      aria-label={text}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      {...useHint(text)}
    >
      {axis.toUpperCase()}
    </button>
  );
}
