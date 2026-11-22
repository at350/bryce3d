/**
 * How the Sky & Fog palette's single set of cloud controls edits two cloud layers.
 * The thumbnails show the "primary" layer (cumulus when on, else stratus); a drag moves
 * every enabled layer by the same amount (cover, amplitude) or factor (height, frequency)
 * so each layer keeps its own character. With no layer on, a drag turns cumulus on.
 */
import type { CloudLayer, Sky } from '@/core/types';
import { CLOUD_RANGES, clampTo } from './ranges';

export type CloudKey = 'stratus' | 'cumulus';

export function primaryCloud(sky: Pick<Sky, 'stratus' | 'cumulus'>): CloudKey {
  if (sky.cumulus.enabled) return 'cumulus';
  if (sky.stratus.enabled) return 'stratus';
  return 'cumulus';
}

function edited(start: Pick<Sky, 'stratus' | 'cumulus'>, fn: (layer: CloudLayer) => Partial<CloudLayer>): Pick<Sky, 'stratus' | 'cumulus'> {
  const primary = primaryCloud(start);
  const anyOn = start.stratus.enabled || start.cumulus.enabled;
  const out = { stratus: start.stratus, cumulus: start.cumulus };
  for (const key of ['stratus', 'cumulus'] as const) {
    const layer = start[key];
    if (layer.enabled) out[key] = { ...layer, ...fn(layer) };
    else if (!anyOn && key === primary) out[key] = { ...layer, ...fn(layer), enabled: true };
  }
  return out;
}

export function setCloudCover(start: Pick<Sky, 'stratus' | 'cumulus'>, cover: number): Pick<Sky, 'stratus' | 'cumulus'> {
  const delta = cover - start[primaryCloud(start)].cover;
  return edited(start, (l) => ({ cover: clampTo(CLOUD_RANGES.cover, l.cover + delta) }));
}

export function setCloudHeight(start: Pick<Sky, 'stratus' | 'cumulus'>, height: number): Pick<Sky, 'stratus' | 'cumulus'> {
  const ratio = height / Math.max(1, start[primaryCloud(start)].height);
  return edited(start, (l) => ({ height: clampTo(CLOUD_RANGES.height, l.height * ratio) }));
}

export function setCloudShape(start: Pick<Sky, 'stratus' | 'cumulus'>, frequency: number, amplitude: number): Pick<Sky, 'stratus' | 'cumulus'> {
  const p = start[primaryCloud(start)];
  const ratio = frequency / Math.max(1, p.frequency);
  const delta = amplitude - p.amplitude;
  return edited(start, (l) => ({
    frequency: clampTo(CLOUD_RANGES.frequency, l.frequency * ratio),
    amplitude: clampTo(CLOUD_RANGES.amplitude, l.amplitude + delta),
  }));
}

/** "Cloud Cover (cumulus 38, stratus 22)" style summary for the Text Display Area. */
export function describeClouds(sky: Pick<Sky, 'stratus' | 'cumulus'>, field: 'cover' | 'height' | 'frequency' | 'amplitude'): string {
  const parts: string[] = [];
  if (sky.cumulus.enabled) parts.push(`cumulus ${Math.round(sky.cumulus[field])}`);
  if (sky.stratus.enabled) parts.push(`stratus ${Math.round(sky.stratus[field])}`);
  return parts.length ? parts.join(', ') : 'no clouds (drag to add cumulus)';
}
