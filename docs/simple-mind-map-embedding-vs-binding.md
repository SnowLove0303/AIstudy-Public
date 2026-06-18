# Simple Mind Map Embedding vs Binding

Date: 2026-06-15

## Question

Should AIstudy integrate `simple-mind-map` by embedding the library directly, or by binding the existing web app as a reusable packaged editor?

This matters because AIstudy may later need the same editor packaged and reused by more than one exe/product.

## What The Source Provides

`simple-mind-map` has three useful layers:

1. Library layer: `simple-mind-map/simple-mind-map`
   - NPM package: `simple-mind-map`
   - MIT license.
   - Framework-agnostic JS/SVG editor core.
   - Exposes instance APIs such as `setData`, `setFullData`, `getData(withConfig)`, `export(...)`, `resize`, `destroy`, `on/off`, `execCommand`, and plugin registration.
   - Includes XMind parser/export source:
     - `src/parse/xmind.js`
     - `src/plugins/ExportXMind.js`

2. Full-library entry: `simple-mind-map/full.js`
   - Registers many built-in plugins.
   - Attaches helpers such as `MindMap.xmind`, `MindMap.markdown`, icon list, constants, and themes.
   - Good for fast integration, less good for bundle control.

3. Web app layer: `simple-mind-map/web`
   - Vue 2 + ElementUI application.
   - Already has import/export dialogs, sidebars, toolbar, outline, theme UI, settings, local-file handling.
   - Has a host takeover mechanism through `window.takeOverApp` and `window.takeOverAppMethods`.
   - Build output exists under `simple-mind-map/dist` and is about 7 MB in the current checkout.

Approximate local source sizes:

- Library: about 1 MB, 87 files.
- Web source: about 9 MB, 444 files.
- Built web app: about 7 MB, 279 files.

## Option A: Direct Library Embedding

AIstudy imports `simple-mind-map` into the React renderer and wraps it with an AIstudy-owned React component.

```text
AIstudy React renderer
  -> MindMapCanvas React wrapper
    -> simple-mind-map library instance
    -> selected node / document binding
    -> AIstudy toolbar and side panels
  -> Electron IPC
    -> file open/save/export
    -> asset storage
    -> persistence
```

### Pros

- Best fit for AIstudy's Electron + React architecture.
- Direct access to map state through `getData` and `setData`.
- Easy to connect mind-map node ids to AIstudy documents, assets, review cards, and database projections.
- Avoids shipping Vue 2 and ElementUI inside the React app.
- Allows a consistent AIstudy UI instead of embedding another product's UI.
- Easier to package as a reusable internal module later:

```text
packages/mindmap-canvas
  -> wraps simple-mind-map
  -> exposes stable AIstudy editor APIs
  -> reused by AIstudy exe or future exe products
```

### Cons

- AIstudy must build its own toolbar, sidebars, dialogs, import/export UI, and settings panels.
- Some behavior in the Vue web app must be reimplemented or selectively copied as patterns.
- Some plugin imports may require path imports such as `simple-mind-map/src/plugins/ExportXMind.js`, which should be isolated in one adapter file.

### Packaging Impact

Best for a single polished exe.

For future reuse, do not scatter raw `simple-mind-map` calls through UI components. Put all direct integration in one package or folder:

```text
src/renderer/features/mindmap/vendor/simpleMindMapAdapter.ts
src/renderer/features/mindmap/MindMapCanvas.tsx
src/renderer/features/mindmap/xmindImportExport.ts
```

If reuse becomes real across multiple executables, move that folder into:

```text
packages/aistudy-mindmap-canvas
```

Then AIstudy consumes it like an internal package.

## Option B: Bind The Existing Web App As A Sub-App

AIstudy packages `simple-mind-map/dist` as static assets and loads it in an isolated BrowserWindow, iframe, or webview-like container. AIstudy provides host methods through preload/global bridge, matching the web app's existing takeover hooks:

```text
window.takeOverApp = true
window.takeOverAppMethods = {
  getMindMapData,
  saveMindMapData,
  getMindMapConfig,
  saveMindMapConfig,
  getLanguage,
  saveLanguage,
  getLocalConfig,
  saveLocalConfig
}
window.initApp()
```

### Pros

- Fastest way to reuse the almost-complete editor UI.
- Better if the goal is to package the editor as an independent reusable module/program.
- The web app already includes toolbars, sidebars, import/export dialogs, outline, theme editing, settings, and local file logic.
- Lower initial UI implementation cost.

### Cons

- Pulls a Vue 2 + ElementUI application into a React/Electron product.
- AIstudy has less control over interaction design, keyboard handling, layout, and lifecycle.
- State synchronization becomes message/bridge based rather than direct.
- Harder to deeply bind node selection to AIstudy documents and database state.
- Harder to make a seamless two-pane learning workspace where map node and document editor cooperate.
- Debugging crosses two app runtimes and two UI frameworks.
- The sub-app may use browser file APIs and localStorage assumptions that need to be overridden.

### Packaging Impact

Good if the editor must be a reusable "editor appliance" shared by multiple programs with minimal integration.

Suggested shape:

```text
electron resources
  /mindmap-editor-app
    index.html
    css/*
    js/*
    img/*

AIstudy host
  -> opens editor app route/window
  -> injects takeover bridge
  -> receives save/export events
```

This is closer to "binding" a packaged tool than embedding a component.

## Option C: External Sidecar Program Binding

Ship another desktop editor exe and launch it from AIstudy.

Not recommended.

It makes persistence, document-node linking, single-window UX, and packaging much harder. It also creates an update/versioning problem across two executables.

## Option D: Vendored/Forked Source Embedding

Copy or submodule the `simple-mind-map` library source into AIstudy and patch it directly.

Use only if the npm package cannot support required fixes.

Pros:

- Maximum patch control.
- Can freeze an exact version.

Cons:

- Harder upstream updates.
- More maintenance burden.
- More license notice and source tracking responsibility.

Preferred fallback:

1. Start with npm package.
2. Add a tiny adapter layer.
3. If patching is needed, use `patch-package` or a local fork.
4. Only vendor the source if patches become large.

## Recommendation

Use direct library embedding for AIstudy's main editor.

But design it as a reusable internal package from the start:

```text
AIstudy app
  -> packages/aistudy-mindmap-canvas
    -> simple-mind-map adapter
    -> XMind import/export adapter
    -> React canvas component
    -> stable event/data API
```

This gives us:

- deep integration with AIstudy's course/node/document model;
- clean Electron packaging;
- future reuse across another exe without binding to the whole Vue app;
- control over UI and data contracts.

Use web-app binding only as a spike or emergency shortcut.

## Concrete Integration Contract

The reusable canvas package should expose a small API:

```ts
type MindMapCanvasHandle = {
  getSnapshot(): MindMapSnapshot
  setSnapshot(snapshot: MindMapSnapshot): void
  importXmind(file: File): Promise<MindMapSnapshot>
  exportXmind(name: string): Promise<ArrayBuffer>
  resize(): void
  destroy(): void
}
```

Event contract:

```ts
type MindMapCanvasEvents = {
  onSnapshotChanged(snapshot: MindMapSnapshot): void
  onNodeSelected(nodeId: string | null): void
  onNodeChanged(nodeId: string): void
  onStructureChanged(snapshot: MindMapSnapshot): void
}
```

AIstudy should store:

- full editor snapshot from `getData(true)`;
- normalized node projection for search/document linking;
- selected node id;
- XMind import/export metadata separately from core course data.

## First Spike Plan

1. Install `simple-mind-map`.
2. Create a React wrapper that mounts one map and destroys it on unmount.
3. Use direct library embedding, not web-app binding, for the first product path.
4. Register only the needed plugins:
   - `Drag`
   - `Select`
   - `KeyboardNavigation`
   - `Export`
   - `ExportXMind`
   - `RichText` only if needed immediately
   - `Search` later
   - `MiniMap` later
5. Add one adapter file for XMind import/export so source-path imports are isolated.
6. Verify:
   - create/edit/delete nodes;
   - get snapshot;
   - restore snapshot;
   - import `.xmind`;
   - export `.xmind`;
   - package with electron-builder.

## Decision Rule

Choose library embedding when:

- AIstudy needs deep node/document/database integration.
- UI must match AIstudy.
- The editor is part of one cohesive app.

Choose web-app binding when:

- we need a nearly complete standalone editor immediately;
- the editor is meant to be reused as a mostly independent app;
- bridge-based save/load is enough;
- AIstudy does not need fine-grained node-level integration.

For the current AIstudy goal, library embedding is the better default.
