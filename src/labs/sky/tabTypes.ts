import type { Sky } from '@/core/types';

/** What every Sky Lab tab receives: the working sky and how to change it. */
export interface SkyTabProps {
  sky: Sky;
  update: (patch: Partial<Sky>, key?: string) => void;
  current: () => Sky;
}
