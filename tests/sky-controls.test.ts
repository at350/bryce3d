import { describe, expect, it } from 'vitest';
import { describeClouds, primaryCloud, setCloudCover, setCloudHeight, setCloudShape } from '@/sky/cloudEdit';
import { defaultSky, makeCloudLayer } from '@/sky/defaults';
import { ballPosition } from '@/sky/paint/ball';
import { moonPhaseName, rollSun } from '@/sky/sun';

const layers = (stratus: Parameters<typeof makeCloudLayer>[0], cumulus: Parameters<typeof makeCloudLayer>[0]) => ({
  stratus: makeCloudLayer(stratus),
  cumulus: makeCloudLayer(cumulus),
});

describe('palette cloud controls', () => {
  it('the primary layer is cumulus when on, else stratus', () => {
    expect(primaryCloud(layers({ enabled: true }, { enabled: true }))).toBe('cumulus');
    expect(primaryCloud(layers({ enabled: true }, { enabled: false }))).toBe('stratus');
    expect(primaryCloud(layers({ enabled: false }, { enabled: false }))).toBe('cumulus');
  });

  it('cover moves every enabled layer by the same amount, clamped', () => {
    const start = layers({ enabled: true, cover: 20 }, { enabled: true, cover: 40 });
    const next = setCloudCover(start, 70);
    expect(next.cumulus.cover).toBe(70);
    expect(next.stratus.cover).toBe(50);
    expect(setCloudCover(start, 100).stratus.cover).toBe(80);
    expect(setCloudCover(start, 0).stratus.cover).toBe(0);
  });

  it('leaves disabled layers alone', () => {
    const start = layers({ enabled: false, cover: 20 }, { enabled: true, cover: 40 });
    const next = setCloudCover(start, 60);
    expect(next.stratus).toBe(start.stratus);
    expect(next.cumulus.cover).toBe(60);
  });

  it('with no clouds, dragging turns cumulus on', () => {
    const start = layers({ enabled: false }, { enabled: false, cover: 0 });
    const next = setCloudCover(start, 35);
    expect(next.cumulus.enabled).toBe(true);
    expect(next.cumulus.cover).toBe(35);
    expect(next.stratus.enabled).toBe(false);
  });

  it('height scales layers together, frequency scales and amplitude shifts', () => {
    const start = layers({ enabled: true, height: 1800, frequency: 60, amplitude: 60 }, { enabled: true, height: 600, frequency: 120, amplitude: 160 });
    const h = setCloudHeight(start, 900);
    expect(h.cumulus.height).toBeCloseTo(900);
    expect(h.stratus.height).toBeCloseTo(2700);
    const s = setCloudShape(start, 240, 200);
    expect(s.cumulus.frequency).toBeCloseTo(240);
    expect(s.stratus.frequency).toBeCloseTo(120);
    expect(s.cumulus.amplitude).toBeCloseTo(200);
    expect(s.stratus.amplitude).toBeCloseTo(100);
  });

  it('never mutates its input', () => {
    const sky = defaultSky();
    const snapshot = JSON.stringify(sky);
    setCloudCover(sky, 90);
    setCloudHeight(sky, 2000);
    setCloudShape(sky, 300, 300);
    expect(JSON.stringify(sky)).toBe(snapshot);
  });

  it('summarizes the layers for the Text Display Area', () => {
    expect(describeClouds(layers({ enabled: true, cover: 22 }, { enabled: true, cover: 38 }), 'cover')).toBe('cumulus 38, stratus 22');
    expect(describeClouds(layers({ enabled: false }, { enabled: false }), 'cover')).toMatch(/no clouds/);
  });
});

describe('sun ball and moon', () => {
  it('maps the zenith to the center and the horizon to the rim (12 o\'clock = azimuth 0)', () => {
    const top = ballPosition(123, 90);
    expect(top.x).toBeCloseTo(0);
    expect(top.y).toBeCloseTo(0);
    const ahead = ballPosition(0, 0);
    expect(ahead.x).toBeCloseTo(0);
    expect(ahead.y).toBeCloseTo(-1);
    const right = ballPosition(90, 45);
    expect(right.x).toBeCloseTo(0.5);
    expect(right.y).toBeCloseTo(0);
  });

  it('a drag from the zenith moves the highlight by exactly the dragged distance', () => {
    const size = 100;
    const p = rollSun({ sunAzimuth: 0, sunAltitude: 90 }, 25, 0, size);
    const b = ballPosition(p.sunAzimuth, p.sunAltitude);
    expect(b.x * (size / 2)).toBeCloseTo(25, 5);
  });

  it('names the moon phases', () => {
    expect(moonPhaseName(0)).toBe('New moon');
    expect(moonPhaseName(0.15)).toBe('Waxing crescent');
    expect(moonPhaseName(0.25)).toBe('First quarter');
    expect(moonPhaseName(0.5)).toBe('Full moon');
    expect(moonPhaseName(0.75)).toBe('Last quarter');
    expect(moonPhaseName(0.9)).toBe('Waning crescent');
    expect(moonPhaseName(1)).toBe('New moon');
  });
});
