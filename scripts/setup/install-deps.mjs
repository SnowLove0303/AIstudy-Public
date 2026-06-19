import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tmpRoot = path.join(projectRoot, ".tmp", "build-cache");
const electronCache = path.join(tmpRoot, "electron");

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function run(command, args, env = {}) {
  console.log(`[AIstudy] ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    stdio: "inherit"
  });
}

function getPlatformPath() {
  if (process.platform === "darwin") return "Electron.app/Contents/MacOS/Electron";
  if (process.platform === "win32") return "electron.exe";
  return "electron";
}

function getElectronZipName(version) {
  const platform = process.platform;
  const arch = process.arch;
  return `electron-v${version}-${platform}-${arch}.zip`;
}

function findFile(root, fileName) {
  if (!fs.existsSync(root)) return null;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }
    }
  }
  return null;
}

function repairElectronBinary(env) {
  const electronPackagePath = path.join(projectRoot, "node_modules", "electron", "package.json");
  if (!fs.existsSync(electronPackagePath)) {
    throw new Error("Electron package is missing after npm install.");
  }

  const electronRoot = path.dirname(electronPackagePath);
  const electronPackage = JSON.parse(fs.readFileSync(electronPackagePath, "utf8"));
  const executableRelativePath = getPlatformPath();
  const executablePath = path.join(electronRoot, "dist", executableRelativePath);
  const pathTxt = path.join(electronRoot, "path.txt");

  if (fs.existsSync(executablePath) && fs.existsSync(pathTxt)) {
    console.log("[AIstudy] Electron binary is ready.");
    return;
  }

  console.log("[AIstudy] Electron binary is incomplete; trying npm install repair.");
  fs.rmSync(path.join(electronRoot, "dist"), { recursive: true, force: true });
  fs.rmSync(pathTxt, { force: true });
  run(process.execPath, [path.join(electronRoot, "install.js")], env);

  if (fs.existsSync(executablePath) && fs.existsSync(pathTxt)) {
    console.log("[AIstudy] Electron binary repaired by install.js.");
    return;
  }

  if (process.platform !== "darwin") {
    throw new Error("Electron install did not produce a runnable binary. Delete node_modules/electron and retry.");
  }

  const zipName = getElectronZipName(electronPackage.version);
  const zipPath = findFile(env.electron_config_cache || electronCache, zipName);
  if (!zipPath) {
    throw new Error(`Electron cache zip not found: ${zipName}`);
  }

  console.log(`[AIstudy] Rebuilding Electron.app from cache: ${zipPath}`);
  fs.rmSync(path.join(electronRoot, "dist"), { recursive: true, force: true });
  fs.mkdirSync(path.join(electronRoot, "dist"), { recursive: true });
  run("unzip", ["-q", zipPath, "-d", path.join(electronRoot, "dist")], env);
  fs.writeFileSync(pathTxt, executableRelativePath);

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Electron executable is still missing: ${executablePath}`);
  }

  console.log("[AIstudy] Electron binary repaired from cached zip.");
}

const env = {
  npm_config_cache: process.env.npm_config_cache || ensureDir(path.join(tmpRoot, "npm")),
  electron_config_cache: process.env.electron_config_cache || ensureDir(electronCache),
  ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE || ensureDir(path.join(tmpRoot, "electron-builder")),
  ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || "https://npmmirror.com/mirrors/electron/",
  npm_config_registry: process.env.npm_config_registry || "https://registry.npmmirror.com"
};

console.log(`[AIstudy] npm registry: ${env.npm_config_registry}`);
console.log(`[AIstudy] Electron mirror: ${env.ELECTRON_MIRROR}`);
run("npm", ["ci"], env);
repairElectronBinary(env);
