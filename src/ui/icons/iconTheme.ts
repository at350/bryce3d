/** Per-skin icon palettes: Bryce 5 blue & silver, Bryce 2 teal & orange, Bryce 7 sage. */
import type { Skin } from '@/core/types';

export interface IconTheme {
  /** Glossy color of created objects (primitives). */
  object: string;
  /** Body of tool icons (Edit palette, display tools). */
  tool: string;
  /** Tool bodies are polished metal (true) or glossy plastic (false). */
  toolMetal: boolean;
  /** Accent balls and arrows on tool icons. */
  accent: string;
  /** Lights. */
  light: string;
  /** Chrome tint for the render balls. */
  chrome: string;
  /** Background tint used in sky tiles. */
  skyTop: string;
  skyBottom: string;
}

export const ICON_THEMES: Record<Skin, IconTheme> = {
  bryce5: {
    object: '#2445e2',
    tool: '#dfe4ec',
    toolMetal: true,
    accent: '#2445e2',
    light: '#ffd23f',
    chrome: '#e8ecf4',
    skyTop: '#3f6fe0',
    skyBottom: '#dbe8ff',
  },
  bryce2: {
    object: '#0e8c8e',
    tool: '#e8672a',
    toolMetal: false,
    accent: '#0e8c8e',
    light: '#ffab2b',
    chrome: '#efe8dc',
    skyTop: '#5a48c8',
    skyBottom: '#e9d8ff',
  },
  bryce7: {
    object: '#5f9456',
    tool: '#ccd4c6',
    toolMetal: true,
    accent: '#3f7a64',
    light: '#f3dc86',
    chrome: '#e4ebe0',
    skyTop: '#5b86a8',
    skyBottom: '#e2eee4',
  },
};
