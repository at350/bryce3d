/** Glossy SVG ball with an optional embossed glyph (lab check/cancel, small round buttons). Crisp at any size. */
import { useId } from 'react';

export type GlossTone = 'accent' | 'metal' | 'danger' | 'dark';
export type GlossGlyph = 'check' | 'cross' | 'play' | 'stop' | 'refresh' | 'plus' | 'minus' | 'dot';

const GLYPHS: Record<GlossGlyph, string> = {
  check: 'M30 52 L44 66 L71 36',
  cross: 'M35 35 L65 65 M65 35 L35 65',
  play: 'M40 32 L68 50 L40 68 Z',
  stop: 'M36 36 H64 V64 H36 Z',
  refresh: 'M66 40 A19 19 0 1 0 69 56 M66 26 V40 H52',
  plus: 'M50 32 V68 M32 50 H68',
  minus: 'M32 50 H68',
  dot: 'M50 44 A6 6 0 1 1 49.9 44 Z',
};

export function GlossBall({ size = 40, tone = 'accent', glyph, className = '' }: { size?: number; tone?: GlossTone; glyph?: GlossGlyph; className?: string }) {
  const id = useId().replace(/:/g, '');
  const filled = glyph === 'play' || glyph === 'stop' || glyph === 'dot';
  return (
    <svg className={`bk-glossball bk-glossball--${tone} ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}b`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" className="bk-gb-hi" />
          <stop offset="0.45" className="bk-gb-mid" />
          <stop offset="1" className="bk-gb-lo" />
        </radialGradient>
        <radialGradient id={`${id}s`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.45" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="52" cy="92" rx="34" ry="7" fill={`url(#${id}s)`} />
      <circle cx="50" cy="48" r="42" fill={`url(#${id}b)`} className="bk-gb-body" />
      <ellipse cx="44" cy="26" rx="25" ry="15" fill={`url(#${id}h)`} />
      {glyph && (
        <g transform="translate(0 -2)">
          <path d={GLYPHS[glyph]} className="bk-gb-glyph-shadow" fill={filled ? 'currentColor' : 'none'} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 1.5)" />
          <path d={GLYPHS[glyph]} className="bk-gb-glyph" fill={filled ? 'currentColor' : 'none'} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}
