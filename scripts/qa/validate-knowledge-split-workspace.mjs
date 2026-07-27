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
const paneControls = read("src/renderer/features/knowledge/WorkspacePaneControls.tsx");
const viewportScrollbars = read("src/renderer/lib/ViewportScrollbars.tsx");
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
    && splitWorkspace.includes("ResizeObserver")
    && splitWorkspace.includes('window.addEventListener("blur"')
    && splitWorkspace.includes('document.addEventListener("visibilitychange"')
    && splitWorkspace.includes("releasePointerCapture"),
  "split resizing must use pointer capture, frame-batched updates, responsive measurement, and interruption cleanup"
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
    && rendererMain.includes("<WorkspacePaneControls")
    && rendererMain.includes("onNodeSelectedChanged={setSelectedMindMapNode}"),
  "the renderer must expose split mode and default both width-consuming directories to collapsed drawers"
);
assert(
  paneControls.includes('className="workspace-pane-controls"')
    && paneControls.includes('libraryCollapsed ? "展开知识库" : "收起知识库"')
    && paneControls.includes('catalogCollapsed ? "展开目录" : "收起目录"')
    && styles.includes(".workspace-pane-controls")
    && styles.includes("z-index: 64"),
  "directory controls must remain in a persistent interaction layer above drawers and the canvas"
);
assert(
  viewportScrollbars.includes("setPointerCapture")
    && viewportScrollbars.includes("releasePointerCapture")
    && viewportScrollbars.includes('window.addEventListener("blur"')
    && viewportScrollbars.includes('document.addEventListener("visibilitychange"')
    && !viewportScrollbars.includes('window.addEventListener("pointermove"'),
  "viewport scrollbars must not leak temporary window drag listeners across workspace changes"
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
