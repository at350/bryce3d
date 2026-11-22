/**
 * A component's three outputs, Bryce style: the Color swatch (gradient applied), the Alpha
 * (grayscale value that drives value channels) and the Bump relief. All three come from a
 * single CPU evaluation of the pattern.
 */
import { useEffect, useRef } from 'react';
import type { TextureComponent } from '@/core/types';
import { componentField, fieldToPixels, type SwatchMode } from '@/materials/texturePreview';
import { useHint } from '@/ui/kit';

const SIZE = 84;

export function TextureSwatch({ component, letter }: { component: TextureComponent; letter: string }) {
  const color = useRef<HTMLCanvasElement>(null);
  const alpha = useRef<HTMLCanvasElement>(null);
  const bump = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const field = componentField(component, SIZE);
      const targets: [HTMLCanvasElement | null, SwatchMode][] = [[color.current, 'color'], [alpha.current, 'alpha'], [bump.current, 'bump']];
      for (const [canvas, mode] of targets) {
        const ctx = canvas?.getContext('2d');
        if (ctx) ctx.putImageData(new ImageData(fieldToPixels(component, field, SIZE, mode), SIZE, SIZE), 0, 0);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [component]);
  return (
    <div className="ml-swatch">
      <canvas ref={color} width={SIZE} height={SIZE} className="ml-swatch__color" {...useHint(`Component ${letter}: color output`)} />
      <div className="ml-swatch__outputs">
        <canvas ref={alpha} width={SIZE} height={SIZE} {...useHint(`Component ${letter}: value (alpha) output, drives value channels`)} />
        <canvas ref={bump} width={SIZE} height={SIZE} {...useHint(`Component ${letter}: bump output`)} />
      </div>
    </div>
  );
}
