export class SnapshotCache {
  #entries = new Map();
  #totalBytes = 0;

  constructor({ maxEntries, maxBytes }) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
  }

  get(snapshotId) {
    const entry = this.#entries.get(snapshotId);
    if (!entry) return null;
    this.#entries.delete(snapshotId);
    this.#entries.set(snapshotId, entry);
    return entry.value;
  }

  set(snapshotId, value, sizeBytes) {
    const normalizedSize = Number.isFinite(sizeBytes) ? Math.max(0, Math.trunc(sizeBytes)) : 0;
    const previous = this.#entries.get(snapshotId);
    if (previous) {
      this.#entries.delete(snapshotId);
      this.#totalBytes -= previous.sizeBytes;
    }
    if (normalizedSize > this.maxBytes) return;
    this.#entries.set(snapshotId, { value, sizeBytes: normalizedSize });
    this.#totalBytes += normalizedSize;
    while (this.#entries.size > this.maxEntries || this.#totalBytes > this.maxBytes) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      const entry = this.#entries.get(oldest);
      this.#entries.delete(oldest);
      this.#totalBytes -= entry?.sizeBytes ?? 0;
    }
  }
}
