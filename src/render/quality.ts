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
  terrainSteps: number;
  sdfSteps: number;
}

const int = (v: unknown, def: number, lo: number, hi: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : def;
  return Math.min(hi, Math.max(lo, n));
};

export function mainQuality(r: RenderSettings): TraceQuality {
  const bounces = int(r.maxBounces, 6, 1, 12);
  const mosaic = r.mosaic !== false;
  if (r.quality === 'draft') {
    return { samples: 1, mosaic, maxDepth: Math.min(2, bounces), maxRays: 4, softShadows: false, blur: false, volumeSteps: 12, terrainSteps: 128, sdfSteps: 56 };
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
      terrainSteps: 320,
      sdfSteps: 110,
    };
  }
  return { samples, mosaic, maxDepth: bounces, maxRays: Math.min(12, bounces + 4), softShadows: true, blur: true, volumeSteps: 24, terrainSteps: 200, sdfSteps: 80 };
}

export function previewQuality(q: PreviewOptions['quality']): TraceQuality {
  switch (q) {
    case 'preview':
      return { samples: 16, mosaic: false, maxDepth: 4, maxRays: 7, softShadows: true, blur: true, volumeSteps: 20, terrainSteps: 160, sdfSteps: 64 };
    case 'icon':
      return { samples: 8, mosaic: false, maxDepth: 3, maxRays: 5, softShadows: true, blur: true, volumeSteps: 16, terrainSteps: 128, sdfSteps: 56 };
    default:
      return { samples: 3, mosaic: false, maxDepth: 2, maxRays: 4, softShadows: false, blur: false, volumeSteps: 10, terrainSteps: 96, sdfSteps: 44 };
  }
}
