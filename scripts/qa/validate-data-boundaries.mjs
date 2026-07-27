import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

const requiredStorageModuleIds = [
  "courses",
  "mindmaps",
  "documents",
  "exams",
  "textbooks",
  "textbook-annotations",
  "chrome-port-states",
  "vocabulary-capture",
  "information-collection",
  "error-logs",
  "ui-preferences"
];

const allowedLocalStorageFiles = new Set([
  "src/renderer/features/assistant/AiAssistantPanel.tsx",
  "src/renderer/features/documents/KnowledgeDocumentWorkspace.tsx",
  "src/renderer/features/knowledge/KnowledgeSplitWorkspace.tsx",
  "src/renderer/features/mindmap/MindMapWorkspace.tsx",
  "src/renderer/features/mindmap/mindMapShortcutSettings.ts"
]);

const forbiddenPackageEntries = [
  "AIstudyPublicData",
  "AIstudyUserData",
  "courses.json",
  "course-pending-operations.json",
  "textbook-pending-scopes.json",
  "textbook-database-backed-scopes.json",
  "vocabulary-capture.json",
  "vocabulary-capture-pending-events.json",
  "chrome-ports.json",
  "bilibili-cookies.txt",
  "mysql.config.json"
];

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function walk(dir) {
  const entries = fs.readdirSync(path.join(projectRoot, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(dir.split(path.sep).join("/"), entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "dist-electron", "release"].includes(entry.name)) continue;
      files.push(...walk(relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

function fail(message) {
  console.error(`data boundary policy: ${message}`);
  process.exitCode = 1;
}

const packageJson = JSON.parse(read("package.json"));
const packagedFiles = JSON.stringify(packageJson.build?.files ?? []);
for (const forbidden of forbiddenPackageEntries) {
  if (packagedFiles.includes(forbidden)) {
    fail(`package.json build.files must not include runtime data: ${forbidden}`);
  }
}

for (const scriptName of ["pack", "dist"]) {
  const script = packageJson.scripts?.[scriptName] ?? "";
  if (!script.includes("scripts/package/clean-runtime-data.mjs")) {
    fail(`package.json ${scriptName} script must clean runtime data before packaging`);
  }
}

const closeAndDist = read("scripts/package/close-and-dist.ps1");
for (const forbidden of forbiddenPackageEntries) {
  if (!closeAndDist.includes(forbidden)) {
    fail(`dist:oneclick clean source guard is missing ${forbidden}`);
  }
}

const storageBoundary = read("electron/storageBoundary.ts");
for (const id of requiredStorageModuleIds) {
  if (!storageBoundary.includes(`id: "${id}"`)) {
    fail(`storage boundary registry is missing module ${id}`);
  }
}

const sourceFiles = [
  ...walk("src/renderer"),
  ...walk("electron")
].filter((file) => /\.(ts|tsx|cts)$/.test(file));

for (const file of sourceFiles) {
  const source = read(file);
  if (source.includes("localStorage") && !allowedLocalStorageFiles.has(file)) {
    fail(`localStorage is only allowed for whitelisted local preferences or legacy recovery: ${file}`);
  }
}

const preload = read("electron/preload.cts");
if (/mysql|fs\.|node:fs/i.test(preload)) {
  fail("preload must not expose raw MySQL or filesystem capabilities");
}
if (!preload.includes('storageFootprint: () => invokeApp("runtime:storage-footprint")') || !preload.includes('cleanCaches: () => invokeApp("runtime:clean-caches")')) {
  fail("preload must expose only scoped storage footprint and cache cleanup actions");
}

const main = read("electron/main.ts");
for (const directAnnotationImport of [
  "readTextbookAnnotationsFromMysql",
  "writeTextbookAnnotationToMysql",
  "deleteTextbookAnnotationFromMysql"
]) {
  if (main.includes(directAnnotationImport)) {
    fail(`main.ts should route PDF annotation persistence through textbookAnnotationService: ${directAnnotationImport}`);
  }
}

if (!main.includes("ensureChromePortProfileDir") || !main.includes("AIstudyPublicCleanData")) {
  fail("Chrome port profiles must use the stable public clean runtime root and migrate legacy exe-adjacent profiles");
}

if (
  !main.includes("return normalized.databaseSourceKey === sourceKey")
  || !main.includes("return operation.databaseSourceKey === sourceKey")
  || main.includes("await repairCourseIndexFromCache")
  || main.includes("Course database returned an empty course index while local courses exist")
  || main.includes("SELECT COUNT(*) AS liveCount")
) {
  fail("course database reads must reject stale local source mirrors and must not recover visible content from cache");
}

if (
  !main.includes('type DatabaseProvider = "mysql" | "tidb"')
  || !main.includes("readPublicTidbEnv")
  || !main.includes("skipSchemaCreation")
  || !main.includes("TLSv1.2")
) {
  fail("main database runtime must keep optional TiDB/TLS support without replacing the default MySQL path");
}

if (
  !main.includes("isRecoverableDatabaseConnectionError")
  || !main.includes('runtime.pool.query("SELECT 1")')
  || !main.includes("await resetMysqlRuntime()")
) {
  fail("main database runtime must verify and rebuild stale pools before serving app data");
}

if (
  !main.includes('ipcMain.handle("runtime:storage-footprint"')
  || !main.includes('ipcMain.handle("runtime:clean-caches"')
  || !main.includes("information_schema.tables")
  || !main.includes("session.defaultSession.clearCache")
) {
  fail("main runtime must provide safe cache inspection/cleanup and database footprint checks");
}

const cacheMaintenance = read("electron/cacheMaintenance.ts");
if (
  !cacheMaintenance.includes('"cache-information-collection"')
  || !cacheMaintenance.includes('"cache-update-temp"')
  || !cacheMaintenance.includes('"cache-chrome-profiles"')
  || !cacheMaintenance.includes('"cache-electron-session"')
  || !cacheMaintenance.includes("!options.informationCollectionBusy")
  || !cacheMaintenance.includes("任务完成前不会清理")
  || !cacheMaintenance.includes('false, "课程、导图、文档、资产和运行数据根目录，只统计。"')
  || !cacheMaintenance.includes('"database"')
) {
  fail("cache maintenance must separate cleanable caches from database and durable content");
}

if (
  cacheMaintenance.includes("removeSafeCacheDirectories(options.localDatabasePaths")
  || cacheMaintenance.includes("removeDirectoryContents(path.join(options.dataRoot, \"state\")")
  || cacheMaintenance.includes("removeDirectoryContents(path.join(options.dataRoot, \"assets\")")
  || cacheMaintenance.includes("removeDirectoryContents(path.join(options.dataRoot, \"locators\")")
) {
  fail("cache maintenance must not delete database, state, asset, or locator content");
}

const runtimeMaintenanceCoordinator = read("electron/runtimeMaintenanceCoordinator.ts");
if (
  !runtimeMaintenanceCoordinator.includes("runInformationCollectionTask")
  || !runtimeMaintenanceCoordinator.includes("runCacheCleanup")
  || !main.includes("runtimeMaintenanceCoordinator.runInformationCollectionTask")
  || !main.includes("runtimeMaintenanceCoordinator.runCacheCleanup")
) {
  fail("runtime maintenance must serialize cache cleanup against active information collection tasks");
}

if (
  main.includes("readDbFirstStore(createCourseStorageProvider())")
  || main.includes("writeDbFirstStore(createCourseStorageProvider()")
  || !main.includes('throw createAppError("MYSQL_UNAVAILABLE", "数据库未连接，本次知识库操作未保存。')
) {
  fail("course knowledge data must be database-authoritative and must not fall back to local course stores");
}

const appEntry = read("src/renderer/main.tsx");
if (
  !appEntry.includes("clearCourseStoreForDatabaseUnavailable")
  || appEntry.includes("await onDatabaseChanged?.().catch(() => undefined)")
  || !appEntry.includes("setDatabaseError(saveError instanceof Error")
  || !appEntry.includes("COURSE_DATABASE_RECOVERY_RETRY_MS")
  || !appEntry.includes("setExternalContentRevision(Date.now())")
) {
  fail("renderer must clear stale course state on load failures and must not reload the app shell after a failed database switch");
}

const storageMaintenancePanel = read("src/renderer/features/settings/StorageMaintenancePanel.tsx");
if (
  !appEntry.includes('type SettingsPage = "runtime" | "storage"')
  || !appEntry.includes("缓存空间")
  || !appEntry.includes("<StorageMaintenancePanel />")
  || !storageMaintenancePanel.includes("storageFootprint")
  || !storageMaintenancePanel.includes("cleanCaches")
  || storageMaintenancePanel.includes("entry.path")
  || storageMaintenancePanel.includes("sourceKey}</")
  || storageMaintenancePanel.includes("table.name")
) {
  fail("renderer settings must expose scoped cache maintenance without raw paths or database internals");
}

const courseSidebar = read("src/renderer/features/course/CourseSidebar.tsx");
if (courseSidebar.includes("部分内容暂时没同步") || courseSidebar.includes("已在本机保存，稍后自动同步")) {
  fail("course sidebar must not present database failures as local sync or partial stale content");
}

const mindMapWorkspace = read("src/renderer/features/mindmap/MindMapWorkspace.tsx");
if (
  mindMapWorkspace.includes('setStorageMode("local")')
  || mindMapWorkspace.includes("导图读取失败，已打开本地副本")
  || mindMapWorkspace.includes("已保存到本地副本")
) {
  fail("mind map workspace must not render or save a local fallback when the database is unavailable");
}

if (
  !main.includes("SELECT payload_json AS payloadJson")
  || !main.includes("normalizeMindMapSnapshot(parseJsonText(rows[0].payloadJson))")
  || !main.includes("normalizeKnowledgeDocumentSnapshot(parseJsonText(rows[0].payloadJson))")
  || !main.includes("syncKnowledgeAssetLinks(connection, knowledgeAssetLinkTable")
) {
  fail("database reload must preserve full snapshots, formatting payloads, and asset relationships");
}

const documentWorkspace = read("src/renderer/features/documents/KnowledgeDocumentWorkspace.tsx");
if (
  documentWorkspace.includes('setStorageMode("local")')
  || documentWorkspace.includes("文档读取失败，已打开本地副本")
  || documentWorkspace.includes("文档保存失败，已保存到本地副本")
  || documentWorkspace.includes("本地副本也保存失败")
) {
  fail("document workspace must not render or save a local fallback when the database is unavailable");
}

const mcpServer = read("scripts/mcp/aistudy-mcp-server.mjs");
if (!mcpServer.includes("AIstudyPublicCleanData") || !mcpServer.includes("xiaohongshu")) {
  fail("external MCP chrome ports must share the stable runtime root and full platform list");
}

if (!mcpServer.includes("normalizeDatabaseProvider") || !mcpServer.includes("TIDB_") || !mcpServer.includes("TLSv1.2")) {
  fail("MCP database runtime must support the same optional TiDB/TLS configuration as the desktop app");
}

if (!process.exitCode) {
  console.log("data boundary policy: ok");
}
