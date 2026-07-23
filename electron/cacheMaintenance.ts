import { existsSync, type Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type StorageFootprintKind =
  | "application"
  | "data"
  | "runtime-cache"
  | "database"
  | "backup"
  | "log"
  | "preference";

export type StorageFootprintEntry = {
  id: string;
  name: string;
  kind: StorageFootprintKind;
  path: string;
  exists: boolean;
  bytes: number;
  files: number;
  directories: number;
  cleanable: boolean;
  note: string;
};

export type DatabaseTableFootprint = {
  name: string;
  rowCount: number | null;
  dataBytes: number;
  indexBytes: number;
  totalBytes: number;
};

export type DatabaseFootprint = {
  connected: boolean;
  provider: string;
  sourceKey: string;
  database: string;
  totalBytes: number;
  tableCount: number;
  tables: DatabaseTableFootprint[];
  message: string;
};

export type StorageFootprintReport = {
  scannedAt: string;
  dataRoot: string;
  userDataRoot: string;
  appRoot: string;
  totalBytes: number;
  cleanableBytes: number;
  databaseBytes: number;
  entries: StorageFootprintEntry[];
  database: DatabaseFootprint;
};

export type CacheCleanupResult = {
  cleanedAt: string;
  beforeBytes: number;
  afterBytes: number;
  releasedBytes: number;
  removedEntries: number;
  report: StorageFootprintReport;
};

export type CacheMaintenanceOptions = {
  dataRoot: string;
  userDataRoot: string;
  appRoot: string;
  chromeRuntimeRoot: string;
  legacyChromeRuntimeRoot?: string;
  localDatabasePaths: string[];
  database: DatabaseFootprint;
  informationCollectionBusy?: boolean;
  clearSessionCache?: () => Promise<void>;
};

type Usage = {
  bytes: number;
  files: number;
  directories: number;
  exists: boolean;
};

type MeasuredPath = {
  path: string;
  usage: Usage;
};

const EMPTY_USAGE: Usage = {
  bytes: 0,
  files: 0,
  directories: 0,
  exists: false
};

const CHROME_CACHE_DIRECTORY_NAMES = new Set([
  "cache",
  "code cache",
  "gpucache",
  "dawncache",
  "shadercache",
  "grshadercache",
  "cachestorage"
]);

function normalizePath(value: string) {
  return path.resolve(value);
}

function isSamePath(left: string, right: string) {
  return normalizePath(left).toLowerCase() === normalizePath(right).toLowerCase();
}

function isPathInside(child: string, parent: string) {
  const relative = path.relative(normalizePath(parent), normalizePath(child));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isSameOrInside(child: string, parent: string) {
  return isSamePath(child, parent) || isPathInside(child, parent);
}

async function measureDirectory(directoryPath: string): Promise<Usage> {
  const root = normalizePath(directoryPath);
  if (!existsSync(root)) return EMPTY_USAGE;

  const usage: Usage = {
    bytes: 0,
    files: 0,
    directories: 0,
    exists: true
  };
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          usage.directories += 1;
          stack.push(entryPath);
        } else if (entry.isFile()) {
          const stat = await fs.stat(entryPath);
          usage.bytes += stat.size;
          usage.files += 1;
        }
      } catch {
        continue;
      }
    }
  }
  return usage;
}

async function measureFiles(directoryPath: string, predicate: (fileName: string) => boolean): Promise<Usage> {
  const root = normalizePath(directoryPath);
  if (!existsSync(root)) return EMPTY_USAGE;

  const usage: Usage = {
    bytes: 0,
    files: 0,
    directories: 0,
    exists: true
  };
  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return usage;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !predicate(entry.name)) continue;
    try {
      const stat = await fs.stat(path.join(root, entry.name));
      usage.bytes += stat.size;
      usage.files += 1;
    } catch {
      continue;
    }
  }
  return usage;
}

async function collectCacheDirectories(rootPath: string, maxDepth = 6): Promise<string[]> {
  const root = normalizePath(rootPath);
  if (!existsSync(root)) return [];

  const result: string[] = [];
  const stack: Array<{ directoryPath: string; depth: number }> = [{ directoryPath: root, depth: 0 }];
  while (stack.length) {
    const { directoryPath, depth } = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directoryPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = path.join(directoryPath, entry.name);
      const normalizedName = entry.name.trim().toLowerCase();
      if (CHROME_CACHE_DIRECTORY_NAMES.has(normalizedName)) {
        result.push(entryPath);
        continue;
      }
      if (depth < maxDepth) {
        stack.push({ directoryPath: entryPath, depth: depth + 1 });
      }
    }
  }
  return Array.from(new Set(result.map(normalizePath)));
}

async function measurePaths(paths: string[]): Promise<MeasuredPath[]> {
  const uniquePaths = Array.from(new Set(paths.map(normalizePath)));
  const measured: MeasuredPath[] = [];
  for (const targetPath of uniquePaths) {
    measured.push({
      path: targetPath,
      usage: await measureDirectory(targetPath)
    });
  }
  return measured;
}

function sumUsages(usages: Usage[]): Usage {
  return usages.reduce<Usage>(
    (total, usage) => ({
      exists: total.exists || usage.exists,
      bytes: total.bytes + usage.bytes,
      files: total.files + usage.files,
      directories: total.directories + usage.directories
    }),
    { ...EMPTY_USAGE }
  );
}

function createEntry(
  id: string,
  name: string,
  kind: StorageFootprintKind,
  targetPath: string,
  usage: Usage,
  cleanable: boolean,
  note: string
): StorageFootprintEntry {
  return {
    id,
    name,
    kind,
    path: normalizePath(targetPath),
    exists: usage.exists,
    bytes: usage.bytes,
    files: usage.files,
    directories: usage.directories,
    cleanable,
    note
  };
}

function sumNonOverlappingRoots(entries: StorageFootprintEntry[]) {
  const roots: StorageFootprintEntry[] = [];
  for (const entry of entries.filter((item) => item.exists && item.bytes > 0)) {
    if (roots.some((root) => isSameOrInside(entry.path, root.path))) continue;
    for (let index = roots.length - 1; index >= 0; index -= 1) {
      if (isPathInside(roots[index].path, entry.path)) roots.splice(index, 1);
    }
    roots.push(entry);
  }
  return roots.reduce((total, entry) => total + entry.bytes, 0);
}

export function createDisconnectedDatabaseFootprint(input: Partial<Pick<DatabaseFootprint, "provider" | "sourceKey" | "database" | "message">> | string = {}): DatabaseFootprint {
  const patch = typeof input === "string" ? { message: input } : input;
  return {
    connected: false,
    provider: patch.provider ?? "",
    sourceKey: patch.sourceKey ?? "",
    database: patch.database ?? "",
    totalBytes: 0,
    tableCount: 0,
    tables: [],
    message: patch.message ?? "数据库暂时无法连接，只统计本机目录。"
  };
}

export async function scanStorageFootprint(options: CacheMaintenanceOptions): Promise<StorageFootprintReport> {
  const dataRoot = normalizePath(options.dataRoot);
  const userDataRoot = normalizePath(options.userDataRoot);
  const appRoot = normalizePath(options.appRoot);
  const entries: StorageFootprintEntry[] = [];

  const appUsage = await measureDirectory(appRoot);
  const userDataUsage = await measureDirectory(userDataRoot);
  const dataRootUsage = await measureDirectory(dataRoot);

  entries.push(createEntry("app-root", "应用程序", "application", appRoot, appUsage, false, "安装文件与运行程序，只统计。"));
  entries.push(createEntry("user-data-root", "应用用户目录", "data", userDataRoot, userDataUsage, false, "Electron 用户目录，只统计。"));
  entries.push(createEntry("data-root", "AIstudy 数据目录", "data", dataRoot, dataRootUsage, false, "课程、导图、文档、资产和运行数据根目录，只统计。"));

  for (const [id, name, kind, relativePath, note] of [
    ["config", "配置", "preference", "config", "数据库配置和本机配置，只统计。"],
    ["state", "状态镜像", "data", "state", "断连恢复镜像和待处理队列，只统计。"],
    ["runtime", "运行目录", "runtime-cache", "runtime", "运行中间文件和端口目录，按子项清理。"],
    ["assets", "知识库资产", "data", "assets", "图片、教材等正式资产，只统计。"],
    ["updates", "更新文件", "runtime-cache", "updates", "更新下载目录，临时残片可清理。"],
    ["backups", "备份", "backup", "backups", "回滚备份，只统计。"],
    ["logs", "日志", "log", "logs", "运行日志，只统计。"],
    ["locators", "MCP 定位文件", "data", "locators", "课程定位索引，只统计。"]
  ] as const) {
    const targetPath = path.join(dataRoot, relativePath);
    entries.push(createEntry(id, name, kind, targetPath, await measureDirectory(targetPath), false, note));
  }

  const informationRuntimePath = path.join(dataRoot, "runtime", "information-collection");
  entries.push(createEntry(
    "cache-information-collection",
    "信息采集中间文件",
    "runtime-cache",
    informationRuntimePath,
    await measureDirectory(informationRuntimePath),
    !options.informationCollectionBusy,
    options.informationCollectionBusy
      ? "采集任务正在运行，任务完成前不会清理。"
      : "字幕、音频、转写中间稿和单次任务目录，可清理。"
  ));

  const updateTempPath = path.join(dataRoot, "updates");
  entries.push(createEntry(
    "cache-update-temp",
    "更新下载残片",
    "runtime-cache",
    updateTempPath,
    await measureFiles(updateTempPath, (fileName) => /\.(download|tmp)$/i.test(fileName)),
    true,
    "未完成下载残片，可清理。"
  ));

  const chromeCacheRoots = [
    ...await collectCacheDirectories(options.chromeRuntimeRoot),
    ...(options.legacyChromeRuntimeRoot ? await collectCacheDirectories(options.legacyChromeRuntimeRoot) : [])
  ];
  const chromeCacheUsages = await measurePaths(chromeCacheRoots);
  entries.push(createEntry(
    "cache-chrome-profiles",
    "端口浏览器缓存",
    "runtime-cache",
    options.chromeRuntimeRoot,
    sumUsages(chromeCacheUsages.map((item) => item.usage)),
    true,
    "只清浏览器缓存目录，不清 Cookie 和登录状态。"
  ));

  const electronSessionCacheRoots = await collectCacheDirectories(userDataRoot, 3);
  const electronSessionCacheUsages = await measurePaths(electronSessionCacheRoots);
  entries.push(createEntry(
    "cache-electron-session",
    "应用会话缓存",
    "runtime-cache",
    userDataRoot,
    sumUsages(electronSessionCacheUsages.map((item) => item.usage)),
    true,
    "网页会话缓存，可清理。"
  ));

  for (const [index, databasePath] of options.localDatabasePaths.map(normalizePath).entries()) {
    entries.push(createEntry(
      `database-local-${index + 1}`,
      index === 0 ? "本机数据库文件" : "本机数据库文件候选",
      "database",
      databasePath,
      await measureDirectory(databasePath),
      false,
      "数据库物理文件，只统计，不自动清理。"
    ));
  }

  const cleanableBytes = entries
    .filter((entry) => entry.cleanable)
    .reduce((total, entry) => total + entry.bytes, 0);
  const databaseFileBytes = entries
    .filter((entry) => entry.kind === "database")
    .reduce((total, entry) => total + entry.bytes, 0);

  return {
    scannedAt: new Date().toISOString(),
    dataRoot,
    userDataRoot,
    appRoot,
    totalBytes: sumNonOverlappingRoots(entries.filter((entry) => ["application", "data", "database"].includes(entry.kind))),
    cleanableBytes,
    databaseBytes: databaseFileBytes + options.database.totalBytes,
    entries,
    database: options.database
  };
}

async function removeDirectoryContents(directoryPath: string) {
  const root = normalizePath(directoryPath);
  if (!existsSync(root)) return 0;

  let removedEntries = 0;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return removedEntries;
  }

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    try {
      await fs.rm(entryPath, { recursive: true, force: true });
      removedEntries += 1;
    } catch {
      continue;
    }
  }
  return removedEntries;
}

async function removeMatchingFiles(directoryPath: string, predicate: (fileName: string) => boolean) {
  const root = normalizePath(directoryPath);
  if (!existsSync(root)) return 0;

  let removedEntries = 0;
  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return removedEntries;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !predicate(entry.name)) continue;
    try {
      await fs.rm(path.join(root, entry.name), { force: true });
      removedEntries += 1;
    } catch {
      continue;
    }
  }
  return removedEntries;
}

async function removeSafeCacheDirectories(roots: string[], allowedRoots: string[]) {
  let removedEntries = 0;
  const safeRoots = allowedRoots.map(normalizePath);
  for (const cachePath of roots.map(normalizePath)) {
    if (!safeRoots.some((root) => isSameOrInside(cachePath, root))) continue;
    try {
      await fs.rm(cachePath, { recursive: true, force: true });
      removedEntries += 1;
    } catch {
      continue;
    }
  }
  return removedEntries;
}

export async function cleanRuntimeCaches(options: CacheMaintenanceOptions): Promise<CacheCleanupResult> {
  const before = await scanStorageFootprint(options);
  let removedEntries = 0;

  if (!options.informationCollectionBusy) {
    const informationRuntimePath = path.join(options.dataRoot, "runtime", "information-collection");
    removedEntries += await removeDirectoryContents(informationRuntimePath);
    await fs.mkdir(informationRuntimePath, { recursive: true }).catch(() => undefined);
  }

  removedEntries += await removeMatchingFiles(path.join(options.dataRoot, "updates"), (fileName) => /\.(download|tmp)$/i.test(fileName));

  const chromeCacheRoots = [
    ...await collectCacheDirectories(options.chromeRuntimeRoot),
    ...(options.legacyChromeRuntimeRoot ? await collectCacheDirectories(options.legacyChromeRuntimeRoot) : [])
  ];
  removedEntries += await removeSafeCacheDirectories(chromeCacheRoots, [
    options.chromeRuntimeRoot,
    ...(options.legacyChromeRuntimeRoot ? [options.legacyChromeRuntimeRoot] : [])
  ]);

  const electronSessionCacheRoots = await collectCacheDirectories(options.userDataRoot, 3);
  removedEntries += await removeSafeCacheDirectories(electronSessionCacheRoots, [options.userDataRoot]);

  await options.clearSessionCache?.().catch(() => undefined);

  const after = await scanStorageFootprint(options);
  return {
    cleanedAt: new Date().toISOString(),
    beforeBytes: before.cleanableBytes,
    afterBytes: after.cleanableBytes,
    releasedBytes: Math.max(0, before.cleanableBytes - after.cleanableBytes),
    removedEntries,
    report: after
  };
}
