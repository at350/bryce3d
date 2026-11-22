/** Header tools of the Materials Lab: Surface / Volume switch, material name, undo / redo, target. */
import type { Material } from '@/core/types';
import { IconButton, useHint } from '@/ui/kit';
import type { MaterialHistory } from './useMaterialHistory';

export interface LabHeaderProps {
  material: Material;
  targetName: string | null;
  applyCount: number;
  onMode: (mode: Material['mode']) => void;
  onName: (name: string) => void;
  history: MaterialHistory;
}

export function LabHeader({ material, targetName, applyCount, onMode, onName, history }: LabHeaderProps) {
  const nameHint = useHint('Material name (shown in the library and the scene)');
  const targetHint = useHint(applyCount > 1 ? `The check mark applies this material to all ${applyCount} selected objects` : 'The object this material will be applied to');
  return (
    <div className="ml-header">
      <div className="ml-mode" role="radiogroup" aria-label="Material type">
        <ModeButton label="Surface" active={material.mode === 'surface'} hint="Surface material: shades the object's skin" onClick={() => onMode('surface')} />
        <ModeButton label="Volume" active={material.mode === 'volume'} hint="Volume material: fills the object like fog, cloud or glowing gas" onClick={() => onMode('volume')} />
      </div>
      <input
        className="ml-name"
        value={material.name}
        maxLength={48}
        spellCheck={false}
        aria-label="Material name"
        onChange={(e) => onName(e.currentTarget.value)}
        onBlur={(e) => {
          if (!e.currentTarget.value.trim()) onName('Untitled Material');
        }}
        {...nameHint}
      />
      <IconButton hint="Undo (Ctrl/Cmd+Z)" size={30} disabled={!history.canUndo} onClick={history.undo}>
        <ArrowGlyph />
      </IconButton>
      <IconButton hint="Redo (Shift+Ctrl/Cmd+Z)" size={30} disabled={!history.canRedo} onClick={history.redo}>
        <ArrowGlyph flip />
      </IconButton>
      <span className="ml-target" {...targetHint}>
        {applyCount > 1 ? `${applyCount} objects` : targetName ?? 'No object selected'}
      </span>
    </div>
  );
}

/** A curved undo arrow (mirrored for redo). */
function ArrowGlyph({ flip }: { flip?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M7.5 4 3 8.5 7.5 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 8.5H12a4.75 4.75 0 0 1 0 9.5H8.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function ModeButton({ label, active, hint, onClick }: { label: string; active: boolean; hint: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={active} className={`ml-mode__btn ${active ? 'is-active' : ''}`} onClick={onClick} {...useHint(hint)}>
      {label}
    </button>
  );
}
