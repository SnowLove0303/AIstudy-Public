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

function getDisplayPosition(axisState: ViewportScrollAxisState) {
  const realMax = getMaxPosition(axisState);
  const displaySize = getDisplayThumbSize(axisState);
  const displayMax = Math.max(0, 100 - displaySize);
  if (realMax <= 0 || displayMax <= 0) return 0;
  return clamp((clamp(axisState.position, 0, realMax) / realMax) * displayMax, 0, displayMax);
}

type ViewportScrollbarProps = {
  axis: ViewportScrollAxis;
  axisState: ViewportScrollAxisState;
  onChange: ViewportScrollbarsProps["onChange"];
};

function ViewportScrollbar({ axis, axisState, onChange }: ViewportScrollbarProps) {
  const maxPosition = getMaxPosition(axisState);
  const position = clamp(axisState.position, 0, maxPosition);
  const displayPosition = getDisplayPosition(axisState);
  const displayThumbSize = getDisplayThumbSize(axisState);
  const isVertical = axis === "vertical";
  const label = isVertical ? "垂直滚动画布" : "水平滚动画布";

  return (
    <div
      className={`viewport-scrollbar ${axis}${axisState.enabled ? "" : " disabled"}`}
    >
      <div className="viewport-scrollbar-rail" />
      <div
        className="viewport-scrollbar-thumb"
        style={isVertical
          ? { top: `${displayPosition}%`, height: `${displayThumbSize}%` }
          : { left: `${displayPosition}%`, width: `${displayThumbSize}%` }}
      />
      <input
        className="viewport-scrollbar-input"
        type="range"
        aria-label={label}
        aria-orientation={axis}
        min={0}
        max={maxPosition}
        step={0.01}
        value={position}
        disabled={!axisState.enabled || maxPosition <= 0}
        tabIndex={axisState.enabled ? 0 : -1}
        onInput={(event) => {
          const nextPosition = Number(event.currentTarget.value);
          if (!Number.isFinite(nextPosition)) return;
          onChange(axis, clamp(nextPosition, 0, maxPosition));
        }}
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
