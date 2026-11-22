/** The color picker panel used by ColorSwatch: saturation/value square, hue strip, hex field and handy swatches. */
import { useEffect, useRef, useState } from 'react';
import { clamp } from '@/core/math';
import type { RGB } from '@/core/types';
import { fromHsv, HANDY_SWATCHES, hexOf, parseHex, sameColor, toHsv, type HSV } from './colorMath';

interface EyeDropperLike {
  open(): Promise<{ sRGBHex: string }>;
}
type EyeDropperCtor = new () => EyeDropperLike;

function dragArea(e: React.PointerEvent, onPoint: (fx: number, fy: number) => void) {
  if (e.button !== 0) return;
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  el.focus({ preventScroll: true });
  const id = e.pointerId;
  try {
    el.setPointerCapture(id);
  } catch {
    // ignore
  }
  const at = (x: number, y: number) => {
    const r = el.getBoundingClientRect();
    onPoint(clamp((x - r.left) / r.width, 0, 1), clamp((y - r.top) / r.height, 0, 1));
  };
  at(e.clientX, e.clientY);
  const move = (ev: PointerEvent) => ev.pointerId === id && at(ev.clientX, ev.clientY);
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

export interface ColorPickerProps {
  value: RGB;
  onChange: (c: RGB) => void;
  /** The color when the picker opened (click it to go back). */
  original: RGB;
}

export function ColorPicker({ value, onChange, original }: ColorPickerProps) {
  const [hsv, setHsv] = useState<HSV>(() => toHsv(value));
  const [hexText, setHexText] = useState(() => hexOf(value));
  const last = useRef<RGB>(value);

  useEffect(() => {
    if (sameColor(value, last.current)) return;
    last.current = value;
    setHsv((h) => toHsv(value, h[0]));
    setHexText(hexOf(value));
  }, [value]);

  const emit = (next: HSV) => {
    setHsv(next);
    const rgb = fromHsv(next);
    last.current = rgb;
    setHexText(hexOf(rgb));
    onChange(rgb);
  };
  const emitRgb = (rgb: RGB) => {
    last.current = rgb;
    setHsv((h) => toHsv(rgb, h[0]));
    setHexText(hexOf(rgb));
    onChange(rgb);
  };

  const [h, s, v] = hsv;
  const hueColor = hexOf(fromHsv([h, 1, 1]));
  const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

  const svKeys = (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 0.1 : 0.02;
    const map: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    emit([h, clamp(s + m[0], 0, 1), clamp(v + m[1], 0, 1)]);
  };
  const hueKeys = (e: React.KeyboardEvent) => {
    const d = (e.shiftKey ? 10 : 1) / 360;
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    emit([(h + dir * d + 1) % 1, s, v]);
  };

  return (
    <div className="bk-colorpicker">
      <div className="bk-colorpicker__top">
        <div
          className="bk-colorpicker__sv"
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
          role="slider"
          tabIndex={0}
          aria-label="Saturation and brightness"
          aria-valuetext={`saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`}
          onPointerDown={(e) => dragArea(e, (fx, fy) => emit([h, fx, 1 - fy]))}
          onKeyDown={svKeys}
        >
          <span className="bk-colorpicker__svdot" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: hexOf(fromHsv(hsv)) }} />
        </div>
        <div
          className="bk-colorpicker__hue"
          role="slider"
          tabIndex={0}
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(h * 360)}
          onPointerDown={(e) => dragArea(e, (_fx, fy) => emit([Math.min(fy, 0.9999), s, v]))}
          onKeyDown={hueKeys}
        >
          <span className="bk-colorpicker__huemark" style={{ top: `${h * 100}%` }} />
        </div>
      </div>
      <div className="bk-colorpicker__row">
        <button type="button" className="bk-colorpicker__compare" aria-label="Revert to the original color" title="Original color" onClick={() => emitRgb(original)}>
          <span style={{ background: hexOf(original) }} />
          <span style={{ background: hexOf(value) }} />
        </button>
        <label className="bk-colorpicker__hex">
          <span>#</span>
          <input
            value={hexText.replace('#', '')}
            maxLength={7}
            spellCheck={false}
            aria-label="Hex color"
            onChange={(e) => {
              setHexText(e.currentTarget.value);
              const c = parseHex(e.currentTarget.value);
              if (c && e.currentTarget.value.replace('#', '').length === 6) emitRgb(c);
            }}
            onBlur={(e) => {
              const c = parseHex(e.currentTarget.value);
              if (c) emitRgb(c);
              else setHexText(hexOf(value));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const c = parseHex(e.currentTarget.value);
                if (c) emitRgb(c);
              }
            }}
          />
        </label>
        {EyeDropper && (
          <button
            type="button"
            className="bk-colorpicker__dropper"
            aria-label="Pick a color from the screen"
            title="Pick from screen"
            onClick={() => {
              new EyeDropper()
                .open()
                .then((r) => {
                  const c = parseHex(r.sRGBHex);
                  if (c) emitRgb(c);
                })
                .catch(() => undefined);
            }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M11.5 1.5a2 2 0 0 1 2.8 2.8l-1.6 1.6.7.7-1.4 1.4-.7-.7-5.6 5.6H3v-2.7l5.6-5.6-.7-.7 1.4-1.4.7.7z" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>
      <div className="bk-colorpicker__swatches" role="group" aria-label="Handy colors">
        {HANDY_SWATCHES.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`bk-colorpicker__swatch ${sameColor(c, value) ? 'is-current' : ''}`}
            style={{ background: hexOf(c) }}
            aria-label={`Color ${hexOf(c)}`}
            onClick={() => emitRgb(c)}
          />
        ))}
      </div>
    </div>
  );
}
