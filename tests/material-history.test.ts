import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultMaterial } from '@/core/materialUtils';
import { toggleDriver, driverOf } from '@/materials/edit';
import { newComponentFor } from '@/labs/material/newComponent';
import { useMaterialHistory, type MaterialHistory } from '@/labs/material/useMaterialHistory';

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => document.body.replaceChildren());

async function mountHistory() {
  const host = document.createElement('div');
  document.body.append(host);
  const root: Root = createRoot(host);
  let history!: MaterialHistory;
  function Probe() { history = useMaterialHistory(defaultMaterial); return null; }
  await act(async () => { root.render(createElement(Probe)); });
  return {
    value: () => history,
    unmount: async () => { await act(async () => root.unmount()); host.remove(); },
  };
}

describe('material driver undo boundaries', () => {
  it('records successive clicks on the same channel as separate undoable actions', async () => {
    const mounted = await mountHistory();
    const h = mounted.value();
    await act(async () => {
      h.update((m) => toggleDriver(m, 'diffuseColor', 0, (i) => newComponentFor(m, 'diffuseColor', i)));
      h.update((m) => toggleDriver(m, 'diffuseColor', 0, (i) => newComponentFor(m, 'diffuseColor', i)));
    });
    expect(driverOf(mounted.value().material, 'diffuseColor')).toBe(-1);
    await act(async () => h.undo());
    expect(driverOf(mounted.value().material, 'diffuseColor')).toBe(0);
    await act(async () => h.undo());
    expect(driverOf(mounted.value().material, 'diffuseColor')).toBe(-1);
    await act(async () => h.redo());
    expect(driverOf(mounted.value().material, 'diffuseColor')).toBe(0);
    await act(async () => h.redo());
    expect(driverOf(mounted.value().material, 'diffuseColor')).toBe(-1);
    await mounted.unmount();
  });

  it('keeps rapid clicks on different channels as separate history steps', async () => {
    const mounted = await mountHistory();
    const h = mounted.value();
    await act(async () => {
      h.update((m) => toggleDriver(m, 'diffuseColor', 0, (i) => newComponentFor(m, 'diffuseColor', i)));
      h.update((m) => toggleDriver(m, 'specularColor', 0, (i) => newComponentFor(m, 'specularColor', i)));
    });
    expect(driverOf(mounted.value().material, 'diffuseColor')).toBe(0);
    expect(driverOf(mounted.value().material, 'specularColor')).toBe(0);
    await act(async () => h.undo());
    expect(driverOf(mounted.value().material, 'diffuseColor')).toBe(0);
    expect(driverOf(mounted.value().material, 'specularColor')).toBe(-1);
    await mounted.unmount();
  });
});
