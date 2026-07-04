import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

const forbiddenTargets = [
  path.join("node_modules", "electron", "dist", "AIstudyPublicData"),
  path.join("node_modules", "electron", "dist", "AIstudyUserData"),
  path.join("node_modules", "electron", "dist", "mysql.config.json"),
  path.join("release", "win-unpacked", "AIstudyPublicData"),
  path.join("release", "win-unpacked", "AIstudyUserData"),
  path.join("release", "win-unpacked", "mysql.config.json")
];

function assertSafeTarget(targetPath) {
  const absolute = path.resolve(projectRoot, targetPath);
  const relative = path.relative(projectRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean outside project: ${absolute}`);
  }
  const normalized = relative.split(path.sep).join("/");
  const allowed =
    normalized.startsWith("node_modules/electron/dist/") ||
    normalized.startsWith("release/win-unpacked/");
  if (!allowed) {
    throw new Error(`Refusing to clean unexpected path: ${absolute}`);
  }
  return absolute;
}

async function removeIfExists(relativePath) {
  const absolute = assertSafeTarget(relativePath);
  try {
    await fs.rm(absolute, { recursive: true, force: true });
    console.log(`[AIstudy] Removed runtime package residue: ${relativePath.split(path.sep).join("/")}`);
  } catch (error) {
    throw new Error(`Failed to remove runtime package residue: ${absolute}\n${error instanceof Error ? error.message : String(error)}`);
  }
}

await Promise.all(forbiddenTargets.map(removeIfExists));
