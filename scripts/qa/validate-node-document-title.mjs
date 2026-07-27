import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const workspace = read("src/renderer/features/documents/KnowledgeDocumentWorkspace.tsx");
const titleComponent = read("src/renderer/features/documents/NodeDocumentTitle.tsx");
const styles = read("src/renderer/styles.css");
const exporter = read("electron/documentExport.ts");

assert(
  workspace.includes("normalizeNodeDocumentTitle(selectedNode.title)")
    && workspace.includes("<NodeDocumentTitle title={documentTitle} />"),
  "node document heading must be derived directly from the selected real mind-map node"
);
assert(
  !titleComponent.includes("<input") && !titleComponent.includes("contentEditable"),
  "node document heading must not create a second editable title source"
);
assert(
  styles.includes(".document-node-title") && styles.includes(".document-editor-body"),
  "node document heading and editor body must keep explicit layout boundaries"
);
assert(
  exporter.includes("createNodeDocumentTitle(title)")
    && exporter.includes("...buildDocxChildren(snapshot)"),
  "DOCX export must prepend the same node title without mutating the editor snapshot"
);

console.log("node document title validation passed.");
