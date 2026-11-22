/** Shared lab types and tiny helpers. */
import type { TextureComponent } from '@/core/types';
import type { MaterialHistory } from './useMaterialHistory';

/** What editing panels need from the lab's working copy. */
export type LabEditor = Pick<MaterialHistory, 'material' | 'update' | 'begin' | 'end'>;

const css = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;

/** A CSS linear-gradient matching a component's color gradient. */
export function gradientCss(c: Pick<TextureComponent, 'gradient'>): string {
  const stops = c.gradient.map((s) => `${css(s.color)} ${Math.round(s.at * 1000) / 10}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}
