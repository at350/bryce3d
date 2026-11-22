/**
 * Shows the open lab ("room") full-screen. Labs load on first use (code-split, so the
 * first page load stays light) and a crashing lab shows a recover/close card instead of
 * a blank app.
 */
import { lazy, Suspense } from 'react';
import { useStore } from '@/core/store';
import { ErrorBoundary } from './ErrorBoundary';

const MaterialLab = lazy(() => import('@/labs/material/MaterialLab').then((m) => ({ default: m.MaterialLab })));
const TerrainEditor = lazy(() => import('@/labs/terrain/TerrainEditor').then((m) => ({ default: m.TerrainEditor })));
const SkyLab = lazy(() => import('@/labs/sky/SkyLab').then((m) => ({ default: m.SkyLab })));

const NAMES = { material: 'The Materials Lab', terrain: 'The Terrain Editor', sky: 'The Sky Lab' } as const;

function Opening({ name }: { name: string }) {
  return (
    <div className="bk-lab lab-loading" role="status">
      <span className="lab-loading__text">Opening {name.replace(/^The /, 'the ')}…</span>
    </div>
  );
}

export function LabHost() {
  const lab = useStore((s) => s.ui.lab);
  const target = useStore((s) => s.ui.labTarget);
  if (!lab) return null;
  // key = lab + target so reopening starts from fresh working copies
  return (
    <ErrorBoundary name={NAMES[lab]} variant="overlay" resetKey={`${lab}-${target}`} onClose={() => useStore.getState().closeLab()} closeLabel="Leave the lab">
      <Suspense fallback={<Opening name={NAMES[lab]} />}>
        {lab === 'material' && <MaterialLab key={`m-${target}`} />}
        {lab === 'terrain' && <TerrainEditor key={`t-${target}`} />}
        {lab === 'sky' && <SkyLab key="sky" />}
      </Suspense>
    </ErrorBoundary>
  );
}
