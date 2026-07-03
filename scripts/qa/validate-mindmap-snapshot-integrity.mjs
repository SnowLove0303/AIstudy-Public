import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const adapterPath = path.join(projectRoot, "src/renderer/features/mindmap/simpleMindMapAdapter.ts");
const workspacePath = path.join(projectRoot, "src/renderer/features/mindmap/MindMapWorkspace.tsx");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

const adapter = fs.readFileSync(adapterPath, "utf8");
const workspace = fs.readFileSync(workspacePath, "utf8");

assert(
  adapter.includes("const data = editor.getData(true)"),
  "mind map snapshots should read the editor canonical data."
);
assert(
  adapter.includes("const root = data.root ?? editor.renderer?.root?.getPureData?.(true, false);"),
  "mind map snapshots must prefer editor.getData(true).root over render-tree getPureData."
);
assert(
  !adapter.includes("const root = editor.renderer?.root?.getPureData?.(true, false) ?? data.root"),
  "render-tree getPureData must not take precedence over canonical editor data."
);
assert(
  workspace.includes("mergeFocusedSnapshot(snapshotRef.current, focusedNodeId, nextCanvasSnapshot)"),
  "focused branch edits should still merge into the master snapshot before save."
);

read("src/renderer/features/mindmap/README.md");

console.log("mind map snapshot integrity policy: ok");
