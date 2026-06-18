# Importer Module

## Scope

Importer is the only renderer module that owns file-driven import UI and parsing previews.

Current version:

- Drag-and-drop modal import.
- `.txt`, `.md`, `.markdown`, `.docx` parsing.
- Import into the current mind-map node's Word document.

Planned later:

- XMind import.
- Course package import/export.
- Batch folder import.
- MCP import entry.

Related maintenance scripts:

- `scripts/importers/import-docx-to-node-documents.mjs` handles OCR-heavy DOCX batch import into existing mind-map nodes.

## Boundaries

- Importer must not write MySQL directly.
- Importer must not update course, mind-map, or document storage by itself.
- Importer produces an `ImportPackage` and a target snapshot, then the caller commits through the existing save service.
- Importer must not store large binary/base64 data in mind-map or Word JSON.
- Importer UI should stay compact and user-facing; technical errors belong in the error-log layer.

## User Flow

1. User clicks Import from the current workspace.
2. User drops or selects a file.
3. Importer parses and shows a compact preview.
4. User confirms.
5. Caller saves through the existing document save path.

## Extension Rule

Every new parser must convert its output into `ImportPackage` first. Do not create one-off save logic for a specific file format.

For scan/OCR documents, the importer must remove obvious non-content text such as page numbers, repeated page headers, duplicated OCR fragments, "续表" headers, and exam-tip noise before matching headings.
