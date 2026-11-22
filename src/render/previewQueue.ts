/**
 * Pending preview requests. Requests sharing a key supersede each other: an older pending
 * request resolves immediately (without drawing) when a newer one with the same key
 * arrives. Higher-priority requests (Nano Preview) are served before thumbnails.
 */
export interface QueuedPreview<T> {
  key?: string;
  priority: number;
  payload: T;
  resolve: () => void;
}

export class PreviewQueue<T> {
  private items: QueuedPreview<T>[] = [];
  private seq = 0;
  private order = new WeakMap<QueuedPreview<T>, number>();

  get size(): number {
    return this.items.length;
  }

  push(item: QueuedPreview<T>): void {
    if (item.key !== undefined) {
      const stale = this.items.filter((i) => i.key === item.key);
      this.items = this.items.filter((i) => i.key !== item.key);
      stale.forEach((i) => i.resolve());
    }
    this.order.set(item, this.seq++);
    this.items.push(item);
  }

  /** True when a newer request with this key is waiting (the running job is stale). */
  hasPending(key: string | undefined): boolean {
    return key !== undefined && this.items.some((i) => i.key === key);
  }

  /** Remove and return the next request: lowest priority number first, then FIFO. */
  shift(): QueuedPreview<T> | undefined {
    if (!this.items.length) return undefined;
    let best = 0;
    for (let i = 1; i < this.items.length; i++) {
      const a = this.items[i];
      const b = this.items[best];
      if (a.priority < b.priority || (a.priority === b.priority && (this.order.get(a) ?? 0) < (this.order.get(b) ?? 0))) best = i;
    }
    return this.items.splice(best, 1)[0];
  }

  /** Resolve and drop everything (renderer shutdown / unsupported). */
  flush(): void {
    const all = this.items;
    this.items = [];
    all.forEach((i) => i.resolve());
  }
}
