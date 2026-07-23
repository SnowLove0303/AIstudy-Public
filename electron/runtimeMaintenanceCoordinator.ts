export class RuntimeMaintenanceCoordinator {
  private activeInformationCollectionTasks = 0;
  private cacheCleanupPromise: Promise<unknown> | null = null;

  get informationCollectionBusy() {
    return this.activeInformationCollectionTasks > 0;
  }

  async runInformationCollectionTask<T>(task: () => Promise<T>): Promise<T> {
    const pendingCleanup = this.cacheCleanupPromise;
    if (pendingCleanup) {
      await pendingCleanup.catch(() => undefined);
    }

    this.activeInformationCollectionTasks += 1;
    try {
      return await task();
    } finally {
      this.activeInformationCollectionTasks = Math.max(0, this.activeInformationCollectionTasks - 1);
    }
  }

  async runCacheCleanup<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeInformationCollectionTasks > 0) {
      throw new Error("信息采集任务正在运行，请完成后再清理缓存。");
    }
    if (this.cacheCleanupPromise) {
      return this.cacheCleanupPromise as Promise<T>;
    }

    const cleanup = task();
    this.cacheCleanupPromise = cleanup;
    try {
      return await cleanup;
    } finally {
      if (this.cacheCleanupPromise === cleanup) {
        this.cacheCleanupPromise = null;
      }
    }
  }
}
