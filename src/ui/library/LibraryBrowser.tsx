/**
 * Preset library window (objects / materials / skies / scenes), shown when ui.library is set.
 * NOTE: foundation stub (plain lists); the scenes owner builds the Bryce-style browser.
 */
import { useStore } from '@/core/store';
import { MATERIAL_PRESETS } from '@/materials/presets';
import { OBJECT_PRESETS } from '@/scenes/objectLibrary';
import { SAMPLE_SCENES } from '@/scenes/samples';
import { SKY_PRESETS } from '@/sky/presets';
import { cloneMaterial } from '@/core/materialUtils';
import { Button, Dialog } from '@/ui/kit';

export function LibraryBrowser() {
  const kind = useStore((s) => s.ui.library);
  if (!kind) return null;
  const s = useStore.getState();
  const close = () => s.closeLibrary();
  let items: { id: string; name: string; apply: () => void }[] = [];
  if (kind === 'objects') items = OBJECT_PRESETS.map((p) => ({ id: p.id, name: p.name, apply: () => s.addObjects(p.build()) }));
  if (kind === 'materials')
    items = MATERIAL_PRESETS.map((p) => ({ id: p.id, name: p.name, apply: () => s.setMaterial(useStore.getState().selection, cloneMaterial(p.material)) }));
  if (kind === 'skies') items = SKY_PRESETS.map((p) => ({ id: p.id, name: p.name, apply: () => s.setSky(p.sky) }));
  if (kind === 'scenes') items = SAMPLE_SCENES.map((p) => ({ id: p.id, name: p.name, apply: () => s.loadScene(p.build()) }));
  return (
    <Dialog title={`${kind[0].toUpperCase()}${kind.slice(1)} Library`} onClose={close}>
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map((it) => (
          <Button
            key={it.id}
            onClick={() => {
              it.apply();
              close();
            }}
          >
            {it.name}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}
