# XMind Open Source Embedding Research

Date: 2026-06-15

## Executive Decision

Do not embed the old XMind desktop application directly into AIstudy.

AIstudy is an Electron + React + TypeScript exe. The usable XMind open-source path for this project is:

1. Use a web-native mind-map editor as the editing surface.
2. Use official XMind MIT packages for `.xmind` import/export/preview.
3. Treat old XMind 3 Java/Eclipse source as format and feature reference only.

This keeps the exe lightweight, avoids shipping a second Java/Eclipse desktop runtime inside Electron, and fits the current architecture boundary in `docs/ARCHITECTURE.md`.

## Source Inventory

### Old Full Client: XMind 3

- Source: https://github.com/juliuskunze/xmind
- Origin: automatic export from `code.google.com/p/xmind3`
- Language/runtime: Java, Eclipse RCP, SWT, Eclipse GEF
- License: dual licensed EPL 1.0 / LGPL 3.0 according to repository README
- Local research copy: `.tmp/research/xmind3`

Important repository note: the source pack does not include required Eclipse plug-ins. Building it requires downloading XMind/Eclipse plug-in dependencies.

This is the closest thing to an open-source full XMind client, but it is not a good direct embedding target for this Electron app.

### Official JavaScript/TypeScript Components

- `xmind`: https://github.com/xmindltd/xmind-sdk-js
  - npm: `xmind@2.2.33`
  - License: MIT
  - Purpose: build `.xmind` workbooks in Node.js/browser-like contexts.
  - Local research copy: `.tmp/research/xmind-sdk-js`

- `xmind-generator`: https://github.com/xmindltd/xmind-generator
  - npm: `xmind-generator@1.0.1`
  - License: MIT
  - Purpose: modern API for generating `.xmind` files.
  - Local research copy: `.tmp/research/xmind-generator`

- `xmind-viewer`: https://github.com/xmindltd/xmind-viewer
  - npm: `xmind-viewer@1.1.2`
  - License: MIT
  - Purpose: parse `.xmind` and render SVG.
  - Local research copy: `.tmp/research/xmind-viewer`

- `xmind-embed-viewer`: https://github.com/xmindltd/xmind-embed-viewer
  - npm: `xmind-embed-viewer@1.2.0`
  - License: MIT
  - Purpose: load `.xmind` as `ArrayBuffer` and present it in a browser container/iframe.
  - Local research copy: `.tmp/research/xmind-embed-viewer`

## Functional Architecture: Old XMind 3

Old XMind 3 is structured as Eclipse OSGi bundles:

- Application/workbench
  - `org.xmind.cathy`
  - `org.xmind.cathy.win32`
  - `net.xmind.workbench`
  - Owns desktop shell, workbench integration, platform startup, and Windows integration.

- Core model and file system
  - `org.xmind.core`
  - `org.xmind.core.io`
  - `org.xmind.core.runtime`
  - Main abstractions include `IWorkbook`, `ISheet`, `ITopic`, `IRelationship`, `IBoundary`, `ISummary`, notes, markers, styles, manifest entries, revisions, resources, and encryption data.

- Command system
  - `org.xmind.core.command`
  - `org.xmind.core.command.remote`
  - `org.xmind.core.command.remote.lan`
  - Provides undoable command-style changes and remote/local-network command transport.

- Graphical editing framework
  - `org.xmind.gef`
  - `org.xmind.gef.ui`
  - Provides canvas/edit-part/tool abstractions around Eclipse graphical editing.

- Mind-map UI and editing
  - `org.xmind.ui`
  - `org.xmind.ui.mindmap`
  - `org.xmind.ui.fishbone`
  - `org.xmind.ui.spreadsheet`
  - `org.xmind.ui.toolkit`
  - Provides decorations, branch structures, commands, import/export wizards, title editing tools, selection/move tools, relationship/boundary/summary commands, markers, labels, images, notes, numbering, and layout variants.

- Import/export and integrations
  - `org.xmind.ui.imports`
  - `org.xmind.ui.evernote`
  - `org.xmind.ui.browser`
  - `org.xmind.ui.sharing`
  - `org.xmind.core.sharing.localnetwork`
  - Plus bundled third-party libraries for Evernote, OAuth, JSON, spell checking, thumbnails, BouncyCastle, and Bonjour/DNSSD.

High-level model:

```text
Workbench/Application
  -> Mind Map UI
    -> GEF canvas/editing tools
    -> Branch layout/decorations/commands
  -> Core model
    -> Workbook
      -> Sheets
        -> Topics
        -> Relationships
        -> Boundaries
        -> Summaries
        -> Notes, labels, markers, images
    -> Styles, marker sheets, manifest/resources
  -> Core IO
    -> Directory/zip-like storage
    -> import/export targets
```

## Functional Architecture: Official JS/TS Path

Recommended AIstudy integration layers:

```text
React renderer
  -> Mind map editor component
    -> AIstudy internal mind-map model
    -> editing, selection, shortcuts, toolbar
  -> XMind preview component
    -> xmind-embed-viewer or xmind-viewer
    -> read-only SVG/iframe preview

Electron main
  -> file dialogs and local file IO
  -> import `.xmind` as ArrayBuffer
  -> export `.xmind` from AIstudy model
  -> optional image/SVG export pipeline

Domain conversion layer
  -> AIstudy node tree <-> XMind workbook/topic tree
  -> preserve stable node ids where possible
  -> map notes, labels, markers, relationships, summaries as progressive enhancements
```

Package roles:

- Use `xmind-generator` for new `.xmind` export from AIstudy data.
- Use `xmind` SDK if lower-level workbook APIs are needed.
- Use `xmind-embed-viewer` for quick read-only in-app preview.
- Use `xmind-viewer` if we need direct SVG control instead of iframe/container viewer behavior.

## Embedding Options

### Option A: Practical Electron Integration

Use a web-native editor for editing and official XMind packages for compatibility.

Pros:

- Fits current Electron/React architecture.
- MIT license for XMind JS packages.
- No Java runtime or Eclipse RCP packaging.
- Works with electron-builder.
- Keeps `.xmind` compatibility as import/export rather than forcing old desktop UI.

Cons:

- Not a full clone of XMind desktop UI.
- Need a conversion layer between editor data and XMind workbook/topic data.
- Some advanced XMind features may be import-only or lossy at first.

Recommended.

### Option B: Embed Old XMind 3 as External/Sidecar App

Package old XMind 3 or a rebuilt Eclipse RCP app as a sidecar process launched from AIstudy.

Pros:

- Closest to full old XMind behavior.

Cons:

- Heavy runtime.
- Build dependencies are incomplete in the source pack.
- Awkward UX inside an Electron exe.
- Hard to integrate with React state, MySQL persistence, and AIstudy node/document linking.
- EPL/LGPL obligations are more complex than MIT packages.

Not recommended unless the requirement is specifically to ship the old XMind app.

### Option C: Port Old XMind Java UI to TypeScript

Use XMind 3 source as a blueprint and rewrite the editor in React/canvas/SVG.

Pros:

- Full control.

Cons:

- Large rewrite.
- Duplicates work already assigned to a mind-map library in the project architecture.
- High risk and long schedule.

Not recommended.

## Minimum Viable Implementation Plan

1. Add an `xmind-compat` domain module.
2. Add an importer that reads `.xmind` files into an intermediate tree model.
3. Convert the intermediate tree into AIstudy mind-map data.
4. Add an exporter from AIstudy mind-map data to `.xmind` using `xmind-generator`.
5. Add a read-only preview route/component with `xmind-embed-viewer`.
6. Add fixture tests with a small `.xmind` sample.
7. Document lossy fields for the first release.

## Feature Mapping

First release:

- Root topic
- Child topics
- Topic title
- Topic notes
- Labels/tags if available
- Basic markers if available
- Multi-sheet read support
- Export one active sheet

Second release:

- Relationships
- Boundaries
- Summaries
- Images/attachments
- Multiple sheets export
- Theme/style mapping
- SVG/image export

Defer:

- XMind account/share integration
- Evernote integration
- LAN sharing/remote command service
- Full old XMind desktop workbench behavior
- Encrypted workbook editing, unless explicitly needed

## License Notes

- Old XMind 3 code: EPL 1.0 / LGPL 3.0 dual license in the exported repository README. Treat as copyleft code and keep it out of the proprietary/app core unless legal obligations are accepted.
- Official JS packages: MIT according to npm metadata and repository package files.
- XMind name/branding may still be trademarked even when code packages are MIT. Use wording like "XMind-compatible import/export" in AIstudy UI instead of presenting AIstudy as XMind itself.

This is not legal advice; it is engineering risk classification.

## Recommendation

For AIstudy, implement XMind compatibility, not XMind desktop embedding.

The clean route is:

```text
AIstudy editor data
  <-> xmind-compat converter
  <-> official MIT XMind generator/viewer packages
  <-> .xmind files
```

This gives users the practical value they probably want: open/export XMind files inside the exe, without turning the app into a fragile Java/Eclipse-in-Electron bundle.
