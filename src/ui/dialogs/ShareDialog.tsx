/**
 * Share-link dialog: the whole scene packed into a URL. Copy it (clipboard API with a
 * select-and-copy fallback), see how long it is (warnings past ~8 KB and ~32 KB), trade
 * terrain detail for length when the scene has hand-made terrains, or open it in a new tab.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import { SHARE_LIMIT_CHARS, SHARE_WARN_CHARS, encodeShareLink } from '@/io/share';
import { terrainShareStats } from '@/io/shareCodec';
import { Button, Dialog, Select } from '@/ui/kit';
import '@/ui/library/library.css';

const DETAIL_OPTIONS = [
  { value: '128', label: 'Fine (128 × 128)' },
  { value: '64', label: 'Medium (64 × 64)' },
  { value: '32', label: 'Coarse (32 × 32)' },
];

type CopyState = 'idle' | 'copied' | 'manual';

async function copyText(text: string, field: HTMLTextAreaElement | null): Promise<CopyState> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    if (!field) return 'manual';
    field.focus();
    field.select();
    try {
      return document.execCommand('copy') ? 'copied' : 'manual';
    } catch {
      return 'manual';
    }
  }
}

export function ShareDialog() {
  const scene = useStore((s) => s.scene);
  const [detail, setDetail] = useState(128);
  const [copy, setCopy] = useState<CopyState>('idle');
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const link = useMemo(() => encodeShareLink(scene, { terrainDetail: detail }), [scene, detail]);
  const stats = useMemo(() => terrainShareStats(scene), [scene]);
  const close = () => useStore.getState().closeDialog();

  useEffect(() => {
    useStore.getState().setUI({ keyboardCaptured: true });
    const field = fieldRef.current;
    field?.focus();
    field?.select();
    return () => useStore.getState().setUI({ keyboardCaptured: false });
  }, []);

  useEffect(() => {
    if (copy === 'idle') return;
    const t = setTimeout(() => setCopy('idle'), 2600);
    return () => clearTimeout(t);
  }, [copy]);

  const level = link.length > SHARE_LIMIT_CHARS ? 'danger' : link.length > SHARE_WARN_CHARS ? 'warn' : 'ok';
  const kb = link.length / 1024;
  const meter = Math.min(1, link.length / SHARE_LIMIT_CHARS);

  return (
    <Dialog
      title="Share Scene"
      onClose={close}
      width={540}
      footer={
        <>
          <Button hint="Open the link in a new browser tab" onClick={() => window.open(link, '_blank', 'noopener')}>
            Open in New Tab
          </Button>
          <Button variant="primary" hint="Copy the link to the clipboard" onClick={() => void copyText(link, fieldRef.current).then(setCopy)}>
            {copy === 'copied' ? 'Copied!' : 'Copy Link'}
          </Button>
          <Button onClick={close}>Done</Button>
        </>
      }
    >
      <div className="share">
        <p className="share__lead">
          Anyone with this link opens their own copy of <strong>“{scene.name}”</strong>. Nothing is uploaded: the whole scene is packed
          into the link itself.
        </p>
        <textarea
          ref={fieldRef}
          className="share__link"
          readOnly
          spellCheck={false}
          value={link}
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
        />
        {copy === 'manual' && <p className="share__note">Your browser blocked copying: the link is selected, press Ctrl+C (⌘C on a Mac).</p>}
        <div className={`share__size is-${level}`}>
          <span className="share__meter" aria-hidden="true">
            <span style={{ width: `${Math.max(3, meter * 100)}%` }} />
          </span>
          <span>
            {kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB · {link.length.toLocaleString()} characters
          </span>
        </div>
        {level === 'warn' && <p className="share__warn">This link is fairly long. Browsers open it fine, but some chat apps and mail clients may cut it off.</p>}
        {level === 'danger' && (
          <p className="share__warn is-danger">
            This link is very long and may not open everywhere. {stats.sampled ? 'Try a coarser terrain detail below, or' : 'You can'} share the scene file
            instead (File › Save).
          </p>
        )}
        {stats.sampled > 0 && (
          <div className="share__detail">
            <Select
              label={`Hand-made terrain detail (${stats.sampled} terrain${stats.sampled > 1 ? 's' : ''})`}
              value={String(detail)}
              options={DETAIL_OPTIONS}
              onChange={(v) => setDetail(Number(v))}
              hint="Hand-sculpted terrains travel as 8-bit height samples; coarser means a shorter link"
            />
          </div>
        )}
        <p className="share__fine">
          {stats.recipe ? `${stats.recipe} fractal terrain${stats.recipe > 1 ? 's travel' : ' travels'} as a tiny recipe. ` : ''}
          Opening a link never replaces anything without Undo.
        </p>
      </div>
    </Dialog>
  );
}
