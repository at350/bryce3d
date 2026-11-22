/** Help > Keyboard Shortcuts: the full list, grouped. */
import { useStore } from '@/core/store';
import { Dialog } from '@/ui/kit';
import { SHORTCUT_GROUPS } from '../shortcutKeys';

export function ShortcutsDialog() {
  const close = () => useStore.getState().closeDialog();
  return (
    <Dialog title="Keyboard Shortcuts" width={620} onClose={close} onConfirm={close}>
      <div className="shortcuts">
        {SHORTCUT_GROUPS.map((g) => (
          <section key={g.title} className="shortcuts__group">
            <h3 className="dlg-heading">{g.title}</h3>
            <dl>
              {g.items.map(([keys, what]) => (
                <div key={keys + what} className="shortcuts__row">
                  <dt>
                    {keys.split('  or  ').map((k, i) => (
                      <span key={k}>
                        {i > 0 && <span className="shortcuts__or"> or </span>}
                        <kbd>{k}</kbd>
                      </span>
                    ))}
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
