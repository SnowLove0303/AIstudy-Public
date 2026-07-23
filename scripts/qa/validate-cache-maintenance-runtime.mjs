import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  cleanRuntimeCaches,
  createDisconnectedDatabaseFootprint,
  scanStorageFootprint
} from "../../dist-electron/cacheMaintenance.js";
import { RuntimeMaintenanceCoordinator } from "../../dist-electron/runtimeMaintenanceCoordinator.js";

const tempRoot = path.resolve(process.env.TEMP ?? "");
if (!/^F:\\/i.test(tempRoot)) {
  throw new Error(`Cache maintenance QA requires an F-drive TEMP directory, received: ${tempRoot || "(empty)"}`);
}

function assertInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `Unsafe test path: ${candidate}`);
}

async function writeFixture(filePath, contents = "fixture") {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

async function exists(targetPath) {
  return fs.access(targetPath).then(() => true, () => false);
}

async function validateCoordinator() {
  const coordinator = new RuntimeMaintenanceCoordinator();
  let finishTask;
  const activeTask = coordinator.runInformationCollectionTask(() => new Promise((resolve) => {
    finishTask = resolve;
  }));
  await Promise.resolve();
  assert.equal(coordinator.informationCollectionBusy, true);
  await assert.rejects(
    coordinator.runCacheCleanup(async () => true),
    /信息采集任务正在运行/
  );
  finishTask();
  await activeTask;
  assert.equal(coordinator.informationCollectionBusy, false);

  let finishCleanup;
  let informationTaskStarted = false;
  const cleanup = coordinator.runCacheCleanup(() => new Promise((resolve) => {
    finishCleanup = resolve;
  }));
  const queuedInformationTask = coordinator.runInformationCollectionTask(async () => {
    informationTaskStarted = true;
  });
  await Promise.resolve();
  assert.equal(informationTaskStarted, false);
  finishCleanup();
  await cleanup;
  await queuedInformationTask;
  assert.equal(informationTaskStarted, true);
}

async function validateFilesystemBoundaries() {
  const fixtureRoot = await fs.mkdtemp(path.join(tempRoot, "aistudy-cache-maintenance-"));
  assertInside(fixtureRoot, tempRoot);

  const dataRoot = path.join(fixtureRoot, "data");
  const userDataRoot = path.join(fixtureRoot, "user-data");
  const appRoot = path.join(fixtureRoot, "app");
  const chromeRuntimeRoot = path.join(fixtureRoot, "chrome");
  const localDatabasePath = path.join(fixtureRoot, "mysql", "data");
  const protectedFiles = [
    path.join(dataRoot, "state", "state.json"),
    path.join(dataRoot, "assets", "asset.bin"),
    path.join(dataRoot, "locators", "index.json"),
    path.join(dataRoot, "backups", "backup.bin"),
    path.join(localDatabasePath, "database.bin")
  ];
  const informationIntermediate = path.join(dataRoot, "runtime", "information-collection", "bilibili", "BV1", "run-1", "transcript.txt");
  const updateRemainder = path.join(dataRoot, "updates", "AIstudy.exe.download");
  const electronCache = path.join(userDataRoot, "Cache", "http-cache.bin");
  const chromeCache = path.join(chromeRuntimeRoot, "Profile 1", "Cache", "browser-cache.bin");
  let sessionCacheCleared = 0;

  try {
    await Promise.all([
      ...protectedFiles.map((filePath) => writeFixture(filePath)),
      writeFixture(informationIntermediate),
      writeFixture(updateRemainder),
      writeFixture(electronCache),
      writeFixture(chromeCache),
      writeFixture(path.join(appRoot, "AIstudy.exe"))
    ]);

    const junctionTarget = path.join(dataRoot, "assets");
    const junctionPath = path.join(chromeRuntimeRoot, "Profile 2", "Cache");
    await fs.mkdir(path.dirname(junctionPath), { recursive: true });
    await fs.symlink(junctionTarget, junctionPath, "junction");

    const createOptions = (informationCollectionBusy) => ({
      dataRoot,
      userDataRoot,
      appRoot,
      chromeRuntimeRoot,
      localDatabasePaths: [localDatabasePath],
      database: createDisconnectedDatabaseFootprint("QA"),
      informationCollectionBusy,
      clearSessionCache: async () => {
        sessionCacheCleared += 1;
      }
    });

    const busyReport = await scanStorageFootprint(createOptions(true));
    const informationEntry = busyReport.entries.find((entry) => entry.id === "cache-information-collection");
    assert(informationEntry);
    assert.equal(informationEntry.cleanable, false);

    await cleanRuntimeCaches(createOptions(true));
    assert.equal(await exists(informationIntermediate), true, "active information collection files must be preserved");
    assert.equal(await exists(updateRemainder), false, "partial update downloads should be removed");
    assert.equal(await exists(electronCache), false, "Electron HTTP cache should be removed");
    assert.equal(await exists(chromeCache), false, "Chrome runtime cache should be removed");
    for (const protectedFile of protectedFiles) {
      assert.equal(await exists(protectedFile), true, `durable file must be preserved: ${protectedFile}`);
    }

    await cleanRuntimeCaches(createOptions(false));
    assert.equal(await exists(informationIntermediate), false, "inactive information collection files should be removable");
    assert.equal(sessionCacheCleared, 2);
    for (const protectedFile of protectedFiles) {
      assert.equal(await exists(protectedFile), true, `durable file must remain after full cleanup: ${protectedFile}`);
    }
  } finally {
    assertInside(fixtureRoot, tempRoot);
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  }
}

await validateCoordinator();
await validateFilesystemBoundaries();
console.log("Cache maintenance runtime QA passed.");
