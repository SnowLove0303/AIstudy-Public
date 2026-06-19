import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceIcon = path.join(projectRoot, "assets", "app-icon-cutout-1024.png");
const iconsetDir = path.join(projectRoot, "build", "AIstudy.iconset");
const outputIcon = path.join(projectRoot, "build", "icon.icns");

function run(command, args) {
  execFileSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit"
  });
}

if (process.platform !== "darwin") {
  console.log("[AIstudy] macOS icon generation skipped: this step only runs on macOS.");
  process.exit(0);
}

if (!fs.existsSync(sourceIcon)) {
  throw new Error(`Missing source icon: ${sourceIcon}`);
}

fs.rmSync(iconsetDir, { recursive: true, force: true });
fs.rmSync(outputIcon, { force: true });
fs.mkdirSync(iconsetDir, { recursive: true });

for (const size of [16, 32, 128, 256, 512]) {
  run("sips", [
    "-z",
    String(size),
    String(size),
    sourceIcon,
    "--out",
    path.join(iconsetDir, `icon_${size}x${size}.png`)
  ]);

  const retinaSize = size * 2;
  run("sips", [
    "-z",
    String(retinaSize),
    String(retinaSize),
    sourceIcon,
    "--out",
    path.join(iconsetDir, `icon_${size}x${size}@2x.png`)
  ]);
}

run("iconutil", ["-c", "icns", iconsetDir, "-o", outputIcon]);
console.log(`[AIstudy] Prepared macOS icon: ${path.relative(projectRoot, outputIcon)}`);
