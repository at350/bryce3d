/** Dev harness: every preset thumbnail of a library kind in one page (?kind=objects|materials|skies|scenes). */
import type { LibraryKind } from '@/core/types';
import { librarySpec } from '@/ui/library/libraryItems';
import { getThumbnail, wantThumbnails } from '@/ui/library/thumbnails';

const kind = (new URLSearchParams(location.search).get('kind') ?? 'objects') as LibraryKind;
const spec = librarySpec(kind);
const out = document.getElementById('out')!;
const figures = new Map<string, HTMLElement>();
for (const category of spec.categories) {
  const h = document.createElement('h2');
  h.textContent = category;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const item of spec.items.filter((it) => it.category === category)) {
    const fig = document.createElement('figure');
    fig.className = spec.wide ? '' : 'square';
    fig.innerHTML = `<div class="ph"></div><figcaption>${item.name}</figcaption>`;
    grid.append(fig);
    figures.set(item.thumb.key, fig);
  }
  out.append(h, grid);
}
wantThumbnails(spec.items.map((it) => it.thumb));
const timer = setInterval(() => {
  let pending = 0;
  for (const [key, fig] of figures) {
    const url = getThumbnail(key);
    if (!url) {
      pending++;
      continue;
    }
    const ph = fig.querySelector('.ph');
    if (ph) {
      const img = document.createElement('img');
      img.src = url;
      ph.replaceWith(img);
    }
  }
  (window as unknown as { __thumbsPending: number }).__thumbsPending = pending;
  if (!pending) clearInterval(timer);
}, 400);
