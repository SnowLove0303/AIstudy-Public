import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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

const vendorSource = await readFile(outputFile, "utf8");
const listColorNeedle = "e.save(),e.font=this.getListFontStyle(r,u),e.fillText(t,p,m),e.restore()";
const listColorPatch =
  "e.save(),e.font=this.getListFontStyle(r,u),e.fillStyle=this.findStyledElement(r).color||this.options.defaultColor,e.fillText(t,p,m),e.restore()";
if (!vendorSource.includes(listColorNeedle)) {
  throw new Error("canvas-editor list color patch point was not found");
}
await writeFile(outputFile, vendorSource.replace(listColorNeedle, listColorPatch));

const { size } = await stat(outputFile);
console.log(`renderer vendor: canvas-editor ${(size / 1024).toFixed(1)} KB`);
