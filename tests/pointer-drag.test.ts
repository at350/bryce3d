import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePointerDrag } from '@/ui/kit/pointerDrag';

function pointer(type: string, values: Record<string, number> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries({ pointerId: 7, button: 0, clientX: 10, clientY: 10, ...values })) {
    Object.defineProperty(event, key, { value });
  }
  return event;
}

async function mount(onMove: (dx: number, dy: number, e: PointerEvent) => void, onEnd: (info: { moved: boolean }) => void) {
  const host = document.createElement('div'); document.body.append(host);
  const root: Root = createRoot(host);
  function Probe() {
    const onPointerDown = usePointerDrag({ onMove, onEnd });
    return createElement('button', { onPointerDown, 'aria-label': 'drag' });
  }
  await act(async () => root.render(createElement(Probe)));
  return { host, root, button: host.querySelector('button')! };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => document.body.replaceChildren());

describe('pointer drag listener cleanup', () => {
  it('removes move listeners on unmount before a late pointer event', async () => {
    const moves: number[] = [], ends: { moved: boolean }[] = [];
    const move = (_dx: number, _dy: number, _e: PointerEvent) => moves.push(1);
    const end = (info: { moved: boolean }) => ends.push(info);
    const mounted = await mount(move, end);
    await act(async () => mounted.button.dispatchEvent(pointer('pointerdown')));
    await act(async () => mounted.root.unmount());
    window.dispatchEvent(pointer('pointermove', { clientX: 30, clientY: 10 }));
    expect(moves).toEqual([]);
    expect(ends).toHaveLength(1);
    mounted.host.remove();
  });

  it('cleans up on blur and ignores subsequent moves until a new drag', async () => {
    const moves: number[] = [], ends: { moved: boolean }[] = [];
    const move = (_dx: number, _dy: number, _e: PointerEvent) => moves.push(1);
    const end = (info: { moved: boolean }) => ends.push(info);
    const mounted = await mount(move, end);
    await act(async () => mounted.button.dispatchEvent(pointer('pointerdown')));
    await act(async () => window.dispatchEvent(pointer('pointermove', { clientX: 15, clientY: 10 })));
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(pointer('pointermove', { clientX: 25, clientY: 10 }));
    expect(moves).toHaveLength(1);
    expect(ends).toEqual([{ moved: true }]);
    await act(async () => mounted.root.unmount());
    mounted.host.remove();
  });
});
