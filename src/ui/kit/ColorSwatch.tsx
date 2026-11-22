/** A color chip that opens the Bryce-style color picker popover. One open/close = one onStart/onEnd pair. */
import { useEffect, useRef, useState } from 'react';
import { rgbToHex } from '@/core/math';
import type { RGB } from '@/core/types';
import { ColorPicker } from './ColorPicker';
import { useHint } from './hint';
import { Popover } from './Popover';

export interface ColorSwatchProps {
  value: RGB;
  onChange: (c: RGB) => void;
  label?: string;
  hint?: string;
  /** Square size in px (default 22). */
  size?: number;
  onStart?: () => void;
  onEnd?: () => void;
  disabled?: boolean;
}

export function ColorSwatch({ value, onChange, label, hint, size = 22, onStart, onEnd, disabled }: ColorSwatchProps) {
  const [original, setOriginal] = useState<RGB | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const openRef = useRef(false);
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  });
  // Never leave a gesture dangling if we unmount while open.
  useEffect(
    () => () => {
      if (openRef.current) endRef.current?.();
    },
    [],
  );
  const hex = rgbToHex(value);
  const hintHandlers = useHint(hint ?? (label ? `${label}: ${hex}` : undefined));
  const open = () => {
    openRef.current = true;
    setOriginal(value);
    onStart?.();
  };
  const close = () => {
    if (!openRef.current) return;
    openRef.current = false;
    setOriginal(null);
    onEnd?.();
  };
  const name = label ?? hint ?? 'Color';
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`bk-swatch ${original ? 'is-open' : ''}`}
        disabled={disabled}
        aria-label={`${name}: ${hex}`}
        aria-haspopup="dialog"
        aria-expanded={!!original}
        onClick={() => (original ? close() : open())}
        {...hintHandlers}
      >
        <span className="bk-swatch__chip" style={{ width: size, height: size, background: hex }} />
        {label && <span className="bk-swatch__label">{label}</span>}
      </button>
      {original && (
        <Popover
          anchor={btn.current}
          onClose={close}
          placement="down"
          role="dialog"
          ariaLabel={`${name} picker`}
          onReady={(el) => el.querySelector<HTMLElement>('.bk-colorpicker__sv')?.focus({ preventScroll: true })}
        >
          <ColorPicker value={value} original={original} onChange={onChange} />
        </Popover>
      )}
    </>
  );
}
