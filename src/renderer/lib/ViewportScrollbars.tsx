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
  const startDrag = React.useCallback(
    (axis: ViewportScrollAxis, event: React.PointerEvent<HTMLDivElement>) => {
      const axisState = getAxisState(state, axis);
      if (!axisState.enabled) return;

      event.preventDefault();
      event.stopPropagation();

      const track = event.currentTarget;
      const trackRect = track.getBoundingClientRect();
      const trackLength = axis === "vertical" ? trackRect.height : trackRect.width;
      if (trackLength <= 0) return;

      const displaySize = getDisplayThumbSize(axisState);
      const displayMaxPosition = Math.max(0, 100 - displaySize);
      const pointerOffset = axis === "vertical" ? event.clientY - trackRect.top : event.clientX - trackRect.left;
      const currentStart = (getDisplayPosition(axisState) / 100) * trackLength;
      const thumbLength = (displaySize / 100) * trackLength;
      const target = event.target as HTMLElement;
      const grabOffset = target.classList.contains("viewport-scrollbar-thumb")
        ? pointerOffset - currentStart
        : thumbLength / 2;

      const maxPosition = Math.max(0, 100 - axisState.size);

      const moveTo = (clientX: number, clientY: number) => {
        const nextPointerOffset = axis === "vertical" ? clientY - trackRect.top : clientX - trackRect.left;
        const nextDisplayPosition = clamp(((nextPointerOffset - grabOffset) / trackLength) * 100, 0, displayMaxPosition);
        const nextPosition =
          displayMaxPosition <= 0 ? 0 : (nextDisplayPosition / displayMaxPosition) * maxPosition;
        onChange(axis, clamp(nextPosition, 0, maxPosition));
      };

      moveTo(event.clientX, event.clientY);

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        moveTo(moveEvent.clientX, moveEvent.clientY);
      };
      const stopDrag = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", stopDrag);
        window.removeEventListener("pointercancel", stopDrag);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", stopDrag, { once: true });
      window.addEventListener("pointercancel", stopDrag, { once: true });
    },
    [onChange, state]
  );

  const verticalPosition = getDisplayPosition(state.vertical);
  const horizontalPosition = getDisplayPosition(state.horizontal);
  const verticalThumbSize = getDisplayThumbSize(state.vertical);
  const horizontalThumbSize = getDisplayThumbSize(state.horizontal);

  return (
    <div className={`viewport-scrollbars ${className}`.trim()} aria-hidden="true">
      <div
        className={state.vertical.enabled ? "viewport-scrollbar vertical" : "viewport-scrollbar vertical disabled"}
        onPointerDown={(event) => startDrag("vertical", event)}
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
