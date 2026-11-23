/** Render quality presets -> tracer parameters (pure). */
import type { PreviewOptions } from '@/core/renderApi';
import type { RenderSettings } from '@/core/types';

export interface TraceQuality {
  /** Total samples per pixel (the first one is the 1-pixel mosaic pass). */
  samples: number;
  mosaic: boolean;
  /** Reflection/refraction depth. */
  maxDepth: number;
  /** Ray budget per sample (primary + secondary rays). */
  maxRays: number;
  softShadows: boolean;
  /** Honor the material blur channel (glossy reflections/refractions). */
  blur: boolean;
  volumeSteps: number;
  sdfSteps: number;
  /** Sample passes after the first trace only the pixels of the edge mask (Bryce's Normal anti-aliasing). */
  edgesOnly: boolean;
  /** Sigma in pixels of the soft pixel filter applied when the image is presented (0 = none). */
  filterSigma: number;
}

/**
 * Edge-only anti-aliasing marks a pixel when its displayed color (0..1 per channel, after
 * exposure, tone map and sRGB) differs from one of its 8 neighbours by more than this, both
 * taken from a 3x3 median of the 1-sample image. Comparing raw pixels marked 40-50% of a
 * rippled sea or a glossy lagoon at any threshold that kept silhouettes, because single-sample
 * reflection noise differs from every neighbour; the median removes that noise but keeps steps.
 * Tuned by eye on the sample scenes: at 0.1 the cloud bands and sea speckle came back; from 0.15
 * up, low-contrast silhouettes (a gray monolith against pink clouds) broke apart.
 */
export const EDGE_THRESHOLD = 0.12;
/**
 * A difference above this between the raw pixel and a neighbour also marks it: thin
 * high-contrast features (a palm frond, a distant pole) vanish from a 3x3 median.
 */
export const EDGE_STRONG_THRESHOLD = 0.4;

/** Softness 100 = a Gaussian of this sigma (pixels). */
export const MAX_FILTER_SIGMA = 1.5;
/** Taps on each side of the soft pixel filter: 3 sigma at the largest softness. */
export const MAX_FILTER_RADIUS = Math.ceil(3 * MAX_FILTER_SIGMA);

/** One side of a normalized, symmetric Gaussian: weights[i] for offsets +-i, i = 0..MAX_FILTER_RADIUS. */
export interface FilterKernel {
  /** Taps used on each side (0 = no filtering). */
  radius: number;
  weights: Float32Array;
}

const int = (v: unknown, def: number, lo: number, hi: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : def;
  return Math.min(hi, Math.max(lo, n));
};

const num = (v: unknown, def: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, typeof v === 'number' && Number.isFinite(v) ? v : def));

/** RenderSettings.softness (0..100) -> filter sigma in pixels. */
export function softnessSigma(softness: number): number {
  return (num(softness, 30, 0, 100) / 100) * MAX_FILTER_SIGMA;
}

/** Gaussian weights for a separable filter of `sigma` pixels, cut at 3 sigma; sigma 0 is the identity. */
export function filterKernel(sigma: number): FilterKernel {
  const weights = new Float32Array(MAX_FILTER_RADIUS + 1);
  const s = num(sigma, 0, 0, MAX_FILTER_SIGMA);
  const radius = s > 0 ? Math.min(MAX_FILTER_RADIUS, Math.ceil(3 * s)) : 0;
  let sum = 0;
  for (let i = 0; i <= radius; i++) {
    weights[i] = radius ? Math.exp((-i * i) / (2 * s * s)) : 1;
    sum += i ? 2 * weights[i] : weights[i];
  }
  for (let i = 0; i <= radius; i++) weights[i] /= sum;
  return { radius, weights };
}

export function mainQuality(r: RenderSettings): TraceQuality {
  const bounces = int(r.maxBounces, 6, 1, 12);
  const mosaic = r.mosaic !== false;
  // Missing (scenes built before these settings) reads as the defaults: every pixel, softness 30.
  const edgesOnly = r.antialias === 'edges';
  const filterSigma = softnessSigma(r.softness);
  if (r.quality === 'draft') {
    return { samples: 1, mosaic, maxDepth: Math.min(2, bounces), maxRays: 4, softShadows: false, blur: false, volumeSteps: 12, sdfSteps: 56, edgesOnly, filterSigma };
  }
  const samples = int(r.samples, 12, 1, 256);
  if (r.quality === 'premium') {
    return {
      samples: Math.min(1024, samples * 4),
      mosaic,
      maxDepth: bounces,
      maxRays: Math.min(16, bounces + 6),
      softShadows: true,
      blur: true,
      volumeSteps: 48,
      sdfSteps: 110,
      edgesOnly,
      filterSigma,
    };
  }
  return { samples, mosaic, maxDepth: bounces, maxRays: Math.min(12, bounces + 4), softShadows: true, blur: true, volumeSteps: 24, sdfSteps: 80, edgesOnly, filterSigma };
}

/** Previews (Nano Preview, lab previews, thumbnails) sample every pixel and stay unfiltered. */
export function previewQuality(q: PreviewOptions['quality']): TraceQuality {
  const aa = { edgesOnly: false, filterSigma: 0 };
  switch (q) {
    case 'preview':
      return { samples: 16, mosaic: false, maxDepth: 4, maxRays: 7, softShadows: true, blur: true, volumeSteps: 20, sdfSteps: 64, ...aa };
    case 'icon':
      return { samples: 8, mosaic: false, maxDepth: 3, maxRays: 5, softShadows: true, blur: true, volumeSteps: 16, sdfSteps: 56, ...aa };
    default:
      return { samples: 3, mosaic: false, maxDepth: 2, maxRays: 4, softShadows: false, blur: false, volumeSteps: 10, sdfSteps: 44, ...aa };
  }
}
