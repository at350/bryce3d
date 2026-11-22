/**
 * Under the preview: dice, Copy / Paste (the lab's own material clipboard), Revert, and
 * the lab's Text Display line naming whatever is under the pointer.
 */
import { useState } from 'react';
import { useStore } from '@/core/store';
import type { Material } from '@/core/types';
import { Button, Icon3D, IconButton } from '@/ui/kit';
import { clipboardName, copyMaterial, pasteMaterial } from './clipboard';

export interface LabToolbarProps {
  material: Material;
  onRandom: () => void;
  onPaste: (m: Material) => void;
  onRevert: () => void;
}

export function LabToolbar({ material, onRandom, onPaste, onRevert }: LabToolbarProps) {
  const [clip, setClip] = useState(() => clipboardName());
  const hint = useStore((s) => s.ui.hint);
  return (
    <>
      <div className="ml-tools">
        <IconButton hint="Randomize: roll a brand new material" size={34} onClick={onRandom}>
          <Icon3D kind="dice" size={26} />
        </IconButton>
        <Button
          hint="Copy this material to the lab clipboard"
          onClick={() => {
            copyMaterial(material);
            setClip(material.name);
          }}
        >
          Copy
        </Button>
        <Button
          hint={clip ? `Paste ${clip}` : 'Paste (copy a material first)'}
          disabled={!clip}
          onClick={() => {
            const m = pasteMaterial();
            if (m) onPaste(m);
          }}
        >
          Paste
        </Button>
        <Button hint="Revert to the object's original material" onClick={onRevert}>
          Revert
        </Button>
      </div>
      <div className="ml-hintline" aria-live="polite">
        {hint || `${material.name}: drag the bars, click A / B / C to texture a channel`}
      </div>
    </>
  );
}
