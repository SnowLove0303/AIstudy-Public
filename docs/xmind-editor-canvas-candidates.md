# XMind-Compatible Editor Canvas Candidates

Date: 2026-06-15

## Goal

Find an open-source editor canvas that can run inside AIstudy's Electron exe and support XMind-style mind-map editing.

The practical meaning of "XMind editing" in an Electron app is:

1. Import `.xmind` into an editable web mind-map model.
2. Edit the map inside the exe.
3. Save AIstudy's own model for app persistence.
4. Export back to `.xmind` when the user needs file compatibility.

Directly editing the binary/zip `.xmind` package as the live document format is not recommended.

## Best Candidate: `simple-mind-map`

- Repository: https://github.com/wanglin2/mind-map
- NPM: `simple-mind-map@0.14.0-fix.2`
- License: MIT
- Local research copy: `.tmp/research/simple-mind-map`
- Tech: framework-agnostic JavaScript/SVG library, plus a Vue 2 web app demo/product.

Why it matches AIstudy:

- The open-source library is framework-agnostic and can be mounted inside React.
- It already has XMind parser/export logic in source:
  - `simple-mind-map/src/parse/xmind.js`
  - `simple-mind-map/src/plugins/ExportXMind.js`
- It supports modern XMind `content.json` and legacy XMind 8 `content.xml`.
- It supports a broad set of editor features: drag, zoom, shortcuts, themes, rich text, notes, tags, links, summaries, relationships/associative lines, outline-style side panels through the web app, minimap, search, export.
- Its own public README says the downloadable desktop client supports Windows/Mac/Linux and supports XMind import/export.

Important caveat:

- The author's desktop client code is not open source. The open-source pieces are the JS library and web app.
- That is still enough for AIstudy because AIstudy already has its own Electron shell. We only need the canvas/editor library, not their closed desktop shell.

Suggested integration shape:

```text
React MindMapWorkspace
  -> SimpleMindMap instance
  -> selected node sync
  -> AIstudy toolbar/sidebar
  -> Electron IPC file open/save/export

simple-mind-map parser/export
  -> import .xmind to SimpleMindMap tree
  -> export SimpleMindMap tree to .xmind

AIstudy domain
  -> store normalized node projection
  -> store full map snapshot
  -> link nodes to knowledge documents
```

Implementation notes:

- Prefer using `simple-mind-map` as a library instead of copying its web app.
- Register only the plugins we need for the first milestone to keep bundle size controlled.
- Test import/export with both modern `.xmind` and XMind 8 files.
- The web app is Vue 2 and ElementUI, so it should be used as behavior reference, not copied into React.

## Strong Alternative: `mind-elixir`

- Repository: https://github.com/SSShooter/mind-elixir-core
- NPM: `mind-elixir@5.12.2`
- License: MIT
- Local research copy: `.tmp/research/mind-elixir-core`
- Tech: framework-agnostic TypeScript/DOM/SVG mind-map core.

XMind compatibility packages:

- Import: https://github.com/mind-elixir/import-xmind
  - NPM: `@mind-elixir/import-xmind@1.0.8`
  - Purpose: import modern XMind JSON, legacy XMind XML, and FreeMind files into MindElixir format.
  - Local research copy: `.tmp/research/mind-elixir-import-xmind`

- Export: https://github.com/SSShooter/export-xmind
  - NPM: `@mind-elixir/export-xmind@2.0.1`
  - Purpose: export MindElixir data to `.xmind`.
  - Local research copy: `.tmp/research/mind-elixir-export-xmind`

Why it is attractive:

- Very easy to embed in React/Electron.
- Clean TypeScript package.
- Has plugin-style XMind import/export.
- Smaller, cleaner integration surface than `simple-mind-map`.

Concerns:

- Feature depth appears narrower than `simple-mind-map` for XMind-like advanced editing.
- XMind import/export is split across small packages and should be tested for current `mind-elixir@5.x` compatibility.
- Desktop product exists, but the release repository is not a full open-source desktop app source tree.

Suggested use:

- Use this if AIstudy wants a simpler first canvas quickly.
- Use `simple-mind-map` if AIstudy wants richer XMind-like feature coverage from day one.

## Other Candidates

### WiseMapping

- Repository: https://github.com/wisemapping/wisemapping-open-source
- Open-source web mind-mapping platform.
- Supports import from XMind according to README/search results.
- Built as a larger web/collaboration application rather than a lightweight embeddable React canvas.

Not recommended for AIstudy's first embedded editor because it brings a heavier app/server-style architecture.

### BlinkMindDesktop

- Repository: https://github.com/awehook/blink-mind-desktop
- Electron + React desktop mind-map/outliner.
- MIT.
- Good reference for desktop UX, multi-sheet documents, outline mode, image export, search, tags, rich text notes.

Not recommended as the XMind-compatible canvas because no direct XMind import/export support was found in the core feature list.

### XMind 3 Old Java Client

- Repository: https://github.com/juliuskunze/xmind
- Java/Eclipse RCP/SWT.
- Feature-rich old XMind codebase.

Not recommended for Electron embedding. Keep as historical/reference source only.

## Recommendation

Use `simple-mind-map` for AIstudy's exe-internal XMind-compatible editing canvas.

Reason:

- It is the closest match to the remembered "editor that supports exe/internal XMind editing": the project has an open web library and a separate desktop client, while the open code already includes `.xmind` import/export logic.
- It supports more XMind-like editor features than the lighter alternatives.
- It can be embedded inside the existing Electron + React app without adopting another desktop shell.

Fallback:

- If `simple-mind-map` integration proves too heavy or awkward in React, use `mind-elixir` plus `@mind-elixir/import-xmind` and `@mind-elixir/export-xmind` for a lean first version.

## First Spike

1. Install `simple-mind-map`.
2. Create `MindMapCanvas.tsx` with a fixed full-viewport editor mount.
3. Initialize one root node and basic toolbar actions.
4. Wire `getData()`/snapshot save in renderer state first.
5. Add Electron file-open IPC for `.xmind`.
6. Feed selected `.xmind` into `simple-mind-map/src/parse/xmind.js`.
7. Export through `ExportXMind`.
8. Verify in dev and packaged exe.
