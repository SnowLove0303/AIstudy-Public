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

function flattenOutlineTitles(items) {
  const titles = [];
  const stack = [...items];
  while (stack.length > 0) {
    const item = stack.shift();
    if (!item) continue;
    titles.push(item.title);
    stack.unshift(...item.children);
  }
  return titles;
}

if (!fs.existsSync(snapshotSourcePath)) {
  throw new Error("Missing mind map snapshot module.");
}
if (!fs.existsSync(coreContractSourcePath)) {
  throw new Error("Missing core contract module.");
}

const tempRoot = process.env.TMP || process.env.TEMP || os.tmpdir();
const tempDir = path.join(tempRoot, "aistudy-mindmap-catalog-boundary-qa");
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
  MIND_MAP_CATALOG_BOUNDARY_KEY,
  buildMindMapOutline,
  countNodes,
  createMindMapStructureSignature,
  normalizeMindMapTree
} = await import(`${pathToFileURL(snapshotModulePath).href}?qa=${Date.now()}`);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createBaseRoot() {
  return normalizeMindMapTree({
    data: { uid: "root", text: "math", expand: true },
    children: [
      {
        data: { uid: "chapter", text: "functions", expand: true },
        children: [
          {
            data: {
              uid: "feature",
              text: "properties",
              expand: true,
              [MIND_MAP_CATALOG_BOUNDARY_KEY]: true
            },
            children: [
              { data: { uid: "bounded", text: "boundedness", expand: true }, children: [] },
              { data: { uid: "monotone", text: "monotonicity", expand: true }, children: [] }
            ]
          },
          {
            data: {
              uid: "leaf-boundary",
              text: "function types",
              expand: true,
              [MIND_MAP_CATALOG_BOUNDARY_KEY]: true
            },
            children: []
          }
        ]
      }
    ]
  });
}

const root = createBaseRoot();
assert(root.children[0].children[0].data[MIND_MAP_CATALOG_BOUNDARY_KEY] === true, "catalog boundary flag should survive normalization");
assert(countNodes(root) === 6, "catalog boundary must not remove real mind map nodes");

const outline = buildMindMapOutline(root);
const rootItem = outline[0];
const chapterItem = rootItem.children[0];
const featureItem = chapterItem.children[0];
const leafBoundaryItem = chapterItem.children[1];
const titles = flattenOutlineTitles(outline);

assert(rootItem.title === "math", "root should remain in catalog");
assert(chapterItem.title === "functions", "parent should remain in catalog");
assert(featureItem.title === "properties", "boundary node should remain in catalog");
assert(featureItem.catalogBoundary === true, "boundary outline item should expose catalogBoundary=true");
assert(featureItem.childCount === 0, "visible childCount should stop at boundary");
assert(featureItem.hiddenChildCount === 2, "hiddenChildCount should report suppressed children");
assert(featureItem.children.length === 0, "boundary node should not expose descendants in catalog");
assert(leafBoundaryItem.catalogBoundary === true, "leaf nodes can be prepared as future catalog boundaries");
assert(leafBoundaryItem.hiddenChildCount === 0, "empty boundary nodes should not invent hidden children");
assert(!titles.includes("boundedness") && !titles.includes("monotonicity"), "boundary descendants should not appear in catalog");
assert(titles.includes("function types"), "sibling boundary node should remain selectable");

const restoredRoot = clone(root);
delete restoredRoot.children[0].children[0].data[MIND_MAP_CATALOG_BOUNDARY_KEY];
const restoredOutline = buildMindMapOutline(restoredRoot);
const restoredFeatureItem = restoredOutline[0].children[0].children[0];
const restoredTitles = flattenOutlineTitles(restoredOutline);
assert(restoredFeatureItem.catalogBoundary === false, "restored node should expose catalogBoundary=false");
assert(restoredFeatureItem.childCount === 2, "restored boundary should show its children again");
assert(restoredTitles.includes("boundedness") && restoredTitles.includes("monotonicity"), "restored descendants should reappear in catalog");
assert(
  createMindMapStructureSignature(root) !== createMindMapStructureSignature(restoredRoot),
  "catalog boundary changes should refresh the mind map UI signature"
);

const futureChildRoot = clone(root);
futureChildRoot.children[0].children[1].children.push({
  data: { uid: "trigonometric", text: "trigonometric functions", expand: true },
  children: []
});
const futureChildOutline = buildMindMapOutline(futureChildRoot);
const futureLeafBoundaryItem = futureChildOutline[0].children[0].children[1];
const futureChildTitles = flattenOutlineTitles(futureChildOutline);
assert(countNodes(futureChildRoot) === 7, "new child under a catalog boundary should remain in the real mind map");
assert(futureLeafBoundaryItem.hiddenChildCount === 1, "future children under a boundary should be counted as hidden descendants");
assert(!futureChildTitles.includes("trigonometric functions"), "future children under a boundary should stay out of catalog");

const parentBoundaryRoot = clone(root);
parentBoundaryRoot.children[0].data[MIND_MAP_CATALOG_BOUNDARY_KEY] = true;
const parentBoundaryOutline = buildMindMapOutline(parentBoundaryRoot);
const parentBoundaryChapterItem = parentBoundaryOutline[0].children[0];
const parentBoundaryTitles = flattenOutlineTitles(parentBoundaryOutline);
assert(parentBoundaryChapterItem.catalogBoundary === true, "a parent can become the catalog boundary");
assert(parentBoundaryChapterItem.hiddenChildCount === 2, "parent boundary should suppress immediate child topics");
assert(
  parentBoundaryTitles.length === 2 && parentBoundaryTitles.includes("math") && parentBoundaryTitles.includes("functions"),
  "parent boundary should hide all lower catalog levels while keeping the real branch"
);

console.log("mind map catalog boundary policy: ok");
