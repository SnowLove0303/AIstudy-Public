import { preloadCanvasDocumentEditor } from "../features/documents/canvasEditorAdapter";
import { preloadSimpleMindMapEditor } from "../features/mindmap/simpleMindMapAdapter";

type WarmupCancel = () => void;

let hasStartedCoreWarmup = false;

function scheduleIdleTask(task: () => Promise<void> | void, timeout: number): WarmupCancel {
  if (typeof window === "undefined") return () => undefined;

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(() => void task(), { timeout });
    return () => window.cancelIdleCallback(idleId);
  }

  const timerId = window.setTimeout(() => void task(), Math.min(timeout, 1000));
  return () => window.clearTimeout(timerId);
}

function runQuietly(task: () => Promise<void>) {
  void task().catch(() => {
    // Warmup is best-effort. The real editor path still reports load errors.
  });
}

export function startCoreFeatureWarmup(): WarmupCancel {
  if (hasStartedCoreWarmup) return () => undefined;
  hasStartedCoreWarmup = true;

  const cancelMindMapWarmup = scheduleIdleTask(() => runQuietly(preloadSimpleMindMapEditor), 600);
  const cancelDocumentWarmup = scheduleIdleTask(() => runQuietly(preloadCanvasDocumentEditor), 1400);

  return () => {
    cancelMindMapWarmup();
    cancelDocumentWarmup();
  };
}
