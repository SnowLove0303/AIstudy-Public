import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const snapshotSourcePath = path.join(projectRoot, "src/renderer/features/mindmap/mindMapSnapshot.ts");
const coreContractSourcePath = path.join(projectRoot, "src/renderer/domain/coreContracts.ts");
const adapterSourcePath = path.join(projectRoot, "src/renderer/features/mindmap/simpleMindMapAdapter.ts");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function transpileTypeScript(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true
    },
    fileName: sourcePath
  }).outputText;
}

const tempRoot = process.env.TMP || process.env.TEMP || os.tmpdir();
const tempDir = path.join(tempRoot, "aistudy-mindmap-summary-qa");
fs.mkdirSync(tempDir, { recursive: true });

const coreContractModulePath = path.join(tempDir, "coreContracts.mjs");
const snapshotModulePath = path.join(tempDir, "mindMapSnapshot.mjs");

fs.writeFileSync(coreContractModulePath, transpileTypeScript(coreContractSourcePath), "utf8");
fs.writeFileSync(
  snapshotModulePath,
  transpileTypeScript(snapshotSourcePath).replace(
    /from\s+["']\.\.\/\.\.\/domain\/coreContracts["'];/g,
    'from "./coreContracts.mjs";'
  ),
  "utf8"
);

const {
  buildMindMapOutline,
  countNodes,
  createEditorSafeMindMapTree,
  createMindMapStructureSignature,
  normalizeNativeMindMapGeneralization,
  normalizeMindMapTree
} = await import(`${pathToFileURL(snapshotModulePath).href}?qa=${Date.now()}`);
const adapterSource = fs.readFileSync(adapterSourcePath, "utf8");

const root = normalizeMindMapTree({
  data: { uid: "root", text: "Pynes", expand: true },
  children: [
    {
      data: {
        uid: "channel",
        text: "渠道",
        expand: true,
        generalization: {
          uid: "generalization-visible-summary",
          text: "选定方式",
          expand: true,
          range: [0, 2]
        }
      },
      children: [
        { data: { uid: "hot", text: "找爆款", expand: true }, children: [] },
        { data: { uid: "new", text: "有上新", expand: true }, children: [] },
        { data: { uid: "supplier", text: "找供应商", expand: true }, children: [] }
      ]
    }
  ]
});

const outline = buildMindMapOutline(root);
const channelItem = outline[0].children[0];

assert(channelItem.title === "渠道", "summary anchor should stay in the main outline");
assert(channelItem.childCount === 3, "native summary must not add outline children");
assert(
  channelItem.children.map((child) => child.title).join(",") === "找爆款,有上新,找供应商",
  "outline should contain only real child topics"
);
assert(countNodes(root) === 5, "native summary should not increase topic node count");
assert(root.children[0].data.generalization?.text === "选定方式", "native summary text should stay on the anchor node");
assert(root.children[0].data.generalization?.range?.join(",") === "0,2", "native summary range should be preserved");

const beforeSignature = createMindMapStructureSignature(root);
root.children[0].data.generalization.text = "商品入库清单";
const afterSignature = createMindMapStructureSignature(root);
assert(beforeSignature !== afterSignature, "native summary text edits should update the structure signature");

const editorSafeRoot = createEditorSafeMindMapTree(root);
assert(
  editorSafeRoot.children[0].data.generalization?.text === "商品入库清单",
  "native summary must be sent to simple-mind-map for visible bracket rendering"
);
assert(
  editorSafeRoot.children[0].data.generalization?.range?.join(",") === "0,2",
  "native summary range must remain editor-safe"
);

const normalizedDuplicateSummary = normalizeNativeMindMapGeneralization(
  [
    { uid: "legacy-self-summary", text: "摘要", range: null },
    { uid: "range-summary-default", text: "摘要", range: [0, 2] },
    { uid: "range-summary-edited", text: "选定方式", range: [0, 2] }
  ],
  3
);
assert(!Array.isArray(normalizedDuplicateSummary), "duplicate range summary should collapse to one item");
assert(normalizedDuplicateSummary?.text === "选定方式", "edited summary text should win over default duplicate text");
assert(
  normalizedDuplicateSummary?.range?.join(",") === "0,2",
  "range summary should remove legacy self summary on the same parent"
);
assert(
  adapterSource.includes("restoreActiveNodesAfterSummary")
    && adapterSource.includes('editor.render(() => restoreActiveNodesAfterSummary(editor, activeNodeIds))')
    && adapterSource.includes("findNodeByUid?.(nodeId)")
    && adapterSource.includes("addNodeToActiveList?.(node, true)"),
  "adding a summary must restore current render-node instances so editing can continue"
);

console.log("mind map native summary policy: ok");
