# Mind Map Canvas Integration Plan

Date: 2026-06-15

## Final Direction

AIstudy will ship as one exe only.

The mind-map editor will be embedded as an internal renderer module, not launched as a second executable and not bound as a full Vue sub-app.

```text
AIstudy.exe
  -> Electron main process
  -> React renderer
  -> AIstudy mind-map canvas module
  -> simple-mind-map library code
  -> XMind import/export adapter
```

Reuse happens at source/module level. Each exe that needs this feature compiles the reusable module into its own package. Runtime must not depend on a second exe.

## What To Integrate

Use:

- `simple-mind-map`
- selected `simple-mind-map` plugins
- `simple-mind-map` XMind parser/export code through a local adapter

Do not use:

- old XMind Java/Eclipse desktop source as runtime
- `simple-mind-map` closed desktop client
- `simple-mind-map` Vue web app as the product implementation
- a sidecar `MindMapEditor.exe`

## Why This Route

Library embedding gives AIstudy:

- one installer and one exe;
- direct React integration;
- direct access to selected node and map snapshot;
- lower memory use than embedding a whole Vue app;
- easier node-to-document binding;
- consistent UI with the rest of AIstudy;
- cleaner future reuse as an internal package.

The Vue web app binding route remains useful only as a reference or emergency spike.

## Target Module Shape

First keep the module inside the app:

```text
src/renderer/features/mindmap/
  MindMapWorkspace.tsx
  MindMapCanvas.tsx
  MindMapToolbar.tsx
  MindMapSidePanel.tsx
  simpleMindMapAdapter.ts
  xmindAdapter.ts
  mindMapSnapshot.ts
  mindMapProjection.ts
```

When reuse becomes real, move the stable part into an internal package:

```text
packages/mindmap-canvas/
  src/
    MindMapCanvas.tsx
    simpleMindMapAdapter.ts
    xmindAdapter.ts
    mindMapSnapshot.ts
    mindMapProjection.ts
```

`apps/aistudy-exe` will consume it as a workspace dependency:

```json
{
  "dependencies": {
    "@aistudy/mindmap-canvas": "workspace:*"
  }
}
```

The packaged output is still one exe. The internal package is compiled into the renderer bundle.

## Connection Points

### React Renderer

React owns the visible workspace:

```text
MindMapWorkspace
  -> layout
  -> toolbar
  -> side panels
  -> selected node document area
  -> MindMapCanvas
```

`MindMapCanvas` owns only the third-party editor instance lifecycle:

```text
mount
  -> dynamic import simple-mind-map
  -> register selected plugins
  -> create editor instance

update
  -> setData / setFullData only when loading a new map
  -> resize on container resize

unmount
  -> save pending snapshot
  -> destroy editor instance
  -> remove event listeners
```

### Electron Preload

Expose narrow IPC APIs:

```ts
window.aistudy.mindmap = {
  openXmindFile(): Promise<{ name: string; bytes: ArrayBuffer } | null>
  saveXmindFile(defaultName: string, bytes: ArrayBuffer): Promise<void>
  saveSnapshot(courseId: string, mapId: string, snapshot: MindMapSnapshot): Promise<void>
  loadSnapshot(courseId: string, mapId: string): Promise<MindMapSnapshot | null>
}
```

Renderer must not directly access filesystem or database.

### Electron Main

Main process owns:

- native file dialogs;
- reading `.xmind` bytes;
- writing exported `.xmind` bytes;
- database persistence;
- local asset storage;
- future backup/export jobs.

## Adapter Contract

All direct third-party calls stay behind one adapter.

```ts
export type MindMapEditorHandle = {
  getSnapshot(): MindMapSnapshot
  setSnapshot(snapshot: MindMapSnapshot): void
  importXmind(file: File): Promise<MindMapSnapshot>
  exportXmind(name: string): Promise<ArrayBuffer>
  resize(): void
  destroy(): void
}
```

Event callbacks:

```ts
export type MindMapEditorEvents = {
  onSnapshotChanged(snapshot: MindMapSnapshot): void
  onNodeSelected(nodeId: string | null): void
  onNodeChanged(nodeId: string): void
  onStructureChanged(snapshot: MindMapSnapshot): void
}
```

This contract prevents the rest of AIstudy from depending directly on `simple-mind-map` internals.

## Data Ownership

AIstudy stores two forms of mind-map data:

1. Full editor snapshot
   - Source: `simple-mind-map` `getData(true)`.
   - Purpose: exact editor restore.
   - Stored in `mind_map_snapshots`.

2. Normalized node projection
   - Source: traversal of snapshot root tree.
   - Purpose: search, outline navigation, document binding, AI features.
   - Stored in `mind_map_nodes`.

Do not store only `.xmind` as the live source of truth.

`.xmind` is an import/export format, not AIstudy's internal live format.

## Memory Strategy

Rules:

- Only one active mind-map editor instance at a time.
- Mount editor only when the mind-map workspace is visible.
- On workspace exit, call `destroy()`.
- On course/map switch, save pending snapshot, destroy old instance, load new snapshot, create new instance.
- Use dynamic imports so the editor code is not loaded before the mind-map feature is opened.
- Do not embed the Vue web app.
- Do not load all course maps into renderer memory.
- Do not keep previous editor instances hidden in tabs.

Large map behavior:

- Enable performance mode when node count exceeds a threshold.
- Suggested threshold: start checking at 500 nodes, enable at 1000 nodes.
- Debounce expensive snapshot/projection work.
- Avoid automatic image export/SVG export for very large maps unless user requests it.

Images/assets:

- Do not store large images as permanent base64 in node data.
- Store images in Electron-owned local asset storage.
- Keep node data referencing asset ids or local asset URLs.
- Avoid `NodeBase64ImageStorage` in the first implementation.

Save behavior:

- Listen to editor change events.
- Debounce snapshot save, suggested 800-1500 ms.
- Save immediately on app close, route change, course switch, and explicit user save.
- Keep snapshot compaction on the database side.

## Plugin Strategy

Start with a minimal plugin set:

- `Drag`
- `Select`
- `KeyboardNavigation`
- `Export`
- `ExportXMind`

Add after first stability pass:

- `Search`
- `MiniMap`
- `Scrollbar`
- `RichText`
- `AssociativeLine`
- `OuterFrame`

Defer:

- `Cooperate`
- `Demonstrate`
- `Formula`
- `NodeBase64ImageStorage`
- heavy PDF/image export features unless required.

Avoid importing `simple-mind-map/full.js` in product code because it registers many plugins at once.

## XMind Flow

Import:

```text
User opens .xmind
  -> Electron main reads file
  -> preload returns bytes to renderer
  -> xmindAdapter converts bytes/File to simple-mind-map tree
  -> MindMapCanvas loads snapshot
  -> AIstudy saves editor snapshot
  -> AIstudy updates node projection
```

Export:

```text
User exports .xmind
  -> MindMapCanvas getSnapshot()
  -> xmindAdapter calls ExportXMind path
  -> returns ArrayBuffer
  -> Electron main writes .xmind
```

Multi-sheet XMind:

- First implementation imports one selected sheet.
- If the source file has multiple sheets, show a sheet selection dialog.
- Store imported source metadata separately.

Lossy fields:

- Relationship lines, boundaries, summaries, images, styles, markers, and multiple sheets may need staged support.
- First version should preserve core tree, title, notes, links, and labels where possible.

## UI Scope For First Version

Build only the controls required for daily editing:

- create sibling node;
- create child node;
- edit node title;
- delete node;
- collapse/expand;
- undo/redo if available through editor command history;
- zoom in/out/reset;
- import `.xmind`;
- export `.xmind`;
- save snapshot;
- selected node detail link area.

Do not copy the full Vue app UI.

AIstudy should own its toolbar and side panels.

## Packaging Rule

Final product:

```text
release/AIstudy-Setup-*.exe
```

The installer contains one app.

Do not package:

```text
AIstudy.exe
MindMapEditor.exe
```

Do not require:

- separate XMind install;
- separate simple-mind-map desktop client;
- external local web server;
- runtime internet access for the editor.

## Implementation Milestones

### Milestone 1: Canvas Spike

- Install `simple-mind-map`.
- Create `MindMapCanvas.tsx`.
- Dynamically import the editor.
- Mount a root node.
- Verify create/edit/delete.
- Verify `getData(true)` and restore.
- Verify `destroy()` on unmount.

Success claim:

- One AIstudy renderer page can edit a local mind map and restore it from snapshot without memory leaking obvious editor instances.

### Milestone 2: AIstudy Binding

- Add `MindMapWorkspace.tsx`.
- Add selected node state.
- Add node projection traversal.
- Add debounced save.
- Add course/map switch lifecycle.

Success claim:

- Switching maps saves the old snapshot, destroys the old editor, loads the new map, and keeps selected node/document state correct.

### Milestone 3: XMind Compatibility

- Add `xmindAdapter.ts`.
- Add `.xmind` open IPC.
- Add `.xmind` export IPC.
- Add multi-sheet selection.
- Add sample import/export fixtures.

Success claim:

- A basic `.xmind` file imports into editable AIstudy map data and exports back to a `.xmind` file.

### Milestone 4: Memory/Performance Pass

- Add node-count thresholds.
- Add performance mode for large maps.
- Add ResizeObserver.
- Add save debounce and forced save guards.
- Confirm editor instance is destroyed on navigation.

Success claim:

- Large maps remain usable, and switching away from the editor releases the active canvas instance.

### Milestone 5: Reusable Module Extraction

- Move stable adapter/component code into an internal package if another exe/product needs it.
- Keep AIstudy-specific UI in the app.
- Keep editor contract stable.

Success claim:

- Another renderer app can consume the canvas module without launching a second exe.

## Risks

- `simple-mind-map` source-path imports may change between versions.
  - Mitigation: pin package version and isolate imports in adapter files.

- Rich text and image-heavy maps can inflate memory.
  - Mitigation: delay rich text, externalize images, avoid base64 storage.

- XMind compatibility may be partially lossy.
  - Mitigation: document supported fields and add fixture tests.

- Vue web app features may look tempting to copy wholesale.
  - Mitigation: use it as reference only; keep AIstudy UI native to React.

## Immediate Next Step

Build Milestone 1 as a spike:

```text
npm install simple-mind-map
create MindMapCanvas.tsx
mount editor with minimal plugins
verify snapshot save/restore
verify destroy lifecycle
```

After the spike proves the lifecycle and memory behavior, connect XMind import/export.
