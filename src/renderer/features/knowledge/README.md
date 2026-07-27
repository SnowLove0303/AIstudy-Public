# Knowledge Workspace Module

## Scope

The knowledge workspace coordinates the visible relationship between the primary mind map and the selected node document. It does not own mind-map or document persistence.

Current files:

- `KnowledgeSplitWorkspace.tsx`: resizable mind-map/document layout, compact-width behavior, keyboard-accessible separator, and per-course ratio persistence.
- `WorkspacePaneControls.tsx`: persistent knowledge-base and catalog drawer controls kept above workspace canvases and drawer transitions.

## Boundaries

- The mind map remains the structural source of truth.
- Node documents remain bound by `courseId + mindMapId + nodeId`.
- Panel resizing is a renderer-only preference and must not alter database schemas or domain snapshots.
- Directory drawers overlay the workspace and must not reduce the persistent editing width.
- The split component must not recreate either editor during pointer movement; editor children remain stable while the component updates only its layout variable.
- Mind-map container resize handling remains owned by `MindMapCanvas` and its `ResizeObserver`.
- Pointer capture must be released on pointer cancellation, window blur, visibility loss, mode changes, and unmount so a stale resize cannot block later interaction.

## Behavior

- Mind-map mode shows the map only.
- Split mode shows the map and selected node document with a draggable separator.
- Word mode shows the document only while retaining the mounted mind-map editor behind it.
- Below the combined minimum width, split mode shows the document; the existing workspace mode switch returns to the full mind map.
- The separator supports pointer dragging, arrow-key adjustment, and double-click reset.
- Drawer controls remain mounted and interactive while either drawer, its scrim, or an editor overlay is visible.
