/** Dev harness: every IconKind in every skin (not part of the production build). */
import { createRoot } from 'react-dom/client';
import { Icon3D } from '@/ui/icons/Icon3D';
import { ALL_ICON_KINDS } from '@/ui/icons/iconKinds';
import type { Skin } from '@/core/types';
import '@/ui/kit/kit.css';

const SKINS: Skin[] = ['bryce5', 'bryce2', 'bryce7'];
const params = new URLSearchParams(location.search);
const only = params.get('skin') as Skin | null;
const size = Number(params.get('size') || 48);

function Gallery() {
  return (
    <>
      {(only ? [only] : SKINS).map((skin) => (
        <section key={skin}>
          <h2>{skin}</h2>
          <div className="grid">
            {ALL_ICON_KINDS.map((k) => (
              <div className="cell" key={k}>
                <Icon3D kind={k} size={size} skin={skin} />
                <span>{k}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Gallery />);
