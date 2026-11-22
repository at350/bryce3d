/** About: what this is, credits to Bryce's original creators, and the unofficial/trademark disclaimer. */
import { useStore } from '@/core/store';
import { Dialog } from '@/ui/kit';

export function AboutDialog() {
  const close = () => useStore.getState().closeDialog();
  return (
    <Dialog title="About Bryce 3D Web" width={460} onClose={close} onConfirm={close}>
      <div className="about">
        <div className="about__hero" aria-hidden="true">
          <svg viewBox="0 0 220 70" width="220" height="70">
            <defs>
              <linearGradient id="about-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2a2f7a" />
                <stop offset="0.6" stopColor="#c86a9a" />
                <stop offset="1" stopColor="#ffc07a" />
              </linearGradient>
              <radialGradient id="about-ball" cx="0.35" cy="0.3" r="0.8">
                <stop offset="0" stopColor="#fff" />
                <stop offset="0.5" stopColor="#9fb0d8" />
                <stop offset="1" stopColor="#1a2048" />
              </radialGradient>
            </defs>
            <rect width="220" height="70" rx="8" fill="url(#about-sky)" />
            <path d="M0 52 L30 30 L44 40 L70 14 L96 42 L120 30 L150 46 L176 26 L220 50 L220 70 L0 70 Z" fill="#2b2534" />
            <rect y="54" width="220" height="16" fill="#1d3b5a" opacity="0.85" />
            <circle cx="176" cy="44" r="9" fill="url(#about-ball)" />
          </svg>
        </div>
        <p>
          <b>Bryce 3D Web</b> is an unofficial, browser-based homage to Bryce, the playful landscape ray tracer of
          the 1990s and 2000s: fractal terrains, infinite reflective seas, chrome spheres and surreal skies,
          rendered in chunky mosaic passes.
        </p>
        <p>
          Bryce was originally created by <b>Eric Wenger</b>, <b>Kai Krause</b>, <b>Phil Clevenger</b> and{' '}
          <b>Sree Kotay</b>, and grew through MetaTools, MetaCreations, Corel and DAZ 3D with many more people
          over the years. This project celebrates their work; every line of code, icon and preset here is new.
        </p>
        <p className="about__legal">
          Not affiliated with or endorsed by DAZ 3D or any former owner. “Bryce” is a trademark of DAZ 3D,
          used here only to describe what this tribute is about. No original Bryce code, artwork, icons or
          presets are included.
        </p>
        <p className="about__links">
          <a href="https://github.com/at350/bryce3d" target="_blank" rel="noopener noreferrer">
            Source code on GitHub
          </a>
          <span aria-hidden="true"> · </span>
          <a href="https://en.wikipedia.org/wiki/Bryce_(software)" target="_blank" rel="noopener noreferrer">
            Bryce on Wikipedia
          </a>
        </p>
      </div>
    </Dialog>
  );
}
