import React from "react";

type KnowledgeWorkspaceMode = "mindmap" | "split" | "word";

type KnowledgeSplitWorkspaceProps = {
  courseId: string;
  mode: KnowledgeWorkspaceMode;
  children: React.ReactNode;
  onCompactChange?: (compact: boolean) => void;
};

const DEFAULT_MIND_MAP_RATIO = 60;
const MIN_MIND_MAP_WIDTH = 360;
const MIN_DOCUMENT_WIDTH = 420;
const SEPARATOR_WIDTH = 9;
const RATIO_STEP = 2;
const STORAGE_PREFIX = "aistudy:knowledge-split-ratio:";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredRatio(courseId: string) {
  try {
    const value = Number.parseFloat(localStorage.getItem(`${STORAGE_PREFIX}${courseId}`) ?? "");
    return Number.isFinite(value) ? value : DEFAULT_MIND_MAP_RATIO;
  } catch {
    return DEFAULT_MIND_MAP_RATIO;
  }
}

function persistRatio(courseId: string, ratio: number) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${courseId}`, ratio.toFixed(2));
  } catch {
    // UI preference persistence must not block the real workspace.
  }
}

export function KnowledgeSplitWorkspace({
  courseId,
  mode,
  children,
  onCompactChange
}: KnowledgeSplitWorkspaceProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{ pointerId: number; rect: DOMRect } | null>(null);
  const pendingFrameRef = React.useRef<number | null>(null);
  const pendingRatioRef = React.useRef(DEFAULT_MIND_MAP_RATIO);
  const ratioRef = React.useRef(DEFAULT_MIND_MAP_RATIO);
  const [ratio, setRatio] = React.useState(() => readStoredRatio(courseId));
  const [isCompact, setIsCompact] = React.useState(false);

  const getRatioBounds = React.useCallback((width: number) => {
    const availableWidth = Math.max(1, width - SEPARATOR_WIDTH);
    return {
      min: (MIN_MIND_MAP_WIDTH / availableWidth) * 100,
      max: 100 - (MIN_DOCUMENT_WIDTH / availableWidth) * 100
    };
  }, []);

  const applyRatio = React.useCallback((nextRatio: number) => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = getRatioBounds(container.getBoundingClientRect().width);
    const normalized = bounds.min <= bounds.max
      ? clamp(nextRatio, bounds.min, bounds.max)
      : DEFAULT_MIND_MAP_RATIO;
    pendingRatioRef.current = normalized;
    ratioRef.current = normalized;
    container.style.setProperty("--knowledge-mindmap-ratio", `${normalized}%`);
  }, [getRatioBounds]);

  const commitRatio = React.useCallback((nextRatio: number) => {
    applyRatio(nextRatio);
    const normalized = ratioRef.current;
    setRatio(normalized);
    persistRatio(courseId, normalized);
  }, [applyRatio, courseId]);

  React.useEffect(() => {
    const nextRatio = readStoredRatio(courseId);
    setRatio(nextRatio);
    ratioRef.current = nextRatio;
    pendingRatioRef.current = nextRatio;
    applyRatio(nextRatio);
  }, [applyRatio, courseId]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const updateSize = () => {
      const width = container.getBoundingClientRect().width;
      const nextCompact = width < MIN_MIND_MAP_WIDTH + MIN_DOCUMENT_WIDTH + SEPARATOR_WIDTH;
      setIsCompact((current) => current === nextCompact ? current : nextCompact);
      onCompactChange?.(nextCompact);
      if (!nextCompact) applyRatio(ratioRef.current);
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize();
    return () => observer.disconnect();
  }, [applyRatio, onCompactChange]);

  React.useEffect(() => () => {
    if (pendingFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingFrameRef.current);
    }
    document.documentElement.classList.remove("knowledge-split-resizing");
  }, []);

  const updatePointerRatio = React.useCallback((clientX: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const availableWidth = Math.max(1, drag.rect.width - SEPARATOR_WIDTH);
    pendingRatioRef.current = ((clientX - drag.rect.left) / availableWidth) * 100;
    if (pendingFrameRef.current !== null) return;
    pendingFrameRef.current = window.requestAnimationFrame(() => {
      pendingFrameRef.current = null;
      applyRatio(pendingRatioRef.current);
    });
  }, [applyRatio]);

  const finishDragging = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    updatePointerRatio(event.clientX);
    dragRef.current = null;
    document.documentElement.classList.remove("knowledge-split-resizing");
    commitRatio(pendingRatioRef.current);
  }, [commitRatio, updatePointerRatio]);

  const cancelDragging = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    document.documentElement.classList.remove("knowledge-split-resizing");
    commitRatio(ratioRef.current);
  }, [commitRatio]);

  const isSplitVisible = mode === "split" && !isCompact;
  return (
    <div
      ref={containerRef}
      className="knowledge-split-workspace"
      data-mode={mode}
      data-compact={isCompact ? "true" : "false"}
      style={{ "--knowledge-mindmap-ratio": `${ratio}%` } as React.CSSProperties}
    >
      {children}

      {isSplitVisible ? (
        <div
          className="knowledge-split-separator"
          role="separator"
          aria-label="调整导图和文档宽度"
          aria-orientation="vertical"
          aria-valuemin={Math.round(getRatioBounds(containerRef.current?.getBoundingClientRect().width ?? 1).min)}
          aria-valuemax={Math.round(getRatioBounds(containerRef.current?.getBoundingClientRect().width ?? 1).max)}
          aria-valuenow={Math.round(ratio)}
          tabIndex={0}
          onDoubleClick={() => commitRatio(DEFAULT_MIND_MAP_RATIO)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") return;
            event.preventDefault();
            if (event.key === "Home") {
              commitRatio(DEFAULT_MIND_MAP_RATIO);
              return;
            }
            commitRatio(ratioRef.current + (event.key === "ArrowLeft" ? -RATIO_STEP : RATIO_STEP));
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const container = containerRef.current;
            if (!container) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { pointerId: event.pointerId, rect: container.getBoundingClientRect() };
            pendingRatioRef.current = ratioRef.current;
            document.documentElement.classList.add("knowledge-split-resizing");
            updatePointerRatio(event.clientX);
          }}
          onPointerMove={(event) => {
            if (dragRef.current?.pointerId === event.pointerId) updatePointerRatio(event.clientX);
          }}
          onPointerUp={finishDragging}
          onPointerCancel={cancelDragging}
          onLostPointerCapture={cancelDragging}
        >
          <span />
        </div>
      ) : null}
    </div>
  );
}
