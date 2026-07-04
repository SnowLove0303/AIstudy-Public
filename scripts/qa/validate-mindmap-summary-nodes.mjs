import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const snapshotSourcePath = path.join(projectRoot, "src/renderer/features/mindmap/mindMapSnapshot.ts");
const coreContractSourcePath = path.join(projectRoot, "src/renderer/domain/coreContracts.ts");

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
  createMindMapStructureSignature,
  createMindMapSummaryNode,
  getMindMapSummarySnapshot,
  isMindMapSummaryNode,
  normalizeMindMapTree
} = await import(`${pathToFileURL(snapshotModulePath).href}?qa=${Date.now()}`);

const root = normalizeMindMapTree({
  data: { uid: "root", text: "Pynes", expand: true },
  children: [
    {
      data: { uid: "channel", text: "渠道", expand: true },
      children: [
        { data: { uid: "hot", text: "找爆款", expand: true }, children: [] },
        { data: { uid: "new", text: "有上新", expand: true }, children: [] },
        { data: { uid: "supplier", text: "找供应商", expand: true }, children: [] }
      ]
    }
  ]
});

const channel = root.children[0];
const summaryNode = createMindMapSummaryNode(channel);
const rootWithSummary = normalizeMindMapTree({
  ...root,
  children: [
    {
      ...channel,
      children: [summaryNode, ...channel.children]
    }
  ]
});

const outline = buildMindMapOutline(rootWithSummary);
const channelItem = outline[0].children[0];
const summaryItem = channelItem.children[0];
const hotItem = channelItem.children[1];
const summarySnapshot = getMindMapSummarySnapshot(rootWithSummary.children[0].children[0]);

assert(isMindMapSummaryNode(rootWithSummary.children[0].children[0]), "summary node kind should survive normalization");
assert(channelItem.title === "渠道", "anchor should stay in the main outline");
assert(summaryItem.title === "摘要", "summary should appear as a catalog node");
assert(summaryItem.nodeKind === "summary", "summary outline item should expose nodeKind=summary");
assert(summaryItem.childCount === 0, "summary internals must not appear in the main catalog");
assert(hotItem.title === "找爆款", "original first business child should remain after the summary");
assert(countNodes(rootWithSummary) === 6, "summary should add only one main mind map node");
assert(summarySnapshot?.root?.data?.text === "渠道", "summary mind map root should use the nearest multi-child parent title");
assert(summarySnapshot?.root?.data?.uid === rootWithSummary.children[0].children[0].data.uid, "summary root id should match the summary node id for selection");

const beforeSignature = createMindMapStructureSignature(rootWithSummary);
summarySnapshot.root.children.push({
  data: { uid: "summary-child", text: "筛选方式", expand: true },
  children: []
});
rootWithSummary.children[0].children[0].data.aistudySummarySnapshot = summarySnapshot;
const afterSignature = createMindMapStructureSignature(rootWithSummary);
assert(beforeSignature !== afterSignature, "summary map edits should update the structure signature");

console.log("mind map summary node policy: ok");
