/**
 * Shared screen-space line materials (three's LineMaterial: crisp lines of a fixed CSS-pixel
 * width on any display). LineSegments2 updates each material's resolution before drawing.
 */
import { Color, SRGBColorSpace } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { RGB } from '@/core/types';

export interface LineStyle {
  color: RGB;
  /** CSS pixels. */
  width: number;
  opacity?: number;
  /** Fade with distance (depth cue) using the scene fog. */
  fog?: boolean;
}

export class LineMaterials {
  private cache = new Map<string, LineMaterial>();

  get(style: LineStyle): LineMaterial {
    const opacity = style.opacity ?? 1;
    const fog = !!style.fog;
    const key = `${style.color.map((c) => c.toFixed(3)).join(',')}|${style.width}|${opacity.toFixed(3)}|${fog}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new LineMaterial({
        color: new Color().setRGB(style.color[0], style.color[1], style.color[2], SRGBColorSpace),
        linewidth: style.width,
        worldUnits: false,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
        fog,
      });
      this.cache.set(key, m);
    }
    return m;
  }

  dispose(): void {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
  }
}
