type SnapshotCacheEntry<T> = {
  value: T;
  sizeBytes: number;
};

type SnapshotCacheOptions = {
  maxEntries: number;
  maxBytes: number;
};

export class SnapshotCache<T> {
  private readonly entries = new Map<string, SnapshotCacheEntry<T>>();
  private totalBytes = 0;

  constructor(private readonly options: SnapshotCacheOptions) {}

  get(snapshotId: string) {
    const entry = this.entries.get(snapshotId);
    if (entry === undefined) return undefined;
    this.entries.delete(snapshotId);
    this.entries.set(snapshotId, entry);
    return entry.value;
  }

  set(snapshotId: string, value: T, sizeBytes: number) {
    const normalizedSize = Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0;
    const previous = this.entries.get(snapshotId);
    if (previous) {
      this.entries.delete(snapshotId);
      this.totalBytes -= previous.sizeBytes;
    }
    if (normalizedSize > this.options.maxBytes) return;
    this.entries.set(snapshotId, { value, sizeBytes: normalizedSize });
    this.totalBytes += normalizedSize;
    while (this.entries.size > this.options.maxEntries || this.totalBytes > this.options.maxBytes) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const entry = this.entries.get(oldest);
      this.entries.delete(oldest);
      this.totalBytes -= entry?.sizeBytes ?? 0;
    }
  }
}
