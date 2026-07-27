import React from "react";
import {
  areViewportScrollStatesEqual,
  EMPTY_VIEWPORT_SCROLL_STATE,
  ViewportScrollbars,
  type ViewportScrollAxis,
  type ViewportScrollState
} from "../../lib/ViewportScrollbars";
import { createSimpleMindMapEditor, resetSimpleMindMapRuntime } from "./simpleMindMapAdapter";
import type {
  MindMapCommand,
  MindMapCommandPayload,
  MindMapEditorHandle,
  MindMapExportType,
  MindMapLayoutType,
  MindMapSelectedNode,
  MindMapSnapshot,
  MindMapTextFormatPatch
} from "./mindMapTypes";

export type MindMapCanvasHandle = {
  exec: (command: MindMapCommand, payload?: MindMapCommandPayload) => void;
  selectNode: (nodeId: string) => MindMapSelectedNode | null;
  setSnapshot: (snapshot: MindMapSnapshot) => void;
  setLayout: (layout: MindMapLayoutType) => MindMapSnapshot | null;
  applyTextFormat: (patch: MindMapTextFormatPatch) => MindMapSelectedNode | null;
  exportFile: (type: MindMapExportType, fileName: string) => Promise<void>;
  setCanvasDragEnabled: (enabled: boolean) => void;
  getSnapshot: () => MindMapSnapshot | null;
};

type MindMapCanvasProps = {
  snapshot: MindMapSnapshot;
  canvasDragEnabled: boolean;
  onSnapshotChanged: (snapshot: MindMapSnapshot) => void;
  onNodeSelected: (node: MindMapSelectedNode) => void;
  onReadyChange: (ready: boolean) => void;
  onError: (message: string) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
};

export const MindMapCanvas = React.forwardRef<MindMapCanvasHandle, MindMapCanvasProps>(function MindMapCanvas(
  { snapshot, canvasDragEnabled, onSnapshotChanged, onNodeSelected, onReadyChange, onError, onContextMenu },
  ref
) {
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<MindMapEditorHandle | null>(null);
  const latestSnapshotRef = React.useRef(snapshot);
  const canvasDragEnabledRef = React.useRef(canvasDragEnabled);
  const eventsRef = React.useRef({
    onSnapshotChanged,
    onNodeSelected,
    onReadyChange,
    onError
  });
  const [viewportState, setViewportState] = React.useState<ViewportScrollState>(EMPTY_VIEWPORT_SCROLL_STATE);

  const commitViewportState = React.useCallback((nextState: ViewportScrollState) => {
    setViewportState((previousState) =>
      areViewportScrollStatesEqual(previousState, nextState) ? previousState : nextState
    );
  }, []);

  React.useEffect(() => {
    eventsRef.current = {
      onSnapshotChanged,
      onNodeSelected,
      onReadyChange,
      onError
    };
  }, [onError, onNodeSelected, onReadyChange, onSnapshotChanged]);

  React.useEffect(() => {
    latestSnapshotRef.current = snapshot;
  }, [snapshot]);

  React.useEffect(() => {
    canvasDragEnabledRef.current = canvasDragEnabled;
    editorRef.current?.setCanvasDragEnabled(canvasDragEnabled);
  }, [canvasDragEnabled]);

  React.useImperativeHandle(
    ref,
    () => ({
      exec: (command, payload) => editorRef.current?.exec(command, payload),
      selectNode: (nodeId) => editorRef.current?.selectNode(nodeId) ?? null,
      setSnapshot: (nextSnapshot) => editorRef.current?.setSnapshot(nextSnapshot),
      setLayout: (layout) => editorRef.current?.setLayout(layout) ?? null,
      applyTextFormat: (patch) => editorRef.current?.applyTextFormat(patch) ?? null,
      exportFile: async (type, fileName) => {
        await editorRef.current?.exportFile(type, fileName);
      },
      setCanvasDragEnabled: (enabled) => editorRef.current?.setCanvasDragEnabled(enabled),
      getSnapshot: () => editorRef.current?.getSnapshot() ?? null
    }),
    []
  );

  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let isDisposed = false;
    let isCreating = false;
    let frameId: number | null = null;
    let resizeFrameId: number | null = null;
    let retryTimer: number | null = null;
    let creationAttempts = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    eventsRef.current.onReadyChange(false);

    const hasStableSize = () => {
      const rect = mount.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const scheduleEditorRetry = () => {
      if (isDisposed || retryTimer !== null || creationAttempts >= 3) return;
      const delay = Math.min(1200, 200 * 2 ** Math.max(0, creationAttempts - 1));
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        createEditor();
      }, delay);
    };

    const createEditor = () => {
      if (isDisposed || isCreating || editorRef.current) return;
      if (!hasStableSize()) return;
      isCreating = true;
      creationAttempts += 1;

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (isDisposed || editorRef.current || !hasStableSize()) {
          isCreating = false;
          return;
        }

        mount.replaceChildren();
        const editorSurface = document.createElement("div");
        editorSurface.className = "mindmap-canvas-surface";
        mount.appendChild(editorSurface);

        createSimpleMindMapEditor(editorSurface, latestSnapshotRef.current, {
          onSnapshotChanged: (nextSnapshot) => eventsRef.current.onSnapshotChanged(nextSnapshot),
          onNodeSelected: (node) => eventsRef.current.onNodeSelected(node),
          onViewportChanged: commitViewportState,
          onReady: () => {
            if (!isDisposed) eventsRef.current.onReadyChange(true);
          },
          onError: (message) => eventsRef.current.onError(message)
        }, {
          canvasDragEnabled: canvasDragEnabledRef.current
        })
          .then((editor) => {
            if (isDisposed || editorRef.current || editorSurface.parentElement !== mount) {
              editor.destroy();
              editorSurface.remove();
              resetSimpleMindMapRuntime();
              if (creationAttempts < 3) {
                scheduleEditorRetry();
              } else {
                eventsRef.current.onError("导图暂时无法加载，请重新打开课程。");
              }
              return;
            }
            editorRef.current = editor;
            creationAttempts = 0;
            editor.setCanvasDragEnabled(canvasDragEnabledRef.current);
            editor.setViewportControlSize(mount.clientWidth, mount.clientHeight);
          })
          .catch((error: unknown) => {
            if (!isDisposed) {
              editorSurface.remove();
              eventsRef.current.onError(error instanceof Error ? error.message : "导图编辑器载入失败");
              eventsRef.current.onReadyChange(false);
            }
          })
          .finally(() => {
            isCreating = false;
            if (!isDisposed && !editorRef.current) {
              resetSimpleMindMapRuntime();
              if (creationAttempts < 3) {
                scheduleEditorRetry();
              } else {
                eventsRef.current.onError("导图暂时无法加载，请重新打开课程。");
              }
            }
          });
      });
    };

    mount.replaceChildren();
    const syncEditorSize = () => {
      resizeFrameId = null;
      if (isDisposed || !hasStableSize()) return;
      const width = Math.round(mount.clientWidth);
      const height = Math.round(mount.clientHeight);
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      editorRef.current?.resize();
    };
    const scheduleEditorSizeSync = () => {
      if (resizeFrameId !== null) return;
      resizeFrameId = window.requestAnimationFrame(syncEditorSize);
    };
    const resizeObserver = new ResizeObserver(() => {
      createEditor();
      scheduleEditorSizeSync();
    });
    resizeObserver.observe(mount);
    createEditor();

    return () => {
      isDisposed = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      if (resizeFrameId !== null) {
        window.cancelAnimationFrame(resizeFrameId);
        resizeFrameId = null;
      }
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      resizeObserver.disconnect();
      editorRef.current?.destroy();
      editorRef.current = null;
      commitViewportState(EMPTY_VIEWPORT_SCROLL_STATE);
      mount.replaceChildren();
      eventsRef.current.onReadyChange(false);
    };
  }, [commitViewportState]);

  const handleViewportChange = React.useCallback((axis: ViewportScrollAxis, position: number) => {
    editorRef.current?.scrollViewport(axis, position);
  }, []);

  return (
    <div className="mindmap-canvas-frame" onContextMenu={onContextMenu}>
      <div ref={mountRef} className="mindmap-canvas-host" />
      <ViewportScrollbars
        className="mindmap-viewport-scrollbars"
        state={viewportState}
        onChange={handleViewportChange}
      />
    </div>
  );
});
