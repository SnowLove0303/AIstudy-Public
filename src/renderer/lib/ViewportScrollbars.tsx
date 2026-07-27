import React from "react";

export type ViewportScrollAxis = "vertical" | "horizontal";

export type ViewportScrollAxisState = {
  position: number;
  size: number;
  enabled: boolean;
};

export type ViewportScrollState = {
  vertical: ViewportScrollAxisState;
  horizontal: ViewportScrollAxisState;
};

export const EMPTY_VIEWPORT_SCROLL_STATE: ViewportScrollState = {
  vertical: { position: 0, size: 100, enabled: false },
  horizontal: { position: 0, size: 100, enabled: false }
};

export function areViewportScrollStatesEqual(left: ViewportScrollState, right: ViewportScrollState) {
  return left.vertical.position === right.vertical.position &&
    left.vertical.size === right.vertical.size &&
    left.vertical.enabled === right.vertical.enabled &&
    left.horizontal.position === right.horizontal.position &&
    left.horizontal.size === right.horizontal.size &&
    left.horizontal.enabled === right.horizontal.enabled;
}

type ViewportScrollbarsProps = {
  state: ViewportScrollState;
  className?: string;
  onChange: (axis: ViewportScrollAxis, position: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getAxisState(state: ViewportScrollState, axis: ViewportScrollAxis) {
  return axis === "vertical" ? state.vertical : state.horizontal;
}

function getMaxPosition(axisState: ViewportScrollAxisState) {
  return Math.max(0, 100 - axisState.size);
}

function getDisplayThumbSize(axisState: ViewportScrollAxisState) {
  return clamp(axisState.size, 8, 100);
}

function getDisplayPosition(axisState: ViewportScrollAxisState, position = axisState.position) {
  const realMax = getMaxPosition(axisState);
  const displaySize = getDisplayThumbSize(axisState);
  const displayMax = Math.max(0, 100 - displaySize);
  if (realMax <= 0 || displayMax <= 0) return 0;
  return clamp((clamp(position, 0, realMax) / realMax) * displayMax, 0, displayMax);
}

type ViewportScrollbarProps = {
  axis: ViewportScrollAxis;
  axisState: ViewportScrollAxisState;
  onChange: ViewportScrollbarsProps["onChange"];
};

type ViewportDragState = {
  pointerId: number;
  track: HTMLDivElement;
  trackRect: DOMRect;
  trackLength: number;
  displayMaxPosition: number;
  grabOffset: number;
  maxPosition: number;
};

function ViewportScrollbar({ axis, axisState, onChange }: ViewportScrollbarProps) {
  const maxPosition = getMaxPosition(axisState);
  const position = clamp(axisState.position, 0, maxPosition);
  const [localPosition, setLocalPosition] = React.useState(position);
  const [isDragging, setIsDragging] = React.useState(false);
  const onChangeRef = React.useRef(onChange);
  const draggingRef = React.useRef(false);
  const dragRef = React.useRef<ViewportDragState | null>(null);
  const dragAbortRef = React.useRef<AbortController | null>(null);
  const changeFrameRef = React.useRef<number | null>(null);
  const pendingPositionRef = React.useRef<number | null>(null);
  const displayThumbSize = getDisplayThumbSize(axisState);
  const displayPosition = getDisplayPosition(axisState, localPosition);
  const isVertical = axis === "vertical";
  const label = isVertical ? "垂直滚动画布" : "水平滚动画布";

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (!draggingRef.current) {
      setLocalPosition(position);
    }
  }, [position]);

  const flushPendingPosition = React.useCallback(() => {
    if (changeFrameRef.current !== null) {
      window.cancelAnimationFrame(changeFrameRef.current);
      changeFrameRef.current = null;
    }
    const pendingPosition = pendingPositionRef.current;
    pendingPositionRef.current = null;
    if (pendingPosition !== null) {
      onChangeRef.current(axis, pendingPosition);
    }
  }, [axis]);

  const queuePositionChange = React.useCallback((nextPosition: number) => {
    setLocalPosition(nextPosition);
    pendingPositionRef.current = nextPosition;
    if (changeFrameRef.current !== null) return;
    changeFrameRef.current = window.requestAnimationFrame(() => {
      changeFrameRef.current = null;
      const pendingPosition = pendingPositionRef.current;
      pendingPositionRef.current = null;
      if (pendingPosition !== null) {
        onChangeRef.current(axis, pendingPosition);
      }
    });
  }, [axis]);

  const updateDragFromPointer = React.useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pointerOffset = isVertical
      ? clientY - drag.trackRect.top
      : clientX - drag.trackRect.left;
    const nextDisplayPosition = clamp(
      ((pointerOffset - drag.grabOffset) / drag.trackLength) * 100,
      0,
      drag.displayMaxPosition
    );
    const nextPosition = drag.displayMaxPosition <= 0
      ? 0
      : (nextDisplayPosition / drag.displayMaxPosition) * drag.maxPosition;
    queuePositionChange(clamp(nextPosition, 0, drag.maxPosition));
  }, [isVertical, queuePositionChange]);

  const finishDrag = React.useCallback((pointerId?: number) => {
    const drag = dragRef.current;
    if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) return;
    dragRef.current = null;
    draggingRef.current = false;
    setIsDragging(false);
    flushPendingPosition();
    dragAbortRef.current?.abort();
    dragAbortRef.current = null;
    try {
      if (drag.track.hasPointerCapture(drag.pointerId)) {
        drag.track.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // The workspace may have switched modes before the pointer was released.
    }
  }, [flushPendingPosition]);

  const handleDocumentPointerMove = React.useCallback((event: PointerEvent) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updateDragFromPointer(event.clientX, event.clientY);
  }, [updateDragFromPointer]);

  const startDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!axisState.enabled || maxPosition <= 0 || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    finishDrag();

    const track = event.currentTarget;
    const trackRect = track.getBoundingClientRect();
    const trackLength = isVertical ? trackRect.height : trackRect.width;
    if (trackLength <= 0) return;

    const displayMaxPosition = Math.max(0, 100 - displayThumbSize);
    const pointerOffset = isVertical
      ? event.clientY - trackRect.top
      : event.clientX - trackRect.left;
    const thumbStart = (displayPosition / 100) * trackLength;
    const thumbLength = (displayThumbSize / 100) * trackLength;
    const isPointerOnVisibleThumb =
      pointerOffset >= thumbStart && pointerOffset <= thumbStart + thumbLength;
    const grabOffset = isPointerOnVisibleThumb
      ? pointerOffset - thumbStart
      : thumbLength / 2;

    dragRef.current = {
      pointerId: event.pointerId,
      track,
      trackRect,
      trackLength,
      displayMaxPosition,
      grabOffset,
      maxPosition
    };
    draggingRef.current = true;
    setIsDragging(true);

    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      // Document listeners below remain the authoritative drag lifecycle.
    }

    const abortController = new AbortController();
    dragAbortRef.current = abortController;
    const listenerOptions = { capture: true, signal: abortController.signal };
    document.addEventListener("pointermove", handleDocumentPointerMove, listenerOptions);
    document.addEventListener("pointerup", (pointerEvent) => {
      finishDrag(pointerEvent.pointerId);
    }, listenerOptions);
    document.addEventListener("pointercancel", (pointerEvent) => {
      finishDrag(pointerEvent.pointerId);
    }, listenerOptions);
    window.addEventListener("blur", () => finishDrag(), { signal: abortController.signal });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") finishDrag();
    }, { signal: abortController.signal });

    updateDragFromPointer(event.clientX, event.clientY);
  }, [
    axisState.enabled,
    displayPosition,
    displayThumbSize,
    finishDrag,
    handleDocumentPointerMove,
    isVertical,
    maxPosition,
    updateDragFromPointer
  ]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!axisState.enabled || maxPosition <= 0) return;
    const smallStep = Math.max(0.1, maxPosition / 100);
    const largeStep = Math.max(1, maxPosition / 10);
    let nextPosition: number | null = null;
    if (event.key === "Home") nextPosition = 0;
    if (event.key === "End") nextPosition = maxPosition;
    if (event.key === "PageUp") nextPosition = localPosition - largeStep;
    if (event.key === "PageDown") nextPosition = localPosition + largeStep;
    if (!isVertical && event.key === "ArrowLeft") nextPosition = localPosition - smallStep;
    if (!isVertical && event.key === "ArrowRight") nextPosition = localPosition + smallStep;
    if (isVertical && event.key === "ArrowUp") nextPosition = localPosition - smallStep;
    if (isVertical && event.key === "ArrowDown") nextPosition = localPosition + smallStep;
    if (nextPosition === null) return;
    event.preventDefault();
    event.stopPropagation();
    const clampedPosition = clamp(nextPosition, 0, maxPosition);
    setLocalPosition(clampedPosition);
    onChangeRef.current(axis, clampedPosition);
  }, [axis, axisState.enabled, isVertical, localPosition, maxPosition]);

  React.useEffect(() => () => {
    draggingRef.current = false;
    dragRef.current = null;
    dragAbortRef.current?.abort();
    dragAbortRef.current = null;
    if (changeFrameRef.current !== null) {
      window.cancelAnimationFrame(changeFrameRef.current);
      changeFrameRef.current = null;
    }
    pendingPositionRef.current = null;
  }, []);

  return (
    <div
      className={`viewport-scrollbar ${axis}${axisState.enabled ? "" : " disabled"}${isDragging ? " is-dragging" : ""}`}
      role="scrollbar"
      aria-label={label}
      aria-orientation={axis}
      aria-valuemin={0}
      aria-valuemax={maxPosition}
      aria-valuenow={localPosition}
      tabIndex={axisState.enabled ? 0 : -1}
      onPointerDown={startDrag}
      onKeyDown={handleKeyDown}
    >
      <div className="viewport-scrollbar-rail" />
      <div
        className="viewport-scrollbar-thumb"
        style={isVertical
          ? { top: `${displayPosition}%`, height: `${displayThumbSize}%` }
          : { left: `${displayPosition}%`, width: `${displayThumbSize}%` }}
      />
    </div>
  );
}

export function ViewportScrollbars({ state, className = "", onChange }: ViewportScrollbarsProps) {
  return (
    <div className={`viewport-scrollbars ${className}`.trim()}>
      <ViewportScrollbar axis="vertical" axisState={getAxisState(state, "vertical")} onChange={onChange} />
      <ViewportScrollbar axis="horizontal" axisState={getAxisState(state, "horizontal")} onChange={onChange} />
    </div>
  );
}
