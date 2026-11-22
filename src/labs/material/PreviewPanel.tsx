/**
 * The Materials Lab preview: the ray tracer renders the working material on a sphere,
 * cube or plane (debounced after every change; drag to orbit, double-click to reset),
 * next to an instant CPU swatch. If the ray tracer is unavailable the CPU render
 * stands in for it.
 */
import { useEffect, useRef, useState } from 'react';
import { clamp } from '@/core/math';
import type { Material } from '@/core/types';
import { renderMaterialPixels } from '@/materials/cpuPreview';
import { materialPreviewScene, type PreviewShape } from '@/materials/previewScene';
import { getRenderer } from '@/render';
import { Icon3D, IconButton, useHint, usePointerDrag, type IconKind } from '@/ui/kit';
import { PixelCanvas } from './PixelCanvas';

const SHAPES: { shape: PreviewShape; icon: IconKind; hint: string }[] = [
  { shape: 'sphere', icon: 'sphere', hint: 'Preview on a sphere' },
  { shape: 'cube', icon: 'cube', hint: 'Preview on a cube' },
  { shape: 'plane', icon: 'square', hint: 'Preview on a plane (water, ground, terrain looks)' },
];

const PREVIEW_SIZE = 300;
const SWATCH_SIZE = 96;

const paintSwatch = (m: Material, w: number, h: number) => renderMaterialPixels(m, w, h, { shape: 'swatch', maxOctaves: 6 });
const paintSphere = (m: Material, w: number, h: number) => renderMaterialPixels(m, w, h, { shape: 'sphere', maxOctaves: 6 });
const paintPlane = (m: Material, w: number, h: number) => renderMaterialPixels(m, w, h, { shape: 'plane', maxOctaves: 6 });

export function PreviewPanel({ material, shape, onShape }: { material: Material; shape: PreviewShape; onShape: (s: PreviewShape) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ yaw: 0, pitch: 0 });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const renderer = getRenderer();
  const gpu = renderer.supported && !failed;
  const resolution = Math.round(PREVIEW_SIZE * Math.min(2, Math.max(1, window.devicePixelRatio || 1)));

  useEffect(() => {
    const target = canvas.current;
    if (!target || !gpu) return;
    let alive = true;
    const timer = window.setTimeout(
      () => {
        setBusy(true);
        renderer
          .preview(materialPreviewScene(material, { shape, yaw: view.yaw, pitch: view.pitch }), target, {
            width: resolution,
            height: resolution,
            quality: 'preview',
            key: 'materialLab',
          })
          .then(() => alive && setBusy(false))
          .catch(() => {
            if (!alive) return;
            setBusy(false);
            setFailed(true);
          });
      },
      dragging ? 16 : 120,
    );
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [material, shape, view, dragging, gpu, renderer, resolution]);

  const onPointerDown = usePointerDrag({
    onStart: () => setDragging(true),
    onMove: (dx, dy) => setView((v) => ({ yaw: ((v.yaw + dx * 0.6 + 540) % 360) - 180, pitch: clamp(v.pitch - dy * 0.35, -12, 55) })),
    onEnd: () => setDragging(false),
  });
  const previewHint = useHint('Material preview: drag to orbit, double-click to reset the view');

  return (
    <div className="ml-preview">
      <div className={`ml-preview__frame ${busy ? 'is-busy' : ''}`} onPointerDown={onPointerDown} onDoubleClick={() => setView({ yaw: 0, pitch: 0 })} {...previewHint}>
        {gpu ? (
          <canvas ref={canvas} width={resolution} height={resolution} className="ml-preview__canvas" role="img" aria-label={`Preview of ${material.name}`} />
        ) : (
          <PixelCanvas
            source={material}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            paint={shape === 'plane' ? paintPlane : paintSphere}
            delay={60}
            className="ml-preview__canvas"
            label={`Preview of ${material.name}`}
          />
        )}
        {busy && <span className="ml-preview__busy">Rendering</span>}
      </div>
      <div className="ml-preview__row">
        <div className="ml-preview__shapes" role="radiogroup" aria-label="Preview shape">
          {SHAPES.map((s) => (
            <IconButton key={s.shape} hint={s.hint} size={34} active={shape === s.shape} onClick={() => onShape(s.shape)}>
              <Icon3D kind={s.icon} size={26} />
            </IconButton>
          ))}
        </div>
        <Swatch material={material} />
      </div>
    </div>
  );
}

function Swatch({ material }: { material: Material }) {
  return (
    <div className="ml-flat" {...useHint('Flat swatch: an instant CPU sketch of the material on a tilted square')}>
      <PixelCanvas source={material} width={SWATCH_SIZE} height={SWATCH_SIZE} paint={paintSwatch} delay={90} className="ml-flat__canvas" label="Flat swatch" />
    </div>
  );
}
