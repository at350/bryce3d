/**
 * Small glossy 3D icon. NOTE: foundation stub (a flat glyph); the ui owner replaces the
 * implementation with runtime-rendered three.js icons, keeping the props.
 */
import type { IconKind } from './iconKinds';

export interface Icon3DProps {
  kind: IconKind;
  /** Pixel size (square). Default 32. */
  size?: number;
  className?: string;
}

const GLYPHS: Partial<Record<IconKind, string>> = {
  sphere: '●', cube: '■', cylinder: '▮', cone: '▲', torus: '◎', pyramid: '◭', disc: '⬬', square: '▬',
  water: '≈', ground: '▁', cloud: '☁', terrain: '⛰', lattice: '◇', stone: '⬣', tree: '♣',
  radialLight: '✺', spotLight: '⚲', squareSpotLight: '⛶', parallelLight: '⇊',
  materials: '◐', editTerrain: '⛰', editObject: '✎', resize: '⤢', rotate: '⟳', reposition: '✥',
  align: '☰', randomize: '⁂', duplicate: '⧉', delete: '✕', land: '⤓', render: '◉', renderResume: '▶',
  renderClear: '↺', dice: '⚄', sun: '☀', moon: '☾', stars: '✦', cloudCover: '☁', fog: '▒', haze: '░',
  shadows: '◑', camera: '⌖', director: '⌘', eye: '◉', library: '▤', zoomIn: '+', zoomOut: '−', frame: '⛶',
  wireframe: '▦', solid: '■', selectAll: '⬚', prev: '◀', next: '▶',
};

export function Icon3D({ kind, size = 32, className = '' }: Icon3DProps) {
  return (
    <span
      className={`bk-icon3d ${className}`}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.62, lineHeight: `${size}px` }}
    >
      {GLYPHS[kind] ?? '•'}
    </span>
  );
}
