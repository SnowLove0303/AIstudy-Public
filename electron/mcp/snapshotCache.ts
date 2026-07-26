export class SnapshotCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly maxEntries = 64) {}

  get(snapshotId: string) {
    const value = this.entries.get(snapshotId);
    if (value === undefined) return undefined;
    this.entries.delete(snapshotId);
    this.entries.set(snapshotId, value);
    return value;
  }

  set(snapshotId: string, value: T) {
    this.entries.delete(snapshotId);
    this.entries.set(snapshotId, value);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
