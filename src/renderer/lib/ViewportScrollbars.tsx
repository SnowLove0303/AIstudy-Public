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

function getDisplayThumbSize(axisState: ViewportScrollAxisState) {
  return clamp(axisState.size, 8, 100);
}

function getDisplayPosition(axisState: ViewportScrollAxisState) {
  const realMax = Math.max(0, 100 - axisState.size);
  const displaySize = getDisplayThumbSize(axisState);
  const displayMax = Math.max(0, 100 - displaySize);
  if (realMax <= 0 || displayMax <= 0) return 0;
  return clamp((clamp(axisState.position, 0, realMax) / realMax) * displayMax, 0, displayMax);
}

export function ViewportScrollbars({ state, className = "", onChange }: ViewportScrollbarsProps) {
  const onChangeRef = React.useRef(onChange);
  const dragRef = React.useRef<{
    pointerId: number;
    axis: ViewportScrollAxis;
    track: HTMLDivElement;
    trackRect: DOMRect;
    trackLength: number;
    displayMaxPosition: number;
    grabOffset: number;
    maxPosition: number;
  } | null>(null);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const releasePointerCapture = React.useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    try {
      if (drag.track.hasPointerCapture(drag.pointerId)) {
        drag.track.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // The track may already be detached during a workspace mode switch.
    }
  }, []);

  React.useEffect(() => {
    const cancelOnBlur = () => releasePointerCapture();
    const cancelWhenHidden = () => {
      if (document.visibilityState === "hidden") releasePointerCapture();
    };
    window.addEventListener("blur", cancelOnBlur);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () => {
      window.removeEventListener("blur", cancelOnBlur);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
      releasePointerCapture();
    };
  }, [releasePointerCapture]);

  const moveDrag = React.useCallback((pointerId: number, clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    const nextPointerOffset = drag.axis === "vertical"
      ? clientY - drag.trackRect.top
      : clientX - drag.trackRect.left;
    const nextDisplayPosition = clamp(
      ((nextPointerOffset - drag.grabOffset) / drag.trackLength) * 100,
      0,
      drag.displayMaxPosition
    );
    const nextPosition = drag.displayMaxPosition <= 0
      ? 0
      : (nextDisplayPosition / drag.displayMaxPosition) * drag.maxPosition;
    onChangeRef.current(drag.axis, clamp(nextPosition, 0, drag.maxPosition));
  }, []);

  const startDrag = React.useCallback(
    (axis: ViewportScrollAxis, event: React.PointerEvent<HTMLDivElement>) => {
      const axisState = getAxisState(state, axis);
      if (!axisState.enabled || event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();
      releasePointerCapture();

      const track = event.currentTarget;
      const trackRect = track.getBoundingClientRect();
      const trackLength = axis === "vertical" ? trackRect.height : trackRect.width;
      if (trackLength <= 0) return;

      const displaySize = getDisplayThumbSize(axisState);
      const displayMaxPosition = Math.max(0, 100 - displaySize);
      const pointerOffset = axis === "vertical"
        ? event.clientY - trackRect.top
        : event.clientX - trackRect.left;
      const currentStart = (getDisplayPosition(axisState) / 100) * trackLength;
      const thumbLength = (displaySize / 100) * trackLength;
      const target = event.target as HTMLElement;
      const grabOffset = target.classList.contains("viewport-scrollbar-thumb")
        ? pointerOffset - currentStart
        : thumbLength / 2;

      dragRef.current = {
        pointerId: event.pointerId,
        axis,
        track,
        trackRect,
        trackLength,
        displayMaxPosition,
        grabOffset,
        maxPosition: Math.max(0, 100 - axisState.size)
      };
      track.setPointerCapture(event.pointerId);
      moveDrag(event.pointerId, event.clientX, event.clientY);
    },
    [moveDrag, releasePointerCapture, state]
  );

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    moveDrag(event.pointerId, event.clientX, event.clientY);
  }, [moveDrag]);

  const handlePointerEnd = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    releasePointerCapture();
  }, [releasePointerCapture]);

  const verticalPosition = getDisplayPosition(state.vertical);
  const horizontalPosition = getDisplayPosition(state.horizontal);
  const verticalThumbSize = getDisplayThumbSize(state.vertical);
  const horizontalThumbSize = getDisplayThumbSize(state.horizontal);

  return (
    <div className={`viewport-scrollbars ${className}`.trim()} aria-hidden="true">
      <div
        className={state.vertical.enabled ? "viewport-scrollbar vertical" : "viewport-scrollbar vertical disabled"}
        onPointerDown={(event) => startDrag("vertical", event)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
      >
        <div
          className="viewport-scrollbar-thumb"
          style={{
            top: `${verticalPosition}%`,
            height: `${verticalThumbSize}%`
          }}
        />
      </div>
      <div
        className={state.horizontal.enabled ? "viewport-scrollbar horizontal" : "viewport-scrollbar horizontal disabled"}
        onPointerDown={(event) => startDrag("horizontal", event)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
      >
        <div
          className="viewport-scrollbar-thumb"
          style={{
            left: `${horizontalPosition}%`,
            width: `${horizontalThumbSize}%`
          }}
        />
      </div>
    </div>
  );
}
