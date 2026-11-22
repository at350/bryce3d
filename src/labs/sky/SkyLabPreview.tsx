/**
 * The Sky Lab's large live preview: the sky preview scene (or your own scene) rendered
 * with the working sky. Every change shows a quick low-resolution pass at once, then a
 * full-quality pass once the edits pause. Drag to look around, wheel to zoom,
 * double-click to reset the view.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { look, orbit, zoomFov } from '@/core/cameraOps';
import { useStore } from '@/core/store';
import type { CameraState, Scene, Sky } from '@/core/types';
import { getRenderer } from '@/render';
import { skyPreviewScene } from '@/sky/previewScene';
import { Button, useHint, usePointerDrag } from '@/ui/kit';

export type PreviewTarget = 'sky' | 'scene';

const MAX_WIDTH = 640;
const FULL_DELAY_MS = 140;

function useCanvasSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 480, h: 360 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (width <= 0) return;
      const dpr = Math.min(1.25, window.devicePixelRatio || 1);
      const w = Math.max(160, Math.min(MAX_WIDTH, Math.round(width * dpr)));
      setSize((s) => (s.w === w ? s : { w, h: Math.round((w * 3) / 4) }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function SkyLabPreview({ sky, target, onTarget }: { sky: Sky; target: PreviewTarget; onTarget: (t: PreviewTarget) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const fast = useRef<HTMLCanvasElement>(null);
  const full = useRef<HTMLCanvasElement>(null);
  const version = useRef(0);
  const size = useCanvasSize(frame);
  const userScene = useStore((s) => s.scene);
  const [view, setView] = useState<{ target: PreviewTarget; camera: CameraState } | null>(null);
  const scene: Scene = useMemo(() => (target === 'sky' ? skyPreviewScene(sky) : { ...userScene, sky }), [sky, target, userScene]);
  const camera = view && view.target === target ? view.camera : scene.camera;
  const fw = Math.max(1, Math.round(size.w / 2));
  const fh = Math.max(1, Math.round(size.h / 2));

  useEffect(() => {
    const quick = fast.current;
    const fine = full.current;
    if (!quick || !fine) return;
    const v = ++version.current;
    const renderer = getRenderer();
    fine.classList.remove('is-ready');
    void renderer.preview(scene, quick, { width: fw, height: fh, quality: 'nano', key: 'skyLab:fast', camera });
    const timer = setTimeout(() => {
      void renderer.preview(scene, fine, { width: size.w, height: size.h, quality: 'preview', key: 'skyLab', camera }).then(() => {
        if (v === version.current) fine.classList.add('is-ready');
      });
    }, FULL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [scene, camera, size, fw, fh]);

  const onPointerDown = usePointerDrag({
    onMove: (dx, dy, e) => {
      const k = e.shiftKey ? 0.25 : 1;
      setView((v) => {
        const base = v && v.target === target ? v.camera : scene.camera;
        const next = target === 'sky' ? look(base, dx * 0.15 * k, dy * 0.15 * k) : orbit(base, -dx * 0.4 * k, dy * 0.4 * k);
        return { target, camera: next };
      });
    },
  });
  const hint = useHint(target === 'sky' ? 'Preview: drag to look around the sky, wheel to zoom, double-click to reset' : 'Preview of your scene with this sky: drag to orbit, wheel to zoom, double-click to reset');
  const renderer = getRenderer();
  return (
    <section className="skylab__preview">
      <div
        ref={frame}
        className="skylab__frame"
        onPointerDown={onPointerDown}
        onDoubleClick={() => setView(null)}
        onWheel={(e) => setView({ target, camera: zoomFov(camera, e.deltaY > 0 ? 1.08 : 1 / 1.08) })}
        {...hint}
      >
        <canvas ref={fast} className="skylab__canvas skylab__canvas--fast" width={fw} height={fh} aria-label="Sky preview" />
        <canvas ref={full} className="skylab__canvas skylab__canvas--full" width={size.w} height={size.h} aria-hidden="true" />
        {!renderer.supported && <div className="skylab__nogl">{renderer.error ?? 'The 3D preview needs WebGL2.'}</div>}
      </div>
      <div className="skylab__previewbar">
        <div className="skylab__segment" role="group" aria-label="Preview">
          <Button pressed={target === 'sky'} hint="Preview the sky over a calm sea with a chrome ball" onClick={() => onTarget('sky')}>
            Sky Preview
          </Button>
          <Button pressed={target === 'scene'} hint="Preview your own scene under this sky" onClick={() => onTarget('scene')}>
            Your Scene
          </Button>
        </div>
        <Button variant="ghost" hint="Reset the preview camera" disabled={!view} onClick={() => setView(null)}>
          Reset View
        </Button>
      </div>
    </section>
  );
}
