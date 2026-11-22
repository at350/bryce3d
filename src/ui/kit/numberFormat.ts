/** Number formatting/parsing for drag fields (pure; unit tested). */
import { clamp } from '@/core/math';

export function formatNumber(v: number, precision: number): string {
  if (!Number.isFinite(v)) return '0';
  if (precision > 0) {
    const s = v.toFixed(precision);
    return s === `-${(0).toFixed(precision)}` ? (0).toFixed(precision) : s;
  }
  const r = Math.round(v);
  return String(r === 0 ? 0 : r);
}

/** Snap to `step` (if > 0), clamp, and strip float noise. */
export function quantize(v: number, step: number, min: number, max: number): number {
  const snapped = step > 0 ? Math.round(v / step) * step : v;
  return Number(clamp(snapped, min, max).toPrecision(12));
}

/** Increment for one arrow-key press. */
export function keyIncrement(step: number, precision: number): number {
  if (step > 0) return step;
  return precision >= 2 ? 10 ** (1 - precision) : 10 ** -precision;
}

/**
 * Parse what the user typed into a numeric field: plain numbers ("12.5", "-3", "1e3"),
 * a comma decimal ("12,5"), trailing units ("45°", "12 px") and simple arithmetic
 * ("10+2.5", "(3+1)*2"). Returns null when it is not a number.
 */
export function parseNumberInput(text: string): number | null {
  const src = text.trim().replace(/(\d),(\d)/g, '$1.$2').replace(/([0-9.)])\s*[a-zA-Z°%]+$/, '$1').replace(/\s+/g, '');
  if (!src) return null;
  let i = 0;
  const peek = () => src[i];
  const number = (): number | null => {
    const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number | null => {
    if (peek() === '-') {
      i++;
      const f = factor();
      return f === null ? null : -f;
    }
    if (peek() === '+') {
      i++;
      return factor();
    }
    if (peek() === '(') {
      i++;
      const v = expr();
      if (v === null || peek() !== ')') return null;
      i++;
      return v;
    }
    return number();
  };
  const term = (): number | null => {
    let v = factor();
    while (v !== null && (peek() === '*' || peek() === '/')) {
      const op = src[i++];
      const r = factor();
      if (r === null) return null;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    while (v !== null && (peek() === '+' || peek() === '-')) {
      const op = src[i++];
      const r = term();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const result = expr();
  if (result === null || i !== src.length || !Number.isFinite(result)) return null;
  return result;
}
