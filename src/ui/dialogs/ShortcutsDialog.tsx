import { useStore } from '@/core/store';
import { Dialog } from '@/ui/kit';

const SHORTCUTS: [string, string][] = [
  ['Ctrl/Cmd + R', 'Render'],
  ['Ctrl/Cmd + Z', 'Undo'],
  ['Shift + Ctrl/Cmd + Z', 'Redo'],
  ['Ctrl/Cmd + D', 'Duplicate'],
  ['Delete', 'Delete selection'],
  ['Ctrl/Cmd + 1 / 2 / 3', 'Create / Edit / Sky & Fog palette'],
  ['Ctrl/Cmd + M', 'Materials Lab'],
  ['Ctrl/Cmd + E', 'Edit selected object'],
  ['Esc', 'Deselect / close'],
];

export function ShortcutsDialog() {
  return (
    <Dialog title="Keyboard Shortcuts" onClose={() => useStore.getState().closeDialog()}>
      <table>
        <tbody>
          {SHORTCUTS.map(([k, v]) => (
            <tr key={k}>
              <td style={{ paddingRight: 16 }}>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
