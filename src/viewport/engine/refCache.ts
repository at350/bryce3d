/**
 * Reference-counted cache for GPU resources shared between objects (e.g. one terrain wire
 * grid per heights array, one sphere wire for all spheres). Keys may be objects (identity).
 */
export class RefCache<T extends { dispose(): void }> {
  private entries = new Map<unknown, Map<string, { value: T; refs: number }>>();

  acquire(key: unknown, sub: string, build: () => T): T {
    let bucket = this.entries.get(key);
    if (!bucket) {
      bucket = new Map();
      this.entries.set(key, bucket);
    }
    let e = bucket.get(sub);
    if (!e) {
      e = { value: build(), refs: 0 };
      bucket.set(sub, e);
    }
    e.refs++;
    return e.value;
  }

  release(key: unknown, sub: string): void {
    const bucket = this.entries.get(key);
    const e = bucket?.get(sub);
    if (!bucket || !e) return;
    e.refs--;
    if (e.refs > 0) return;
    e.value.dispose();
    bucket.delete(sub);
    if (!bucket.size) this.entries.delete(key);
  }

  get size(): number {
    let n = 0;
    this.entries.forEach((b) => (n += b.size));
    return n;
  }

  dispose(): void {
    this.entries.forEach((b) => b.forEach((e) => e.value.dispose()));
    this.entries.clear();
  }
}
