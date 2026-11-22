/**
 * Stack of modal layers (popovers, dialogs, labs). Escape is routed to the top-most
 * layer only, so closing a color picker inside a dialog inside a lab never cancels the
 * dialog or the lab underneath. Global shortcuts check `layerDepth()` to stay quiet
 * while anything modal is open.
 */
import { useEffect, useRef } from 'react';

export type LayerKind = 'popover' | 'dialog' | 'lab';

interface Layer {
  id: number;
  kind: LayerKind;
  onEscape: () => void;
}

const stack: Layer[] = [];
let nextId = 1;
let installed = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.isComposing || !stack.length) return;
  // Inline editors (typed number fields) cancel themselves first.
  if ((e.target as HTMLElement | null)?.closest?.('[data-bk-own-escape]')) return;
  const top = stack[stack.length - 1];
  e.preventDefault();
  e.stopImmediatePropagation();
  top.onEscape();
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', onKeyDown, true);
}

/** Register a layer; returns its id and a remover. */
export function pushLayer(kind: LayerKind, onEscape: () => void): { id: number; remove: () => void } {
  install();
  const layer: Layer = { id: nextId++, kind, onEscape };
  stack.push(layer);
  return {
    id: layer.id,
    remove: () => {
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
    },
  };
}

/** Number of open layers, optionally of the given kinds. */
export function layerDepth(kinds?: LayerKind[]): number {
  return kinds ? stack.filter((l) => kinds.includes(l.kind)).length : stack.length;
}

export function isTopLayer(id: number | null): boolean {
  return id !== null && stack.length > 0 && stack[stack.length - 1].id === id;
}

/** React binding: registers while `active`; the latest onEscape is always used. Returns a ref to the layer id. */
export function useLayer(kind: LayerKind, onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  const idRef = useRef<number | null>(null);
  useEffect(() => {
    handler.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const { id, remove } = pushLayer(kind, () => handler.current());
    idRef.current = id;
    return () => {
      remove();
      idRef.current = null;
    };
  }, [kind, active]);
  return idRef;
}

/** True when the event target is a text field or other control that owns its keys. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  if (!t || !t.tagName) return false;
  if (t.isContentEditable) return true;
  if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  if (t.tagName === 'INPUT') {
    const type = (t as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'range', 'color'].includes(type);
  }
  return false;
}
