import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const splitWorkspace = read("src/renderer/features/knowledge/KnowledgeSplitWorkspace.tsx");
const mindMapWorkspace = read("src/renderer/features/mindmap/MindMapWorkspace.tsx");
const rendererMain = read("src/renderer/main.tsx");
const styles = read("src/renderer/styles.css");
const rendererCourseTypes = read("src/renderer/features/course/courseTypes.ts");
const electronMain = read("electron/main.ts");

assert(
  splitWorkspace.includes('type KnowledgeWorkspaceMode = "mindmap" | "split" | "word"'),
  "split workspace must keep map, split, and document-only modes explicit"
);
assert(
  splitWorkspace.includes('role="separator"')
    && splitWorkspace.includes('aria-orientation="vertical"')
    && splitWorkspace.includes("onKeyDown=")
    && splitWorkspace.includes("onDoubleClick="),
  "split separator must support accessible keyboard adjustment and reset"
);
assert(
  splitWorkspace.includes("setPointerCapture")
    && splitWorkspace.includes("requestAnimationFrame")
    && splitWorkspace.includes("ResizeObserver"),
  "split resizing must use pointer capture, frame-batched updates, and responsive measurement"
);
assert(
  splitWorkspace.includes("aistudy:knowledge-split-ratio:")
    && splitWorkspace.includes("persistRatio(courseId"),
  "split ratio must persist independently for each real course"
);
assert(
  mindMapWorkspace.includes('<KnowledgeSplitWorkspace courseId={courseId} mode={editorMode}>')
    || (
      mindMapWorkspace.includes("<KnowledgeSplitWorkspace")
      && mindMapWorkspace.includes("onCompactChange={setIsSplitCompact}")
    ),
  "mind map and real node document workspaces must share the responsive split container"
);
assert(
  mindMapWorkspace.includes('editorMode === "word" || editorMode === "split"')
    && mindMapWorkspace.includes('editorMode === "mindmap" || (editorMode === "split" && !isSplitCompact)'),
  "mind map and real node document workspaces must share the split container"
);
assert(
  rendererMain.includes('requestWorkspaceMode("split")')
    && rendererMain.includes("setIsLibraryPaneCollapsed(true)")
    && rendererMain.includes("setIsCatalogPaneCollapsed(true)")
    && rendererMain.includes("onNodeSelectedChanged={setSelectedMindMapNode}"),
  "the renderer must expose split mode and default both width-consuming directories to collapsed drawers"
);
assert(
  mindMapWorkspace.includes('modeChangeRequest?.mode === "word" || modeChangeRequest?.mode === "textbook"'),
  "entering split mode must not trigger an unnecessary full mind-map save"
);
assert(
  styles.includes(".workspace-drawer-scrim")
    && styles.includes('grid-template-columns: minmax(360px, var(--knowledge-mindmap-ratio)) 9px minmax(420px, 1fr)')
    && styles.includes('.knowledge-split-workspace[data-mode="split"][data-compact="true"]'),
  "styles must keep directories as overlays, enforce panel minimums, and degrade split mode on narrow widths"
);
assert(
  rendererCourseTypes.includes('"mindmap" | "split" | "word" | "textbook"')
    && electronMain.includes('"mindmap" | "split" | "word" | "textbook"'),
  "renderer and main-process workspace mode contracts must both accept split"
);

console.log("knowledge split workspace: ok");
