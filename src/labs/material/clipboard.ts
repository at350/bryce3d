/**
 * The Materials Lab's own clipboard (Bryce kept a dedicated material clipboard so copying
 * a material never disturbs the system clipboard). It lives for the whole session, so a
 * material copied in one lab visit can be pasted onto another object later.
 */
import { cloneMaterial } from '@/core/materialUtils';
import type { Material } from '@/core/types';

let clip: Material | null = null;

export function copyMaterial(m: Material): void {
  clip = cloneMaterial(m);
}

/** A fresh copy of the clipboard material, or null when empty. */
export function pasteMaterial(): Material | null {
  return clip ? cloneMaterial(clip) : null;
}

export function clipboardName(): string | null {
  return clip?.name ?? null;
}
