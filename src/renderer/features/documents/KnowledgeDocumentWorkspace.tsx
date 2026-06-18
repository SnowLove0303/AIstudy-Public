import React from "react";
import { Bold, Bot, ChevronLeft, ChevronRight, Italic, Paintbrush, Redo2, Save, SkipForward, Type, Underline, Undo2, Upload } from "lucide-react";
import { createCanvasDocumentEditor, createEmptyKnowledgeDocumentSnapshot } from "./canvasEditorAdapter";
import { AiAssistantPanel } from "../assistant/AiAssistantPanel";
import { ImporterDialog } from "../importer/ImporterDialog";
import { createKnowledgeDocumentBinding } from "../../domain/coreContracts";
import { registerBeforeCloseSave } from "../../lib/saveDrain";
import { readLocalSnapshot, writeLocalSnapshot } from "../../lib/localSnapshotStore";
import {
  areViewportScrollStatesEqual,
  EMPTY_VIEWPORT_SCROLL_STATE,
  ViewportScrollbars,
  type ViewportScrollAxis,
  type ViewportScrollState
} from "../../lib/ViewportScrollbars";
import type {
  KnowledgeDocumentEditorHandle,
  KnowledgeDocumentFormatState,
  KnowledgeDocumentRecord,
  KnowledgeDocumentSaveInput,
  KnowledgeDocumentStatus,
  KnowledgeDocumentSnapshot
} from "./knowledgeDocumentTypes";
import type { MindMapOutlineItem, MindMapSelectedNode } from "../mindmap/mindMapTypes";

type KnowledgeDocumentWorkspaceProps = {
  courseId: string | null;
  mindMapId: string | null;
  selectedNode: MindMapSelectedNode;
  outline: MindMapOutlineItem[];
  onNodeSelect?: (nodeId: string) => void;
};

type StorageMode = "mysql" | "local" | "none";
type PendingDocumentSave = KnowledgeDocumentSaveInput;

type LoadRequest = {
  courseId: string;
  mindMapId: string;
  nodeId: string;
};

type StatusRequest = {
  courseId: string;
  mindMapId: string;
};

type AiContextMenuState = {
  x: number;
  y: number;
  text?: string;
};

type AiPanelSize = {
  width: number;
  height: number;
};

type DocumentFormatBrushState = {
  format: KnowledgeDocumentFormatState;
  reusable: boolean;
};

const SAVE_DEBOUNCE_MS = 900;
const DOCUMENT_STORAGE_PREFIX = "aistudy-public:knowledge-document:v1:";
const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32];
const COLOR_OPTIONS = ["#1f2937", "#2563eb", "#0f766e", "#d97706", "#dc2626", "#7c3aed"];
const AI_CONTEXT_PANEL_WIDTH = 430;
const AI_CONTEXT_PANEL_HEIGHT = 560;
const AI_CONTEXT_PANEL_MIN_WIDTH = 360;
const AI_CONTEXT_PANEL_MIN_HEIGHT = 420;
const AI_CONTEXT_PANEL_MARGIN = 12;

const DEFAULT_AI_PANEL_SIZE: AiPanelSize = {
  width: AI_CONTEXT_PANEL_WIDTH,
  height: AI_CONTEXT_PANEL_HEIGHT
};

declare global {
  interface Window {
    aistudyKnowledgeDocuments?: {
      load: (request: LoadRequest) => Promise<KnowledgeDocumentRecord | null>;
      listStatuses: (request: StatusRequest) => Promise<KnowledgeDocumentStatus[]>;
      save: (input: KnowledgeDocumentSaveInput) => Promise<KnowledgeDocumentRecord>;
    };
  }
}

function getStorageKey(courseId: string, mindMapId: string, nodeId: string) {
  return `${DOCUMENT_STORAGE_PREFIX}${courseId}:${mindMapId}:${nodeId}`;
}

function formatSavedAt() {
  return new Date().toLocaleTimeString();
}

async function loadLocalDocument(courseId: string, mindMapId: string, nodeId: string): Promise<KnowledgeDocumentSnapshot | null> {
  const storageKey = getStorageKey(courseId, mindMapId, nodeId);
  try {
    const snapshot = await readLocalSnapshot<KnowledgeDocumentSnapshot>(storageKey);
    if (snapshot) return snapshot;
  } catch {
    // IndexedDB failure should not block legacy localStorage recovery.
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as KnowledgeDocumentSnapshot;
    void writeLocalSnapshot(storageKey, "document", snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

async function saveLocalDocument(input: KnowledgeDocumentSaveInput) {
  await writeLocalSnapshot(getStorageKey(input.courseId, input.mindMapId, input.nodeId), "document", input.snapshot);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? `${fallback}: ${error.message}` : fallback;
}

function clampPercent(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function readNativeScrollState(element: HTMLElement): ViewportScrollState {
  const verticalSize = element.scrollHeight > 0 ? clampPercent((element.clientHeight / element.scrollHeight) * 100) : 100;
  const horizontalSize = element.scrollWidth > 0 ? clampPercent((element.clientWidth / element.scrollWidth) * 100) : 100;
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  const maxVerticalPosition = Math.max(0, 100 - verticalSize);
  const maxHorizontalPosition = Math.max(0, 100 - horizontalSize);

  return {
    vertical: {
      position:
        maxScrollTop > 0
          ? clampPercent((element.scrollTop / maxScrollTop) * maxVerticalPosition, 0, maxVerticalPosition)
          : 0,
      size: verticalSize,
      enabled: element.scrollHeight > element.clientHeight + 1
    },
    horizontal: {
      position:
        maxScrollLeft > 0
          ? clampPercent((element.scrollLeft / maxScrollLeft) * maxHorizontalPosition, 0, maxHorizontalPosition)
          : 0,
      size: horizontalSize,
      enabled: element.scrollWidth > element.clientWidth + 1
    }
  };
}

function resetScrollTarget(element: HTMLElement | null | undefined) {
  if (!element) return;
  if (element.scrollTop !== 0) element.scrollTop = 0;
  if (element.scrollLeft !== 0) element.scrollLeft = 0;
}

function readDomSelectedText(container: HTMLElement | null) {
  const selectionText = window.getSelection()?.toString().trim() ?? "";
  if (selectionText) return selectionText;

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLInputElement
  ) {
    if (container && !container.contains(activeElement)) return "";
    const start = activeElement.selectionStart ?? 0;
    const end = activeElement.selectionEnd ?? 0;
    if (end > start) return activeElement.value.slice(start, end).trim();
  }

  return "";
}

function flattenOutlineItems(items: MindMapOutlineItem[]) {
  const flat: MindMapOutlineItem[] = [];
  const visit = (item: MindMapOutlineItem) => {
    if (item.nodeId) {
      flat.push(item);
    }
    item.children.forEach(visit);
  };
  items.forEach(visit);
  return flat;
}

const DOCUMENT_CONTENT_STRUCTURAL_KEYS = new Set([
  "id",
  "type",
  "mode",
  "name",
  "style",
  "styles",
  "attrs",
  "schemaVersion",
  "editor",
  "editorVersion",
  "updatedAt"
]);

function hasDocumentContent(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some(hasDocumentContent);
  }
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, child]) => {
    if (DOCUMENT_CONTENT_STRUCTURAL_KEYS.has(key)) return false;
    return hasDocumentContent(child);
  });
}

function isBlankDocumentSnapshot(snapshot: KnowledgeDocumentSnapshot | null | undefined) {
  if (!snapshot?.content) return true;
  return !hasDocumentContent(snapshot.content.header) &&
    !hasDocumentContent(snapshot.content.main) &&
    !hasDocumentContent(snapshot.content.footer) &&
    !hasDocumentContent(snapshot.content.graffiti);
}

function clampAiPanelSize(size: AiPanelSize): AiPanelSize {
  const maxWidth = Math.max(AI_CONTEXT_PANEL_MIN_WIDTH, window.innerWidth - AI_CONTEXT_PANEL_MARGIN * 2);
  const maxHeight = Math.max(AI_CONTEXT_PANEL_MIN_HEIGHT, window.innerHeight - AI_CONTEXT_PANEL_MARGIN * 2);
  return {
    width: Math.min(Math.max(AI_CONTEXT_PANEL_MIN_WIDTH, size.width), maxWidth),
    height: Math.min(Math.max(AI_CONTEXT_PANEL_MIN_HEIGHT, size.height), maxHeight)
  };
}

function clampAiPanelPoint(point: { x: number; y: number }, size: AiPanelSize = DEFAULT_AI_PANEL_SIZE) {
  const nextSize = clampAiPanelSize(size);
  const maxX = Math.max(AI_CONTEXT_PANEL_MARGIN, window.innerWidth - nextSize.width - AI_CONTEXT_PANEL_MARGIN);
  const maxY = Math.max(AI_CONTEXT_PANEL_MARGIN, window.innerHeight - nextSize.height - AI_CONTEXT_PANEL_MARGIN);
  return {
    x: Math.min(Math.max(AI_CONTEXT_PANEL_MARGIN, point.x), maxX),
    y: Math.min(Math.max(AI_CONTEXT_PANEL_MARGIN, point.y), maxY)
  };
}

function getAiPanelAnchorPoint(anchor: HTMLElement | null, fallback: { x: number; y: number }, size: AiPanelSize = DEFAULT_AI_PANEL_SIZE) {
  const rect = anchor?.getBoundingClientRect();
  if (!rect) return fallback;

  return {
    x: rect.right - size.width,
    y: rect.bottom + 8
  };
}

export function KnowledgeDocumentWorkspace({
  courseId,
  mindMapId,
  selectedNode,
  outline,
  onNodeSelect
}: KnowledgeDocumentWorkspaceProps) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const toolbarAiButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const aiPanelRef = React.useRef<HTMLDivElement | null>(null);
  const latestContextMenuPointRef = React.useRef({ x: 0, y: 0 });
  const lastSelectedTextRef = React.useRef("");
  const editorRef = React.useRef<KnowledgeDocumentEditorHandle | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const pendingSaveRef = React.useRef<PendingDocumentSave | null>(null);
  const activeSaveRef = React.useRef<Promise<KnowledgeDocumentRecord | null>>(Promise.resolve(null));
  const latestSnapshotRef = React.useRef<KnowledgeDocumentSnapshot | null>(null);
  const loadSequenceRef = React.useRef(0);
  const documentStatusMapRef = React.useRef<Map<string, KnowledgeDocumentStatus>>(new Map());
  const documentStatusReadyRef = React.useRef(false);
  const documentStatusLoadPromiseRef = React.useRef<Promise<void> | null>(null);
  const documentStatusLoadSequenceRef = React.useRef(0);
  const viewportUpdateFrameRef = React.useRef<number | null>(null);
  const [snapshot, setSnapshot] = React.useState<KnowledgeDocumentSnapshot | null>(null);
  const [formatState, setFormatState] = React.useState<KnowledgeDocumentFormatState>({
    fontSize: 16,
    color: "#1f2937",
    bold: false,
    italic: false,
    underline: false
  });
  const formatStateRef = React.useRef(formatState);
  const formatBrushRef = React.useRef<DocumentFormatBrushState | null>(null);
  const [formatBrush, setFormatBrush] = React.useState<DocumentFormatBrushState | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditorReady, setIsEditorReady] = React.useState(false);
  const [storageMode, setStorageMode] = React.useState<StorageMode>("none");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [documentViewportState, setDocumentViewportState] =
    React.useState<ViewportScrollState>(EMPTY_VIEWPORT_SCROLL_STATE);
  const [assistantDraft, setAssistantDraft] = React.useState("");
  const [aiPanelSize, setAiPanelSize] = React.useState<AiPanelSize>(DEFAULT_AI_PANEL_SIZE);
  const aiPanelSizeRef = React.useRef<AiPanelSize>(DEFAULT_AI_PANEL_SIZE);
  const [aiContextMenu, setAiContextMenu] = React.useState<AiContextMenuState | null>(null);
  const [skipBlankPages, setSkipBlankPages] = React.useState(false);
  const [isNavigatingDocument, setIsNavigatingDocument] = React.useState(false);
  const [isImporterOpen, setIsImporterOpen] = React.useState(false);

  const documentBinding = React.useMemo(
    () => createKnowledgeDocumentBinding(courseId, mindMapId, selectedNode.id),
    [courseId, mindMapId, selectedNode.id]
  );
  const canUseDocument = Boolean(documentBinding && snapshot);
  const navigationItems = React.useMemo(() => flattenOutlineItems(outline), [outline]);
  const documentKey = React.useMemo(
    () => (documentBinding ? `${documentBinding.courseId}:${documentBinding.mindMapId}:${documentBinding.nodeId}` : "none"),
    [documentBinding]
  );
  const documentKeyRef = React.useRef(documentKey);
  documentKeyRef.current = documentKey;
  aiPanelSizeRef.current = aiPanelSize;
  const currentNavigationIndex = React.useMemo(
    () => navigationItems.findIndex((item) => item.nodeId === selectedNode.id),
    [navigationItems, selectedNode.id]
  );
  const canNavigatePrevious = canUseDocument && currentNavigationIndex > 0 && Boolean(onNodeSelect);
  const canNavigateNext = canUseDocument &&
    currentNavigationIndex >= 0 &&
    currentNavigationIndex < navigationItems.length - 1 &&
    Boolean(onNodeSelect);

  const updateFormatState = React.useCallback((nextState: KnowledgeDocumentFormatState) => {
    formatStateRef.current = nextState;
    setFormatState(nextState);
  }, []);

  const setActiveFormatBrush = React.useCallback((nextBrush: DocumentFormatBrushState | null) => {
    formatBrushRef.current = nextBrush;
    setFormatBrush(nextBrush);
  }, []);

  const preserveDocumentScroll = React.useCallback((action: () => void) => {
    const mount = mountRef.current;
    const scrollLeft = mount?.scrollLeft ?? 0;
    const scrollTop = mount?.scrollTop ?? 0;
    action();
    if (!mount) return;

    const restore = () => {
      mount.scrollLeft = scrollLeft;
      mount.scrollTop = scrollTop;
      const nextState = readNativeScrollState(mount);
      setDocumentViewportState((previousState) =>
        areViewportScrollStatesEqual(previousState, nextState) ? previousState : nextState
      );
    };
    restore();
    window.requestAnimationFrame(restore);
    window.setTimeout(restore, 0);
  }, []);

  const applyFormatBrushToSelection = React.useCallback((brush: DocumentFormatBrushState) => {
    const editor = editorRef.current;
    if (!editor?.hasSelection()) {
      setError(brush.reusable ? "连续格式刷已取样，请先框选要套用格式的文字" : "单次格式刷已取样，请先框选要套用格式的文字");
      return false;
    }

    let applied = false;
    preserveDocumentScroll(() => {
      applied = editor.applyFormat(brush.format);
    });
    if (!applied) {
      setError(brush.reusable ? "连续格式刷已取样，请重新框选要套用格式的文字" : "单次格式刷已取样，请重新框选要套用格式的文字");
      return false;
    }

    setError("");
    return true;
  }, [preserveDocumentScroll]);

  const runFormatBrush = React.useCallback(
    (reusable: boolean) => {
      const editor = editorRef.current;
      if (!canUseDocument || !isEditorReady || !editor) return;

      const activeBrush = formatBrushRef.current;
      const isSameBrush = Boolean(activeBrush && activeBrush.reusable === reusable);
      const hasSelection = editor.hasSelection();

      if (isSameBrush && activeBrush) {
        if (!hasSelection) {
          setActiveFormatBrush(null);
          setError("");
          return;
        }

        const applied = applyFormatBrushToSelection(activeBrush);
        if (applied && !activeBrush.reusable) {
          setActiveFormatBrush(null);
        }
        return;
      }

      if (!hasSelection) {
        setError(reusable ? "请先框选要复制格式的文字，再点击连续格式刷取样" : "请先框选要复制格式的文字，再点击单次格式刷取样");
        return;
      }

      const capturedFormat = editor.captureFormat();
      if (!capturedFormat) {
        setError("未读取到选区格式，请重新框选源文字");
        return;
      }

      setActiveFormatBrush({
        format: capturedFormat,
        reusable
      });
      setError("");
    },
    [applyFormatBrushToSelection, canUseDocument, isEditorReady, setActiveFormatBrush]
  );

  const startSingleUseFormatBrush = React.useCallback(() => {
    runFormatBrush(false);
  }, [runFormatBrush]);

  const toggleReusableFormatBrush = React.useCallback(() => {
    runFormatBrush(true);
  }, [runFormatBrush]);

  const handleEditorKeyDownCapture = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape" || !formatBrushRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      setActiveFormatBrush(null);
    },
    [setActiveFormatBrush]
  );

  const upsertDocumentStatus = React.useCallback((status: KnowledgeDocumentStatus) => {
    const nextMap = new Map(documentStatusMapRef.current);
    nextMap.set(status.nodeId, status);
    documentStatusMapRef.current = nextMap;
  }, []);

  const updateDocumentStatusFromSnapshot = React.useCallback(
    (input: KnowledgeDocumentSaveInput, document?: KnowledgeDocumentRecord | null) => {
      const existing = documentStatusMapRef.current.get(input.nodeId);
      upsertDocumentStatus({
        courseId: input.courseId,
        mindMapId: input.mindMapId,
        nodeId: input.nodeId,
        documentId: document?.documentId ?? existing?.documentId ?? `${input.mindMapId}:${input.nodeId}`,
        title: document?.title ?? input.title,
        updatedAt: document?.updatedAt ?? new Date().toISOString(),
        byteSize: document?.byteSize ?? existing?.byteSize ?? 0,
        hasContent: document?.hasContent ?? !isBlankDocumentSnapshot(input.snapshot)
      });
    },
    [upsertDocumentStatus]
  );

  React.useEffect(() => {
    documentStatusMapRef.current = new Map();
    documentStatusReadyRef.current = false;
    documentStatusLoadPromiseRef.current = null;

    const sequence = documentStatusLoadSequenceRef.current + 1;
    documentStatusLoadSequenceRef.current = sequence;

    if (!courseId || !mindMapId || !window.aistudyKnowledgeDocuments?.listStatuses) {
      return;
    }

    const statusLoadTask = window.aistudyKnowledgeDocuments
      .listStatuses({ courseId, mindMapId })
      .then((statuses) => {
        if (documentStatusLoadSequenceRef.current !== sequence) return;
        const nextMap = new Map(statuses.map((status) => [status.nodeId, status]));
        documentStatusMapRef.current.forEach((existingStatus, nodeId) => {
          const loadedStatus = nextMap.get(nodeId);
          if (
            !loadedStatus ||
            (existingStatus.updatedAt &&
              (!loadedStatus.updatedAt || existingStatus.updatedAt > loadedStatus.updatedAt))
          ) {
            nextMap.set(nodeId, existingStatus);
          }
        });
        documentStatusMapRef.current = nextMap;
        documentStatusReadyRef.current = true;
      })
      .catch(() => {
        if (documentStatusLoadSequenceRef.current === sequence) {
          documentStatusReadyRef.current = false;
        }
      });
    documentStatusLoadPromiseRef.current = statusLoadTask;
    void statusLoadTask;
  }, [courseId, mindMapId]);

  const commitDocumentViewportState = React.useCallback((nextState: ViewportScrollState) => {
    setDocumentViewportState((previousState) =>
      areViewportScrollStatesEqual(previousState, nextState) ? previousState : nextState
    );
  }, []);

  const updateDocumentViewportState = React.useCallback(() => {
    const mount = mountRef.current;
    commitDocumentViewportState(mount ? readNativeScrollState(mount) : EMPTY_VIEWPORT_SCROLL_STATE);
  }, [commitDocumentViewportState]);

  const scheduleDocumentViewportStateUpdate = React.useCallback(() => {
    if (viewportUpdateFrameRef.current !== null) return;
    viewportUpdateFrameRef.current = window.requestAnimationFrame(() => {
      viewportUpdateFrameRef.current = null;
      updateDocumentViewportState();
    });
  }, [updateDocumentViewportState]);

  const resetDocumentViewportToStart = React.useCallback(() => {
    const mount = mountRef.current;
    if (!mount) {
      commitDocumentViewportState(EMPTY_VIEWPORT_SCROLL_STATE);
      return;
    }

    resetScrollTarget(mount);
    const surface = mount.querySelector<HTMLElement>(".document-editor-surface");
    resetScrollTarget(surface);
    if (mount.firstElementChild instanceof HTMLElement && mount.firstElementChild !== surface) {
      resetScrollTarget(mount.firstElementChild);
    }
    commitDocumentViewportState(readNativeScrollState(mount));
  }, [commitDocumentViewportState]);

  React.useLayoutEffect(() => {
    editorRef.current?.destroy();
    editorRef.current = null;
    setActiveFormatBrush(null);
    setIsEditorReady(false);
    mountRef.current?.replaceChildren();
    commitDocumentViewportState(EMPTY_VIEWPORT_SCROLL_STATE);
  }, [commitDocumentViewportState, documentKey, setActiveFormatBrush]);

  const persistDocument = React.useCallback(
    async (input: PendingDocumentSave, silent = false): Promise<KnowledgeDocumentRecord | null> => {
      if (!silent) setIsSaving(true);
      try {
        if (!window.aistudyKnowledgeDocuments) {
          try {
            await saveLocalDocument(input);
            updateDocumentStatusFromSnapshot(input, null);
            if (!silent) {
              setStorageMode("local");
              setSavedAt(formatSavedAt());
              setError("");
            }
            return null;
          } catch (localError) {
            if (!silent) {
              setStorageMode("none");
              setError(getErrorMessage(localError, "文档本地缓存失败"));
            }
            return null;
          }
        }

        const document = await window.aistudyKnowledgeDocuments.save(input);
        updateDocumentStatusFromSnapshot(input, document);
        if (!silent) {
          setStorageMode("mysql");
          setSavedAt(formatSavedAt());
          setError("");
        }
        return document;
      } catch (error) {
        try {
          await saveLocalDocument(input);
          updateDocumentStatusFromSnapshot(input, null);
          if (!silent) {
            setStorageMode("local");
            setSavedAt(formatSavedAt());
            setError(getErrorMessage(error, "文档保存失败，已保存到本地副本"));
          }
          return null;
        } catch (localError) {
          if (!silent) {
            setStorageMode("none");
            setError(`${getErrorMessage(error, "文档保存失败")}；${getErrorMessage(localError, "本地副本也保存失败")}`);
          }
          return null;
        }
      } finally {
        if (!silent) setIsSaving(false);
      }
    },
    [updateDocumentStatusFromSnapshot]
  );

  const flushPendingSave = React.useCallback(
    (silent = false): Promise<KnowledgeDocumentRecord | null> => {
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
    },
    [persistDocument]
  );

  const queueSnapshotSave = React.useCallback(
    (nextSnapshot: KnowledgeDocumentSnapshot) => {
      if (!documentBinding) return;
      latestSnapshotRef.current = nextSnapshot;
      pendingSaveRef.current = {
        ...documentBinding,
        title: selectedNode.title || "未命名",
        snapshot: nextSnapshot
      };
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => flushPendingSave(false), SAVE_DEBOUNCE_MS);
    },
    [documentBinding, flushPendingSave, selectedNode.title]
  );

  const importDocumentSnapshot = React.useCallback(
    async (nextSnapshot: KnowledgeDocumentSnapshot) => {
      if (!documentBinding) return;
      editorRef.current?.destroy();
      editorRef.current = null;
      mountRef.current?.replaceChildren();
      setIsEditorReady(false);
      setSnapshot(nextSnapshot);
      latestSnapshotRef.current = nextSnapshot;
      await persistDocument({
        ...documentBinding,
        title: selectedNode.title || "未命名",
        snapshot: nextSnapshot
      });
      setSavedAt(formatSavedAt());
      setError("");
    },
    [documentBinding, persistDocument, selectedNode.title]
  );

  React.useEffect(() => {
    void flushPendingSave(true);
    editorRef.current?.destroy();
    editorRef.current = null;
    setIsEditorReady(false);
    setSnapshot(null);
    commitDocumentViewportState(EMPTY_VIEWPORT_SCROLL_STATE);
    resetDocumentViewportToStart();
    latestSnapshotRef.current = null;
    setSavedAt(null);
    setError("");

    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;

    if (!documentBinding) {
      setIsLoading(false);
      setStorageMode("none");
      return;
    }

    setIsLoading(true);
    const request: LoadRequest = documentBinding;
    void (async () => {
      const fallbackSnapshot =
        (await loadLocalDocument(documentBinding.courseId, documentBinding.mindMapId, documentBinding.nodeId)) ??
        createEmptyKnowledgeDocumentSnapshot();
      if (loadSequenceRef.current !== sequence) return;

      if (!window.aistudyKnowledgeDocuments) {
        setSnapshot(fallbackSnapshot);
        latestSnapshotRef.current = fallbackSnapshot;
        setStorageMode("local");
        setIsLoading(false);
        return;
      }

      try {
        const document = await window.aistudyKnowledgeDocuments.load(request);
        if (loadSequenceRef.current !== sequence) return;
        const nextSnapshot = document?.snapshot ?? fallbackSnapshot;
        if (document) {
          upsertDocumentStatus({
            courseId: document.courseId,
            mindMapId: document.mindMapId,
            nodeId: document.nodeId,
            documentId: document.documentId,
            title: document.title,
            updatedAt: document.updatedAt,
            byteSize: document.byteSize,
            hasContent: document.hasContent
          });
        }
        setSnapshot(nextSnapshot);
        latestSnapshotRef.current = nextSnapshot;
        setStorageMode(document ? "mysql" : "none");
      } catch (error) {
        if (loadSequenceRef.current !== sequence) return;
        setSnapshot(fallbackSnapshot);
        latestSnapshotRef.current = fallbackSnapshot;
        setStorageMode("local");
        setError(getErrorMessage(error, "文档读取失败，已打开本地副本"));
      } finally {
        if (loadSequenceRef.current === sequence) {
          setIsLoading(false);
        }
      }
    })();
  }, [commitDocumentViewportState, documentBinding, flushPendingSave, resetDocumentViewportToStart, upsertDocumentStatus]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !snapshot || !canUseDocument) return undefined;
    let isDisposed = false;
    let isCreating = false;
    let frameId: number | null = null;
    const editorDocumentKey = documentKey;

    const createEditor = () => {
      if (isDisposed || isCreating || editorRef.current) return;
      const rect = mount.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      isCreating = true;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (isDisposed || editorRef.current) {
          isCreating = false;
          return;
        }
        if (documentKeyRef.current !== editorDocumentKey) {
          isCreating = false;
          return;
        }
        const nextRect = mount.getBoundingClientRect();
        if (nextRect.width <= 0 || nextRect.height <= 0) {
          isCreating = false;
          return;
        }
        resetDocumentViewportToStart();
        mount.replaceChildren();
        setIsEditorReady(false);
        const editorSurface = document.createElement("div");
        editorSurface.className = "document-editor-surface";
        editorSurface.dataset.documentKey = editorDocumentKey;
        mount.appendChild(editorSurface);
        createCanvasDocumentEditor(editorSurface, snapshot, {
          onSnapshotChanged: (nextSnapshot) => {
            queueSnapshotSave(nextSnapshot);
            scheduleDocumentViewportStateUpdate();
          },
          onFormatChanged: updateFormatState,
          onAskAi: (selectedText) => {
            const assistantText = selectedText.trim() || lastSelectedTextRef.current;
            if (assistantText) {
              lastSelectedTextRef.current = assistantText;
            }
            const nextSize = clampAiPanelSize(aiPanelSizeRef.current);
            const point = getAiPanelAnchorPoint(toolbarAiButtonRef.current, latestContextMenuPointRef.current, nextSize);
            setAssistantDraft(assistantText);
            setAiPanelSize(nextSize);
            setAiContextMenu({
              ...clampAiPanelPoint(point, nextSize),
              text: assistantText
            });
          }
        })
          .then((editor) => {
            if (
              isDisposed ||
              editorRef.current ||
              editorSurface.parentElement !== mount ||
              documentKeyRef.current !== editorDocumentKey
            ) {
              editor.destroy();
              editorSurface.remove();
              return;
            }
            editorRef.current = editor;
            setIsEditorReady(true);
            window.requestAnimationFrame(() => {
              if (isDisposed) return;
              resetDocumentViewportToStart();
              window.setTimeout(() => {
                if (!isDisposed) resetDocumentViewportToStart();
              }, 0);
            });
          })
          .catch((error) => {
            if (!isDisposed) {
              editorSurface.remove();
              setIsEditorReady(false);
              setError(getErrorMessage(error, "文档编辑器加载失败"));
            }
          })
          .finally(() => {
            isCreating = false;
          });
      });
    };

    editorRef.current?.destroy();
    editorRef.current = null;
    setIsEditorReady(false);
    mount.replaceChildren();
    const resizeObserver = new ResizeObserver(createEditor);
    resizeObserver.observe(mount);
    createEditor();

    return () => {
      isDisposed = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      resizeObserver.disconnect();
      editorRef.current?.destroy();
      editorRef.current = null;
      setIsEditorReady(false);
      mount.replaceChildren();
    };
  }, [canUseDocument, documentKey, queueSnapshotSave, resetDocumentViewportToStart, scheduleDocumentViewportStateUpdate, snapshot, updateFormatState]);

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !canUseDocument) {
      commitDocumentViewportState(EMPTY_VIEWPORT_SCROLL_STATE);
      return undefined;
    }

    let frameId: number | null = null;
    const update = () => scheduleDocumentViewportStateUpdate();
    const resizeObserver = new ResizeObserver(update);
    mount.addEventListener("scroll", update, { passive: true });
    resizeObserver.observe(mount);

    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      const surface = mount.firstElementChild;
      if (surface) resizeObserver.observe(surface);
      updateDocumentViewportState();
    });

    return () => {
      mount.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [canUseDocument, commitDocumentViewportState, scheduleDocumentViewportStateUpdate, snapshot, updateDocumentViewportState]);

  React.useEffect(() => {
    return () => {
      if (viewportUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportUpdateFrameRef.current);
        viewportUpdateFrameRef.current = null;
      }
      void flushPendingSave(true);
      editorRef.current?.destroy();
    };
  }, [flushPendingSave]);

  React.useEffect(() => registerBeforeCloseSave(() => flushPendingSave(true)), [flushPendingSave]);

  const saveNow = React.useCallback(() => {
    if (!documentBinding) return Promise.resolve(null);
    const nextSnapshot = editorRef.current?.getSnapshot() ?? latestSnapshotRef.current ?? snapshot;
    if (!nextSnapshot) return Promise.resolve(null);
    latestSnapshotRef.current = nextSnapshot;
    pendingSaveRef.current = {
      ...documentBinding,
      title: selectedNode.title || "未命名",
      snapshot: nextSnapshot
    };
    return flushPendingSave(false);
  }, [documentBinding, flushPendingSave, selectedNode.title, snapshot]);

  const storageText = storageMode === "mysql" ? "已连接" : storageMode === "local" ? "本地副本" : "未保存";

  const loadDocumentForNavigation = React.useCallback(
    async (nodeId: string): Promise<KnowledgeDocumentSnapshot | null> => {
      if (!courseId || !mindMapId) return null;

      if (window.aistudyKnowledgeDocuments) {
        try {
          const remoteDocument = await window.aistudyKnowledgeDocuments.load({ courseId, mindMapId, nodeId });
          if (remoteDocument?.snapshot) {
            return remoteDocument.snapshot;
          }
        } catch {
          // Remote lookup can fail independently; local fallback keeps navigation responsive.
        }
      }

      return loadLocalDocument(courseId, mindMapId, nodeId);
    },
    [courseId, mindMapId]
  );

  const documentHasContentForNavigation = React.useCallback(
    async (nodeId: string) => {
      if (window.aistudyKnowledgeDocuments?.listStatuses) {
        if (!documentStatusReadyRef.current) {
          await documentStatusLoadPromiseRef.current?.catch(() => undefined);
        }
        if (documentStatusReadyRef.current) {
          return documentStatusMapRef.current.get(nodeId)?.hasContent ?? false;
        }
      }

      const candidateSnapshot = await loadDocumentForNavigation(nodeId);
      return !isBlankDocumentSnapshot(candidateSnapshot);
    },
    [loadDocumentForNavigation]
  );

  const navigateDocument = React.useCallback(
    async (direction: "previous" | "next") => {
      if (!onNodeSelect || currentNavigationIndex < 0 || isNavigatingDocument) return;

      const step = direction === "next" ? 1 : -1;
      const endReachedMessage = direction === "next" ? "已经到最后一页" : "已经到第一页";
      setIsNavigatingDocument(true);
      setError("");

      try {
        await saveNow();

        for (
          let index = currentNavigationIndex + step;
          index >= 0 && index < navigationItems.length;
          index += step
        ) {
          const candidate = navigationItems[index];
          if (!candidate.nodeId) continue;

          if (!skipBlankPages) {
            onNodeSelect(candidate.nodeId);
            return;
          }

          if (await documentHasContentForNavigation(candidate.nodeId)) {
            onNodeSelect(candidate.nodeId);
            return;
          }
        }

        setError(skipBlankPages ? "没有找到有内容的文档页" : endReachedMessage);
      } catch (error) {
        setError(getErrorMessage(error, "文档翻页失败"));
      } finally {
        setIsNavigatingDocument(false);
      }
    },
    [
      currentNavigationIndex,
      documentHasContentForNavigation,
      isNavigatingDocument,
      navigationItems,
      onNodeSelect,
      saveNow,
      skipBlankPages
    ]
  );

  const scrollDocumentViewport = React.useCallback(
    (axis: ViewportScrollAxis, position: number) => {
      const mount = mountRef.current;
      if (!mount) return;
      const axisState = axis === "vertical" ? documentViewportState.vertical : documentViewportState.horizontal;
      const maxPosition = Math.max(0, 100 - axisState.size);
      const nextPosition = clampPercent(position, 0, maxPosition);
      if (axis === "vertical") {
        const maxScrollTop = Math.max(0, mount.scrollHeight - mount.clientHeight);
        mount.scrollTop = maxPosition <= 0 ? 0 : (nextPosition / maxPosition) * maxScrollTop;
      } else {
        const maxScrollLeft = Math.max(0, mount.scrollWidth - mount.clientWidth);
        mount.scrollLeft = maxPosition <= 0 ? 0 : (nextPosition / maxPosition) * maxScrollLeft;
      }
      updateDocumentViewportState();
    },
    [documentViewportState.horizontal, documentViewportState.vertical, updateDocumentViewportState]
  );

  const readSelectedText = React.useCallback(() => {
    const selectedText = editorRef.current?.getSelectedText() || readDomSelectedText(mountRef.current);
    if (selectedText) {
      lastSelectedTextRef.current = selectedText;
    }
    return selectedText;
  }, []);

  const openAssistantPanel = React.useCallback((point: { x: number; y: number }, text?: string) => {
    const selectedText = text?.trim() || readSelectedText().trim() || lastSelectedTextRef.current;
    if (selectedText) {
      lastSelectedTextRef.current = selectedText;
    }
    const nextSize = clampAiPanelSize(aiPanelSize);
    setAssistantDraft(selectedText);
    setAiPanelSize(nextSize);
    setAiContextMenu({
      ...clampAiPanelPoint(point, nextSize),
      text: selectedText
    });
  }, [aiPanelSize, readSelectedText]);

  const startAssistantPanelDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!aiContextMenu || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { x: aiContextMenu.x, y: aiContextMenu.y };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextPoint = clampAiPanelPoint({
        x: origin.x + moveEvent.clientX - startX,
        y: origin.y + moveEvent.clientY - startY
      }, aiPanelSize);
      setAiContextMenu((current) => current ? { ...current, ...nextPoint } : current);
    };
    const stopDrag = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag, { once: true });
    window.addEventListener("pointercancel", stopDrag, { once: true });
  }, [aiContextMenu, aiPanelSize]);

  const startAssistantPanelResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!aiContextMenu || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const originSize = aiPanelSize;
    const originPoint = { x: aiContextMenu.x, y: aiContextMenu.y };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextSize = clampAiPanelSize({
        width: originSize.width + moveEvent.clientX - startX,
        height: originSize.height + moveEvent.clientY - startY
      });
      const nextPoint = clampAiPanelPoint(originPoint, nextSize);
      setAiPanelSize(nextSize);
      setAiContextMenu((current) => current ? { ...current, ...nextPoint } : current);
    };
    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
    window.addEventListener("pointercancel", stopResize, { once: true });
  }, [aiContextMenu, aiPanelSize]);

  React.useEffect(() => {
    const keepAssistantPanelInViewport = () => {
      const nextSize = clampAiPanelSize(aiPanelSize);
      setAiPanelSize(nextSize);
      setAiContextMenu((current) => current ? { ...current, ...clampAiPanelPoint(current, nextSize) } : current);
    };

    window.addEventListener("resize", keepAssistantPanelInViewport);
    return () => {
      window.removeEventListener("resize", keepAssistantPanelInViewport);
    };
  }, [aiPanelSize]);

  React.useEffect(() => {
    const handleCanvasEditorAskAiMenu = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const menuItem = target?.closest(".ce-contextmenu-item");
      const host = mountRef.current;
      if (!target || !menuItem || !host?.contains(menuItem)) return;

      const menuText = menuItem.textContent?.replace(/\s+/g, "") ?? "";
      if (!menuText.includes("问AI")) return;

      event.preventDefault();
      event.stopPropagation();

      const selectedText = readSelectedText().trim() || lastSelectedTextRef.current;
      if (selectedText) {
        lastSelectedTextRef.current = selectedText;
      }
      host.querySelectorAll(".ce-contextmenu-container").forEach((menu) => menu.remove());

      setAssistantDraft(selectedText);
      const nextSize = clampAiPanelSize(aiPanelSize);
      setAiPanelSize(nextSize);
      setAiContextMenu({
        ...clampAiPanelPoint(getAiPanelAnchorPoint(toolbarAiButtonRef.current, latestContextMenuPointRef.current, nextSize), nextSize),
        text: selectedText
      });
    };

    document.addEventListener("mousedown", handleCanvasEditorAskAiMenu, true);
    return () => {
      document.removeEventListener("mousedown", handleCanvasEditorAskAiMenu, true);
    };
  }, [aiPanelSize, readSelectedText]);

  const rememberContextMenuPoint = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    latestContextMenuPointRef.current = {
      x: event.clientX,
      y: event.clientY
    };
  }, []);

  return (
    <div className="document-workspace">
      <div className="document-local-toolbar" aria-label="文档编辑工具栏">
        <button type="button" title="撤销" onClick={() => editorRef.current?.exec("undo")} disabled={!canUseDocument}>
          <Undo2 size={15} />
        </button>
        <button type="button" title="重做" onClick={() => editorRef.current?.exec("redo")} disabled={!canUseDocument}>
          <Redo2 size={15} />
        </button>
        <span className="mindmap-toolbar-separator" />
        <button
          type="button"
          title="加粗"
          className={formatState.bold ? "format-button active" : "format-button"}
          onClick={() => editorRef.current?.exec("bold")}
          disabled={!canUseDocument}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          title="斜体"
          className={formatState.italic ? "format-button active" : "format-button"}
          onClick={() => editorRef.current?.exec("italic")}
          disabled={!canUseDocument}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          title="下划线"
          className={formatState.underline ? "format-button active" : "format-button"}
          onClick={() => editorRef.current?.exec("underline")}
          disabled={!canUseDocument}
        >
          <Underline size={15} />
        </button>
        <span className="mindmap-toolbar-separator" />
        <label className="document-size-control" title="字号">
          <Type size={15} />
          <select
            value={formatState.fontSize}
            onChange={(event) => editorRef.current?.setFontSize(Number(event.target.value))}
            disabled={!canUseDocument}
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="document-color-swatches" aria-label="文字颜色">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              className={formatState.color.toLowerCase() === color.toLowerCase() ? "document-color-swatch active" : "document-color-swatch"}
              style={{ backgroundColor: color }}
              title={color}
              aria-label={`文字颜色 ${color}`}
              onClick={() => editorRef.current?.setColor(color)}
              disabled={!canUseDocument}
            />
          ))}
        </div>
        <button
          type="button"
          title={formatBrush && !formatBrush.reusable ? "单次格式刷已取样：框选目标文字后再次点击应用" : "单次格式刷：框选源文字后点击取样"}
          className={formatBrush && !formatBrush.reusable ? "format-button document-format-brush-button active" : "format-button document-format-brush-button"}
          aria-pressed={Boolean(formatBrush && !formatBrush.reusable)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={startSingleUseFormatBrush}
          disabled={!canUseDocument || !isEditorReady}
        >
          <Paintbrush size={15} />
        </button>
        <button
          type="button"
          title={formatBrush?.reusable ? "连续格式刷已取样：框选目标文字后再次点击应用；无选区点击关闭" : "连续格式刷：框选源文字后点击取样"}
          className={formatBrush?.reusable ? "format-button document-format-brush-button active" : "format-button document-format-brush-button"}
          aria-pressed={Boolean(formatBrush?.reusable)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleReusableFormatBrush}
          disabled={!canUseDocument || !isEditorReady}
        >
          <Paintbrush size={15} />
          <span className="document-format-brush-infinity">∞</span>
        </button>
        <span className="mindmap-toolbar-spacer" />
        <div className="document-page-navigation" aria-label="文档翻页">
          <button
            type="button"
            title="上一页"
            onClick={() => void navigateDocument("previous")}
            disabled={!canNavigatePrevious || isNavigatingDocument}
          >
            <ChevronLeft size={15} />
            <span>上一页</span>
          </button>
          <button
            type="button"
            title="下一页"
            onClick={() => void navigateDocument("next")}
            disabled={!canNavigateNext || isNavigatingDocument}
          >
            <span>下一页</span>
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            title={skipBlankPages ? "当前会跳过空白页" : "当前会显示空白页"}
            className={skipBlankPages ? "document-skip-blank-button active" : "document-skip-blank-button"}
            aria-pressed={skipBlankPages}
            onClick={() => setSkipBlankPages((enabled) => !enabled)}
            disabled={!canUseDocument || isNavigatingDocument}
          >
            <SkipForward size={15} />
            <span>{skipBlankPages ? "跳空白" : "含空白"}</span>
          </button>
        </div>
        <button
          type="button"
          title="AI 助手"
          ref={toolbarAiButtonRef}
          className={aiContextMenu ? "document-ai-toolbar-button active" : "document-ai-toolbar-button"}
          onClick={(event) => {
            event.stopPropagation();
            const nextSize = clampAiPanelSize(aiPanelSizeRef.current);
            openAssistantPanel(getAiPanelAnchorPoint(toolbarAiButtonRef.current, {
              x: window.innerWidth - nextSize.width - AI_CONTEXT_PANEL_MARGIN,
              y: 96
            }, nextSize));
          }}
          disabled={!canUseDocument}
        >
          <Bot size={15} />
          <span>AI</span>
        </button>
        <button type="button" title="导入文档" onClick={() => setIsImporterOpen(true)} disabled={!canUseDocument || isSaving}>
          <Upload size={15} />
          <span>导入</span>
        </button>
        <button type="button" title="保存文档" onClick={saveNow} disabled={!canUseDocument || isSaving}>
          <Save size={15} />
          <span>{isSaving ? "保存中" : "保存"}</span>
        </button>
      </div>

      <div
        className={formatBrush ? "document-editor-shell is-format-brush" : "document-editor-shell"}
        onContextMenu={rememberContextMenuPoint}
        onKeyDownCapture={handleEditorKeyDownCapture}
      >
        <div ref={mountRef} className="document-editor-host" aria-hidden={!canUseDocument} />
        <ViewportScrollbars
          className="document-viewport-scrollbars"
          state={documentViewportState}
          onChange={scrollDocumentViewport}
        />
        <div className={canUseDocument && isEditorReady ? "document-placeholder is-hidden" : "document-placeholder"}>
          <strong>{isLoading || canUseDocument ? "正在打开文档" : "请选择目录节点"}</strong>
        </div>
      </div>

      {aiContextMenu ? (
        <div
          ref={aiPanelRef}
          className="document-ai-context-menu is-chat"
          style={{ left: aiContextMenu.x, top: aiContextMenu.y, width: aiPanelSize.width, height: aiPanelSize.height }}
          role="dialog"
          onClick={(event) => event.stopPropagation()}
        >
          <AiAssistantPanel
            compact
            title="文档 AI 助手"
            initialInput={assistantDraft}
            storageKey={`document:${courseId ?? "none"}:${mindMapId ?? "none"}:${selectedNode.id}`}
            onDragHandlePointerDown={startAssistantPanelDrag}
            onInitialInputConsumed={() => {
              setAssistantDraft("");
            }}
            onClose={() => setAiContextMenu(null)}
          />
          <div
            className="document-ai-resize-handle"
            title="拖动调整 AI 小窗大小"
            aria-hidden="true"
            onPointerDown={startAssistantPanelResize}
          />
        </div>
      ) : null}

      {isImporterOpen && documentBinding ? (
        <ImporterDialog
          target={{
            courseId: documentBinding.courseId,
            mindMapId: documentBinding.mindMapId,
            nodeId: documentBinding.nodeId,
            title: selectedNode.title || "当前节点"
          }}
          onClose={() => setIsImporterOpen(false)}
          onCommit={importDocumentSnapshot}
        />
      ) : null}

      <div className="document-status-strip">
        <span>{canUseDocument ? selectedNode.title || "未命名" : "未选择节点"}</span>
        <span>{storageText}</span>
        {formatBrush ? <span>{formatBrush.reusable ? "连续格式刷已取样" : "单次格式刷已取样"}</span> : null}
        {skipBlankPages ? <span>跳过空白页</span> : null}
        {isNavigatingDocument ? <span>切换中</span> : null}
        {savedAt ? <span>已保存 {savedAt}</span> : null}
        {error ? <span className="mindmap-error">{error}</span> : null}
      </div>
    </div>
  );
}
