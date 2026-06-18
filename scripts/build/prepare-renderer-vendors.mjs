import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const input = path.join(rootDir, "node_modules", "@hufe921", "canvas-editor", "dist", "canvas-editor.js");
const outputDir = path.join(rootDir, "dist", "vendor");
const outputFile = path.join(outputDir, "canvas-editor.js");

await mkdir(outputDir, { recursive: true });
await build({
  input,
  output: {
    file: outputFile,
    format: "esm",
    minify: true,
    comments: false
  }
});

const { size } = await stat(outputFile);
console.log(`renderer vendor: canvas-editor ${(size / 1024).toFixed(1)} KB`);
