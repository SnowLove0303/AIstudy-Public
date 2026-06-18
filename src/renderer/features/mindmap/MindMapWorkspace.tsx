import React from "react";
import {
  Braces,
  Download,
  Frame,
  GitBranch,
  Link2,
  Maximize2,
  Minus,
  Move,
  Network,
  Plus,
  Redo2,
  Rows3,
  Save,
  Trash2,
  Undo2
} from "lucide-react";
import { MindMapCanvas, type MindMapCanvasHandle } from "./MindMapCanvas";
import { MindMapTextFormatToolbar } from "./MindMapTextFormatToolbar";
import { KnowledgeDocumentWorkspace } from "../documents/KnowledgeDocumentWorkspace";
import { registerBeforeCloseSave } from "../../lib/saveDrain";
import { readLocalSnapshot, writeLocalSnapshot } from "../../lib/localSnapshotStore";
import {
  buildMindMapOutline,
  countNodes,
  createInitialSnapshot,
  MIND_MAP_LAYOUT_OPTIONS,
  normalizeLayout,
  normalizeSnapshot
} from "./mindMapSnapshot";
import type {
  MindMapDocument,
  MindMapExportType,
  MindMapLayoutType,
  MindMapOutlineItem,
  MindMapSaveInput,
  MindMapSelectedNode,
  MindMapSnapshot,
  SimpleMindMapNode,
  MindMapTextFormatPatch
} from "./mindMapTypes";

export type WorkspaceEditorMode = "mindmap" | "word";

export type WorkspaceModeChangeRequest = {
  mode: WorkspaceEditorMode;
  nonce: number;
};

export type WorkspaceNodeSelectionRequest = {
  nodeId: string | null;
  nonce: number;
};

type MindMapWorkspaceProps = {
  courseId: string | null;
  courseName: string;
  editorMode: WorkspaceEditorMode;
  modeChangeRequest: WorkspaceModeChangeRequest | null;
  nodeSelectionRequest: WorkspaceNodeSelectionRequest | null;
  onEditorModeChange: (mode: WorkspaceEditorMode) => void;
  onOutlineChanged?: (outline: MindMapOutlineItem[]) => void;
  onNodeSelectedChanged?: (node: MindMapSelectedNode) => void;
};

type PendingSave = MindMapSaveInput;

type StorageMode = "mysql" | "local" | "none";

declare global {
  interface Window {
    aistudyMindMaps?: {
      load: (courseId: string) => Promise<MindMapDocument | null>;
      save: (document: MindMapSaveInput) => Promise<MindMapDocument>;
    };
  }
}

const SNAPSHOT_KEY_PREFIX = "aistudy-public:mindmap-document:v1:";
const LEGACY_SNAPSHOT_KEY_PREFIX = "aistudy-public:mindmap-snapshot:v1:";
const SAVE_DEBOUNCE_MS = 900;
const EXPORT_OPTIONS: Array<{ value: MindMapExportType; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "svg", label: "SVG" },
  { value: "xmind", label: "XMind" },
  { value: "json", label: "JSON" },
  { value: "md", label: "Markdown" }
];

function createMindMapId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `mindmap_${crypto.randomUUID().replaceAll("-", "")}`;
  }
  return `mindmap_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getStorageKey(courseId: string) {
  return `${SNAPSHOT_KEY_PREFIX}${courseId}`;
}

function getLegacyStorageKey(courseId: string) {
  return `${LEGACY_SNAPSHOT_KEY_PREFIX}${courseId}`;
}

function createDocument(courseId: string, courseName: string): MindMapDocument {
  const snapshot = createInitialSnapshot(courseName);
  return {
    courseId,
    mapId: createMindMapId(),
    title: courseName,
    snapshot,
    updatedAt: null,
    nodeCount: countNodes(snapshot.root)
  };
}

function normalizeDocument(value: unknown, courseId: string, courseName: string): MindMapDocument {
  if (!value || typeof value !== "object") {
    return createDocument(courseId, courseName);
  }

  const candidate = value as Partial<MindMapDocument>;
  const snapshot = normalizeSnapshot(candidate.snapshot ?? value, courseName);
  return {
    courseId,
    mapId: typeof candidate.mapId === "string" && candidate.mapId ? candidate.mapId : createMindMapId(),
    title: typeof candidate.title === "string" && candidate.title ? candidate.title : courseName,
    snapshot,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    nodeCount: countNodes(snapshot.root)
  };
}

async function loadLocalDocument(courseId: string, courseName: string): Promise<MindMapDocument> {
  try {
    const snapshotDocument = await readLocalSnapshot<MindMapDocument>(getStorageKey(courseId));
    if (snapshotDocument) {
      return normalizeDocument(snapshotDocument, courseId, courseName);
    }
  } catch {
    // IndexedDB is a fallback layer; failure should not block legacy recovery.
  }

  try {
    const storageKey = getStorageKey(courseId);
    const rawDocument = localStorage.getItem(storageKey);
    if (rawDocument) {
      const document = normalizeDocument(JSON.parse(rawDocument), courseId, courseName);
      void writeLocalSnapshot(storageKey, "mindmap", document);
      return document;
    }

    const rawLegacySnapshot = localStorage.getItem(getLegacyStorageKey(courseId));
    if (rawLegacySnapshot) {
      const document = normalizeDocument(JSON.parse(rawLegacySnapshot), courseId, courseName);
      void writeLocalSnapshot(storageKey, "mindmap", document);
      return document;
    }
  } catch {
    // A corrupt local cache should never block opening the editor.
  }

  return createDocument(courseId, courseName);
}

async function saveLocalDocument(input: PendingSave): Promise<MindMapDocument> {
  const snapshot = normalizeSnapshot(input.snapshot, input.title);
  const document: MindMapDocument = {
    courseId: input.courseId,
    mapId: input.mapId ?? createMindMapId(),
    title: input.title,
    snapshot,
    updatedAt: new Date().toISOString(),
    nodeCount: countNodes(snapshot.root)
  };
  await writeLocalSnapshot(getStorageKey(input.courseId), "mindmap", document);
  return document;
}

async function loadPersistedDocument(courseId: string, courseName: string) {
  if (!window.aistudyMindMaps) {
    return { document: await loadLocalDocument(courseId, courseName), mode: "local" as StorageMode, error: "" };
  }

  try {
    const remoteDocument = await window.aistudyMindMaps.load(courseId);
    return {
      document: remoteDocument ? normalizeDocument(remoteDocument, courseId, courseName) : createDocument(courseId, courseName),
      mode: "mysql" as StorageMode,
      error: ""
    };
  } catch (error) {
    return {
      document: await loadLocalDocument(courseId, courseName),
      mode: "local" as StorageMode,
      error: getErrorMessage(error, "导图读取失败，已打开本地副本")
    };
  }
}

function formatSavedAt() {
  return new Date().toLocaleTimeString();
}

function sanitizeFileName(value: string) {
  return (value || "AIstudy导图").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim() || "AIstudy导图";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}

function findOutlineItem(items: MindMapOutlineItem[], nodeId: string): MindMapOutlineItem | null {
  for (const item of items) {
    if (item.nodeId === nodeId) return item;
    const child = findOutlineItem(item.children, nodeId);
    if (child) return child;
  }
  return null;
}

function cloneMindMapNode(node: SimpleMindMapNode): SimpleMindMapNode {
  return {
    ...node,
    data: {
      ...node.data
    },
    children: Array.isArray(node.children) ? node.children.map(cloneMindMapNode) : []
  };
}

function getNodeId(node: SimpleMindMapNode | null | undefined) {
  return typeof node?.data?.uid === "string" && node.data.uid ? node.data.uid : null;
}

function findNodeInTree(root: SimpleMindMapNode | null | undefined, nodeId: string | null): SimpleMindMapNode | null {
  if (!root || !nodeId) return null;
  if (getNodeId(root) === nodeId) return root;
  const children = Array.isArray(root.children) ? root.children : [];
  for (const child of children) {
    const found = findNodeInTree(child, nodeId);
    if (found) return found;
  }
  return null;
}

function replaceNodeInTree(
  root: SimpleMindMapNode,
  nodeId: string,
  replacement: SimpleMindMapNode
): { root: SimpleMindMapNode; replaced: boolean } {
  if (getNodeId(root) === nodeId) {
    return { root: cloneMindMapNode(replacement), replaced: true };
  }

  let replaced = false;
  const children = Array.isArray(root.children)
    ? root.children.map((child) => {
        const result = replaceNodeInTree(child, nodeId, replacement);
        replaced = replaced || result.replaced;
        return result.root;
      })
    : [];

  return {
    root: {
      ...root,
      data: {
        ...root.data
      },
      children
    },
    replaced
  };
}

function createFocusedSnapshot(masterSnapshot: MindMapSnapshot, focusedNodeId: string | null): MindMapSnapshot {
  if (!focusedNodeId || getNodeId(masterSnapshot.root) === focusedNodeId) {
    return masterSnapshot;
  }

  const focusedNode = findNodeInTree(masterSnapshot.root, focusedNodeId);
  if (!focusedNode) {
    return masterSnapshot;
  }

  return {
    ...masterSnapshot,
    root: cloneMindMapNode(focusedNode),
    view: undefined
  };
}

function mergeFocusedSnapshot(
  masterSnapshot: MindMapSnapshot | null,
  focusedNodeId: string | null,
  focusedSnapshot: MindMapSnapshot
): MindMapSnapshot {
  if (!masterSnapshot || !focusedNodeId || getNodeId(masterSnapshot.root) === focusedNodeId) {
    return focusedSnapshot;
  }

  const result = replaceNodeInTree(masterSnapshot.root, focusedNodeId, focusedSnapshot.root);
  if (!result.replaced) {
    return focusedSnapshot;
  }

  return {
    ...masterSnapshot,
    root: result.root,
    layout: focusedSnapshot.layout,
    theme: focusedSnapshot.theme,
    view: undefined,
    updatedAt: focusedSnapshot.updatedAt
  };
}

function isSameSelectedNode(left: MindMapSelectedNode, right: MindMapSelectedNode) {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.textFormat?.fontWeight === right.textFormat?.fontWeight &&
    left.textFormat?.fontStyle === right.textFormat?.fontStyle &&
    left.textFormat?.textDecoration === right.textFormat?.textDecoration &&
    left.textFormat?.color === right.textFormat?.color &&
    left.textFormat?.fontSize === right.textFormat?.fontSize &&
    left.textFormat?.textAutoWrapWidth === right.textFormat?.textAutoWrapWidth
  );
}

export function MindMapWorkspace({
  courseId,
  courseName,
  editorMode,
  modeChangeRequest,
  nodeSelectionRequest,
  onEditorModeChange,
  onOutlineChanged,
  onNodeSelectedChanged
}: MindMapWorkspaceProps) {
  const canvasRef = React.useRef<MindMapCanvasHandle | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const pendingSaveRef = React.useRef<PendingSave | null>(null);
  const activeSaveRef = React.useRef<Promise<MindMapDocument | null>>(Promise.resolve(null));
  const loadSequenceRef = React.useRef(0);
  const [snapshot, setSnapshot] = React.useState<MindMapSnapshot | null>(null);
  const snapshotRef = React.useRef<MindMapSnapshot | null>(null);
  const [mapId, setMapId] = React.useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = React.useState<string | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<MindMapSelectedNode>({ id: null, title: "" });
  const [isReady, setIsReady] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [canvasDragEnabled, setCanvasDragEnabled] = React.useState(false);
  const [exportType, setExportType] = React.useState<MindMapExportType>("png");
  const [storageMode, setStorageMode] = React.useState<StorageMode>("none");
  const [error, setError] = React.useState("");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const canUseEditor = isReady && !isLoading;
  const selectedNodeRef = React.useRef(selectedNode);

  React.useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  React.useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const publishSelectedNode = React.useCallback(
    (node: MindMapSelectedNode) => {
      if (isSameSelectedNode(selectedNodeRef.current, node)) return;
      selectedNodeRef.current = node;
      setSelectedNode(node);
      onNodeSelectedChanged?.(node);
    },
    [onNodeSelectedChanged]
  );

  const persistDocument = React.useCallback(async (input: PendingSave, silent = false): Promise<MindMapDocument | null> => {
    if (!silent) {
      setIsSaving(true);
    }

    try {
      if (!window.aistudyMindMaps) {
        try {
          const localDocument = await saveLocalDocument(input);
          if (!silent) {
            setMapId(localDocument.mapId);
            setStorageMode("local");
            setSavedAt(formatSavedAt());
            setError("");
          }
          return localDocument;
        } catch (localError) {
          if (!silent) {
            setStorageMode("none");
            setError(getErrorMessage(localError, "导图本地缓存失败"));
          }
          return null;
        }
      }

      const remoteDocument = await window.aistudyMindMaps.save(input);
      if (!silent) {
        setMapId(remoteDocument.mapId);
        setStorageMode("mysql");
          setSavedAt(formatSavedAt());
          setError("");
        }
      return remoteDocument;
    } catch (error) {
      try {
        const localDocument = await saveLocalDocument(input);
        if (!silent) {
          setMapId(localDocument.mapId);
          setStorageMode("local");
          setSavedAt(formatSavedAt());
          setError(getErrorMessage(error, "导图保存失败，已保存到本地副本"));
        }
        return localDocument;
      } catch (localError) {
        if (!silent) {
          setStorageMode("none");
          setError(`${getErrorMessage(error, "导图保存失败")}；${getErrorMessage(localError, "本地副本也保存失败")}`);
        }
        return null;
      }
    } finally {
      if (!silent) {
        setIsSaving(false);
      }
    }
  }, []);

  const flushPendingSave = React.useCallback((silent = false): Promise<MindMapDocument | null> => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!pending) {
      return activeSaveRef.current;
    }

    const saveTask = activeSaveRef.current
      .catch(() => null)
      .then(() => persistDocument(pending, silent));
    activeSaveRef.current = saveTask.catch(() => null);
    return saveTask;
  }, [persistDocument]);

  React.useEffect(() => {
    void flushPendingSave(true);

    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;
    publishSelectedNode({ id: null, title: "" });
    setFocusedNodeId(null);
    setIsReady(false);
    setSavedAt(null);
    setSnapshot(null);
    setMapId(null);
    setStorageMode("none");

    if (!courseId) {
      setError("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    loadPersistedDocument(courseId, courseName)
      .then(({ document, mode, error: loadError }) => {
        if (loadSequenceRef.current !== sequence) return;
        setMapId(document.mapId);
        setSnapshot(normalizeSnapshot(document.snapshot, courseName));
        setStorageMode(mode);
        setError(loadError);
      })
      .catch(async () => {
        if (loadSequenceRef.current !== sequence) return;
        const document = await loadLocalDocument(courseId, courseName);
        setMapId(document.mapId);
        setSnapshot(normalizeSnapshot(document.snapshot, courseName));
        setStorageMode("local");
        setError("导图读取失败，已打开本地副本。");
      })
      .finally(() => {
        if (loadSequenceRef.current === sequence) {
          setIsLoading(false);
        }
      });
  }, [courseId, courseName, flushPendingSave, publishSelectedNode]);

  React.useEffect(() => {
    return () => {
      void flushPendingSave(true);
    };
  }, [flushPendingSave]);

  React.useEffect(() => registerBeforeCloseSave(() => flushPendingSave(true)), [flushPendingSave]);

  const queueSnapshotSave = React.useCallback(
    (nextSnapshot: MindMapSnapshot) => {
      if (!courseId) return;

      const nextMapId = mapId ?? createMindMapId();
      if (!mapId) {
        setMapId(nextMapId);
      }

      snapshotRef.current = nextSnapshot;
      React.startTransition(() => {
        setSnapshot(nextSnapshot);
      });
      pendingSaveRef.current = {
        courseId,
        mapId: nextMapId,
        title: courseName,
        snapshot: nextSnapshot
      };

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => flushPendingSave(false), SAVE_DEBOUNCE_MS);
    },
    [courseId, courseName, flushPendingSave, mapId]
  );

  const queueCanvasSnapshotSave = React.useCallback(
    (nextCanvasSnapshot: MindMapSnapshot) => {
      const nextSnapshot = mergeFocusedSnapshot(snapshotRef.current, focusedNodeId, nextCanvasSnapshot);
      queueSnapshotSave(nextSnapshot);
    },
    [focusedNodeId, queueSnapshotSave]
  );

  const saveNow = React.useCallback((): Promise<MindMapDocument | null> => {
    if (!courseId) return Promise.resolve(null);
    const currentCanvasSnapshot = canvasRef.current?.getSnapshot();
    const currentMasterSnapshot = currentCanvasSnapshot
      ? mergeFocusedSnapshot(snapshotRef.current, focusedNodeId, currentCanvasSnapshot)
      : snapshotRef.current;
    if (!currentMasterSnapshot) return Promise.resolve(null);

    const nextMapId = mapId ?? createMindMapId();
    if (!mapId) {
      setMapId(nextMapId);
    }

    pendingSaveRef.current = {
      courseId,
      mapId: nextMapId,
      title: courseName,
      snapshot: currentMasterSnapshot
    };
    return flushPendingSave(false);
  }, [courseId, courseName, flushPendingSave, focusedNodeId, mapId]);

  const exportMap = React.useCallback(async () => {
    if (!courseId || !isReady || isLoading) return;
    setIsExporting(true);
    setError("");

    try {
      await canvasRef.current?.exportFile(exportType, sanitizeFileName(courseName));
    } catch (error) {
      setError(getErrorMessage(error, "导出失败"));
    } finally {
      setIsExporting(false);
    }
  }, [courseId, courseName, exportType, isLoading, isReady]);

  const changeLayout = React.useCallback(
    (nextLayout: MindMapLayoutType) => {
      if (!courseId || !canUseEditor) return;
      const layout = normalizeLayout(nextLayout);
      const nextSnapshot = canvasRef.current?.setLayout(layout);

      if (nextSnapshot) {
        queueCanvasSnapshotSave(nextSnapshot);
        return;
      }

      const currentSnapshot = snapshotRef.current;
      if (currentSnapshot) {
        const fallbackSnapshot: MindMapSnapshot = {
          ...currentSnapshot,
          layout,
          view: undefined,
          updatedAt: new Date().toISOString()
        };
        queueSnapshotSave(fallbackSnapshot);
      }
    },
    [canUseEditor, courseId, queueCanvasSnapshotSave, queueSnapshotSave]
  );

  const outline = React.useMemo(() => buildMindMapOutline(snapshot?.root), [snapshot]);
  const focusedSnapshot = React.useMemo(
    () => (snapshot ? createFocusedSnapshot(snapshot, focusedNodeId) : null),
    [focusedNodeId, snapshot]
  );

  React.useEffect(() => {
    onOutlineChanged?.(outline);
  }, [onOutlineChanged, outline]);

  React.useEffect(() => {
    if (!snapshot || !focusedNodeId) return;
    if (!findNodeInTree(snapshot.root, focusedNodeId)) {
      setFocusedNodeId(null);
    }
  }, [focusedNodeId, snapshot]);

  const handleNodeSelected = React.useCallback(
    (node: MindMapSelectedNode) => {
      publishSelectedNode(node);
    },
    [publishSelectedNode]
  );

  React.useEffect(() => {
    if (!modeChangeRequest || modeChangeRequest.mode === editorMode) return;
    let isCancelled = false;

    async function changeMode() {
      if (modeChangeRequest?.mode === "word") {
        await saveNow();
      }
      if (!isCancelled && modeChangeRequest) {
        onEditorModeChange(modeChangeRequest.mode);
      }
    }

    void changeMode();
    return () => {
      isCancelled = true;
    };
  }, [editorMode, modeChangeRequest, onEditorModeChange, saveNow]);

  React.useEffect(() => {
    const nodeId = nodeSelectionRequest?.nodeId;
    if (!nodeId) return;

    const item = findOutlineItem(outline, nodeId);
    const rootNodeId = outline[0]?.nodeId ?? null;
    const requestedNode: MindMapSelectedNode = {
      id: nodeId,
      title: item?.title ?? ""
    };

    publishSelectedNode(requestedNode);
    setFocusedNodeId(nodeId === rootNodeId ? null : nodeId);
  }, [nodeSelectionRequest, outline, publishSelectedNode]);

  const applyTextFormat = React.useCallback(
    (patch: MindMapTextFormatPatch) => {
      if (!canUseEditor || !selectedNode.id) return;
      const nextSelectedNode = canvasRef.current?.applyTextFormat(patch);
      if (!nextSelectedNode) return;
      publishSelectedNode(nextSelectedNode);
    },
    [canUseEditor, publishSelectedNode, selectedNode.id]
  );

  const selectDocumentNode = React.useCallback(
    (nodeId: string) => {
      const item = findOutlineItem(outline, nodeId);
      const rootNodeId = outline[0]?.nodeId ?? null;
      publishSelectedNode({ id: nodeId, title: item?.title ?? "" });
      setFocusedNodeId(nodeId === rootNodeId ? null : nodeId);
    },
    [outline, publishSelectedNode]
  );

  if (!courseId || !snapshot || !focusedSnapshot) {
    return (
      <div className="mindmap-placeholder">
        <GitBranch size={30} strokeWidth={1.7} />
        <div>
          <strong>{isLoading ? "正在载入导图" : "请选择课程"}</strong>
        </div>
      </div>
    );
  }

  const nodeCount = countNodes(focusedSnapshot.root);
  const storageText = storageMode === "mysql" ? "已连接" : storageMode === "local" ? "本地副本" : "未连接";
  const currentLayout = normalizeLayout(focusedSnapshot.layout);
  const canvasKey = `${courseId}:${focusedNodeId ?? "full"}`;

  if (editorMode === "word") {
    return (
      <div className="mindmap-workspace" data-editor-mode="word">
        <KnowledgeDocumentWorkspace
          courseId={courseId}
          mindMapId={mapId}
          selectedNode={selectedNode}
          outline={outline}
          onNodeSelect={selectDocumentNode}
        />
      </div>
    );
  }

  return (
    <div className="mindmap-workspace" data-editor-mode="mindmap">
      <div className="mindmap-local-toolbar" aria-label="导图编辑工具栏">
        <button type="button" title="添加子主题" onClick={() => canvasRef.current?.exec("insert-child")} disabled={!canUseEditor}>
          <Plus size={15} />
          <span>子主题</span>
        </button>
        <button type="button" title="添加同级主题" onClick={() => canvasRef.current?.exec("insert-sibling")} disabled={!canUseEditor}>
          <GitBranch size={15} />
          <span>同级</span>
        </button>
        <button type="button" title="添加父主题" onClick={() => canvasRef.current?.exec("insert-parent")} disabled={!canUseEditor}>
          <Rows3 size={15} />
          <span>父主题</span>
        </button>
        <button type="button" title="整理布局" onClick={() => canvasRef.current?.exec("reset-layout")} disabled={!canUseEditor}>
          <Network size={15} />
          <span>整理</span>
        </button>
        <span className="mindmap-toolbar-separator" />
        <button type="button" title="添加关系线" onClick={() => canvasRef.current?.exec("add-relationship")} disabled={!canUseEditor}>
          <Link2 size={15} />
          <span>关系线</span>
        </button>
        <button type="button" title="添加边界" onClick={() => canvasRef.current?.exec("add-boundary")} disabled={!canUseEditor}>
          <Frame size={15} />
          <span>边界</span>
        </button>
        <button type="button" title="添加概要" onClick={() => canvasRef.current?.exec("add-summary")} disabled={!canUseEditor}>
          <Braces size={15} />
          <span>概要</span>
        </button>
        <button type="button" title="删除选中主题" onClick={() => canvasRef.current?.exec("delete-node")} disabled={!canUseEditor}>
          <Trash2 size={15} />
        </button>
        <span className="mindmap-toolbar-separator" />
        <MindMapTextFormatToolbar
          value={selectedNode.textFormat}
          disabled={!canUseEditor || !selectedNode.id}
          onChange={applyTextFormat}
        />
        <span className="mindmap-toolbar-separator" />
        <button type="button" title="撤销" onClick={() => canvasRef.current?.exec("undo")} disabled={!canUseEditor}>
          <Undo2 size={15} />
        </button>
        <button type="button" title="重做" onClick={() => canvasRef.current?.exec("redo")} disabled={!canUseEditor}>
          <Redo2 size={15} />
        </button>
        <span className="mindmap-toolbar-separator" />
        <button type="button" title="缩小" onClick={() => canvasRef.current?.exec("zoom-out")} disabled={!canUseEditor}>
          <Minus size={15} />
        </button>
        <button type="button" title="适应画布" onClick={() => canvasRef.current?.exec("fit")} disabled={!canUseEditor}>
          <Maximize2 size={15} />
        </button>
        <button type="button" title="放大" onClick={() => canvasRef.current?.exec("zoom-in")} disabled={!canUseEditor}>
          <Plus size={15} />
        </button>
        <button
          className={canvasDragEnabled ? "interaction-mode-button active" : "interaction-mode-button"}
          type="button"
          title={canvasDragEnabled ? "关闭空白画布拖拽" : "开启空白画布拖拽"}
          aria-label={canvasDragEnabled ? "关闭空白画布拖拽" : "开启空白画布拖拽"}
          aria-pressed={canvasDragEnabled}
          onClick={() => setCanvasDragEnabled((value) => !value)}
          disabled={!canUseEditor}
        >
          <Move size={15} />
          <span>画布拖拽</span>
        </button>
        <span className="mindmap-toolbar-spacer" />
        <div className="mindmap-select-control">
          <span>布局</span>
          <select
            value={currentLayout}
            title="画布布局"
            aria-label="画布布局"
            onChange={(event) => changeLayout(event.target.value as MindMapLayoutType)}
            disabled={!canUseEditor}
          >
            {MIND_MAP_LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mindmap-export-control">
          <select
            value={exportType}
            title="导出格式"
            aria-label="导出格式"
            onChange={(event) => setExportType(event.target.value as MindMapExportType)}
            disabled={!canUseEditor || isExporting}
          >
            {EXPORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" title="导出导图" onClick={exportMap} disabled={!canUseEditor || isExporting}>
            <Download size={15} />
            <span>{isExporting ? "导出中" : "导出"}</span>
          </button>
        </div>
        <button type="button" title="立即保存" onClick={saveNow} disabled={!canUseEditor || isSaving}>
          <Save size={15} />
          <span>{isSaving ? "保存中" : "保存"}</span>
        </button>
      </div>

      <MindMapCanvas
        key={canvasKey}
        ref={canvasRef}
        snapshot={focusedSnapshot}
        canvasDragEnabled={canvasDragEnabled}
        onSnapshotChanged={queueCanvasSnapshotSave}
        onNodeSelected={handleNodeSelected}
        onReadyChange={setIsReady}
        onError={setError}
      />

      <div className="mindmap-status-strip">
        <span>{canUseEditor ? "就绪" : "载入中"}</span>
        <span>{nodeCount} 个主题</span>
        <span>{storageText}</span>
        <span>{canvasDragEnabled ? "画布拖拽" : "框选模式"}</span>
        {selectedNode.id ? <span>已选：{selectedNode.title || "未命名"}</span> : <span>未选中主题</span>}
        {savedAt ? <span>已保存 {savedAt}</span> : null}
        {error ? <span className="mindmap-error">{error}</span> : null}
      </div>
    </div>
  );
}
