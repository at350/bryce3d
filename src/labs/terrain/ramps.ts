/**
 * Color ramps for the Terrain Editor: a visual aid only (Bryce's canvas color mapping),
 * never applied to the rendered terrain. Stops are [height, r, g, b] with 0..255 colors.
 */
export interface ColorRamp {
  id: string;
  label: string;
  stops: [number, number, number, number][];
}

export const RAMPS: ColorRamp[] = [
  { id: 'gray', label: 'Grayscale', stops: [[0, 0, 0, 0], [1, 255, 255, 255]] },
  {
    id: 'earth', label: 'Earth',
    stops: [[0, 34, 58, 96], [0.1, 52, 104, 138], [0.16, 196, 184, 136], [0.24, 92, 140, 66], [0.45, 70, 108, 52], [0.62, 128, 108, 82], [0.8, 150, 142, 134], [0.9, 236, 238, 242], [1, 255, 255, 255]],
  },
  {
    id: 'desert', label: 'Desert',
    stops: [[0, 92, 46, 28], [0.25, 168, 88, 48], [0.5, 214, 146, 84], [0.75, 236, 196, 132], [1, 255, 240, 210]],
  },
  {
    id: 'alien', label: 'Alien',
    stops: [[0, 24, 8, 52], [0.25, 88, 28, 128], [0.5, 30, 150, 160], [0.75, 236, 120, 178], [1, 255, 238, 170]],
  },
  {
    id: 'thermal', label: 'Thermal',
    stops: [[0, 10, 10, 40], [0.25, 60, 30, 150], [0.5, 210, 50, 80], [0.75, 250, 160, 30], [1, 255, 255, 200]],
  },
  {
    id: 'glacier', label: 'Glacier',
    stops: [[0, 12, 30, 60], [0.35, 40, 96, 140], [0.65, 150, 200, 225], [1, 250, 252, 255]],
  },
];

export const getRamp = (id: string) => RAMPS.find((r) => r.id === id) ?? RAMPS[0];

/** 256-entry RGBA lookup table. */
export function rampLUT(ramp: ColorRamp): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  const s = ramp.stops;
  for (let i = 0; i < 256; i++) {
    const h = i / 255;
    let k = 1;
    while (k < s.length - 1 && h > s[k][0]) k++;
    const a = s[k - 1];
    const b = s[k];
    const t = b[0] > a[0] ? Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0]))) : 0;
    lut[i * 4] = a[1] + (b[1] - a[1]) * t;
    lut[i * 4 + 1] = a[2] + (b[2] - a[2]) * t;
    lut[i * 4 + 2] = a[3] + (b[3] - a[3]) * t;
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

/** CSS linear-gradient (bottom = low) for bars and swatches. */
export function rampCss(ramp: ColorRamp, direction = 'to top'): string {
  const stops = ramp.stops.map(([at, r, g, b]) => `rgb(${r} ${g} ${b}) ${(at * 100).toFixed(1)}%`);
  return `linear-gradient(${direction}, ${stops.join(', ')})`;
}
