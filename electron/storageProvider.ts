export type DbFirstStorageSource = "database" | "cache";

export type DbFirstStorageResult<T> = {
  value: T;
  source: DbFirstStorageSource;
  databaseAvailable: boolean;
};

export type DbFirstStorageProvider<T> = {
  name: string;
  readCache: () => Promise<T>;
  writeCache: (value: T) => Promise<T>;
  readDatabase: (cache: T) => Promise<T>;
  writeDatabase: (value: T) => Promise<T>;
};

export async function readDbFirstStore<T>(provider: DbFirstStorageProvider<T>): Promise<DbFirstStorageResult<T>> {
  const cache = await provider.readCache();
  try {
    const databaseValue = await provider.readDatabase(cache);
    try {
      const cachedValue = await provider.writeCache(databaseValue);
      return {
        value: cachedValue,
        source: "database",
        databaseAvailable: true
      };
    } catch (error) {
      console.warn(`${provider.name} cache write after database read failed.`, error);
    }
    return {
      value: databaseValue,
      source: "database",
      databaseAvailable: true
    };
  } catch (error) {
    console.warn(`${provider.name} database read failed. Falling back to local cache.`, error);
    return {
      value: cache,
      source: "cache",
      databaseAvailable: false
    };
  }
}

export async function writeDbFirstStore<T>(
  provider: Pick<DbFirstStorageProvider<T>, "name" | "writeCache" | "writeDatabase">,
  value: T
): Promise<DbFirstStorageResult<T>> {
  try {
    const databaseValue = await provider.writeDatabase(value);
    try {
      const cachedValue = await provider.writeCache(databaseValue);
      return {
        value: cachedValue,
        source: "database",
        databaseAvailable: true
      };
    } catch (error) {
      console.warn(`${provider.name} cache write after database save failed.`, error);
    }
    return {
      value: databaseValue,
      source: "database",
      databaseAvailable: true
    };
  } catch (error) {
    console.warn(`${provider.name} database write failed. Saving to local cache.`, error);
    const cachedValue = await provider.writeCache(value);
    return {
      value: cachedValue,
      source: "cache",
      databaseAvailable: false
    };
  }
}
