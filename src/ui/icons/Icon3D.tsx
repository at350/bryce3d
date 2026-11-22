/**
 * Small glossy 3D icon, rendered at runtime by the shared icon renderer and cached per
 * skin and size. Shows a soft neutral placeholder until ready, and a flat glyph if WebGL
 * is unavailable.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { useStore } from '@/core/store';
import type { Skin } from '@/core/types';
import { useUiZoom } from '@/ui/layoutScale';
import type { IconKind } from './iconKinds';
import { getAnyIconUrl, getIconUrl, iconBucket, iconKey, iconRenderingFailed, subscribeIcon } from './iconRenderer';

export interface Icon3DProps {
  kind: IconKind;
  /** Pixel size (square). Default 32. */
  size?: number;
  className?: string;
  /** Render in a specific skin instead of the current one (previews, galleries). */
  skin?: Skin;
}

const GLYPHS: Partial<Record<IconKind, string>> = {
  sphere: '●', cube: '■', cylinder: '▮', cone: '▲', torus: '◎', pyramid: '◭', disc: '⬬', square: '▬',
  water: '≈', ground: '▁', cloud: '☁', terrain: '⛰', lattice: '◇', stone: '⬣', tree: '♣',
  radialLight: '✺', spotLight: '⚲', squareSpotLight: '⛶', parallelLight: '⇊',
  materials: '◐', editTerrain: '⛰', editObject: '✎', resize: '⤢', rotate: '⟳', reposition: '✥',
  align: '☰', randomize: '⁂', duplicate: '⧉', delete: '✕', land: '⤓', render: '◉', renderResume: '▶',
  renderClear: '↺', dice: '⚄', sun: '☀', moon: '☾', stars: '✦', cloudCover: '☁', fog: '▒', haze: '░',
  shadows: '◑', camera: '⌖', director: '⌘', eye: '◉', library: '▤', zoomIn: '+', zoomOut: '−', frame: '⛶',
  wireframe: '▦', solid: '■', selectAll: '⬚', prev: '◀', next: '▶', stop: '■', selectNone: '⬚',
  family: '⁘', objectList: '☰', depthCue: '▥', resetView: '⌂',
};

const dpr = () => (typeof window !== 'undefined' ? Math.min(3, window.devicePixelRatio || 1) : 1);

export function Icon3D({ kind, size = 32, className = '', skin: skinOverride }: Icon3DProps) {
  const currentSkin = useStore((s) => s.ui.skin);
  const skin = skinOverride ?? currentSkin;
  const zoom = useUiZoom();
  const bucket = iconBucket(size * dpr() * zoom);
  const key = iconKey(kind, skin, bucket);
  const subscribe = useCallback((cb: () => void) => subscribeIcon(kind, skin, bucket, cb), [kind, skin, bucket]);
  const snapshot = useCallback(() => getIconUrl(key) ?? getAnyIconUrl(kind, skin) ?? (iconRenderingFailed() ? 'failed' : ''), [key, kind, skin]);
  const url = useSyncExternalStore(subscribe, snapshot, () => '');
  if (url === 'failed') {
    return (
      <span className={`bk-icon3d bk-icon3d--glyph ${className}`} aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.6, lineHeight: `${size}px` }}>
        {GLYPHS[kind] ?? '•'}
      </span>
    );
  }
  if (!url) return <span className={`bk-icon3d bk-icon3d--loading ${className}`} aria-hidden="true" style={{ width: size, height: size }} />;
  return <img className={`bk-icon3d ${className}`} src={url} width={size} height={size} alt="" aria-hidden="true" draggable={false} />;
}
