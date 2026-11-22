/** Sky Lab: Cloud Cover tab, one panel per cloud layer (as in Bryce's Sky Lab). */
import { CloudLayerPanel } from './CloudLayerPanel';
import type { SkyTabProps } from './tabTypes';

export function CloudCoverTab({ sky, update, current }: SkyTabProps) {
  return (
    <div className="skylab__panels">
      {(['stratus', 'cumulus'] as const).map((kind) => (
        <CloudLayerPanel key={kind} kind={kind} sky={sky} onChange={(patch, key) => update({ [kind]: { ...current()[kind], ...patch } }, key)} />
      ))}
    </div>
  );
}
