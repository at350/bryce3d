/**
 * A color bar (the strip under a Sky & Fog thumbnail): click it to open the kit's color
 * picker. Opening begins a store gesture and closing ends it, so a whole pick is one undo.
 */
import { useEffect, useRef, useState } from 'react';
import { rgbToHex } from '@/core/math';
import type { RGB } from '@/core/types';
import { ColorPicker, Popover, useHint } from '@/ui/kit';
import './skyui.css';

export interface ColorBarProps {
  value: RGB;
  onChange: (c: RGB) => void;
  /** Name shown in the Text Display Area and used as the accessible label. */
  label: string;
  onStart?: () => void;
  onEnd?: () => void;
  className?: string;
  disabled?: boolean;
}

export function ColorBar({ value, onChange, label, onStart, onEnd, className = '', disabled }: ColorBarProps) {
  const [original, setOriginal] = useState<RGB | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const openRef = useRef(false);
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  });
  useEffect(
    () => () => {
      if (openRef.current) endRef.current?.();
    },
    [],
  );
  const hex = rgbToHex(value);
  const hint = useHint(`${label}: ${hex} (click to pick)`);
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
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`sky-colorbar ${original ? 'is-open' : ''} ${className}`}
        style={{ background: hex }}
        disabled={disabled}
        aria-label={`${label}: ${hex}`}
        aria-haspopup="dialog"
        aria-expanded={!!original}
        onClick={() => (original ? close() : open())}
        {...hint}
      />
      {original && (
        <Popover
          anchor={btn.current}
          onClose={close}
          placement="down"
          role="dialog"
          ariaLabel={`${label} picker`}
          onReady={(el) => el.querySelector<HTMLElement>('.bk-colorpicker__sv')?.focus({ preventScroll: true })}
        >
          <ColorPicker value={value} original={original} onChange={onChange} />
        </Popover>
      )}
    </>
  );
}
