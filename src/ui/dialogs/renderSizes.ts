/** Document size presets and the constrain-proportions math (pure; unit tested). */

export interface SizePreset {
  label: string;
  width: number;
  height: number;
}

export const SIZE_GROUPS: { title: string; presets: SizePreset[] }[] = [
  {
    title: '4:3',
    presets: [
      { label: '640 × 480', width: 640, height: 480 },
      { label: '800 × 600', width: 800, height: 600 },
      { label: '1024 × 768', width: 1024, height: 768 },
      { label: '1600 × 1200', width: 1600, height: 1200 },
    ],
  },
  {
    title: '16:9',
    presets: [
      { label: '1280 × 720', width: 1280, height: 720 },
      { label: '1920 × 1080', width: 1920, height: 1080 },
    ],
  },
  { title: 'Square', presets: [{ label: '800 × 800', width: 800, height: 800 }] },
];

export const MIN_SIDE = 16;
export const MAX_SIDE = 4096;

const clampSide = (v: number) => Math.round(Math.min(MAX_SIDE, Math.max(MIN_SIDE, v)));

/**
 * New width/height after the user changes one side. With `aspect` (w / h) set, the other
 * side follows so the proportions stay; both sides stay within MIN_SIDE..MAX_SIDE.
 */
export function constrainSize(changed: 'width' | 'height', value: number, current: { width: number; height: number }, aspect: number | null): { width: number; height: number } {
  if (!aspect || !(aspect > 0)) {
    return changed === 'width' ? { width: clampSide(value), height: current.height } : { width: current.width, height: clampSide(value) };
  }
  if (changed === 'width') {
    let w = clampSide(value);
    const h = clampSide(w / aspect);
    if (Math.abs(h - w / aspect) > 0.5) w = clampSide(h * aspect);
    return { width: w, height: h };
  }
  let h = clampSide(value);
  const w = clampSide(h * aspect);
  if (Math.abs(w - h * aspect) > 0.5) h = clampSide(w / aspect);
  return { width: w, height: h };
}

/** "4:3", "16:9", "1:1" or a decimal ratio. */
export function aspectLabel(width: number, height: number): string {
  const r = width / height;
  const known: [number, string][] = [
    [4 / 3, '4:3'],
    [16 / 9, '16:9'],
    [1, '1:1'],
    [3 / 2, '3:2'],
    [2.39, '2.39:1'],
    [3 / 4, '3:4'],
    [9 / 16, '9:16'],
  ];
  const hit = known.find(([v]) => Math.abs(v - r) < 0.01);
  return hit ? hit[1] : `${r.toFixed(2)}:1`;
}
