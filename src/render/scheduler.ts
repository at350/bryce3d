/**
 * Progressive-render planning (pure): the Bryce mosaic passes, the anti-aliasing passes,
 * work accounting for progress, and the adaptive band controller that sizes each
 * time-sliced band of scanlines to a GPU time budget.
 */

export const MOSAIC_BLOCKS = [16, 8, 4, 2] as const;

export interface Pass {
  /** 'mosaic' renders one ray per block; 'sample' renders one ray per pixel. */
  kind: 'mosaic' | 'sample';
  /** Block size in pixels (1 for sample passes). */
  block: number;
  /** 1-based sample index for sample passes (1 = the full-resolution pass), 0 for mosaic. */
  sample: number;
}

/** Mosaic passes (16, 8, 4, 2 px) followed by `samples` full-resolution passes. */
export function planPasses(mosaic: boolean, samples: number): Pass[] {
  const passes: Pass[] = [];
  if (mosaic) for (const block of MOSAIC_BLOCKS) passes.push({ kind: 'mosaic', block, sample: 0 });
  const n = Math.max(1, Math.floor(samples));
  for (let s = 1; s <= n; s++) passes.push({ kind: 'sample', block: 1, sample: s });
  return passes;
}

/** Extra sample passes appended when a finished render is resumed. */
export function extendPasses(passes: Pass[], extra: number): Pass[] {
  const last = passes.reduce((m, p) => Math.max(m, p.sample), 0);
  const more: Pass[] = [];
  for (let i = 1; i <= Math.max(1, Math.floor(extra)); i++) more.push({ kind: 'sample', block: 1, sample: last + i });
  return [...passes, ...more];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rows and columns of traced cells for a pass over a region. */
export function passGrid(pass: Pass, region: Rect): { cols: number; rows: number } {
  return { cols: Math.ceil(region.w / pass.block), rows: Math.ceil(region.h / pass.block) };
}

export function passWork(pass: Pass, region: Rect): number {
  const g = passGrid(pass, region);
  return g.cols * g.rows;
}

export function totalWork(passes: Pass[], region: Rect): number {
  return passes.reduce((sum, p) => sum + passWork(p, region), 0);
}

/**
 * Normalized document region (y down, 0..1) -> pixel rectangle in GL convention
 * (x right, y up from the bottom row). Always at least 1x1 and inside the image.
 */
export function regionToPixels(
  region: { x: number; y: number; w: number; h: number } | undefined,
  width: number,
  height: number,
): Rect {
  if (!region) return { x: 0, y: 0, w: width, h: height };
  const c = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  const x0 = Math.floor(c(region.x) * width);
  const x1 = Math.max(x0 + 1, Math.ceil(c(region.x + region.w) * width));
  const top = Math.floor(c(region.y) * height);
  const bottom = Math.max(top + 1, Math.ceil(c(region.y + region.h) * height));
  const xe = Math.min(width, x1);
  const be = Math.min(height, bottom);
  const xs = Math.min(x0, xe - 1);
  const ts = Math.min(top, be - 1);
  return { x: xs, y: height - be, w: xe - xs, h: be - ts };
}

/**
 * Sizes bands so each takes about `targetMs` of GPU time. The cost estimate (ms per traced
 * cell) follows measurements: quickly upward (to protect UI responsiveness) and more
 * slowly downward. Growth per band is capped so a cheap sky band cannot be followed by a
 * huge terrain band.
 */
export class BandController {
  private cost: number;
  private lastRows = 0;

  constructor(
    public targetMs = 12,
    initialCostMs = 1e-3,
    private maxCellsPerBand = 400_000,
  ) {
    this.cost = initialCostMs;
  }

  get costPerCell(): number {
    return this.cost;
  }

  rowsFor(cellsPerRow: number, remainingRows: number): number {
    if (remainingRows <= 0) return 0;
    const perRow = Math.max(1, cellsPerRow);
    let rows = Math.floor(this.targetMs / (this.cost * perRow));
    rows = Math.min(rows, Math.floor(this.maxCellsPerBand / perRow));
    if (this.lastRows > 0) rows = Math.min(rows, this.lastRows * 2 + 2);
    rows = Math.max(1, Math.min(remainingRows, rows));
    this.lastRows = rows;
    return rows;
  }

  record(ms: number, cells: number): void {
    if (!(cells > 0) || !Number.isFinite(ms) || ms < 0) return;
    const c = Math.max(1e-7, ms / cells);
    this.cost = c > this.cost ? this.cost + (c - this.cost) * 0.7 : this.cost + (c - this.cost) * 0.35;
  }

  /** Forget band history (new pass type or new scene) but keep the learned cost. */
  resetGrowth(): void {
    this.lastRows = 0;
  }
}
