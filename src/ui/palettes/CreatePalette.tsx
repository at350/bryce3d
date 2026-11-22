/** Create palette: one click adds an object in front of the camera, resting on the ground, selected. */
import { Icon3D, IconButton } from '@/ui/kit';
import { createFromItem } from '../actions';
import { CREATE_GROUP_LABELS, groupedCreateItems } from '../createItems';

export function CreatePalette() {
  return (
    <div className="shelf">
      <div className="shelf__row">
        {groupedCreateItems().map(({ group, items }) => (
          <div key={group} className="shelf__group" role="group" aria-label={CREATE_GROUP_LABELS[group]}>
            {items.map((it) => (
              <IconButton key={it.id} hint={`Create ${it.label}`} size={38} onClick={() => createFromItem(it)}>
                <Icon3D kind={it.kind} size={34} />
              </IconButton>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
